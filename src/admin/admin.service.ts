import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildTimelineBuckets,
  getDashboardPeriodConfig,
  parseDashboardPeriod,
} from './dashboard-period';
import { CustomerStatusDto } from './dto/customer-status.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

function isPaidStatus(status: OrderStatus): boolean {
  return PAID_STATUSES.includes(status);
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats(periodInput?: string) {
    const period = parseDashboardPeriod(periodInput);
    const { start, bucketCount, label } = getDashboardPeriodConfig(period);
    const dateFilter = { createdAt: { gte: start } };

    const [
      ordersTotal,
      revenueAggregate,
      pendingOrders,
      totalCustomers,
      newCustomers,
      lowStockProducts,
      totalProducts,
      chartOrders,
      ordersByStatus,
      unreadContacts,
      newContacts,
      pendingReservations,
    ] = await Promise.all([
      this.prisma.order.count({ where: dateFilter }),
      this.prisma.order.aggregate({
        where: {
          ...dateFilter,
          status: { in: PAID_STATUSES },
        },
        _sum: { total: true },
      }),
      this.prisma.order.count({
        where: { status: OrderStatus.PENDING },
      }),
      this.prisma.user.count({
        where: { role: UserRole.CLIENT },
      }),
      this.prisma.user.count({
        where: { role: UserRole.CLIENT, ...dateFilter },
      }),
      this.prisma.product.count({
        where: { stock: { lte: 3 } },
      }),
      this.prisma.product.count(),
      this.prisma.order.findMany({
        where: dateFilter,
        select: { createdAt: true, total: true, status: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { status: true },
      }),
      this.prisma.contactRequest.count({ where: { isRead: false } }),
      this.prisma.contactRequest.count({ where: dateFilter }),
      this.prisma.productReservation.count({ where: { status: 'PENDING' } }),
    ]);

    const timeline = buildTimelineBuckets(start, bucketCount);

    for (const order of chartOrders) {
      const dateKey = order.createdAt.toISOString().slice(0, 10);
      const bucket = timeline.find((entry) => entry.date === dateKey);
      if (!bucket) continue;

      bucket.orders += 1;
      if (isPaidStatus(order.status)) {
        bucket.revenue += order.total.toNumber();
      }
    }

    return {
      period,
      periodLabel: label,
      revenue: {
        total: revenueAggregate._sum.total?.toNumber() ?? 0,
      },
      orders: {
        total: ordersTotal,
        pending: pendingOrders,
      },
      customers: {
        total: totalCustomers,
        newInPeriod: newCustomers,
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts,
      },
      contacts: {
        unread: unreadContacts,
        newInPeriod: newContacts,
      },
      reservations: {
        pending: pendingReservations,
      },
      charts: {
        timeline,
        ordersByStatus: ordersByStatus.map((entry) => ({
          status: entry.status,
          count: entry._count.status,
        })),
      },
    };
  }

  async getCustomers(params: {
    page: number;
    limit: number;
    search?: string;
    status?: 'active' | 'suspended';
  }) {
    const { page, limit, search, status } = params;
    const skip = (page - 1) * limit;

    const where = {
      role: UserRole.CLIENT,
      ...(status === 'active' ? { isActive: true } : {}),
      ...(status === 'suspended' ? { isActive: false } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          emailMarketingConsent: true,
          whatsappMarketingConsent: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: items.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        isActive: u.isActive,
        emailMarketingConsent: u.emailMarketingConsent,
        whatsappMarketingConsent: u.whatsappMarketingConsent,
        createdAt: u.createdAt,
        orderCount: u._count.orders,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getCustomerDetail(id: string) {
    await this.findClientOrThrow(id);

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Client introuvable');
    }

    const { _count, ...rest } = user;

    return {
      ...rest,
      orderCount: _count.orders,
      orders: user.orders.map((o) => ({
        ...o,
        total: o.total.toNumber(),
      })),
    };
  }

  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    const user = await this.findClientOrThrow(id);

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        phone: dto.phone,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      orderCount: updated._count.orders,
    };
  }

  async setCustomerStatus(id: string, dto: CustomerStatusDto) {
    await this.findClientOrThrow(id);

    if (!dto.isActive) {
      await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phone: updated.phone,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      orderCount: updated._count.orders,
    };
  }

  async deleteCustomer(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        _count: { select: { orders: true } },
      },
    });

    if (!user || user.role !== UserRole.CLIENT) {
      throw new NotFoundException('Client introuvable');
    }

    if (user._count.orders > 0) {
      throw new ConflictException(
        'Impossible de supprimer un client ayant des commandes. Suspendez-le plutôt.',
      );
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: 'Client supprimé' };
  }

  private async findClientOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user || user.role !== UserRole.CLIENT) {
      throw new NotFoundException('Client introuvable');
    }

    return user;
  }

  async exportOrdersCsv(status?: string): Promise<string> {
    const where = status ? { status: status as OrderStatus } : {};

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    const header =
      'Numéro;Date;Client;Email;Téléphone;Statut;Sous-total;Livraison;Total;Articles';
    const rows = orders.map((o) => {
      const articles = o.items
        .map((i) => `${i.productName} x${i.quantity}`)
        .join(' | ');
      return [
        o.orderNumber,
        o.createdAt.toISOString().slice(0, 19),
        o.customerName,
        o.customerEmail,
        o.customerPhone ?? '',
        o.status,
        o.subtotal.toNumber(),
        o.shipping.toNumber(),
        o.total.toNumber(),
        `"${articles}"`,
      ].join(';');
    });

    return [header, ...rows].join('\n');
  }
}
