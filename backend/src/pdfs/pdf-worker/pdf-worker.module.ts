import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { PdfWorkerService } from './pdf-worker.service';
import { PdfWorkerProcessor } from './pdf-worker.processor';
import { PDF_QUEUE } from '../../queue/queue.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: PDF_QUEUE }),
    PrismaModule,
  ],
  providers: [PdfWorkerService, PdfWorkerProcessor],
  exports: [PdfWorkerService],
})
export class PdfWorkerModule {}
