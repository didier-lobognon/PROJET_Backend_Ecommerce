import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ReportsService } from './reports.service';

@ApiTags('admin-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
@Controller('admin/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales/summary')
  @ApiQuery({ name: 'period', required: false })
  salesSummary(@Query('period') period?: string) {
    return this.reportsService.getSalesSummary(period);
  }

  @Get('customers/summary')
  customersSummary() {
    return this.reportsService.getCustomersSummary();
  }

  @Get('sales/export')
  @ApiOperation({ summary: 'Export CSV ventes' })
  @ApiQuery({ name: 'period', required: false })
  async exportSales(@Res() res: Response, @Query('period') period?: string) {
    const csv = await this.reportsService.exportSalesCsv(period);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-ventes-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send('\uFEFF' + csv);
  }

  @Get('sales/export/pdf')
  @ApiOperation({ summary: 'Export PDF ventes' })
  @ApiQuery({ name: 'period', required: false })
  async exportSalesPdf(@Res() res: Response, @Query('period') period?: string) {
    const pdf = await this.reportsService.exportSalesPdf(period);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-ventes-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('customers/export')
  @ApiOperation({ summary: 'Export CSV clients' })
  async exportCustomers(@Res() res: Response) {
    const csv = await this.reportsService.exportCustomersCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-clients-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send('\uFEFF' + csv);
  }

  @Get('customers/export/pdf')
  @ApiOperation({ summary: 'Export PDF clients' })
  async exportCustomersPdf(@Res() res: Response) {
    const pdf = await this.reportsService.exportCustomersPdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-clients-${new Date().toISOString().slice(0, 10)}.pdf"`,
    );
    res.send(pdf);
  }
}
