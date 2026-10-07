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
  service: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
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

  describe('create', () => {
    it('genera la OT y crea el servicio dentro de la misma transacción', async () => {
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

    it('usa el tamaño real del archivo en MinIO', async () => {
      const key = `services/${SERVICE_ID}/photos/before/${PHOTO_UUID}.jpg`;
      mockStorage.head.mockResolvedValue({ ContentLength: 12345, ContentType: 'image/jpeg' });
      mockPrisma.servicePhoto.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));

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

  it('muestra la fecha sin correrse un día', () => {
    const html = generateReportHtml(base, []);
    expect(html).toContain('1 de marzo de 2026');
  });
});
