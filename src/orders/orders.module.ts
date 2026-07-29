import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CartService } from './cart.service';
import { CartController, OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [MediaModule, NotificationsModule],
  controllers: [CartController, OrdersController],
  providers: [CartService, OrdersService],
  exports: [CartService, OrdersService],
})
export class OrdersModule {}
