import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { COD_PAYMENT_PROVIDER } from '../orders/checkout-payment-method';
import { PrismaService } from '../prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { MobileMoneyMethod } from './paydunya/payment-methods';
import { PaydunyaClient } from './paydunya/paydunya.client';
import { PaydunyaWebhookPayload } from './paydunya/paydunya.types';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paydunya: PaydunyaClient,
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {}

  async initiate(dto: InitiatePaymentDto, userId?: string) {
    const { order, payment, token } = await this.ensurePaymentSession(
      dto.orderNumber,
      userId,
      dto.email,
    );

    return {
      paymentId: payment.id,
      amount: order.total.toNumber(),
      currency: 'XOF',
      invoiceReady: Boolean(token),
    };
  }

  async process(dto: ProcessPaymentDto, userId?: string) {
    if (!this.paydunya.isConfigured) {
      throw new BadRequestException(
        'Paiement en ligne non configuré. Contactez le support ou réessayez plus tard.',
      );
    }

    if (dto.method === MobileMoneyMethod.ORANGE && !dto.otp?.trim()) {
      throw new BadRequestException('Le code OTP Orange Money est requis');
    }

    const { order, payment, token } = await this.ensurePaymentSession(
      dto.orderNumber,
      userId,
      dto.email,
    );

    const phone = dto.phone.replace(/\s/g, '');

    const result = await this.executeSoftPay(dto.method, {
      fullName: dto.fullName,
      email: dto.customerEmail,
      phone,
      otp: dto.otp,
      paymentToken: token,
    });

    if (!result.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw new BadRequestException(result.message || 'Le paiement a échoué');
    }

    if (result.url) {
      this.logger.log(`Payment redirect: order=${order.orderNumber} method=${dto.method}`);
      return {
        action: 'redirect' as const,
        redirectUrl: result.url,
        message: 'Finalisez le paiement sur votre application Wave',
      };
    }

    const confirmed = await this.paydunya.confirmInvoice(token);

    if (confirmed.status === 'completed') {
      await this.markPaymentCompleted(payment.id, order.id);
      return {
        action: 'completed' as const,
        message: result.message || 'Paiement confirmé avec succès',
      };
    }

    this.logger.log(`Payment pending: order=${order.orderNumber} method=${dto.method}`);
    return {
      action: 'pending' as const,
      message:
        result.message ||
        'Validez le paiement sur votre téléphone. Cette page se met à jour automatiquement.',
    };
  }

  async getStatus(orderNumber: string, userId?: string, email?: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    this.assertOrderAccess(order, userId, email);

    const payment = order.payments[0];

    return {
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      payment: payment
        ? {
            id: payment.id,
            provider: payment.provider,
            status: payment.status,
            amount: payment.amount.toNumber(),
            currency: payment.currency,
            paidAt: payment.paidAt,
          }
        : null,
    };
  }

  async confirmCodPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });

    if (!payment) {
      throw new NotFoundException('Paiement introuvable');
    }

    if (payment.provider !== COD_PAYMENT_PROVIDER) {
      throw new BadRequestException('Ce paiement n\'est pas un paiement à la livraison');
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return {
        id: payment.id,
        provider: payment.provider,
        status: payment.status,
        amount: payment.amount.toNumber(),
        currency: payment.currency,
        paidAt: payment.paidAt,
      };
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      },
    });

    return {
      id: updated.id,
      provider: updated.provider,
      status: updated.status,
      amount: updated.amount.toNumber(),
      currency: updated.currency,
      paidAt: updated.paidAt,
    };
  }

  async handleWebhook(rawBody: Record<string, unknown>) {
    const payload = this.parseWebhookPayload(rawBody);

    if (!this.paydunya.verifyWebhookHash(payload.hash)) {
      this.logger.warn('PayDunya webhook rejected: invalid hash');
      throw new UnauthorizedException('Signature webhook invalide');
    }

    const invoiceToken = payload.invoice?.token;
    const orderId = payload.custom_data?.order_id;
    const status = payload.status?.toLowerCase();

    if (!invoiceToken || !orderId) {
      this.logger.warn('PayDunya webhook missing token or order_id');
      throw new BadRequestException('Payload webhook incomplet');
    }

    const eventExternalId = `paydunya:${invoiceToken}:${status}`;

    try {
      await this.prisma.paymentEvent.create({
        data: {
          externalId: eventExternalId,
          payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        this.logger.log(`PayDunya webhook duplicate ignored: ${eventExternalId}`);
        return { received: true, duplicate: true };
      }
      throw error;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { externalId: invoiceToken, orderId },
      include: { order: true },
    });

    if (!payment) {
      this.logger.warn(`PayDunya webhook: payment not found for token ${invoiceToken}`);
      return { received: true, processed: false };
    }

    if (status === 'completed') {
      const confirmed = await this.paydunya.confirmInvoice(invoiceToken);

      if (confirmed.status !== 'completed') {
        this.logger.warn(
          `PayDunya confirm mismatch: webhook=completed confirm=${confirmed.status}`,
        );
        return { received: true, processed: false };
      }

      const webhookAmount = payload.total_amount ?? confirmed.total_amount;
      const orderTotal = payment.order.total.toNumber();

      if (webhookAmount !== undefined && webhookAmount !== orderTotal) {
        this.logger.error(
          `PayDunya amount mismatch: expected=${orderTotal} received=${webhookAmount}`,
        );
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED },
        });
        throw new BadRequestException('Montant de paiement incorrect');
      }

      await this.prisma.paymentEvent.update({
        where: { externalId: eventExternalId },
        data: { paymentId: payment.id },
      });

      await this.markPaymentCompleted(payment.id, orderId);

      this.logger.log(`PayDunya payment completed: order=${payment.order.orderNumber}`);
      return { received: true, processed: true };
    }

    if (status === 'cancelled' || status === 'failed') {
      const paymentStatus =
        status === 'cancelled' ? PaymentStatus.CANCELLED : PaymentStatus.FAILED;

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: paymentStatus },
        });

        await tx.paymentEvent.update({
          where: { externalId: eventExternalId },
          data: { paymentId: payment.id },
        });
      });

      this.logger.log(
        `PayDunya payment ${status}: order=${payment.order.orderNumber}`,
      );
    }

    return { received: true, processed: true };
  }

  private async ensurePaymentSession(orderNumber: string, userId?: string, email?: string) {
    if (!this.paydunya.isConfigured) {
      throw new BadRequestException(
        'Paiement en ligne non configuré. Contactez le support ou réessayez plus tard.',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    this.assertOrderAccess(order, userId, email);

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Cette commande ne peut plus être payée en ligne');
    }

    const existingPayment = order.payments[0];
    if (existingPayment?.status === PaymentStatus.COMPLETED) {
      throw new BadRequestException('Cette commande est déjà payée');
    }

    if (existingPayment?.externalId && existingPayment.status === PaymentStatus.PENDING) {
      return {
        order,
        payment: existingPayment,
        token: existingPayment.externalId,
      };
    }

    const totalAmount = order.total.toNumber();
    const apiUrl = this.config.get<string>('API_URL', 'http://localhost:3001');
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const invoice = await this.paydunya.createInvoice({
      totalAmount,
      description: `Commande ${order.orderNumber} — Kaniê`,
      customData: {
        order_id: order.id,
        order_number: order.orderNumber,
      },
      actions: {
        callback_url: `${apiUrl}/api/payments/webhook`,
        return_url: `${frontendUrl}/commande/${order.orderNumber}/paiement?status=success`,
        cancel_url: `${frontendUrl}/commande/${order.orderNumber}/paiement?status=cancelled`,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: order.total,
        externalId: invoice.token,
        status: PaymentStatus.PENDING,
      },
    });

    this.logger.log(`Payment session created: order=${order.orderNumber}`);

    return { order, payment, token: invoice.token };
  }

  private async executeSoftPay(
    method: MobileMoneyMethod,
    params: {
      fullName: string;
      email: string;
      phone: string;
      otp?: string;
      paymentToken: string;
    },
  ) {
    switch (method) {
      case MobileMoneyMethod.WAVE:
        return this.paydunya.payWaveCi(params);
      case MobileMoneyMethod.ORANGE:
        return this.paydunya.payOrangeMoneyCi({ ...params, otp: params.otp! });
      case MobileMoneyMethod.MTN:
        return this.paydunya.payMtnCi(params);
      case MobileMoneyMethod.MOOV:
        return this.paydunya.payMoovCi(params);
      default:
        throw new BadRequestException('Moyen de paiement non supporté');
    }
  }

  private async markPaymentCompleted(paymentId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== OrderStatus.PENDING) return;

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.COMPLETED, paidAt: new Date() },
    });

    await this.ordersService.confirmOrderPayment(orderId, 'Paiement mobile confirmé');
  }

  private parseWebhookPayload(body: Record<string, unknown>): PaydunyaWebhookPayload {
    const rawData = body.data;

    if (typeof rawData === 'string') {
      return JSON.parse(rawData) as PaydunyaWebhookPayload;
    }

    if (rawData && typeof rawData === 'object') {
      return rawData as PaydunyaWebhookPayload;
    }

    return body as unknown as PaydunyaWebhookPayload;
  }

  private assertOrderAccess(
    order: { userId: string | null; customerEmail: string },
    userId?: string,
    email?: string,
  ) {
    if (userId && order.userId === userId) return;
    if (email && order.customerEmail.toLowerCase() === email.toLowerCase()) return;
    if (!userId && !email) {
      throw new ForbiddenException('Email requis pour accéder à ce paiement');
    }
    throw new ForbiddenException('Accès non autorisé à cette commande');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
