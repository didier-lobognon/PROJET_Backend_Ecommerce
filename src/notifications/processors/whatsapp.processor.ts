import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_JOB_OPTIONS,
  EMAIL_QUEUE,
  ORDER_STATUS_EMAIL,
  WHATSAPP_QUEUE,
  WhatsappJobData,
  WhatsappTemplate,
} from '../notifications.constants';
import { WhatsappClient } from '../whatsapp/whatsapp.client';

@Processor(WHATSAPP_QUEUE)
export class WhatsappProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappProcessor.name);

  constructor(
    private readonly whatsapp: WhatsappClient,
    private readonly prisma: PrismaService,
    @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<WhatsappJobData>): Promise<void> {
    const { logId, template, phone, params, text, fallbackEmail } = job.data;

    try {
      if (!this.whatsapp.isConfigured) {
        await this.markSkipped(logId, 'WhatsApp non configuré');
        if (fallbackEmail) {
          await this.triggerReservationEmailFallback(logId, fallbackEmail);
        } else if (template && params) {
          await this.triggerOrderEmailFallback(logId, template, params);
        }
        return;
      }

      if (text) {
        await this.whatsapp.sendText(phone, text);
      } else if (template && params) {
        await this.whatsapp.sendTemplate(phone, template, params);
      } else {
        throw new Error('Job WhatsApp invalide');
      }

      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), jobId: job.id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur envoi WhatsApp';
      this.logger.error(`WhatsApp job failed: ${message}`);

      const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1) - 1;

      if (isLastAttempt) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: { status: NotificationStatus.FAILED, error: message, jobId: job.id },
        });

        if (fallbackEmail) {
          await this.triggerReservationEmailFallback(logId, fallbackEmail);
        } else if (template && params) {
          await this.triggerOrderEmailFallback(logId, template, params);
        }
      }

      throw error;
    }
  }

  private async triggerOrderEmailFallback(
    logId: string,
    whatsappTemplate: WhatsappTemplate,
    params: string[],
  ) {
    const log = await this.prisma.notificationLog.findUnique({
      where: { id: logId },
      include: { order: true },
    });

    if (!log?.order) return;

    const order = log.order;
    const orderStatus = order.status;
    const emailConfig = ORDER_STATUS_EMAIL[orderStatus];
    if (!emailConfig) return;

    const existingEmail = await this.prisma.notificationLog.findFirst({
      where: {
        orderId: order.id,
        channel: NotificationChannel.EMAIL,
        template: emailConfig.template,
        status: { in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
      },
    });
    if (existingEmail) {
      this.logger.log(
        `Email fallback skipped: already queued/sent for order ${order.orderNumber}`,
      );
      return;
    }

    const fallbackLog = await this.prisma.notificationLog.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        channel: NotificationChannel.EMAIL,
        template: emailConfig.template,
        recipient: order.customerEmail,
        status: NotificationStatus.PENDING,
        error: `Fallback depuis WhatsApp (${whatsappTemplate})`,
      },
    });

    const context = {
      customerName: params[0] ?? order.customerName,
      orderNumber: params[1] ?? order.orderNumber,
      total: order.total.toNumber().toLocaleString('fr-CI'),
    };

    await this.emailQueue.add(
      emailConfig.template,
      {
        logId: fallbackLog.id,
        template: emailConfig.template,
        to: order.customerEmail,
        subject: emailConfig.subject,
        context,
      },
      DEFAULT_JOB_OPTIONS,
    );

    this.logger.log(`Email fallback triggered for order ${order.orderNumber}`);
  }

  private async triggerReservationEmailFallback(
    logId: string,
    fallback: NonNullable<WhatsappJobData['fallbackEmail']>,
  ) {
    await this.prisma.notificationLog.update({
      where: { id: logId },
      data: {
        channel: NotificationChannel.EMAIL,
        recipient: fallback.to,
        template: fallback.template,
        status: NotificationStatus.PENDING,
        error: 'Fallback email après échec WhatsApp',
      },
    });

    await this.emailQueue.add(
      `${fallback.template}-fallback`,
      {
        logId,
        template: fallback.template,
        to: fallback.to,
        subject: fallback.subject,
        context: fallback.context,
      },
      DEFAULT_JOB_OPTIONS,
    );

    this.logger.log(`Reservation email fallback queued: ${fallback.template}`);
  }

  private async markSkipped(logId: string, reason: string) {
    await this.prisma.notificationLog.update({
      where: { id: logId },
      data: { status: NotificationStatus.SKIPPED, error: reason },
    });
    this.logger.warn(`WhatsApp skipped: ${reason}`);
  }
}
