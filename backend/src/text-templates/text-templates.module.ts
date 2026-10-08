import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TextTemplatesController } from './text-templates.controller';
import { TextTemplatesService } from './text-templates.service';

@Module({
  imports: [PrismaModule],
  controllers: [TextTemplatesController],
  providers: [TextTemplatesService],
})
export class TextTemplatesModule {}
