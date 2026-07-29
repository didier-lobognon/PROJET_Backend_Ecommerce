import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, ProductMovementType, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { CartAbandonmentService } from '../notifications/cart-abandonment.service';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from './cart.service';
import { CheckoutDto, OrderQueryDto, UpdateOrderStatusDto } from './dto/order.dto';
import { CheckoutPaymentMethod, COD_PAYMENT_PROVIDER } from './checkout-payment-method';
import { DEFAULT_SHIPPING_FEE } from './orders.constants';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly notificationsService: NotificationsService,
    private readonly cartAbandonment: CartAbandonmentService,
  ) {}

  async checkout(
    dto: CheckoutDto,
    sessionId?: string,
    userId?: string,
  ) {
    const cart = await this.cartService.getCartItemsForCheckout(sessionId, userId);
    const shipping = DEFAULT_SHIPPING_FEE;
    const subtotal = cart.subtotal;
    const total = subtotal + shipping;

    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber(tx);

      const created = await tx.order.create({
        data: {
          orderNumber,
          userId: userId ?? null,
          status: OrderStatus.PENDING,
          subtotal,
          shipping,
          total,
          shippingAddress: dto.shippingAddress as unknown as Prisma.InputJsonValue,
          customerEmail: dto.customerEmail,
          customerPhone: dto.customerPhone ?? dto.shippingAddress.phone,
          customerName: dto.customerName,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              productName: item.product.name,
              productReference: item.product.reference,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
          statusHistory: {
            create: {
              status: OrderStatus.PENDING,
              note: 'Commande créée',
            },
          },
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });

      return created;
    });

    await this.cartService.clearCart(sessionId, userId);
    if (userId) {
      await this.cartAbandonment.cancelForUser(userId).catch(() => undefined);
    }

    if (dto.paymentMethod === CheckoutPaymentMethod.COD) {
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          amount: order.total,
          currency: 'XOF',
          provider: COD_PAYMENT_PROVIDER,
          status: PaymentStatus.PENDING,
        },
      });

      return this.confirmOrderPayment(
        order.id,
        'Paiement à la livraison — commande confirmée',
      );
    }

    return this.formatOrder(order);
  }

  async findByOrderNumber(
    orderNumber: string,
    userId?: string,
    email?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    this.assertOrderAccess(order, userId, email);
    return this.formatOrder(order);
  }

  async findMyOrders(userId: string, query: OrderQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = { userId };
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: items.map((o) => this.formatOrder(o)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAdminByOrderNumber(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    return this.formatOrder(order);
  }

  async findAllAdmin(query: OrderQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customerEmail: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: items.map((o) => this.formatOrder(o)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private static readonly VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED, OrderStatus.REFUNDED],
    [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.REFUNDED]: [],
  };

  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    actorRole: UserRole,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    if (actorRole === UserRole.OPERATOR && dto.status === OrderStatus.REFUNDED) {
      throw new ForbiddenException('Action non autorisée pour votre rôle');
    }

    const allowed = OrdersService.VALID_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Transition invalide : ${order.status} → ${dto.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === OrderStatus.CONFIRMED && order.status === OrderStatus.PENDING) {
        await this.decrementStock(tx, order.items);
      }

      if (dto.status === OrderStatus.CANCELLED && order.status === OrderStatus.CONFIRMED) {
        await this.restoreStock(tx, order.items);
      }

      if (dto.status === OrderStatus.DELIVERED) {
        await tx.payment.updateMany({
          where: {
            orderId,
            provider: COD_PAYMENT_PROVIDER,
            status: PaymentStatus.PENDING,
          },
          data: {
            status: PaymentStatus.COMPLETED,
            paidAt: new Date(),
          },
        });
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          statusHistory: {
            create: {
              status: dto.status,
              note: dto.note ?? `Statut mis à jour : ${dto.status}`,
            },
          },
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    this.triggerOrderNotification(orderId, dto.status);
    return this.formatOrder(updated);
  }

  async getOrderNotifications(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }
    return this.notificationsService.getOrderNotifications(orderId);
  }

  async confirmOrderPayment(orderId: string, note: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) {
      throw new NotFoundException('Commande introuvable');
    }

    if (order.status !== OrderStatus.PENDING) {
      return this.formatOrder(order);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.decrementStock(tx, order.items);

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
          statusHistory: {
            create: { status: OrderStatus.CONFIRMED, note },
          },
        },
        include: {
          items: true,
          statusHistory: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    this.triggerOrderNotification(orderId, OrderStatus.CONFIRMED);
    return this.formatOrder(updated);
  }

  private triggerOrderNotification(orderId: string, status: OrderStatus) {
    this.notificationsService.notifyOrderStatus(orderId, status).catch(() => {
      // Notification errors must not block order flow
    });
  }

  private async decrementStock(
    tx: Prisma.TransactionClient,
    items: { productId: string | null; quantity: number; productName: string }[],
  ) {
    for (const item of items) {
      if (!item.productId) continue;

      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (updated.count === 0) {
        throw new BadRequestException(`Stock insuffisant pour ${item.productName}`);
      }

      await tx.productMovement.create({
        data: {
          productId: item.productId,
          type: ProductMovementType.SALE,
          quantity: item.quantity,
          note: 'Vente — confirmation commande',
        },
      });
    }
  }

  private async restoreStock(
    tx: Prisma.TransactionClient,
    items: { productId: string | null; quantity: number }[],
  ) {
    for (const item of items) {
      if (!item.productId) continue;

      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });

      await tx.productMovement.create({
        data: {
          productId: item.productId,
          type: ProductMovementType.IN,
          quantity: item.quantity,
          note: 'Restock — annulation commande',
        },
      });
    }
  }

  private async generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');

    const prefix = `KN-${datePart}-`;
    const count = await tx.order.count({
      where: { orderNumber: { startsWith: prefix } },
    });

    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  private assertOrderAccess(
    order: { userId: string | null; customerEmail: string },
    userId?: string,
    email?: string,
  ) {
    if (userId && order.userId === userId) return;
    if (email && order.customerEmail.toLowerCase() === email.toLowerCase()) return;
    if (!userId && !email) {
      throw new ForbiddenException('Email requis pour consulter cette commande');
    }
    throw new ForbiddenException('Accès non autorisé à cette commande');
  }

  private formatOrder(
    order: {
      subtotal: { toNumber(): number };
      shipping: { toNumber(): number };
      total: { toNumber(): number };
      items: Array<{ unitPrice: { toNumber(): number }; quantity: number; [key: string]: unknown }>;
      payments?: Array<{
        id: string;
        provider: string;
        status: PaymentStatus;
        amount: { toNumber(): number };
        currency: string;
        paidAt: Date | null;
      }>;
      [key: string]: unknown;
    },
  ) {
    const { subtotal, shipping, total, items, payments, ...rest } = order;
    const latestPayment = payments?.[0];

    return {
      ...rest,
      subtotal: subtotal.toNumber(),
      shipping: shipping.toNumber(),
      total: total.toNumber(),
      items: items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice.toNumber(),
        lineTotal: item.unitPrice.toNumber() * item.quantity,
      })),
      payment: latestPayment
        ? {
            id: latestPayment.id,
            provider: latestPayment.provider,
            status: latestPayment.status,
            amount: latestPayment.amount.toNumber(),
            currency: latestPayment.currency,
            paidAt: latestPayment.paidAt,
          }
        : null,
    };
  }
}
