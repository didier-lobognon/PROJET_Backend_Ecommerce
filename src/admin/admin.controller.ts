import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { CustomerStatusDto } from './dto/customer-status.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('ping')
  @ApiOperation({ summary: 'Vérifier accès admin' })
  ping() {
    return { message: 'Accès admin autorisé' };
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Statistiques tableau de bord' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['today', '7d', '30d', 'month'],
    description: 'Période de filtrage des statistiques',
  })
  dashboardStats(@Query('period') period?: string) {
    return this.adminService.getDashboardStats(period);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Liste clients' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'suspended'] })
  customers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: 'active' | 'suspended',
  ) {
    return this.adminService.getCustomers({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      search,
      status,
    });
  }

  @Get('customers/:id')
  @ApiOperation({ summary: 'Détail client' })
  customerDetail(@Param('id') id: string) {
    return this.adminService.getCustomerDetail(id);
  }

  @Patch('customers/:id')
  @ApiOperation({ summary: 'Modifier un client' })
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.adminService.updateCustomer(id, dto);
  }

  @Patch('customers/:id/status')
  @ApiOperation({ summary: 'Suspendre ou réactiver un client' })
  setCustomerStatus(@Param('id') id: string, @Body() dto: CustomerStatusDto) {
    return this.adminService.setCustomerStatus(id, dto);
  }

  @Delete('customers/:id')
  @ApiOperation({ summary: 'Supprimer un client' })
  deleteCustomer(@Param('id') id: string) {
    return this.adminService.deleteCustomer(id);
  }

  @Get('orders/export')
  @ApiOperation({ summary: 'Export CSV commandes' })
  @ApiQuery({ name: 'status', required: false })
  async exportOrders(@Res() res: Response, @Query('status') status?: string) {
    const csv = await this.adminService.exportOrdersCsv(status);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="commandes-kanie-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }
}
