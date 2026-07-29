import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CartAbandonmentStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { CrmService } from '../crm/crm.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CART_ABANDONMENT_QUEUE,
  CartAbandonmentJobData,
  DEFAULT_JOB_OPTIONS,
} from './notifications.constants';

@Injectable()
export class CartAbandonmentService {
  private readonly logger = new Logger(CartAbandonmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crmService: CrmService,
    @InjectQueue(CART_ABANDONMENT_QUEUE) private readonly queue: Queue,
  ) {}

  private get delayHours(): number {
    return this.config.get<number>('CART_ABANDONMENT_DELAY_HOURS', 24);
  }

  async scheduleForUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone && !user?.email) return;

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });
    if (!cart || cart.items.length === 0) {
      await this.cancelForCart(cart?.id);
      return;
    }

    await this.cancelForCart(cart.id);

    const scheduledFor = new Date(Date.now() + this.delayHours * 60 * 60 * 1000);
    const reminder = await this.prisma.cartAbandonmentReminder.create({
      data: {
        cartId: cart.id,
        userId,
        phone: user.phone,
        email: user.email,
        scheduledFor,
      },
    });

    const job = await this.queue.add(
      'remind',
      { reminderId: reminder.id } satisfies CartAbandonmentJobData,
      {
        ...DEFAULT_JOB_OPTIONS,
        delay: this.delayHours * 60 * 60 * 1000,
        jobId: `cart-abandon-${cart.id}`,
      },
    );

    await this.prisma.cartAbandonmentReminder.update({
      where: { id: reminder.id },
      data: { jobId: job.id },
    });

    this.logger.log(`Cart abandonment scheduled cart=${cart.id} in ${this.delayHours}h`);
  }

  async cancelForUser(userId: string): Promise<void> {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (cart) await this.cancelForCart(cart.id);
  }

  async cancelForCart(cartId?: string): Promise<void> {
    if (!cartId) return;

    const pending = await this.prisma.cartAbandonmentReminder.findMany({
      where: { cartId, status: CartAbandonmentStatus.SCHEDULED },
    });

    for (const reminder of pending) {
      if (reminder.jobId) {
        const job = await this.queue.getJob(reminder.jobId);
        if (job) await job.remove();
      }
      await this.prisma.cartAbandonmentReminder.update({
        where: { id: reminder.id },
        data: { status: CartAbandonmentStatus.CANCELLED },
      });
    }
  }
}
