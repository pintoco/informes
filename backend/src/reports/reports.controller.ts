import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { ReportsService } from './reports.service';
import { CompanyQueryDto, MonthlyReportQueryDto } from './dto/monthly-report.dto';

// Informe mensual por institución, según su período (Company.periodStartDay). Solo ADMIN.
@Controller('reports/monthly')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('periods')
  periods(@Query() q: CompanyQueryDto) {
    return this.reports.getPeriods(q.companyId);
  }

  @Get()
  monthly(@Query() q: MonthlyReportQueryDto) {
    return this.reports.getMonthly(q.companyId, q.from);
  }

  @Post('generate-missing')
  @HttpCode(HttpStatus.OK)
  generateMissing(@Body() body: MonthlyReportQueryDto, @Request() req: any) {
    return this.reports.generateMissing(body.companyId, body.from, req.user.sub);
  }

  @Get('zip')
  async zip(@Query() q: MonthlyReportQueryDto, @Res() res: Response) {
    const { buffer, filename } = await this.reports.buildZip(q.companyId, q.from);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('pdf')
  async pdf(@Query() q: MonthlyReportQueryDto, @Request() req: any, @Res() res: Response) {
    const { buffer, filename } = await this.reports.buildConsolidated(q.companyId, q.from, req.user.name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
