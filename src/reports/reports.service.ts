import { Injectable } from '@nestjs/common';
import { OrderStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { parseDashboardPeriod, getDashboardPeriodConfig } from '../admin/dashboard-period';
import { buildCustomersPdf, buildSalesPdf } from './reports-pdf.util';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async exportSalesCsv(periodInput?: string): Promise<string> {
    const period = parseDashboardPeriod(periodInput);
    const { start, label } = getDashboardPeriodConfig(period);

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start } },
      orderBy: { createdAt: 'desc' },
      include: { items: true, user: { select: { email: true } } },
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

    return [`# Période: ${label}`, header, ...rows].join('\n');
  }

  async exportCustomersCsv(): Promise<string> {
    const clients = await this.prisma.user.findMany({
      where: { role: UserRole.CLIENT },
      orderBy: { createdAt: 'desc' },
      include: {
        customerSegments: {
          include: { segment: { include: { tag: true } } },
        },
        orders: { select: { total: true, status: true } },
      },
    });

    const header =
      'Email;Prénom;Nom;Téléphone;Actif;Consentement email;Consentement WhatsApp;Commandes;CA total;Segments;Inscription';
    const rows = clients.map((c) => {
      const paidOrders = c.orders.filter((o) =>
        ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(o.status),
      );
      const revenue = paidOrders.reduce((sum, o) => sum + o.total.toNumber(), 0);
      const segments = c.customerSegments
        .map((row) => {
          const tagLabel = row.segment.tag ? ` [${row.segment.tag.name}]` : '';
          return `${row.segment.name}${tagLabel}`;
        })
        .join(', ');
      return [
        c.email,
        c.firstName ?? '',
        c.lastName ?? '',
        c.phone ?? '',
        c.isActive ? 'Oui' : 'Non',
        c.emailMarketingConsent ? 'Oui' : 'Non',
        c.whatsappMarketingConsent ? 'Oui' : 'Non',
        c.orders.length,
        revenue,
        `"${segments}"`,
        c.createdAt.toISOString().slice(0, 10),
      ].join(';');
    });

    return [header, ...rows].join('\n');
  }

  async exportSalesPdf(periodInput?: string): Promise<Buffer> {
    const period = parseDashboardPeriod(periodInput);
    const { start } = getDashboardPeriodConfig(period);
    const summary = await this.getSalesSummary(periodInput);

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start } },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return buildSalesPdf({
      periodLabel: summary.periodLabel,
      revenue: summary.revenue,
      ordersCount: summary.ordersCount,
      rows: orders.map((o) => ({
        orderNumber: o.orderNumber,
        date: o.createdAt,
        customerName: o.customerName,
        status: o.status,
        total: o.total.toNumber(),
      })),
    });
  }

  async exportCustomersPdf(): Promise<Buffer> {
    const summary = await this.getCustomersSummary();

    const clients = await this.prisma.user.findMany({
      where: { role: UserRole.CLIENT },
      orderBy: { createdAt: 'desc' },
      include: {
        customerSegments: { include: { segment: true } },
        orders: { select: { total: true, status: true } },
      },
    });

    return buildCustomersPdf({
      ...summary,
      rows: clients.map((c) => {
        const paidOrders = c.orders.filter((o) =>
          ['CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED'].includes(o.status),
        );
        const revenue = paidOrders.reduce((sum, o) => sum + o.total.toNumber(), 0);
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
        return {
          email: c.email,
          name,
          phone: c.phone ?? '',
          active: c.isActive,
          emailConsent: c.emailMarketingConsent,
          whatsappConsent: c.whatsappMarketingConsent,
          orderCount: c.orders.length,
          revenue,
          segments: c.customerSegments.map((row) => row.segment.name).join(', '),
        };
      }),
    });
  }

  async getSalesSummary(periodInput?: string) {
    const period = parseDashboardPeriod(periodInput);
    const { start, label } = getDashboardPeriodConfig(period);
    const dateFilter = { createdAt: { gte: start } };
    const paidStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ];

    const [ordersCount, revenueAgg, byStatus] = await Promise.all([
      this.prisma.order.count({ where: dateFilter }),
      this.prisma.order.aggregate({
        where: { ...dateFilter, status: { in: paidStatuses } },
        _sum: { total: true },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: dateFilter,
        _count: { status: true },
      }),
    ]);

    return {
      period,
      periodLabel: label,
      ordersCount,
      revenue: revenueAgg._sum.total?.toNumber() ?? 0,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
    };
  }

  async getCustomersSummary() {
    const [total, withConsentEmail, withConsentWhatsapp, active] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.CLIENT } }),
      this.prisma.user.count({
        where: { role: UserRole.CLIENT, emailMarketingConsent: true },
      }),
      this.prisma.user.count({
        where: { role: UserRole.CLIENT, whatsappMarketingConsent: true },
      }),
      this.prisma.user.count({ where: { role: UserRole.CLIENT, isActive: true } }),
    ]);

    return { total, active, withConsentEmail, withConsentWhatsapp };
  }
}
