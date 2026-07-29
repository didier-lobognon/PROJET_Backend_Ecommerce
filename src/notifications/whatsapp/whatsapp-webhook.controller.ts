import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { CrmService } from '../../crm/crm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsappClient } from './whatsapp.client';

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          text?: { body: string };
        }>;
      };
    }>;
  }>;
}

@ApiTags('webhooks')
@ApiExcludeController()
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crmService: CrmService,
    private readonly whatsapp: WhatsappClient,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', '');
    if (mode === 'subscribe' && token === expected) {
      return challenge;
    }
    throw new UnauthorizedException('Token de vérification invalide');
  }

  @Post()
  @HttpCode(200)
  async receive(@Body() body: MetaWebhookPayload) {
    if (body.object !== 'whatsapp_business_account') {
      return { status: 'ignored' };
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          await this.handleInboundMessage(message);
        }
      }
    }

    return { status: 'ok' };
  }

  private async handleInboundMessage(message: {
    id: string;
    from: string;
    type: string;
    text?: { body: string };
  }) {
    const existing = await this.prisma.whatsappInboundEvent.findUnique({
      where: { externalMessageId: message.id },
    });
    if (existing) return;

    const text = message.type === 'text' ? message.text?.body ?? '' : '';
    const phone = message.from;

    const event = await this.prisma.whatsappInboundEvent.create({
      data: {
        externalMessageId: message.id,
        phone,
        messageText: text || null,
        payload: message as object,
      },
    });

    const user = await this.prisma.user.findFirst({
      where: { phone: { contains: phone.slice(-8) } },
    });

    await this.crmService.logInteraction({
      userId: user?.id,
      phone,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      type: 'inbound_message',
      body: text || `[${message.type}]`,
      metadata: { messageId: message.id },
    });

    if (!text) return;

    const faq = await this.crmService.matchFaqMessage(text);
    if (!faq || !this.whatsapp.isConfigured) return;

    try {
      await this.whatsapp.sendText(phone, faq.responseText);
      await this.prisma.whatsappInboundEvent.update({
        where: { id: event.id },
        data: { faqScenarioId: faq.id, repliedAt: new Date() },
      });
      await this.crmService.logInteraction({
        userId: user?.id,
        phone,
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        type: 'faq_auto_reply',
        subject: faq.title,
        body: faq.responseText,
        metadata: { faqScenarioId: faq.id },
      });
    } catch (error) {
      this.logger.error(
        `FAQ auto-reply failed: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }
}
