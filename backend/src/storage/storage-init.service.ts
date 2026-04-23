import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageInitService implements OnModuleInit {
  private readonly logger = new Logger(StorageInitService.name);
  private readonly s3Client: S3Client;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin123',
      },
      ...(endpoint && { endpoint, forcePathStyle }),
    });
  }

  async onModuleInit() {
    const buckets = [
      process.env.S3_BUCKET_PHOTOS || 'elemental-photos',
      process.env.S3_BUCKET_PDFS || 'elemental-pdfs',
    ];

    for (const bucket of buckets) {
      await this.ensureBucket(bucket);
    }

    // Make PDFs bucket publicly readable
    await this.setPublicReadPolicy(process.env.S3_BUCKET_PDFS || 'elemental-pdfs');
  }

  private async ensureBucket(bucket: string) {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
      this.logger.log(`Bucket "${bucket}" already exists`);
    } catch {
      try {
        await this.s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
        this.logger.log(`Bucket "${bucket}" created`);
      } catch (err: any) {
        this.logger.error(`Failed to create bucket "${bucket}": ${err.message}`);
      }
    }
  }

  private async setPublicReadPolicy(bucket: string) {
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    });

    try {
      await this.s3Client.send(
        new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }),
      );
      this.logger.log(`Public read policy set on "${bucket}"`);
    } catch (err: any) {
      this.logger.warn(`Could not set public policy on "${bucket}": ${err.message}`);
    }
  }
}
