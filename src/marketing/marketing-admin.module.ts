import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketingAdminController } from './marketing-admin.controller';
import { MarketingAdminService } from './marketing-admin.service';

@Module({
  imports: [CrmModule, NotificationsModule],
  controllers: [MarketingAdminController],
  providers: [MarketingAdminService],
})
export class MarketingAdminModule {}
