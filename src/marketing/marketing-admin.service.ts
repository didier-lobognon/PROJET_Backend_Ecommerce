import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CampaignChannel, UserRole } from '@prisma/client';
import { CrmService } from '../crm/crm.service';
import {
  formatCartItemsList,
  formatEmailHtml,
  formatWhatsappText,
  renderMessageTemplate,
} from '../common/utils/message-template.util';
import { SmtpService } from '../notifications/smtp/smtp.service';
import { WhatsappClient } from '../notifications/whatsapp/whatsapp.client';
import { PrismaService } from '../prisma/prisma.service';
import { SendCartReminderDto } from './dto/cart-reminder.dto';

const DEFAULT_CART_REMINDER = `Bonjour {{fullName}},

Vous avez laissé des articles dans votre panier :
{{cartItems}}

Finalisez votre commande sur kanie.ci/panier`;

@Injectable()
export class MarketingAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmService: CrmService,
    private readonly smtp: SmtpService,
    private readonly whatsapp: WhatsappClient,
  ) {}

  async listAbandonedCarts() {
    const carts = await this.prisma.cart.findMany({
      where: {
        userId: { not: null },
        items: { some: {} },
        user: { role: UserRole.CLIENT, isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
            emailMarketingConsent: true,
            whatsappMarketingConsent: true,
          },
        },
        items: {
          include: {
            product: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return carts.map((cart) => ({
      id: cart.id,
      userId: cart.userId!,
      updatedAt: cart.updatedAt,
      itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: cart.items.reduce(
        (sum, item) => sum + item.unitPrice.toNumber() * item.quantity,
        0,
      ),
      user: cart.user!,
      items: cart.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
      })),
    }));
  }

  async sendCartReminder(cartId: string, dto: SendCartReminderDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        user: true,
        items: { include: { product: { select: { name: true } } } },
      },
    });

    if (!cart?.userId || !cart.user) {
      throw new NotFoundException('Panier introuvable');
    }
    if (cart.items.length === 0) {
      throw new BadRequestException('Ce panier est vide');
    }

    const user = cart.user;
    const cartItems = formatCartItemsList(
      cart.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toNumber(),
      })),
    );

    const template = dto.message?.trim() || DEFAULT_CART_REMINDER;
    const rendered = renderMessageTemplate(template, user, { cartItems });

    if (dto.channel === CampaignChannel.EMAIL) {
      if (!user.emailMarketingConsent) {
        throw new BadRequestException('Le client n\'a pas consenti aux emails marketing');
      }
      if (!this.smtp.isConfigured) {
        throw new BadRequestException('SMTP non configuré');
      }
      const subject = dto.subject?.trim() || 'Votre panier vous attend — Kaniê';
      await this.smtp.sendRaw(user.email, subject, formatEmailHtml(rendered));
    } else {
      if (!user.whatsappMarketingConsent || !user.phone) {
        throw new BadRequestException('Consentement WhatsApp ou téléphone manquant');
      }
      if (!this.whatsapp.isConfigured) {
        throw new BadRequestException('WhatsApp non configuré');
      }
      await this.whatsapp.sendText(user.phone, formatWhatsappText(rendered));
    }

    await this.crmService.logInteraction({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      channel: dto.channel === CampaignChannel.EMAIL ? 'EMAIL' : 'WHATSAPP',
      direction: 'OUTBOUND',
      type: 'cart_reminder',
      subject: dto.subject ?? 'Relance panier',
      body: rendered,
    });

    return { message: 'Relance envoyée' };
  }
}
