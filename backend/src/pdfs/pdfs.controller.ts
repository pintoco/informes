import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PdfsService } from './pdfs.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('pdfs')
@UseGuards(JwtAuthGuard)
export class PdfsController {
  constructor(private readonly pdfsService: PdfsService) {}

  @Get('service/:serviceId')
  getByService(@Param('serviceId') serviceId: string) {
    return this.pdfsService.getPdfsByService(serviceId);
  }
}
