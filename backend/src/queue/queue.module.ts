import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService, PDF_QUEUE } from './queue.service';

export { PDF_QUEUE } from './queue.service';

@Module({
  imports: [BullModule.registerQueue({ name: PDF_QUEUE })],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
