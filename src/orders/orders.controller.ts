import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import {
  CheckoutDto,
  OrderQueryDto,
  TrackOrderDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';
import { CART_SESSION_HEADER } from './orders.constants';
import { OrdersService } from './orders.service';

@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Obtenir le panier' })
  getCart(
    @Headers(CART_SESSION_HEADER) sessionId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.cartService.getCart(sessionId, user?.sub);
  }

  @Post('items')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Ajouter un article au panier' })
  addItem(
    @Body() dto: AddCartItemDto,
    @Headers(CART_SESSION_HEADER) sessionId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.cartService.addItem(dto.productId, dto.quantity ?? 1, sessionId, user?.sub);
  }

  @Patch('items/:productId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Modifier la quantité' })
  updateItem(
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
    @Headers(CART_SESSION_HEADER) sessionId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.cartService.updateItemQuantity(productId, dto.quantity, sessionId, user?.sub);
  }

  @Delete('items/:productId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Retirer un article' })
  removeItem(
    @Param('productId') productId: string,
    @Headers(CART_SESSION_HEADER) sessionId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.cartService.removeItem(productId, sessionId, user?.sub);
  }

  @Delete()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Vider le panier' })
  clearCart(
    @Headers(CART_SESSION_HEADER) sessionId: string,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.cartService.clearCart(sessionId, user?.sub);
  }
}

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({ name: CART_SESSION_HEADER, required: false })
  @ApiOperation({ summary: 'Passer commande (utilisateur connecté requis)' })
  checkout(
    @Body() dto: CheckoutDto,
    @Headers(CART_SESSION_HEADER) sessionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.checkout(dto, sessionId, user.sub);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mes commandes' })
  myOrders(@CurrentUser() user: JwtPayload, @Query() query: OrderQueryDto) {
    return this.ordersService.findMyOrders(user.sub, query);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Liste commandes (admin)' })
  adminList(@Query() query: OrderQueryDto) {
    return this.ordersService.findAllAdmin(query);
  }

  @Get('admin/by-number/:orderNumber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Détail commande par numéro (admin)' })
  adminOrderByNumber(@Param('orderNumber') orderNumber: string) {
    return this.ordersService.findAdminByOrderNumber(orderNumber);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Changer le statut (admin)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.ordersService.updateStatus(id, dto, user.role);
  }

  @Get('admin/:id/notifications')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Historique notifications d\'une commande' })
  orderNotifications(@Param('id') id: string) {
    return this.ordersService.getOrderNotifications(id);
  }

  @Get(':orderNumber')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Suivi commande par numéro' })
  trackOrder(
    @Param('orderNumber') orderNumber: string,
    @Query() query: TrackOrderDto,
    @CurrentUser() user?: JwtPayload,
  ) {
    return this.ordersService.findByOrderNumber(orderNumber, user?.sub, query.email);
  }
}
