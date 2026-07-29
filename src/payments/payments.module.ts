import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { PaydunyaClient } from './paydunya/paydunya.client';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaydunyaClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
