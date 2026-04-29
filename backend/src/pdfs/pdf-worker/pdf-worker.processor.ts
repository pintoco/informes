import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../../prisma/prisma.service';
import { generateReportHtml } from './templates/report.html';
import { PDF_QUEUE } from '../../queue/queue.module';
import { PdfJobData } from '../../queue/queue.service';

@Processor(PDF_QUEUE)
export class PdfWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfWorkerProcessor.name);
  private readonly s3: S3Client;
  private readonly photosBucket = process.env.S3_BUCKET_PHOTOS || 'elemental-photos';
  private readonly pdfsBucket = process.env.S3_BUCKET_PDFS || 'elemental-pdfs';
  private readonly s3PublicEndpoint = process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || '';

  constructor(private readonly prisma: PrismaService) {
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
    const { pdfId, serviceId, version, requestedBy } = job.data;
    this.logger.log(`[PDF] Iniciando generación: jobId=${job.id} pdfId=${pdfId} serviceId=${serviceId} v${version}`);

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

      // Snapshot inmutable de los datos al momento de generación
      const dataSnapshot = {
        ordenTrabajo: service.ordenTrabajo,
        razonSocial: service.razonSocial,
        ubicacion: service.ubicacion,
        contactoTerreno: service.contactoTerreno,
        fecha: service.fecha.toISOString(),
        horaInicio: service.horaInicio,
        responsable: service.responsable,
        nombreTecnico: service.nombreTecnico,
        fono: service.fono,
        email: service.email,
        tipoMantenimiento: service.tipoMantenimiento,
        comentarioNvr: service.comentarioNvr,
        comentarioCamaras: service.comentarioCamaras,
        observaciones: service.observaciones,
        totalFotos: service.photos.length,
        generatedAt: new Date().toISOString(),
        version,
      };

      // Descargar fotos y convertir a base64
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
            const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            return { ...photo, dataUrl: `data:${mime};base64,${base64}` };
          } catch (err) {
            this.logger.warn(`[PDF] No se pudo descargar foto ${photo.id}: ${err}`);
            return { ...photo, dataUrl: null };
          }
        }),
      );

      const html = generateReportHtml(service as any, photosWithData as any);

      // Generar PDF con Puppeteer
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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

      // Subir PDF a S3/MinIO
      const pdfKey = `services/${serviceId}/pdfs/${pdfId}.pdf`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.pdfsBucket,
          Key: pdfKey,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          ContentDisposition: `inline; filename="informe-${service.ordenTrabajo}.pdf"`,
        }),
      );

      const endpoint = this.s3PublicEndpoint
        ? this.s3PublicEndpoint.replace(/\/$/, '')
        : `https://${this.pdfsBucket}.s3.amazonaws.com`;
      const pdfUrl = `${endpoint}/${this.pdfsBucket}/${pdfKey}`;

      await this.prisma.servicePdf.update({
        where: { id: pdfId },
        data: {
          status: 'READY',
          s3Key: pdfKey,
          url: pdfUrl,
          generatedBy: 'pdf-worker',
          dataSnapshot,
        },
      });

      this.logger.log(`[PDF] Generado OK: pdfId=${pdfId} url=${pdfUrl}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[PDF] Error en pdfId=${pdfId}: ${msg}`, error instanceof Error ? error.stack : undefined);

      await this.prisma.servicePdf.update({
        where: { id: pdfId },
        data: { status: 'ERROR', errorMessage: msg },
      });

      throw error; // BullMQ reintentará según la config del job
    }
  }
}
