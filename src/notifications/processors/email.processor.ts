import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_QUEUE, EmailJobData } from '../notifications.constants';
import { SmtpService } from '../smtp/smtp.service';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly smtp: SmtpService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    const { logId, template, to, subject, context } = job.data;

    try {
      if (!this.smtp.isConfigured) {
        await this.markSkipped(logId, 'SMTP non configuré');
        return;
      }

      await this.smtp.send(to, subject, template, context);
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { status: NotificationStatus.SENT, sentAt: new Date(), jobId: job.id },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur envoi email';
      this.logger.error(`Email job failed: ${message}`);

      if (job.attemptsMade >= (job.opts.attempts ?? 1) - 1) {
        await this.prisma.notificationLog.update({
          where: { id: logId },
          data: { status: NotificationStatus.FAILED, error: message, jobId: job.id },
        });
      }

      throw error;
    }
  }

  private async markSkipped(logId: string, reason: string) {
    await this.prisma.notificationLog.update({
      where: { id: logId },
      data: { status: NotificationStatus.SKIPPED, error: reason },
    });
    this.logger.warn(`Email skipped: ${reason}`);
  }
}
