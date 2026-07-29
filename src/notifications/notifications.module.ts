import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import {
  CART_ABANDONMENT_QUEUE,
  EMAIL_QUEUE,
  WHATSAPP_QUEUE,
} from './notifications.constants';
import { NotificationsService } from './notifications.service';
import { CartAbandonmentService } from './cart-abandonment.service';
import { CartAbandonmentProcessor } from './processors/cart-abandonment.processor';
import { EmailProcessor } from './processors/email.processor';
import { WhatsappProcessor } from './processors/whatsapp.processor';
import { SmtpService } from './smtp/smtp.service';
import { WhatsappClient } from './whatsapp/whatsapp.client';
import { WhatsappWebhookController } from './whatsapp/whatsapp-webhook.controller';

@Module({
  imports: [
    CrmModule,
    BullModule.registerQueue(
      { name: EMAIL_QUEUE },
      { name: WHATSAPP_QUEUE },
      { name: CART_ABANDONMENT_QUEUE },
    ),
  ],
  controllers: [WhatsappWebhookController],
  providers: [
    NotificationsService,
    CartAbandonmentService,
    SmtpService,
    WhatsappClient,
    EmailProcessor,
    WhatsappProcessor,
    CartAbandonmentProcessor,
  ],
  exports: [NotificationsService, CartAbandonmentService, SmtpService, WhatsappClient],
})
export class NotificationsModule {}
