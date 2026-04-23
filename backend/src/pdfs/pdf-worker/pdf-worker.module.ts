import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PdfWorkerService } from './pdf-worker.service';
import { PdfWorkerProcessor } from './pdf-worker.processor';
import { PDF_QUEUE } from '../../queue/queue.module';

@Module({
  imports: [BullModule.registerQueue({ name: PDF_QUEUE })],
  providers: [PdfWorkerService, PdfWorkerProcessor],
  exports: [PdfWorkerService],
})
export class PdfWorkerModule {}
