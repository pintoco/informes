import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ServicesService } from '../services/services.service';
import { renderHtmlToPdf } from '../pdfs/pdf-renderer';
import { generateMonthlyReportHtml } from './monthly-report.html';
import { Period, parseYmd, periodFrom, recentPeriods } from './periods';

const APP_TIME_ZONE = 'America/Santiago';
const WORK_EXCERPT_LENGTH = 220;

/**
 * Estado del PDF individual de un servicio dentro del informe mensual:
 * - READY: hay PDF y está al día
 * - STALE: hay PDF, pero el servicio cambió después de generarlo
 * - IN_PROGRESS: en cola o generándose
 * - MISSING: nunca se generó (o solo hay intentos fallidos)
 */
export type MonthlyPdfState = 'READY' | 'STALE' | 'IN_PROGRESS' | 'MISSING';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private servicesService: ServicesService,
  ) {}

  private async findCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Institución no encontrada');
    return company;
  }

  private resolvePeriod(from: string, startDay: number): Period {
    const period = periodFrom(from, startDay);
    if (!period) {
      throw new BadRequestException(`El período debe empezar el día ${startDay} de un mes`);
    }
    return period;
  }

  async getPeriods(companyId: string) {
    const company = await this.findCompany(companyId);
    const today = parseYmd(new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE }).format(new Date()));
    return {
      company: { id: company.id, name: company.name, periodStartDay: company.periodStartDay },
      periods: recentPeriods(today, company.periodStartDay),
    };
  }

  /** Servicios de la institución en el período, con el estado de su PDF. */
  private async loadPeriod(companyId: string, from: string) {
    const company = await this.findCompany(companyId);
    const period = this.resolvePeriod(from, company.periodStartDay);

    const services = await this.prisma.service.findMany({
      where: {
        razonSocial: company.name,
        deletedAt: null,
        fecha: { gte: parseYmd(period.from), lte: parseYmd(period.to) },
      },
      orderBy: [{ fecha: 'asc' }, { ordenTrabajo: 'asc' }],
      select: {
        id: true, ordenTrabajo: true, fecha: true, ubicacion: true, tipoMantenimiento: true,
        comentarioCamaras: true, observaciones: true, comentarioNvr: true,
        firmaUrl: true, updatedAt: true,
        photos: { select: { categoria: true } },
        pdfs: { select: { status: true, createdAt: true, s3Key: true }, orderBy: { version: 'desc' } },
      },
    });

    const rows = services.map((s) => {
      const latest = s.pdfs[0];
      const latestReady = s.pdfs.find((p) => p.status === 'READY' && p.s3Key);
      let pdf: MonthlyPdfState;
      if (latest && (latest.status === 'PENDING' || latest.status === 'PROCESSING')) pdf = 'IN_PROGRESS';
      else if (!latestReady) pdf = 'MISSING';
      else pdf = latestReady.createdAt < s.updatedAt ? 'STALE' : 'READY';

      return {
        id: s.id,
        ordenTrabajo: s.ordenTrabajo,
        fecha: s.fecha,
        ubicacion: s.ubicacion,
        tipoMantenimiento: s.tipoMantenimiento,
        trabajo: excerpt(s.comentarioCamaras || s.observaciones || s.comentarioNvr),
        firma: !!s.firmaUrl,
        fotos: s.photos.length,
        fotosDespues: s.photos.filter((p) => p.categoria === 'AFTER').length,
        pdf,
        pdfKey: latestReady?.s3Key ?? null,
      };
    });

    return { company, period, rows };
  }

  async getMonthly(companyId: string, from: string) {
    const { company, period, rows } = await this.loadPeriod(companyId, from);
    const byType: Record<string, number> = {};
    for (const r of rows) byType[r.tipoMantenimiento] = (byType[r.tipoMantenimiento] ?? 0) + 1;

    return {
      company: { id: company.id, name: company.name, periodStartDay: company.periodStartDay },
      period,
      totals: { total: rows.length, byType },
      services: rows.map(({ pdfKey, ...r }) => r),
    };
  }

  /** Encola los PDFs que faltan o quedaron desactualizados. */
  async generateMissing(companyId: string, from: string, userId: string) {
    const { rows } = await this.loadPeriod(companyId, from);
    const pending = rows.filter((r) => r.pdf === 'MISSING' || r.pdf === 'STALE');
    for (const r of pending) {
      await this.servicesService.requestPdf(r.id, userId);
    }
    this.logger.log(`Informe mensual: ${pending.length} PDFs encolados (empresa=${companyId}, desde=${from})`);
    return { queued: pending.length };
  }

  async buildZip(companyId: string, from: string) {
    const { company, period, rows } = await this.loadPeriod(companyId, from);
    const ids = rows.filter((r) => r.pdfKey).map((r) => r.id);
    if (ids.length === 0) throw new BadRequestException('No hay PDFs generados en este período');
    const buffer = await this.servicesService.buildBulkPdfZip(ids);
    return { buffer, filename: `${fileBase(company.name, period)}.zip` };
  }

  /** Portada + resumen, seguidos de los PDFs individuales del período en orden de fecha. */
  async buildConsolidated(companyId: string, from: string, emitidoPor: string) {
    const { company, period, rows } = await this.loadPeriod(companyId, from);
    if (rows.length === 0) throw new BadRequestException('No hay servicios en este período');

    const summary = await renderHtmlToPdf(
      generateMonthlyReportHtml({
        institucion: company.name,
        desde: parseYmd(period.from),
        hasta: parseYmd(period.to),
        emitidoPor,
        rows: rows.map((r) => ({ ...r, adjunto: !!r.pdfKey })),
      }),
    );

    const merged = await PDFDocument.create();
    merged.setTitle(`Informe mensual ${company.name} ${period.from} al ${period.to}`);
    merged.setAuthor('Elemental Pro');
    await appendPdf(merged, summary);

    // De a uno para no tener todos los PDFs en memoria a la vez
    for (const r of rows) {
      if (!r.pdfKey) continue;
      try {
        const bytes = await this.storage.getBuffer(this.storage.pdfsBucket, r.pdfKey);
        await appendPdf(merged, bytes);
      } catch (err) {
        this.logger.warn(`No se pudo adjuntar el PDF de ${r.ordenTrabajo}: ${err}`);
      }
    }

    const buffer = Buffer.from(await merged.save());
    return { buffer, filename: `${fileBase(company.name, period)}.pdf` };
  }
}

async function appendPdf(target: PDFDocument, bytes: Uint8Array) {
  const src = await PDFDocument.load(bytes);
  const pages = await target.copyPages(src, src.getPageIndices());
  pages.forEach((p) => target.addPage(p));
}

function excerpt(text: string | null | undefined): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > WORK_EXCERPT_LENGTH ? `${clean.slice(0, WORK_EXCERPT_LENGTH).trimEnd()}…` : clean;
}

function fileBase(companyName: string, period: Period): string {
  const slug = companyName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `Informe-${slug}-${period.from}_al_${period.to}`;
}
