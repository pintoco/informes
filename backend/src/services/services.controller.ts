import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { FilterServicesDto } from './dto/filter-services.dto';
import { PresignPhotoDto, ConfirmPhotoDto } from './dto/photo.dto';
import { BulkPdfDownloadDto } from './dto/bulk-pdf.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll(@Query() filters: FilterServicesDto) {
    return this.servicesService.findAll(filters);
  }

  @Get('stats')
  getStats() {
    return this.servicesService.getStats();
  }

  @Post('bulk-pdf-download')
  @HttpCode(HttpStatus.OK)
  async bulkPdfDownload(@Body() dto: BulkPdfDownloadDto, @Res() res: Response) {
    const today = new Date().toISOString().split('T')[0];
    const buffer = await this.servicesService.buildBulkPdfZip(dto.serviceIds);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="informes-${today}.zip"`);
    res.send(buffer);
  }

  @Get('export')
  async exportCsv(@Query() filters: FilterServicesDto, @Res() res: Response) {
    const csv = await this.servicesService.exportCsv(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="servicios.csv"');
    res.send(Buffer.from('﻿' + csv, 'utf-8'));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateServiceDto, @Request() req: any) {
    return this.servicesService.create(dto, req.user?.sub);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceDto,
    @Request() req: any,
  ) {
    return this.servicesService.update(id, dto, req.user?.sub);
  }

  // Solo ADMIN puede eliminar servicios
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.servicesService.softDelete(id, req.user?.sub);
  }

  // ── Photos ──────────────────────────────────────────────────────────────────

  @Post(':id/photos/presign')
  getPresignedUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PresignPhotoDto,
  ) {
    return this.servicesService.getPresignedPhotoUrl(
      id,
      body.categoria,
      body.contentType,
      body.sizeBytes,
    );
  }

  @Post(':id/photos/confirm')
  @HttpCode(HttpStatus.CREATED)
  confirmPhotoUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmPhotoDto,
  ) {
    return this.servicesService.confirmPhotoUpload(id, body);
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.servicesService.deletePhoto(id, photoId);
  }

  // ── PDFs ────────────────────────────────────────────────────────────────────

  @Post(':id/pdfs')
  @HttpCode(HttpStatus.CREATED)
  requestPdf(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.servicesService.requestPdf(id, req.user?.sub);
  }

  @Get(':id/pdfs/:pdfId')
  getPdfStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('pdfId', ParseUUIDPipe) pdfId: string,
  ) {
    return this.servicesService.getPdfStatus(id, pdfId);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  clone(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.servicesService.clone(id, req.user?.sub);
  }
}
