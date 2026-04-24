import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { QueueService } from '../queue/queue.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { FilterServicesDto } from './dto/filter-services.dto';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  private readonly s3Client: S3Client;
  private readonly s3ClientPublic: S3Client;
  private readonly photosBucket: string;
  private readonly pdfsBucket: string;
  private readonly s3PublicEndpoint: string;

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
  ) {
    const region = process.env.AWS_REGION || 'us-east-1';
    const endpoint = process.env.S3_ENDPOINT;
    const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || endpoint;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    };

    // Internal client for backend operations (uses minio:9000 in Docker)
    this.s3Client = new S3Client({
      region,
      ...(endpoint && { endpoint, forcePathStyle }),
      credentials,
    });

    // Public client for presigned URLs (uses public endpoint so browser can reach it)
    this.s3ClientPublic = new S3Client({
      region,
      ...(publicEndpoint && { endpoint: publicEndpoint, forcePathStyle }),
      credentials,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.photosBucket = process.env.S3_BUCKET_PHOTOS || 'elemental-photos';
    this.pdfsBucket = process.env.S3_BUCKET_PDFS || 'elemental-pdfs';
    this.s3PublicEndpoint = publicEndpoint || '';
  }

  /** Build a public URL for a given bucket/key */
  private buildPublicUrl(bucket: string, key: string): string {
    if (this.s3PublicEndpoint) {
      const base = this.s3PublicEndpoint.replace(/\/$/, '');
      return `${base}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }

  private async generateOrdenTrabajo(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await this.prisma.$queryRaw<{ max_num: number | null }[]>`
      SELECT MAX(CAST(SPLIT_PART("ordenTrabajo", '-', 2) AS INTEGER)) AS max_num
      FROM "Service"
      WHERE "ordenTrabajo" LIKE ${`${year}-%`}
    `;
    const nextNum = (result[0]?.max_num ?? 0) + 1;
    return `${year}-${nextNum.toString().padStart(3, '0')}`;
  }

  async create(dto: CreateServiceDto, userId?: string) {
    const ordenTrabajo = await this.generateOrdenTrabajo();
    return this.prisma.service.create({
      data: {
        razonSocial: dto.razonSocial,
        ubicacion: dto.ubicacion,
        contactoTerreno: dto.contactoTerreno,
        ordenTrabajo,
        fecha: new Date(dto.fecha),
        horaInicio: dto.horaInicio,
        responsable: dto.responsable,
        nombreTecnico: dto.nombreTecnico,
        fono: dto.fono,
        email: dto.email,
        tipoMantenimiento: dto.tipoMantenimiento,
        comentarioNvr: dto.comentarioNvr,
        comentarioCamaras: dto.comentarioCamaras,
        observaciones: dto.observaciones,
        firmaUrl: dto.firmaUrl,
        firmaNombreReceptor: dto.firmaNombreReceptor,
        createdBy: userId,
      },
      include: { photos: true, pdfs: true },
    });
  }

  async findAll(filters: FilterServicesDto) {
    const { ubicacion, fechaDesde, fechaHasta, search, page = 1, limit = 20 } = filters;
    const where: Prisma.ServiceWhereInput = { deletedAt: null };

    if (ubicacion) where.ubicacion = { contains: ubicacion, mode: 'insensitive' };
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) (where.fecha as Prisma.DateTimeFilter).gte = new Date(fechaDesde);
      if (fechaHasta) {
        const end = new Date(fechaHasta);
        end.setHours(23, 59, 59, 999);
        (where.fecha as Prisma.DateTimeFilter).lte = end;
      }
    }
    if (search) {
      where.OR = [
        { razonSocial: { contains: search, mode: 'insensitive' } },
        { ordenTrabajo: { contains: search, mode: 'insensitive' } },
        { nombreTecnico: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.service.count({ where }),
      this.prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          photos: { orderBy: { orden: 'asc' } },
          pdfs: { orderBy: { version: 'asc' } },
        },
      }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      include: {
        photos: { orderBy: { orden: 'asc' } },
        pdfs: { orderBy: { version: 'asc' } },
        user: true,
      },
    });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);
    const updateData: Prisma.ServiceUpdateInput = {};
    if (dto.razonSocial !== undefined) updateData.razonSocial = dto.razonSocial;
    if (dto.ubicacion !== undefined) updateData.ubicacion = dto.ubicacion;
    if (dto.contactoTerreno !== undefined) updateData.contactoTerreno = dto.contactoTerreno;
    if (dto.ordenTrabajo !== undefined) updateData.ordenTrabajo = dto.ordenTrabajo;
    if (dto.fecha !== undefined) updateData.fecha = new Date(dto.fecha);
    if (dto.horaInicio !== undefined) updateData.horaInicio = dto.horaInicio;
    if (dto.responsable !== undefined) updateData.responsable = dto.responsable;
    if (dto.nombreTecnico !== undefined) updateData.nombreTecnico = dto.nombreTecnico;
    if (dto.fono !== undefined) updateData.fono = dto.fono;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.tipoMantenimiento !== undefined) updateData.tipoMantenimiento = dto.tipoMantenimiento;
    if (dto.comentarioNvr !== undefined) updateData.comentarioNvr = dto.comentarioNvr;
    if (dto.comentarioCamaras !== undefined) updateData.comentarioCamaras = dto.comentarioCamaras;
    if (dto.observaciones !== undefined) updateData.observaciones = dto.observaciones;
    if (dto.firmaUrl !== undefined) updateData.firmaUrl = dto.firmaUrl;
    if (dto.firmaNombreReceptor !== undefined) updateData.firmaNombreReceptor = dto.firmaNombreReceptor;

    return this.prisma.service.update({
      where: { id },
      data: updateData,
      include: {
        photos: { orderBy: { orden: 'asc' } },
        pdfs: { orderBy: { version: 'asc' } },
      },
    });
  }

  async softDelete(id: string) {
    await this.findOne(id);
    return this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getPresignedPhotoUrl(
    serviceId: string,
    filename: string,
    categoria: string,
    contentType: string,
  ) {
    await this.findOne(serviceId);
    const count = await this.prisma.servicePhoto.count({ where: { serviceId } });
    if (count >= 30) throw new BadRequestException('Maximum 30 photos per service');

    const ext = filename.split('.').pop() || 'jpg';
    const key = `services/${serviceId}/photos/${categoria.toLowerCase()}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.photosBucket,
      Key: key,
      ContentType: contentType,
    });

    // Use the public client so the presigned URL is signed for localhost:9000 (browser-accessible)
    const presignedUrl = await getSignedUrl(this.s3ClientPublic, command, { expiresIn: 300 });

    const url = this.buildPublicUrl(this.photosBucket, key);
    return { presignedUrl, key, url };
  }

  async confirmPhotoUpload(
    serviceId: string,
    data: {
      key: string;
      url: string;
      originalName: string;
      sizeBytes: number;
      categoria: string;
      orden: number;
    },
  ) {
    await this.findOne(serviceId);
    return this.prisma.servicePhoto.create({
      data: {
        serviceId,
        categoria: data.categoria as any,
        s3Key: data.key,
        url: data.url,
        originalName: data.originalName,
        sizeBytes: data.sizeBytes,
        orden: data.orden,
      },
    });
  }

  async deletePhoto(serviceId: string, photoId: string) {
    const photo = await this.prisma.servicePhoto.findFirst({
      where: { id: photoId, serviceId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.photosBucket, Key: photo.s3Key }),
      );
    } catch (err) {
      this.logger.warn(`S3 delete failed for ${photo.s3Key}`, err);
    }

    await this.prisma.servicePhoto.delete({ where: { id: photoId } });
    return { success: true };
  }

  async requestPdf(serviceId: string) {
    await this.findOne(serviceId);

    const lastPdf = await this.prisma.servicePdf.findFirst({
      where: { serviceId },
      orderBy: { version: 'desc' },
    });
    const version = (lastPdf?.version || 0) + 1;

    const pdf = await this.prisma.servicePdf.create({
      data: { serviceId, version, status: 'PENDING' },
    });

    try {
      await this.queueService.enqueuePdfJob({ pdfId: pdf.id, serviceId, version });
    } catch (error) {
      await this.prisma.servicePdf.update({
        where: { id: pdf.id },
        data: { status: 'ERROR', errorMessage: 'Failed to queue PDF job' },
      });
      throw new BadRequestException('Failed to queue PDF generation');
    }

    return pdf;
  }

  async getPdfStatus(serviceId: string, pdfId: string) {
    const pdf = await this.prisma.servicePdf.findFirst({
      where: { id: pdfId, serviceId },
    });
    if (!pdf) throw new NotFoundException('PDF not found');
    return pdf;
  }
}
