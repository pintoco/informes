import { Module } from '@nestjs/common';
import { PdfsController } from './pdfs.controller';
import { PdfsService } from './pdfs.service';
import { PdfWorkerModule } from './pdf-worker/pdf-worker.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, PdfWorkerModule],
  controllers: [PdfsController],
  providers: [PdfsService],
  exports: [PdfsService],
})
export class PdfsModule {}
