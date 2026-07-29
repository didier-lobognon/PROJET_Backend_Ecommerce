import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { InitiatePaymentDto, PaymentStatusQueryDto } from './dto/initiate-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('initiate')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Préparer une session de paiement' })
  initiate(@Body() dto: InitiatePaymentDto, @CurrentUser() user?: JwtPayload) {
    return this.paymentsService.initiate(dto, user?.sub);
  }

  @Post('process')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Exécuter un paiement mobile money' })
  process(@Body() dto: ProcessPaymentDto, @CurrentUser() user?: JwtPayload) {
    return this.paymentsService.process(dto, user?.sub);
  }

  @Get('status/:orderNumber')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Statut du paiement d\'une commande' })
  getStatus(
    @Param('orderNumber') orderNumber: string,
    @Query() query: PaymentStatusQueryDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.paymentsService.getStatus(orderNumber, user?.sub, query.email);
  }

  @Patch('admin/:id/confirm-cod')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: 'Marquer un paiement à la livraison comme encaissé' })
  confirmCodPayment(@Param('id') id: string) {
    return this.paymentsService.confirmCodPayment(id);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook IPN PayDunya' })
  webhook(@Req() req: Request) {
    return this.paymentsService.handleWebhook(req.body as Record<string, unknown>);
  }
}
