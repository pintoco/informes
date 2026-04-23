import { Injectable, Logger } from '@nestjs/common';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { SQSEvent } from 'aws-lambda';
import { generateReportHtml } from './templates/report.html';

// This service is used as a Lambda SQS consumer
// It runs independently from the NestJS HTTP server

const prisma = new PrismaClient();
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

const PDFS_BUCKET = process.env.S3_BUCKET_PDFS || '';
const PHOTOS_BUCKET = process.env.S3_BUCKET_PHOTOS || '';

@Injectable()
export class PdfWorkerService {
  private readonly logger = new Logger(PdfWorkerService.name);

  async processMessage(message: { pdfId: string; serviceId: string; version: number }) {
    const { pdfId, serviceId } = message;

    this.logger.log(`Processing PDF ${pdfId} for service ${serviceId}`);

    // Mark as processing
    await prisma.servicePdf.update({
      where: { id: pdfId },
      data: { status: 'PROCESSING' },
    });

    try {
      // Get service with photos
      const service = await prisma.service.findFirst({
        where: { id: serviceId },
        include: {
          photos: { orderBy: { orden: 'asc' } },
        },
      });

      if (!service) {
        throw new Error(`Service ${serviceId} not found`);
      }

      // Download photos from S3 and convert to base64
      const photosWithData = await Promise.all(
        service.photos.map(async (photo) => {
          try {
            const command = new GetObjectCommand({
              Bucket: PHOTOS_BUCKET,
              Key: photo.s3Key,
            });
            const response = await s3Client.send(command);
            const chunks: Uint8Array[] = [];
            const stream = response.Body as NodeJS.ReadableStream;
            for await (const chunk of stream) {
              chunks.push(chunk as Uint8Array);
            }
            const buffer = Buffer.concat(chunks);
            const base64 = buffer.toString('base64');
            const mimeType = 'image/jpeg';
            return {
              ...photo,
              dataUrl: `data:${mimeType};base64,${base64}`,
            };
          } catch (error) {
            this.logger.warn(`Failed to download photo ${photo.id}: ${error}`);
            return { ...photo, dataUrl: null };
          }
        })
      );

      // Generate HTML
      const html = generateReportHtml(service, photosWithData);

      // Use Puppeteer to generate PDF
      let pdfBuffer: Buffer;

      if (process.env.NODE_ENV === 'production') {
        // Lambda environment - use @sparticuz/chromium
        const chromium = require('@sparticuz/chromium');
        const puppeteer = require('puppeteer-core');

        const browser = await puppeteer.launch({
          args: chromium.args,
          defaultViewport: chromium.defaultViewport,
          executablePath: await chromium.executablePath(),
          headless: chromium.headless,
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        });
        await browser.close();
      } else {
        // Local development
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        });
        await browser.close();
      }

      // Upload PDF to S3
      const pdfKey = `services/${serviceId}/pdfs/${pdfId}.pdf`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: PDFS_BUCKET,
          Key: pdfKey,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          ContentDisposition: `attachment; filename="informe-${service.ordenTrabajo}.pdf"`,
        })
      );

      const pdfUrl = `https://${PDFS_BUCKET}.s3.amazonaws.com/${pdfKey}`;

      // Update PDF record to READY
      await prisma.servicePdf.update({
        where: { id: pdfId },
        data: {
          status: 'READY',
          s3Key: pdfKey,
          url: pdfUrl,
        },
      });

      this.logger.log(`PDF ${pdfId} generated successfully`);
    } catch (error) {
      this.logger.error(`Failed to generate PDF ${pdfId}`, error);

      await prisma.servicePdf.update({
        where: { id: pdfId },
        data: {
          status: 'ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

// Lambda SQS handler
export const sqsHandler = async (event: SQSEvent) => {
  const workerService = new PdfWorkerService();

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body);
      await workerService.processMessage(message);
    } catch (error) {
      console.error('Error processing SQS record:', error);
      throw error; // This will cause the message to go to DLQ
    }
  }
};
