import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus, Order, OrderStatus, ProductReservation } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_JOB_OPTIONS,
  EMAIL_QUEUE,
  EmailTemplate,
  ORDER_STATUS_EMAIL,
  ORDER_STATUS_WHATSAPP,
  RESERVATION_STATUS_EMAIL,
  WHATSAPP_QUEUE,
  WhatsappTemplate,
} from './notifications.constants';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
    @InjectQueue(WHATSAPP_QUEUE) private readonly whatsappQueue: Queue,
  ) {}

  async notifyOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const emailConfig = ORDER_STATUS_EMAIL[status];
    const whatsappTemplate = ORDER_STATUS_WHATSAPP[status];

    if (!emailConfig && !whatsappTemplate) return;

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    const context = this.buildOrderContext(order);
    const params = [order.customerName, order.orderNumber];

    // WhatsApp first when phone is available; email only as fallback in WhatsappProcessor
    if (whatsappTemplate && order.customerPhone) {
      await this.enqueueWhatsapp(order, whatsappTemplate, params);
    } else if (emailConfig) {
      await this.enqueueEmail(order, emailConfig.template, emailConfig.subject, context);
    }
  }

  async notifyPasswordReset(userId: string, email: string, resetUrl: string): Promise<void> {
    const log = await this.prisma.notificationLog.create({
      data: {
        userId,
        channel: NotificationChannel.EMAIL,
        template: 'password-reset',
        recipient: email,
        status: NotificationStatus.PENDING,
      },
    });

    await this.emailQueue.add(
      'password-reset',
      {
        logId: log.id,
        template: 'password-reset' as EmailTemplate,
        to: email,
        subject: 'Réinitialisation de mot de passe — Kaniê',
        context: { resetUrl },
      },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async notifyEmailVerification(
    userId: string,
    email: string,
    verifyUrl: string,
    firstName: string,
  ): Promise<void> {
    const log = await this.prisma.notificationLog.create({
      data: {
        userId,
        channel: NotificationChannel.EMAIL,
        template: 'email-verification',
        recipient: email,
        status: NotificationStatus.PENDING,
      },
    });

    await this.emailQueue.add(
      'email-verification',
      {
        logId: log.id,
        template: 'email-verification' as EmailTemplate,
        to: email,
        subject: 'Confirmez votre compte Kaniê',
        context: { verifyUrl, firstName },
      },
      DEFAULT_JOB_OPTIONS,
    );
  }

  async getOrderNotifications(orderId: string) {
    return this.prisma.notificationLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        channel: true,
        template: true,
        recipient: true,
        status: true,
        error: true,
        sentAt: true,
        createdAt: true,
      },
    });
  }

  async notifyReservationReceived(reservation: ProductReservation): Promise<void> {
    await this.notifyReservation(reservation, 'PENDING');
  }

  async notifyReservationStatusChange(reservation: ProductReservation): Promise<void> {
    await this.notifyReservation(reservation, reservation.status);
  }

  private async notifyReservation(
    reservation: ProductReservation,
    status: keyof typeof RESERVATION_STATUS_EMAIL,
  ): Promise<void> {
    const emailConfig = RESERVATION_STATUS_EMAIL[status];
    if (!emailConfig) return;

    const context = this.buildReservationContext(reservation);
    const whatsappText = this.buildReservationWhatsappText(reservation, status);

    if (reservation.phone) {
      await this.enqueueReservationWhatsapp(reservation, whatsappText, emailConfig, context);
    } else {
      await this.enqueueReservationEmail(reservation, emailConfig.template, emailConfig.subject, context);
    }
  }

  private async enqueueReservationEmail(
    reservation: ProductReservation,
    template: EmailTemplate,
    subject: string,
    context: Record<string, unknown>,
  ) {
    const log = await this.prisma.notificationLog.create({
      data: {
        userId: reservation.userId,
        channel: NotificationChannel.EMAIL,
        template,
        recipient: reservation.email,
        status: NotificationStatus.PENDING,
      },
    });

    await this.emailQueue.add(
      template,
      { logId: log.id, template, to: reservation.email, subject, context },
      DEFAULT_JOB_OPTIONS,
    );

    this.logger.log(`Reservation email queued: ${template} product=${reservation.productName}`);
  }

  private async enqueueReservationWhatsapp(
    reservation: ProductReservation,
    text: string,
    emailConfig: { template: EmailTemplate; subject: string },
    context: Record<string, unknown>,
  ) {
    const phone = reservation.phone!;

    const log = await this.prisma.notificationLog.create({
      data: {
        userId: reservation.userId,
        channel: NotificationChannel.WHATSAPP,
        template: emailConfig.template,
        recipient: phone,
        status: NotificationStatus.PENDING,
      },
    });

    await this.whatsappQueue.add(
      'reservation-status',
      {
        logId: log.id,
        phone,
        text,
        fallbackEmail: {
          template: emailConfig.template,
          subject: emailConfig.subject,
          context,
          to: reservation.email,
          userId: reservation.userId,
        },
      },
      DEFAULT_JOB_OPTIONS,
    );

    this.logger.log(`Reservation WhatsApp queued: product=${reservation.productName}`);
  }

  private buildReservationContext(reservation: ProductReservation): Record<string, unknown> {
    const budget = reservation.estimatedBudget?.toNumber();
    const discount = reservation.offeredDiscount;
    const discountedAmount =
      budget != null && discount != null && discount > 0
        ? Math.round(budget * (1 - discount / 100))
        : null;

    return {
      customerName: reservation.fullName,
      productName: reservation.productName,
      statusLabel: this.getReservationStatusLabel(reservation.status),
      budget: budget != null ? this.formatFcfa(budget) : null,
      discount,
      discountedPrice: discountedAmount != null ? this.formatFcfa(discountedAmount) : null,
      adminNote: reservation.adminNote,
    };
  }

  private formatFcfa(amount: number): string {
    return `${Math.round(amount).toLocaleString('fr-CI')} FCFA`;
  }

  private buildReservationWhatsappText(
    reservation: ProductReservation,
    status: keyof typeof RESERVATION_STATUS_EMAIL,
  ): string {
    const statusLabel = this.getReservationStatusLabel(status);
    const budget = reservation.estimatedBudget?.toNumber();
    const discount = reservation.offeredDiscount;
    const discountedAmount =
      budget != null && discount != null && discount > 0
        ? Math.round(budget * (1 - discount / 100))
        : null;

    let discountLine = '';
    if (discount != null && discount > 0) {
      discountLine = discountedAmount != null
        ? ` Réduction : ${discount}%. Nouveau montant : ${this.formatFcfa(discountedAmount)}.`
        : ` Réduction proposée : ${discount}%.`;
    }

    const messages: Record<string, string> = {
      PENDING: `Bonjour ${reservation.fullName}, votre demande de réservation pour « ${reservation.productName} » a bien été reçue. Notre équipe vous recontactera sous 48h. En réservant, vous pourriez bénéficier d'une réduction selon le montant de l'article.`,
      APPROVED: `Bonjour ${reservation.fullName}, bonne nouvelle ! Votre réservation pour « ${reservation.productName} » est approuvée.${discountLine} Notre équipe vous contactera pour finaliser.`,
      REJECTED: `Bonjour ${reservation.fullName}, nous ne pouvons pas honorer votre réservation pour « ${reservation.productName} » pour le moment. Contactez-nous pour une alternative.`,
      DELIVERED: `Bonjour ${reservation.fullName}, votre article réservé « ${reservation.productName} » a été livré. Merci pour votre confiance !`,
    };

    return messages[status] ?? `Kaniê — Réservation « ${reservation.productName} » : ${statusLabel}.`;
  }

  private getReservationStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      APPROVED: 'Approuvée',
      REJECTED: 'Rejetée',
      DELIVERED: 'Livrée',
    };
    return labels[status] ?? status;
  }

  private async enqueueEmail(
    order: Order,
    template: EmailTemplate,
    subject: string,
    context: Record<string, unknown>,
  ) {
    const log = await this.prisma.notificationLog.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        channel: NotificationChannel.EMAIL,
        template,
        recipient: order.customerEmail,
        status: NotificationStatus.PENDING,
      },
    });

    await this.emailQueue.add(
      template,
      { logId: log.id, template, to: order.customerEmail, subject, context },
      DEFAULT_JOB_OPTIONS,
    );

    this.logger.log(`Email queued: ${template} order=${order.orderNumber}`);
  }

  private async enqueueWhatsapp(
    order: Order,
    template: WhatsappTemplate,
    params: string[],
  ) {
    const phone = order.customerPhone!;

    const log = await this.prisma.notificationLog.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        channel: NotificationChannel.WHATSAPP,
        template,
        recipient: phone,
        status: NotificationStatus.PENDING,
      },
    });

    await this.whatsappQueue.add(
      template,
      { logId: log.id, template, phone, params },
      DEFAULT_JOB_OPTIONS,
    );

    this.logger.log(`WhatsApp queued: ${template} order=${order.orderNumber}`);
  }

  private buildOrderContext(order: Order): Record<string, unknown> {
    return {
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      total: order.total.toNumber().toLocaleString('fr-CI'),
    };
  }
}
