import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { generateReportHtml } from './templates/report.html';
import { PDF_QUEUE } from '../../queue/queue.module';
import { PdfJobData } from '../../queue/queue.service';

@Processor(PDF_QUEUE)
export class PdfWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfWorkerProcessor.name);
  private readonly prisma = new PrismaClient();
  private readonly s3: S3Client;
  private readonly photosBucket = process.env.S3_BUCKET_PHOTOS || 'elemental-photos';
  private readonly pdfsBucket = process.env.S3_BUCKET_PDFS || 'elemental-pdfs';
  private readonly s3PublicEndpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || '';

  constructor() {
    super();
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async process(job: Job<PdfJobData>): Promise<void> {
    const { pdfId, serviceId } = job.data;
    this.logger.log(`[BullMQ] Processing PDF job ${job.id}: pdfId=${pdfId}`);

    await this.prisma.servicePdf.update({
      where: { id: pdfId },
      data: { status: 'PROCESSING' },
    });

    try {
      const service = await this.prisma.service.findFirst({
        where: { id: serviceId },
        include: { photos: { orderBy: { orden: 'asc' } } },
      });

      if (!service) throw new Error(`Service ${serviceId} not found`);

      // Download photos and convert to base64
      const photosWithData = await Promise.all(
        service.photos.map(async (photo) => {
          try {
            const res = await this.s3.send(
              new GetObjectCommand({ Bucket: this.photosBucket, Key: photo.s3Key }),
            );
            const chunks: Uint8Array[] = [];
            for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
              chunks.push(chunk);
            }
            const base64 = Buffer.concat(chunks).toString('base64');
            const ext = photo.s3Key.split('.').pop()?.toLowerCase() || 'jpg';
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
            return { ...photo, dataUrl: `data:${mime};base64,${base64}` };
          } catch {
            return { ...photo, dataUrl: null };
          }
        }),
      );

      const html = generateReportHtml(service as any, photosWithData as any);

      // Generate PDF with Puppeteer
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      });
      await browser.close();

      // Upload to S3/MinIO
      const pdfKey = `services/${serviceId}/pdfs/${pdfId}.pdf`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.pdfsBucket,
          Key: pdfKey,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          ContentDisposition: `attachment; filename="informe-${service.ordenTrabajo}.pdf"`,
        }),
      );

      // Public URL: use S3_PUBLIC_ENDPOINT for browser-accessible URLs
      const endpoint = this.s3PublicEndpoint
        ? this.s3PublicEndpoint.replace(/\/$/, '')
        : `https://${this.pdfsBucket}.s3.amazonaws.com`;
      const pdfUrl = `${endpoint}/${this.pdfsBucket}/${pdfKey}`;

      await this.prisma.servicePdf.update({
        where: { id: pdfId },
        data: { status: 'READY', s3Key: pdfKey, url: pdfUrl },
      });

      this.logger.log(`PDF ${pdfId} generated OK`);
    } catch (error) {
      this.logger.error(`PDF ${pdfId} failed`, error);
      await this.prisma.servicePdf.update({
        where: { id: pdfId },
        data: {
          status: 'ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error; // BullMQ will retry
    }
  }
}
