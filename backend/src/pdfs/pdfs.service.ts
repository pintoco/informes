import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PdfsService {
  private readonly logger = new Logger(PdfsService.name);

  constructor(private prisma: PrismaService) {}

  async getPdfsByService(serviceId: string) {
    return this.prisma.servicePdf.findMany({
      where: { serviceId },
      orderBy: { version: 'desc' },
    });
  }

  async updatePdfStatus(
    pdfId: string,
    status: string,
    data?: { s3Key?: string; url?: string; errorMessage?: string }
  ) {
    return this.prisma.servicePdf.update({
      where: { id: pdfId },
      data: {
        status: status as any,
        ...data,
      },
    });
  }
}
