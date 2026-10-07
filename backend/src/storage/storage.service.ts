import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Duración de las URLs firmadas de lectura (fotos y PDFs). Los buckets son privados.
const DEFAULT_SIGNED_URL_TTL_SECONDS = 2 * 60 * 60;
const UPLOAD_URL_TTL_SECONDS = 5 * 60;

/**
 * Acceso centralizado a MinIO/S3.
 * - `internal`: red privada (S3_ENDPOINT), usado por el backend y el worker.
 * - `public`: dominio público (S3_PUBLIC_ENDPOINT), usado solo para firmar URLs
 *   que abre el navegador; la firma incluye el host, por eso necesita su propio cliente.
 */
@Injectable()
export class StorageService {
  readonly photosBucket = process.env.S3_BUCKET_PHOTOS || 'elemental-photos';
  readonly pdfsBucket = process.env.S3_BUCKET_PDFS || 'elemental-pdfs';
  readonly internal: S3Client;
  private readonly public: S3Client;
  private readonly publicEndpoint: string;
  private readonly signedUrlTtl: number;

  constructor() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY no están configurados');
    }

    const region = process.env.AWS_REGION || 'us-east-1';
    const endpoint = process.env.S3_ENDPOINT;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    this.publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || endpoint || '';
    this.signedUrlTtl =
      parseInt(process.env.SIGNED_URL_TTL_SECONDS || '', 10) || DEFAULT_SIGNED_URL_TTL_SECONDS;

    const credentials = { accessKeyId, secretAccessKey };
    this.internal = new S3Client({
      region,
      credentials,
      ...(endpoint && { endpoint, forcePathStyle }),
    });
    this.public = new S3Client({
      region,
      credentials,
      ...(this.publicEndpoint && { endpoint: this.publicEndpoint, forcePathStyle }),
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  /** URL estable (sin firma) que se guarda en BD solo como referencia. */
  buildObjectUrl(bucket: string, key: string): string {
    if (this.publicEndpoint) {
      return `${this.publicEndpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }

  presignUpload(bucket: string, key: string, contentType: string, contentLength: number) {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: contentLength,
    });
    return getSignedUrl(this.public, command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
  }

  signedReadUrl(bucket: string, key: string, downloadName?: string) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(downloadName && {
        ResponseContentDisposition: `inline; filename="${downloadName.replace(/[^\w.\-]/g, '_')}"`,
      }),
    });
    return getSignedUrl(this.public, command, { expiresIn: this.signedUrlTtl });
  }

  head(bucket: string, key: string) {
    return this.internal.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  }

  async getBuffer(bucket: string, key: string): Promise<Buffer> {
    const res = await this.internal.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  put(bucket: string, key: string, body: Buffer, contentType: string) {
    return this.internal.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  delete(bucket: string, key: string) {
    return this.internal.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
