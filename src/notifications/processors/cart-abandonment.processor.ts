import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CartAbandonmentStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { CrmService } from '../../crm/crm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CART_ABANDONMENT_QUEUE, CartAbandonmentJobData } from '../notifications.constants';
import { SmtpService } from '../smtp/smtp.service';
import { WhatsappClient } from '../whatsapp/whatsapp.client';

@Processor(CART_ABANDONMENT_QUEUE)
export class CartAbandonmentProcessor extends WorkerHost {
  private readonly logger = new Logger(CartAbandonmentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmService: CrmService,
    private readonly smtp: SmtpService,
    private readonly whatsapp: WhatsappClient,
  ) {
    super();
  }

  async process(job: Job<CartAbandonmentJobData>): Promise<void> {
    const reminder = await this.prisma.cartAbandonmentReminder.findUnique({
      where: { id: job.data.reminderId },
      include: {
        cart: { include: { items: { include: { product: true } }, user: true } },
      },
    });

    if (!reminder || reminder.status !== CartAbandonmentStatus.SCHEDULED) return;
    if (!reminder.cart || reminder.cart.items.length === 0) {
      await this.markSkipped(reminder.id, 'Panier vide');
      return;
    }

    const user = reminder.cart.user;
    const firstName = user?.firstName ?? user?.email ?? 'Client';
    const itemCount = reminder.cart.items.reduce((sum, i) => sum + i.quantity, 0);

    let sent = false;

    if (reminder.phone && this.whatsapp.isConfigured) {
      await this.whatsapp.sendTemplate(reminder.phone, 'cart_abandoned', [firstName]);
      sent = true;
    }

    if (reminder.email && this.smtp.isConfigured) {
      await this.smtp.sendRaw(
        reminder.email,
        'Votre panier Kaniê vous attend',
        `Bonjour ${firstName},\n\nVous avez ${itemCount} article(s) dans votre panier. Finalisez votre commande sur kanie.ci/panier`,
      );
      sent = true;
    }

    if (!sent) {
      await this.markSkipped(reminder.id, 'Aucun canal disponible');
      return;
    }

    await this.prisma.cartAbandonmentReminder.update({
      where: { id: reminder.id },
      data: { status: CartAbandonmentStatus.SENT, sentAt: new Date() },
    });

    await this.crmService.logInteraction({
      userId: reminder.userId,
      phone: reminder.phone,
      email: reminder.email,
      channel: 'SYSTEM',
      direction: 'OUTBOUND',
      type: 'cart_abandonment',
      subject: 'Relance panier abandonné',
      body: `${itemCount} article(s) en attente`,
    });

    this.logger.log(`Cart abandonment sent reminder=${reminder.id}`);
  }

  private async markSkipped(id: string, reason: string) {
    await this.prisma.cartAbandonmentReminder.update({
      where: { id },
      data: { status: CartAbandonmentStatus.SKIPPED, sentAt: new Date() },
    });
    this.logger.warn(`Cart abandonment skipped: ${reason}`);
  }
}
