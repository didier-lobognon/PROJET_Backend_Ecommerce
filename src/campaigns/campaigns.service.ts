import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  CampaignChannel,
  CampaignStatus,
  NotificationStatus,
  UserRole,
} from '@prisma/client';
import { Queue } from 'bullmq';
import { CrmService } from '../crm/crm.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CAMPAIGN_QUEUE,
  DEFAULT_JOB_OPTIONS,
} from '../notifications/notifications.constants';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';

export interface CampaignJobData {
  campaignId: string;
  recipientId: string;
}

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmService: CrmService,
    @InjectQueue(CAMPAIGN_QUEUE) private readonly campaignQueue: Queue,
  ) {}

  async listCampaigns() {
    return this.prisma.marketingCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { segment: { select: { id: true, name: true } } },
    });
  }

  async getCampaign(id: string) {
    const campaign = await this.prisma.marketingCampaign.findUnique({
      where: { id },
      include: {
        segment: true,
        recipients: {
          take: 50,
          orderBy: { sentAt: 'desc' },
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campagne introuvable');
    return campaign;
  }

  async createCampaign(dto: CreateCampaignDto, createdById?: string) {
    if (dto.channel === CampaignChannel.EMAIL && !dto.subject?.trim()) {
      throw new BadRequestException('Le sujet est obligatoire pour une campagne email');
    }

    return this.prisma.marketingCampaign.create({
      data: {
        name: dto.name.trim(),
        channel: dto.channel,
        segmentId: dto.segmentId,
        subject: dto.subject?.trim(),
        body: dto.body.trim(),
        whatsappTemplate: dto.whatsappTemplate,
        createdById,
      },
    });
  }

  async updateCampaign(id: string, dto: UpdateCampaignDto) {
    const campaign = await this.findCampaignOrThrow(id);
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Seules les campagnes brouillon sont modifiables');
    }

    return this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        segmentId: dto.segmentId,
        subject: dto.subject?.trim(),
        body: dto.body?.trim(),
        whatsappTemplate: dto.whatsappTemplate,
      },
    });
  }

  async deleteCampaign(id: string) {
    const campaign = await this.findCampaignOrThrow(id);
    if (campaign.status === CampaignStatus.SENDING) {
      throw new BadRequestException('Impossible de supprimer une campagne en cours');
    }
    await this.prisma.marketingCampaign.delete({ where: { id } });
    return { message: 'Campagne supprimée' };
  }

  async launchCampaign(id: string) {
    const campaign = await this.findCampaignOrThrow(id);
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Cette campagne a déjà été lancée');
    }

    return this.dispatchCampaign(id);
  }

  async resendCampaign(id: string) {
    const campaign = await this.findCampaignOrThrow(id);
    if (campaign.status === CampaignStatus.SENDING) {
      throw new BadRequestException('Envoi déjà en cours');
    }
    if (campaign.status === CampaignStatus.DRAFT) {
      throw new BadRequestException('Utilisez « Envoyer » pour un brouillon');
    }
    if (!campaign.segmentId) {
      throw new BadRequestException('Aucun groupe associé à ce message');
    }

    return this.dispatchCampaign(id);
  }

  private async dispatchCampaign(id: string) {
    const campaign = await this.findCampaignOrThrow(id);
    if (!campaign.segmentId) {
      throw new BadRequestException('Sélectionnez un segment cible');
    }

    const segmentUsers = await this.crmService.resolveSegmentUsers(campaign.segmentId);
    const eligible = segmentUsers.filter((user) => this.hasConsent(user, campaign.channel));

    if (eligible.length === 0) {
      throw new BadRequestException('Aucun client éligible (consentement RGPD requis)');
    }

    await this.prisma.campaignRecipient.deleteMany({ where: { campaignId: id } });
    await this.prisma.campaignRecipient.createMany({
      data: eligible.map((user) => ({ campaignId: id, userId: user.id })),
    });

    const recipients = await this.prisma.campaignRecipient.findMany({
      where: { campaignId: id },
    });

    await this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        status: CampaignStatus.SENDING,
        startedAt: new Date(),
        completedAt: null,
        totalRecipients: recipients.length,
        sentCount: 0,
        failedCount: 0,
      },
    });

    for (const recipient of recipients) {
      await this.campaignQueue.add(
        'send',
        { campaignId: id, recipientId: recipient.id } satisfies CampaignJobData,
        DEFAULT_JOB_OPTIONS,
      );
    }

    return {
      message: 'Campagne lancée',
      totalRecipients: recipients.length,
    };
  }

  async markRecipientResult(
    recipientId: string,
    success: boolean,
    error?: string,
  ) {
    const recipient = await this.prisma.campaignRecipient.findUnique({
      where: { id: recipientId },
      include: { campaign: true },
    });
    if (!recipient) return;

    await this.prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        status: success ? NotificationStatus.SENT : NotificationStatus.FAILED,
        error,
        sentAt: success ? new Date() : undefined,
      },
    });

    await this.prisma.marketingCampaign.update({
      where: { id: recipient.campaignId },
      data: {
        sentCount: { increment: success ? 1 : 0 },
        failedCount: { increment: success ? 0 : 1 },
      },
    });

    await this.checkCampaignCompletion(recipient.campaignId);
  }

  private async checkCampaignCompletion(campaignId: string) {
    const pending = await this.prisma.campaignRecipient.count({
      where: { campaignId, status: NotificationStatus.PENDING },
    });
    if (pending === 0) {
      await this.prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.COMPLETED, completedAt: new Date() },
      });
    }
  }

  private hasConsent(
    user: {
      emailMarketingConsent: boolean;
      whatsappMarketingConsent: boolean;
      phone: string | null;
    },
    channel: CampaignChannel,
  ): boolean {
    if (channel === CampaignChannel.EMAIL) return user.emailMarketingConsent;
    return user.whatsappMarketingConsent && Boolean(user.phone);
  }

  private async findCampaignOrThrow(id: string) {
    const campaign = await this.prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campagne introuvable');
    return campaign;
  }
}
