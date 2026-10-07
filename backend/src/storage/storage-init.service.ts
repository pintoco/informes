import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  DeleteBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

@Injectable()
export class StorageInitService implements OnModuleInit {
  private readonly logger = new Logger(StorageInitService.name);

  constructor(private readonly storage: StorageService) {}

  async onModuleInit() {
    // En AWS S3 los buckets se crean aparte (create-aws-resources.sh) y el usuario IAM
    // de la app no tiene permisos de administración: S3_INIT_BUCKETS=false.
    if (process.env.S3_INIT_BUCKETS === 'false') {
      this.logger.log('S3_INIT_BUCKETS=false: se omite la creación/configuración de buckets');
      return;
    }
    for (const bucket of [this.storage.photosBucket, this.storage.pdfsBucket]) {
      await this.ensureBucket(bucket);
      await this.ensurePrivate(bucket);
    }
  }

  private async ensureBucket(bucket: string) {
    try {
      await this.storage.internal.send(new HeadBucketCommand({ Bucket: bucket }));
      this.logger.log(`Bucket "${bucket}" already exists`);
    } catch {
      try {
        await this.storage.internal.send(new CreateBucketCommand({ Bucket: bucket }));
        this.logger.log(`Bucket "${bucket}" created`);
      } catch (err: any) {
        this.logger.error(`Failed to create bucket "${bucket}": ${err.message}`);
      }
    }
  }

  // Los buckets son privados: el navegador accede con URLs firmadas que expiran.
  // Se elimina cualquier política pública heredada (versiones anteriores la creaban).
  private async ensurePrivate(bucket: string) {
    try {
      await this.storage.internal.send(new DeleteBucketPolicyCommand({ Bucket: bucket }));
      this.logger.log(`Bucket "${bucket}" is private`);
    } catch (err: any) {
      if (err?.name !== 'NoSuchBucketPolicy') {
        this.logger.warn(`Could not remove policy on "${bucket}": ${err.message}`);
      }
    }
  }
}
