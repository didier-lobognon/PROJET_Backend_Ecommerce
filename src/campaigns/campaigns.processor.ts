import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CampaignChannel } from '@prisma/client';
import { Job } from 'bullmq';
import {
  formatEmailHtml,
  formatWhatsappText,
  renderMessageTemplate,
} from '../common/utils/message-template.util';
import { CampaignJobData, CampaignsService } from './campaigns.service';
import { CrmService } from '../crm/crm.service';
import { CAMPAIGN_QUEUE } from '../notifications/notifications.constants';
import { SmtpService } from '../notifications/smtp/smtp.service';
import { WhatsappClient } from '../notifications/whatsapp/whatsapp.client';
import { PrismaService } from '../prisma/prisma.service';

@Processor(CAMPAIGN_QUEUE)
export class CampaignsProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignsService: CampaignsService,
    private readonly crmService: CrmService,
    private readonly smtp: SmtpService,
    private readonly whatsapp: WhatsappClient,
  ) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<void> {
    const { campaignId, recipientId } = job.data;

    const recipient = await this.prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      include: {
        user: true,
        campaign: true,
      },
    });

    if (!recipient || recipient.campaignId !== campaignId) return;

    const { user, campaign } = recipient;
    const rendered = renderMessageTemplate(campaign.body, user);
    const subject = renderMessageTemplate(
      campaign.subject ?? campaign.name,
      user,
    );

    try {
      if (campaign.channel === CampaignChannel.EMAIL) {
        if (!user.emailMarketingConsent) {
          throw new Error('Consentement email marketing absent');
        }
        await this.smtp.sendRaw(user.email, subject, formatEmailHtml(rendered));
      } else {
        if (!user.whatsappMarketingConsent || !user.phone) {
          throw new Error('Consentement WhatsApp marketing absent');
        }
        await this.whatsapp.sendText(user.phone, formatWhatsappText(rendered));
      }

      await this.campaignsService.markRecipientResult(recipientId, true);

      try {
        await this.crmService.logInteraction({
          userId: user.id,
          email: user.email,
          phone: user.phone,
          channel: 'CAMPAIGN',
          direction: 'OUTBOUND',
          type: 'campaign_send',
          subject,
          body: rendered,
          campaignId: campaign.id,
        });
      } catch (logError) {
        this.logger.warn(
          `Campaign sent but interaction log failed: ${logError instanceof Error ? logError.message : logError}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur campagne';
      this.logger.error(`Campaign send failed: ${message}`);
      await this.campaignsService.markRecipientResult(recipientId, false, message);
      throw error;
    }
  }
}
