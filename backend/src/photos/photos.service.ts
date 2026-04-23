import { Injectable, Logger } from '@nestjs/common';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PhotosService {
  private readonly logger = new Logger(PhotosService.name);
  private readonly s3Client: S3Client;
  private readonly photosBucket: string;

  constructor(private prisma: PrismaService) {
    this.s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    this.photosBucket = process.env.S3_BUCKET_PHOTOS || '';
  }

  async getPhotosByService(serviceId: string) {
    return this.prisma.servicePhoto.findMany({
      where: { serviceId },
      orderBy: [{ categoria: 'asc' }, { orden: 'asc' }],
    });
  }

  async deletePhoto(photoId: string) {
    const photo = await this.prisma.servicePhoto.findUnique({
      where: { id: photoId },
    });

    if (!photo) return null;

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.photosBucket,
          Key: photo.s3Key,
        })
      );
    } catch (error) {
      this.logger.warn(`Failed to delete from S3: ${photo.s3Key}`);
    }

    return this.prisma.servicePhoto.delete({ where: { id: photoId } });
  }
}
