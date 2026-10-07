import { Module } from '@nestjs/common';
import { PdfWorkerModule } from './pdf-worker/pdf-worker.module';

@Module({
  imports: [PdfWorkerModule],
})
export class PdfsModule {}
