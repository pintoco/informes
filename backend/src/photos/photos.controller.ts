import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PhotosService } from './photos.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('photos')
@UseGuards(JwtAuthGuard)
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Get('service/:serviceId')
  getByService(@Param('serviceId') serviceId: string) {
    return this.photosService.getPhotosByService(serviceId);
  }
}
