import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { SendCartReminderDto } from './dto/cart-reminder.dto';
import { MarketingAdminService } from './marketing-admin.service';

@ApiTags('admin-marketing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/marketing')
export class MarketingAdminController {
  constructor(private readonly marketingAdminService: MarketingAdminService) {}

  @Get('abandoned-carts')
  @ApiOperation({ summary: 'Paniers non vides avec client connecté' })
  listAbandonedCarts() {
    return this.marketingAdminService.listAbandonedCarts();
  }

  @Post('abandoned-carts/:cartId/remind')
  @ApiOperation({ summary: 'Relancer manuellement un client sur son panier' })
  sendCartReminder(@Param('cartId') cartId: string, @Body() dto: SendCartReminderDto) {
    return this.marketingAdminService.sendCartReminder(cartId, dto);
  }
}
