import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';

export const PDF_QUEUE = 'pdf-jobs';

export interface PdfJobData {
  pdfId: string;
  serviceId: string;
  version: number;
}

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private pdfQueue: Queue;

  onModuleInit() {
    this.pdfQueue = new Queue(PDF_QUEUE, {
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    });
  }

  async onModuleDestroy() {
    await this.pdfQueue?.close();
  }

  async enqueuePdfJob(data: PdfJobData): Promise<void> {
    const job = await this.pdfQueue.add('generate-pdf', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.log(`PDF job enqueued: ${job.id} for service ${data.serviceId}`);
  }
}
