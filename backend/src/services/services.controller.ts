import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { FilterServicesDto } from './dto/filter-services.dto';
import { PresignPhotoDto, ConfirmPhotoDto } from './dto/photo.dto';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  findAll(@Query() filters: FilterServicesDto) {
    return this.servicesService.findAll(filters);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateServiceDto, @Request() req: any) {
    return this.servicesService.create(dto, req.user?.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
    @Request() req: any,
  ) {
    return this.servicesService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@Param('id') id: string, @Request() req: any) {
    return this.servicesService.softDelete(id, req.user?.sub);
  }

  // ── Photos ──────────────────────────────────────────────────────────────────

  @Post(':id/photos/presign')
  getPresignedUrl(
    @Param('id') id: string,
    @Body() body: PresignPhotoDto,
  ) {
    return this.servicesService.getPresignedPhotoUrl(
      id,
      body.filename,
      body.categoria,
      body.contentType,
    );
  }

  @Post(':id/photos/confirm')
  @HttpCode(HttpStatus.CREATED)
  confirmPhotoUpload(
    @Param('id') id: string,
    @Body() body: ConfirmPhotoDto,
  ) {
    return this.servicesService.confirmPhotoUpload(id, body);
  }

  @Delete(':id/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePhoto(
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.servicesService.deletePhoto(id, photoId);
  }

  // ── PDFs ────────────────────────────────────────────────────────────────────

  @Post(':id/pdfs')
  @HttpCode(HttpStatus.CREATED)
  requestPdf(@Param('id') id: string, @Request() req: any) {
    return this.servicesService.requestPdf(id, req.user?.sub);
  }

  @Get(':id/pdfs/:pdfId')
  getPdfStatus(@Param('id') id: string, @Param('pdfId') pdfId: string) {
    return this.servicesService.getPdfStatus(id, pdfId);
  }
}
