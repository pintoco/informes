import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';

export { PDF_QUEUE } from './queue.service';

@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
