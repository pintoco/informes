import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const PDF_QUEUE = 'pdf-jobs';

export interface PdfJobData {
  pdfId: string;
  serviceId: string;
  version: number;
  requestedBy?: string;
}

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(@InjectQueue(PDF_QUEUE) private readonly pdfQueue: Queue) {}

  async enqueuePdfJob(data: PdfJobData): Promise<void> {
    const job = await this.pdfQueue.add('generate-pdf', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
    this.logger.log(
      `PDF job enqueued: jobId=${job.id} serviceId=${data.serviceId} v${data.version}`,
    );
  }
}
