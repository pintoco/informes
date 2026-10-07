import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import * as sharp from 'sharp';
import puppeteer, { Browser } from 'puppeteer';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { generateReportHtml } from './templates/report.html';
import { PDF_QUEUE } from '../../queue/queue.module';
import { PdfJobData } from '../../queue/queue.service';

// Máximo ancho de imagen embebida en el PDF. 1200px es suficiente para A4 a 150dpi.
const PDF_IMAGE_MAX_WIDTH = 1200;
const PDF_IMAGE_QUALITY = 72; // JPEG quality 1-100
const PDF_RENDER_TIMEOUT_MS = 60_000;

// concurrency 1: un solo Chromium a la vez (importante en instancias de 2 GB)
@Processor(PDF_QUEUE, { concurrency: 1 })
export class PdfWorkerProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfWorkerProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {
    super();
  }

  async process(job: Job<PdfJobData>): Promise<void> {
    const { pdfId, serviceId, version } = job.data;
    this.logger.log(`[PDF] Iniciando generación: jobId=${job.id} pdfId=${pdfId} serviceId=${serviceId} v${version}`);

    await this.prisma.servicePdf.update({
      where: { id: pdfId },
      data: { status: 'PROCESSING', errorMessage: null },
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

      // Descargar fotos de a una (menos RAM), comprimir con sharp y convertir a base64
      const photosWithData = [];
      for (const photo of service.photos) {
        try {
          const original = await this.storage.getBuffer(this.storage.photosBucket, photo.s3Key);
          const compressed = await sharp(original)
            .rotate() // respeta la orientación EXIF de fotos de celular
            .resize({ width: PDF_IMAGE_MAX_WIDTH, withoutEnlargement: true })
            .jpeg({ quality: PDF_IMAGE_QUALITY, progressive: true })
            .toBuffer();
          photosWithData.push({ ...photo, dataUrl: `data:image/jpeg;base64,${compressed.toString('base64')}` });
        } catch (err) {
          this.logger.warn(`[PDF] No se pudo procesar foto ${photo.id}: ${err}`);
          photosWithData.push({ ...photo, dataUrl: null });
        }
      }

      const html = generateReportHtml(service, photosWithData);
      const pdfBuffer = await this.renderPdf(html);

      // Subir PDF a S3/MinIO
      const pdfKey = `services/${serviceId}/pdfs/${pdfId}.pdf`;
      await this.storage.put(this.storage.pdfsBucket, pdfKey, pdfBuffer, 'application/pdf');

      await this.prisma.servicePdf.update({
        where: { id: pdfId },
        data: {
          status: 'READY',
          s3Key: pdfKey,
          url: this.storage.buildObjectUrl(this.storage.pdfsBucket, pdfKey),
          generatedBy: 'pdf-worker',
          dataSnapshot,
        },
      });

      this.logger.log(`[PDF] Generado OK: pdfId=${pdfId} key=${pdfKey}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`[PDF] Error en pdfId=${pdfId}: ${msg}`, error instanceof Error ? error.stack : undefined);

      const willRetry = job.attemptsMade + 1 < (job.opts.attempts ?? 1);
      await this.prisma.servicePdf.update({
        where: { id: pdfId },
        // Mientras queden reintentos se deja PENDING para que el frontend siga esperando
        data: willRetry
          ? { status: 'PENDING', errorMessage: msg }
          : { status: 'ERROR', errorMessage: msg },
      });

      throw error; // BullMQ reintentará según la config del job
    }
  }

  private async renderPdf(html: string): Promise<Buffer> {
    let browser: Browser | undefined;
    try {
      browser = await puppeteer.launch({
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
      await page.setJavaScriptEnabled(false);

      // El HTML es autocontenido (imágenes en data URLs): se bloquea cualquier petición
      // de red para que un contenido malicioso no pueda alcanzar servicios internos.
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (url.startsWith('data:') || url === 'about:blank') {
          req.continue();
        } else {
          req.abort();
        }
      });

      await page.setContent(html, { waitUntil: 'load', timeout: PDF_RENDER_TIMEOUT_MS });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        timeout: PDF_RENDER_TIMEOUT_MS,
      });
      return Buffer.from(pdf);
    } finally {
      // Siempre cerrar Chromium, incluso si falla: evita procesos huérfanos consumiendo RAM
      await browser?.close().catch(() => undefined);
    }
  }
}
