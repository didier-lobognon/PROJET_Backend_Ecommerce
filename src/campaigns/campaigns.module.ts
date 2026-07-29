import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { CAMPAIGN_QUEUE } from '../notifications/notifications.constants';
import { NotificationsModule } from '../notifications/notifications.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsProcessor } from './campaigns.processor';
import { CampaignsService } from './campaigns.service';

@Module({
  imports: [
    CrmModule,
    NotificationsModule,
    BullModule.registerQueue({ name: CAMPAIGN_QUEUE }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignsProcessor],
})
export class CampaignsModule {}
