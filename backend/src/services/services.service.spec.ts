import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { generateReportHtml } from '../pdfs/pdf-worker/templates/report.html';

const SERVICE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const PHOTO_UUID = '33333333-3333-4333-8333-333333333333';

const tx = {
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  service: { create: jest.fn() },
};

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
  },
  service: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  servicePhoto: {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  servicePdf: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockQueue = { enqueuePdfJob: jest.fn() };

const mockStorage = {
  photosBucket: 'elemental-photos',
  pdfsBucket: 'elemental-pdfs',
  signedReadUrl: jest.fn(async (_b: string, key: string) => `https://signed/${key}`),
  presignUpload: jest.fn(async () => 'https://upload'),
  buildObjectUrl: jest.fn((b: string, key: string) => `https://files/${b}/${key}`),
  head: jest.fn(),
  delete: jest.fn(async () => undefined),
  getBuffer: jest.fn(),
};

describe('ServicesService', () => {
  let service: ServicesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get(ServicesService);
  });

  const PROFILE = { name: 'Felipe Romero', phone: '+569 51996149', email: 'felipe@login.cl', contactEmail: 'tecnico@elementalpro.cl' };

  describe('create', () => {
    it('genera la OT y crea el servicio dentro de la misma transacción', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(PROFILE);
      mockPrisma.$transaction.mockImplementation((fn: any) => fn(tx));
      tx.$queryRaw.mockResolvedValue([{ max_num: 7 }]);
      tx.service.create.mockImplementation(async ({ data }: any) => ({
        id: SERVICE_ID,
        ...data,
        photos: [],
        pdfs: [],
      }));

      const result = await service.create(
        {
          razonSocial: 'Test Corp',
          ubicacion: 'Santiago',
          contactoTerreno: 'Juan',
          fecha: '2026-03-01',
          horaInicio: '09:00',
          responsable: 'Pedro',
          nombreTecnico: 'Carlos',
          fono: '+56912345678',
          email: 'tec@empresa.cl',
          tipoMantenimiento: 'PREVENTIVE' as any,
        },
        'user-1',
      );

      expect(tx.$executeRaw).toHaveBeenCalled(); // advisory lock
      expect(tx.service.create).toHaveBeenCalled();
      expect(result.ordenTrabajo).toMatch(/^\d{4}-008$/);
    });

    it('toma responsable, fono y email del perfil e ignora los del formulario', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(PROFILE);
      mockPrisma.$transaction.mockImplementation((fn: any) => fn(tx));
      tx.$queryRaw.mockResolvedValue([{ max_num: 0 }]);
      tx.service.create.mockImplementation(async ({ data }: any) => ({ id: SERVICE_ID, ...data, photos: [], pdfs: [] }));

      const result: any = await service.create(
        {
          razonSocial: 'Muni', ubicacion: 'Plaza', contactoTerreno: 'Ana', fecha: '2026-10-08',
          horaInicio: '10:00', tipoMantenimiento: 'CORRECTIVE' as any,
          responsable: 'Otro', nombreTecnico: 'Vicente', fono: '1', email: 'x@x.cl',
        },
        'user-1',
      );

      expect(result.responsable).toBe('Felipe Romero');
      expect(result.fono).toBe('+569 51996149');
      expect(result.email).toBe('tecnico@elementalpro.cl'); // contactEmail tiene prioridad
      expect(result.nombreTecnico).toBeUndefined();
    });

    it('usa el email de acceso si no hay email de contacto', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...PROFILE, contactEmail: null, phone: null });
      mockPrisma.$transaction.mockImplementation((fn: any) => fn(tx));
      tx.$queryRaw.mockResolvedValue([{ max_num: 0 }]);
      tx.service.create.mockImplementation(async ({ data }: any) => ({ id: SERVICE_ID, ...data, photos: [], pdfs: [] }));

      const result: any = await service.create(
        { razonSocial: 'M', ubicacion: 'U', contactoTerreno: 'C', fecha: '2026-10-08', horaInicio: '10:00', tipoMantenimiento: 'OTHER' as any },
        'user-1',
      );
      expect(result.email).toBe('felipe@login.cl');
      expect(result.fono).toBe('');
    });
  });

  describe('clone (nueva visita a este punto)', () => {
    it('copia cliente y ubicación, pero no comentarios ni firma', async () => {
      mockPrisma.service.findFirst.mockResolvedValue({
        id: SERVICE_ID, razonSocial: 'Muni', ubicacion: 'Plaza', contactoTerreno: 'Ana',
        tipoMantenimiento: 'CORRECTIVE', observaciones: 'texto viejo', comentarioCamaras: 'viejo',
        firmaUrl: 'data:image/png;base64,AAAA', nombreTecnico: 'Vicente',
      });
      mockPrisma.user.findFirst.mockResolvedValue(PROFILE);
      mockPrisma.$transaction.mockImplementation((fn: any) => fn(tx));
      tx.$queryRaw.mockResolvedValue([{ max_num: 41 }]);
      tx.service.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data, photos: [], pdfs: [] }));

      const visit: any = await service.clone(SERVICE_ID, 'user-1');

      expect(visit.razonSocial).toBe('Muni');
      expect(visit.ubicacion).toBe('Plaza');
      expect(visit.responsable).toBe('Felipe Romero');
      expect(visit.observaciones).toBeUndefined();
      expect(visit.comentarioCamaras).toBeUndefined();
      expect(visit.firmaUrl).toBeUndefined();
      expect(visit.nombreTecnico).toBeUndefined();
      expect(visit.horaInicio).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('getStats', () => {
    it('detecta informes incompletos y PDF desactualizado', async () => {
      const pdfAt = new Date('2026-10-01T12:00:00Z');
      mockPrisma.service.count.mockResolvedValue(3);
      mockPrisma.service.groupBy
        .mockResolvedValueOnce([{ razonSocial: 'Muni', _count: { id: 3 } }])
        .mockResolvedValueOnce([{ razonSocial: 'Muni', ubicacion: 'Plaza', _count: { id: 4 }, _max: { fecha: new Date('2026-10-01') } }]);
      mockPrisma.service.findMany.mockResolvedValue([
        // completo
        { id: 'a', ordenTrabajo: '2026-001', razonSocial: 'Muni', ubicacion: 'U1', fecha: new Date(), updatedAt: pdfAt,
          firmaUrl: 'x', photos: [{ categoria: 'AFTER' }], pdfs: [{ status: 'READY', createdAt: pdfAt }] },
        // editado después del PDF
        { id: 'b', ordenTrabajo: '2026-002', razonSocial: 'Muni', ubicacion: 'U2', fecha: new Date(), updatedAt: new Date('2026-10-02T00:00:00Z'),
          firmaUrl: 'x', photos: [{ categoria: 'AFTER' }], pdfs: [{ status: 'READY', createdAt: pdfAt }] },
        // sin firma, sin fotos después, sin PDF
        { id: 'c', ordenTrabajo: '2026-003', razonSocial: 'Muni', ubicacion: 'U3', fecha: new Date(), updatedAt: pdfAt,
          firmaUrl: null, photos: [{ categoria: 'BEFORE' }], pdfs: [] },
      ]);

      const stats: any = await service.getStats();

      expect(stats.attention.totalItems).toBe(2);
      expect(stats.attention.pdfDesactualizado).toBe(1);
      expect(stats.attention.sinFirma).toBe(1);
      expect(stats.attention.sinFotosDespues).toBe(1);
      expect(stats.attention.sinPdf).toBe(1);
      expect(stats.attention.items.find((i: any) => i.id === 'c').issues).toEqual(
        ['Sin firma', 'Sin fotos "después"', 'Sin PDF'],
      );
      expect(stats.recurringPoints.items[0]).toMatchObject({ ubicacion: 'Plaza', correctivos: 4 });
      expect(stats.thisMonthByClient).toEqual([{ razonSocial: 'Muni', count: 3 }]);
    });
  });

  describe('findOne', () => {
    it('no expone el passwordHash del creador y firma las URLs', async () => {
      mockPrisma.service.findFirst.mockResolvedValue({
        id: SERVICE_ID,
        ordenTrabajo: '2026-001',
        photos: [{ id: 'p1', s3Key: 'services/x/photos/before/a.jpg', url: 'old' }],
        pdfs: [{ id: 'd1', s3Key: 'services/x/pdfs/d1.pdf', url: 'old' }],
        user: { id: 'u1', name: 'A', email: 'a@b.cl' },
      });

      const result: any = await service.findOne(SERVICE_ID);

      const include = mockPrisma.service.findFirst.mock.calls[0][0].include;
      expect(include.user).toEqual({ select: { id: true, name: true, email: true } });
      expect(result.photos[0].url).toBe('https://signed/services/x/photos/before/a.jpg');
      expect(result.pdfs[0].url).toBe('https://signed/services/x/pdfs/d1.pdf');
    });

    it('lanza NotFoundException si no existe', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);
      await expect(service.findOne(SERVICE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmPhotoUpload', () => {
    beforeEach(() => {
      mockPrisma.service.findFirst.mockResolvedValue({ id: SERVICE_ID });
      mockPrisma.servicePhoto.findFirst.mockResolvedValue(null);
      mockPrisma.servicePhoto.count.mockResolvedValue(0);
    });

    it('rechaza una key de otro servicio', async () => {
      await expect(
        service.confirmPhotoUpload(SERVICE_ID, {
          key: `services/${OTHER_ID}/photos/before/${PHOTO_UUID}.jpg`,
          originalName: 'a.jpg',
          categoria: 'BEFORE',
          orden: 0,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.servicePhoto.create).not.toHaveBeenCalled();
    });

    it('usa el tamaño real del archivo en el almacenamiento', async () => {
      const key = `services/${SERVICE_ID}/photos/before/${PHOTO_UUID}.jpg`;
      mockStorage.head.mockResolvedValue({ ContentLength: 12345, ContentType: 'image/jpeg' });
      mockPrisma.servicePhoto.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
      mockPrisma.$transaction.mockImplementation((ops: any[]) => Promise.all(ops));

      const photo: any = await service.confirmPhotoUpload(SERVICE_ID, {
        key,
        originalName: 'a.jpg',
        categoria: 'BEFORE',
        orden: 0,
      });

      expect(photo.sizeBytes).toBe(12345);
      expect(photo.url).toBe(`https://signed/${key}`);
    });

    it('borra y rechaza archivos que no son imagen', async () => {
      const key = `services/${SERVICE_ID}/photos/after/${PHOTO_UUID}.png`;
      mockStorage.head.mockResolvedValue({ ContentLength: 100, ContentType: 'text/html' });

      await expect(
        service.confirmPhotoUpload(SERVICE_ID, { key, originalName: 'x', categoria: 'AFTER', orden: 0 }),
      ).rejects.toThrow(BadRequestException);
      expect(mockStorage.delete).toHaveBeenCalledWith('elemental-photos', key);
    });
  });

  describe('requestPdf', () => {
    it('no encola otro PDF si ya hay uno en proceso', async () => {
      mockPrisma.service.findFirst.mockResolvedValue({ id: SERVICE_ID });
      const pending = { id: 'pdf-1', status: 'PENDING' };
      mockPrisma.servicePdf.findFirst.mockResolvedValueOnce(pending);

      const result = await service.requestPdf(SERVICE_ID, 'u1');

      expect(result).toBe(pending);
      expect(mockQueue.enqueuePdfJob).not.toHaveBeenCalled();
    });
  });

  describe('exportCsv', () => {
    it('neutraliza fórmulas de Excel', async () => {
      mockPrisma.service.findMany.mockResolvedValue([
        {
          ordenTrabajo: '2026-001',
          razonSocial: '=HYPERLINK("http://malo")',
          ubicacion: 'Stgo',
          contactoTerreno: 'x',
          fecha: new Date('2026-03-01T00:00:00Z'),
          horaInicio: '09:00',
          responsable: 'r',
          nombreTecnico: 't',
          fono: '1',
          email: 'a@b.cl',
          tipoMantenimiento: 'PREVENTIVE',
          photos: [],
          firmaUrl: null,
        },
      ]);

      const csv = await service.exportCsv({});
      const row = csv.split('\n')[1];

      expect(row).toContain(`"'=HYPERLINK(""http://malo"")"`);
      expect(row).toContain('01/03/2026');
    });
  });
});

describe('generateReportHtml', () => {
  const base = {
    id: SERVICE_ID,
    razonSocial: 'ACME',
    ubicacion: 'Stgo',
    contactoTerreno: 'x',
    ordenTrabajo: '2026-001',
    fecha: new Date('2026-03-01T00:00:00Z'),
    horaInicio: '09:00',
    responsable: 'r',
    nombreTecnico: 't',
    fono: '1',
    email: 'a@b.cl',
    tipoMantenimiento: 'PREVENTIVE',
  };

  it('escapa el HTML ingresado por el usuario', () => {
    const html = generateReportHtml(
      { ...base, observaciones: '<script>alert(1)</script><iframe src="http://minio:9000">' },
      [],
    );
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('&lt;script&gt;');
  });

  it('descarta una firma que no es data URL de imagen', () => {
    const html = generateReportHtml(
      { ...base, firmaUrl: '" onerror="alert(1)' },
      [],
    );
    expect(html).not.toContain('onerror');
    expect(html).toContain('Firma pendiente');
  });

  it('omite la fila de técnico en servicios nuevos', () => {
    const html = generateReportHtml({ ...base, nombreTecnico: null }, []);
    expect(html).not.toContain('>Técnico<');
    expect(generateReportHtml(base, [])).toContain('>Técnico<');
  });

  it('muestra la fecha sin correrse un día', () => {
    const html = generateReportHtml(base, []);
    expect(html).toContain('1 de marzo de 2026');
  });
});
