import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as AdmZip from 'adm-zip';
import { v4 as uuidv4 } from 'uuid';
import { Prisma, PhotoCategory, ServicePhoto, ServicePdf } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/create-service.dto';
import { FilterServicesDto } from './dto/filter-services.dto';
import { ConfirmPhotoDto, MAX_FILE_SIZE_BYTES } from './dto/photo.dto';

const MAX_PHOTOS_PER_SERVICE = 30;
const APP_TIME_ZONE = 'America/Santiago';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Campos del usuario creador que se exponen en el detalle (nunca passwordHash)
const CREATOR_SELECT = { id: true, name: true, email: true } as const;

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(
    private prisma: PrismaService,
    private queueService: QueueService,
    private storage: StorageService,
  ) {}

  // ── URLs firmadas ─────────────────────────────────────────────────────────────
  // Los buckets son privados. La URL guardada en BD se reemplaza en cada respuesta
  // por una URL firmada temporal (ver StorageService.signedReadUrl).

  private async signPhoto<T extends ServicePhoto>(photo: T): Promise<T> {
    return { ...photo, url: await this.storage.signedReadUrl(this.storage.photosBucket, photo.s3Key) };
  }

  private async signPdf<T extends ServicePdf>(pdf: T, ordenTrabajo?: string): Promise<T> {
    if (!pdf.s3Key) return pdf;
    const name = ordenTrabajo ? `informe-${ordenTrabajo}.pdf` : undefined;
    return { ...pdf, url: await this.storage.signedReadUrl(this.storage.pdfsBucket, pdf.s3Key, name) };
  }

  private async withSignedUrls<
    T extends { ordenTrabajo: string; photos?: ServicePhoto[]; pdfs?: ServicePdf[] },
  >(service: T): Promise<T> {
    const [photos, pdfs] = await Promise.all([
      service.photos ? Promise.all(service.photos.map((p) => this.signPhoto(p))) : undefined,
      service.pdfs
        ? Promise.all(service.pdfs.map((p) => this.signPdf(p, service.ordenTrabajo)))
        : undefined,
    ]);
    return {
      ...service,
      ...(photos && { photos }),
      ...(pdfs && { pdfs }),
    };
  }

  // ── Orden de trabajo ─────────────────────────────────────────────────────────

  /**
   * Genera el siguiente número de OT (YYYY-NNN) dentro de la transacción recibida.
   * pg_advisory_xact_lock se mantiene hasta el commit, así que el INSERT que sigue
   * en la misma transacción queda serializado y no hay números duplicados.
   */
  private async nextOrdenTrabajo(tx: Prisma.TransactionClient): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(987654321)`;

    const year = new Date().getFullYear();
    const result = await tx.$queryRaw<{ max_num: number | null }[]>`
      SELECT MAX(CAST(SPLIT_PART("ordenTrabajo", '-', 2) AS INTEGER)) AS max_num
      FROM "Service"
      WHERE "ordenTrabajo" ~ ${`^${year}-[0-9]+$`}
    `;
    const nextNum = (result[0]?.max_num ?? 0) + 1;
    return `${year}-${nextNum.toString().padStart(3, '0')}`;
  }

  async create(dto: CreateServiceDto, userId?: string) {
    const service = await this.prisma.$transaction(async (tx) => {
      const ordenTrabajo = await this.nextOrdenTrabajo(tx);
      this.logger.log(`Creando servicio OT=${ordenTrabajo} por usuario=${userId}`);

      return tx.service.create({
        data: {
          ordenTrabajo,
          razonSocial: dto.razonSocial,
          ubicacion: dto.ubicacion,
          contactoTerreno: dto.contactoTerreno,
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
    });
    return this.withSignedUrls(service);
  }

  private buildWhere(filters: FilterServicesDto): Prisma.ServiceWhereInput {
    const { ubicacion, fechaDesde, fechaHasta, search, nombreTecnico, tipoMantenimiento } = filters;
    const where: Prisma.ServiceWhereInput = { deletedAt: null };

    if (ubicacion) where.ubicacion = { contains: ubicacion, mode: 'insensitive' };
    if (nombreTecnico) where.nombreTecnico = { contains: nombreTecnico, mode: 'insensitive' };
    if (tipoMantenimiento) where.tipoMantenimiento = tipoMantenimiento;
    // `fecha` se guarda como medianoche UTC del día elegido (YYYY-MM-DD), así que
    // los límites se calculan en UTC sin importar la zona horaria del servidor.
    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) (where.fecha as Prisma.DateTimeFilter).gte = new Date(fechaDesde);
      if (fechaHasta) {
        const end = new Date(fechaHasta);
        end.setUTCHours(23, 59, 59, 999);
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
    return where;
  }

  async findAll(filters: FilterServicesDto) {
    const { page = 1, limit = 20 } = filters;
    const where = this.buildWhere(filters);
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

    const signed = await Promise.all(data.map((s) => this.withSignedUrls(s)));
    return { data: signed, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Primer día del mes actual en hora de Chile, expresado como fecha UTC (igual que `fecha`). */
  private startOfCurrentMonth(): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date());
    const year = Number(parts.find((p) => p.type === 'year')!.value);
    const month = Number(parts.find((p) => p.type === 'month')!.value);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  async getStats() {
    const startOfMonth = this.startOfCurrentMonth();
    const where = { deletedAt: null };

    const [total, thisMonth, withSignature, byMaintenance, topTechnicians] = await Promise.all([
      this.prisma.service.count({ where }),
      this.prisma.service.count({ where: { ...where, fecha: { gte: startOfMonth } } }),
      this.prisma.service.count({ where: { ...where, firmaUrl: { not: null } } }),
      this.prisma.service.groupBy({
        by: ['tipoMantenimiento'],
        where,
        _count: { id: true },
      }),
      this.prisma.service.groupBy({
        by: ['nombreTecnico'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      total,
      thisMonth,
      withSignature,
      withoutSignature: total - withSignature,
      byMaintenance: Object.fromEntries(
        byMaintenance.map((b) => [b.tipoMantenimiento, b._count.id]),
      ),
      topTechnicians: topTechnicians.map((t) => ({ name: t.nombreTecnico, count: t._count.id })),
    };
  }

  async clone(id: string, userId?: string) {
    const original = await this.findServiceOrThrow(id);

    const service = await this.prisma.$transaction(async (tx) => {
      const ordenTrabajo = await this.nextOrdenTrabajo(tx);
      this.logger.log(`Clonando servicio id=${id} → OT=${ordenTrabajo} por usuario=${userId}`);

      return tx.service.create({
        data: {
          ordenTrabajo,
          razonSocial: original.razonSocial,
          ubicacion: original.ubicacion,
          contactoTerreno: original.contactoTerreno,
          // Hoy en Chile, guardado como medianoche UTC igual que las fechas del formulario
          fecha: new Date(
            new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date()),
          ),
          horaInicio: original.horaInicio,
          responsable: original.responsable,
          nombreTecnico: original.nombreTecnico,
          fono: original.fono,
          email: original.email,
          tipoMantenimiento: original.tipoMantenimiento,
          comentarioNvr: original.comentarioNvr,
          comentarioCamaras: original.comentarioCamaras,
          observaciones: original.observaciones,
          createdBy: userId,
        },
        include: { photos: true, pdfs: true },
      });
    });
    return this.withSignedUrls(service);
  }

  async exportCsv(filters: FilterServicesDto): Promise<string> {
    const where = this.buildWhere(filters);
    const services = await this.prisma.service.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: { photos: { select: { categoria: true } } },
    });

    const maintenanceLabel = (t: string) =>
      ({ PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo', INSTALLATION: 'Instalación', OTHER: 'Otro' })[t] ?? t;

    const formatDate = (d: Date) => {
      const day = d.getUTCDate().toString().padStart(2, '0');
      const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
      return `${day}/${month}/${d.getUTCFullYear()}`;
    };

    const esc = (v: string | null | undefined) => {
      if (v == null) return '';
      let s = String(v);
      // Evita inyección de fórmulas al abrir el CSV en Excel (=, +, -, @)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = [
      'Orden de Trabajo', 'Razón Social', 'Ubicación', 'Contacto Terreno',
      'Fecha', 'Hora Inicio', 'Responsable', 'Técnico', 'Fono', 'Email',
      'Tipo Mantenimiento', 'Fotos Antes', 'Fotos Después', 'Con Firma',
      'Comentario NVR', 'Comentario Cámaras', 'Observaciones',
    ];

    const rows = services.map((s) =>
      [
        s.ordenTrabajo, s.razonSocial, s.ubicacion, s.contactoTerreno,
        formatDate(s.fecha), s.horaInicio, s.responsable, s.nombreTecnico,
        s.fono, s.email, maintenanceLabel(s.tipoMantenimiento),
        s.photos.filter((p) => p.categoria === 'BEFORE').length.toString(),
        s.photos.filter((p) => p.categoria === 'AFTER').length.toString(),
        s.firmaUrl ? 'Sí' : 'No',
        s.comentarioNvr ?? '', s.comentarioCamaras ?? '', s.observaciones ?? '',
      ].map(esc).join(','),
    );

    return [headers.join(','), ...rows].join('\n');
  }

  /** Verifica que el servicio exista (no eliminado) sin cargar relaciones. */
  private async findServiceOrThrow(id: string) {
    const service = await this.prisma.service.findFirst({ where: { id, deletedAt: null } });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return service;
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, deletedAt: null },
      include: {
        photos: { orderBy: { orden: 'asc' } },
        pdfs: { orderBy: { version: 'asc' } },
        user: { select: CREATOR_SELECT },
      },
    });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return this.withSignedUrls(service);
  }

  async update(id: string, dto: UpdateServiceDto, userId?: string) {
    await this.findServiceOrThrow(id);

    const updateData: Prisma.ServiceUpdateInput = {
      updatedBy: userId,
    };

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
    if (dto.comentarioNvr !== undefined) updateData.comentarioNvr = dto.comentarioNvr || null;
    if (dto.comentarioCamaras !== undefined) updateData.comentarioCamaras = dto.comentarioCamaras || null;
    if (dto.observaciones !== undefined) updateData.observaciones = dto.observaciones || null;
    if (dto.firmaUrl !== undefined) updateData.firmaUrl = dto.firmaUrl || null;
    if (dto.firmaNombreReceptor !== undefined) updateData.firmaNombreReceptor = dto.firmaNombreReceptor || null;

    this.logger.log(`Actualizando servicio id=${id} por usuario=${userId}`);

    // Un ordenTrabajo duplicado lanza P2002 → PrismaExceptionFilter responde 409
    const service = await this.prisma.service.update({
      where: { id },
      data: updateData,
      include: {
        photos: { orderBy: { orden: 'asc' } },
        pdfs: { orderBy: { version: 'asc' } },
      },
    });
    return this.withSignedUrls(service);
  }

  async softDelete(id: string, userId?: string) {
    await this.findServiceOrThrow(id);
    this.logger.warn(`Eliminando (soft) servicio id=${id} por usuario=${userId}`);
    await this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: userId },
    });
  }

  // ── Fotos ────────────────────────────────────────────────────────────────────

  async getPresignedPhotoUrl(
    serviceId: string,
    categoria: PhotoCategory,
    contentType: string,
    sizeBytes: number,
  ) {
    await this.findServiceOrThrow(serviceId);
    const count = await this.prisma.servicePhoto.count({ where: { serviceId } });
    if (count >= MAX_PHOTOS_PER_SERVICE) {
      throw new BadRequestException(`Maximum ${MAX_PHOTOS_PER_SERVICE} photos per service`);
    }

    // La extensión sale del tipo validado, no del nombre que manda el cliente
    const ext = EXTENSION_BY_MIME[contentType];
    const key = `services/${serviceId}/photos/${categoria.toLowerCase()}/${uuidv4()}.${ext}`;

    const presignedUrl = await this.storage.presignUpload(
      this.storage.photosBucket,
      key,
      contentType,
      sizeBytes,
    );
    return { presignedUrl, key };
  }

  async confirmPhotoUpload(serviceId: string, data: ConfirmPhotoDto) {
    await this.findServiceOrThrow(serviceId);

    // La key debe pertenecer a este servicio y a la categoría indicada
    const expectedPrefix = `services/${serviceId}/photos/${data.categoria.toLowerCase()}/`;
    if (!data.key.startsWith(expectedPrefix)) {
      throw new BadRequestException('La foto no corresponde a este servicio');
    }

    const existing = await this.prisma.servicePhoto.findFirst({ where: { s3Key: data.key } });
    if (existing) throw new BadRequestException('La foto ya fue registrada');

    const count = await this.prisma.servicePhoto.count({ where: { serviceId } });
    if (count >= MAX_PHOTOS_PER_SERVICE) {
      throw new BadRequestException(`Maximum ${MAX_PHOTOS_PER_SERVICE} photos per service`);
    }

    // Verificar en MinIO que el archivo realmente existe y obtener su tamaño real
    let head;
    try {
      head = await this.storage.head(this.storage.photosBucket, data.key);
    } catch {
      throw new BadRequestException('La foto no se encuentra en el almacenamiento');
    }
    const sizeBytes = head.ContentLength ?? 0;
    const isImage = (head.ContentType ?? '').startsWith('image/');
    if (!isImage || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE_BYTES) {
      await this.storage.delete(this.storage.photosBucket, data.key).catch(() => undefined);
      throw new BadRequestException('Archivo inválido o demasiado grande');
    }

    const photo = await this.prisma.servicePhoto.create({
      data: {
        serviceId,
        categoria: data.categoria,
        s3Key: data.key,
        url: this.storage.buildObjectUrl(this.storage.photosBucket, data.key),
        originalName: data.originalName,
        sizeBytes,
        orden: data.orden,
      },
    });
    return this.signPhoto(photo);
  }

  async deletePhoto(serviceId: string, photoId: string) {
    const photo = await this.prisma.servicePhoto.findFirst({
      where: { id: photoId, serviceId },
    });
    if (!photo) throw new NotFoundException('Photo not found');

    try {
      await this.storage.delete(this.storage.photosBucket, photo.s3Key);
    } catch (err) {
      this.logger.warn(`S3 delete failed for ${photo.s3Key}`, err);
    }

    await this.prisma.servicePhoto.delete({ where: { id: photoId } });
    return { success: true };
  }

  // ── PDFs ─────────────────────────────────────────────────────────────────────

  async requestPdf(serviceId: string, userId?: string) {
    await this.findServiceOrThrow(serviceId);

    // Si ya hay uno en cola o generándose, se devuelve ese en vez de encolar otro
    // (evita lanzar varios Chromium a la vez por doble clic).
    const inProgress = await this.prisma.servicePdf.findFirst({
      where: { serviceId, status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: { version: 'desc' },
    });
    if (inProgress) return inProgress;

    const lastPdf = await this.prisma.servicePdf.findFirst({
      where: { serviceId },
      orderBy: { version: 'desc' },
    });
    const version = (lastPdf?.version || 0) + 1;

    const pdf = await this.prisma.servicePdf.create({
      data: {
        serviceId,
        version,
        status: 'PENDING',
        requestedBy: userId,
      },
    });

    this.logger.log(`PDF v${version} solicitado para servicio=${serviceId} por usuario=${userId}`);

    try {
      await this.queueService.enqueuePdfJob({
        pdfId: pdf.id,
        serviceId,
        version,
        requestedBy: userId,
      });
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
      where: { id: pdfId, serviceId, service: { deletedAt: null } },
      include: { service: { select: { ordenTrabajo: true } } },
    });
    if (!pdf) throw new NotFoundException('PDF not found');
    const { service, ...rest } = pdf;
    return this.signPdf(rest, service.ordenTrabajo);
  }

  async buildBulkPdfZip(serviceIds: string[]): Promise<Buffer> {
    const allPdfs = await this.prisma.servicePdf.findMany({
      where: {
        serviceId: { in: serviceIds },
        service: { deletedAt: null },
        status: 'READY',
        s3Key: { not: null },
      },
      orderBy: { version: 'desc' },
      include: { service: { select: { ordenTrabajo: true } } },
    });

    const seen = new Set<string>();
    const latestPdfs = allPdfs.filter((pdf) => {
      if (seen.has(pdf.serviceId)) return false;
      seen.add(pdf.serviceId);
      return true;
    });

    this.logger.log(`Bulk PDF: ${serviceIds.length} servicios solicitados, ${latestPdfs.length} PDFs READY encontrados`);

    const zip = new AdmZip();
    const usedNames = new Set<string>();

    // Descargas en lotes de 5 para no cargar todos los PDFs en paralelo en memoria
    const BATCH_SIZE = 5;
    for (let i = 0; i < latestPdfs.length; i += BATCH_SIZE) {
      const batch = latestPdfs.slice(i, i + BATCH_SIZE);
      const buffers = await Promise.all(
        batch.map((pdf) =>
          this.storage.getBuffer(this.storage.pdfsBucket, pdf.s3Key!).catch((err) => {
            this.logger.warn(`No se pudo obtener PDF ${pdf.id} de S3`, err);
            return null;
          }),
        ),
      );
      batch.forEach((pdf, idx) => {
        const buffer = buffers[idx];
        if (!buffer) return;
        // ordenTrabajo es editable: se sanea para que no pueda crear rutas dentro del ZIP
        let name = `${pdf.service.ordenTrabajo.replace(/[^\w.\-]/g, '_')}.pdf`;
        if (usedNames.has(name)) name = `${pdf.service.ordenTrabajo.replace(/[^\w.\-]/g, '_')}-${pdf.id.slice(0, 8)}.pdf`;
        usedNames.add(name);
        zip.addFile(name, buffer);
      });
    }

    return zip.toBuffer();
  }
}
