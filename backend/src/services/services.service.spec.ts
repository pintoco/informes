import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
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
  },
  servicePdf: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ServicesService', () => {
  let service: ServicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a service successfully', async () => {
      const dto = {
        razonSocial: 'Test Corp',
        ubicacion: 'Santiago',
        contactoTerreno: 'Juan Pérez',
        ordenTrabajo: 'OT-001',
        fecha: '2024-03-01',
        horaInicio: '09:00',
        responsable: 'Pedro García',
        nombreTecnico: 'Carlos López',
        fono: '+56912345678',
        email: 'tecnico@empresa.com',
        tipoMantenimiento: 'PREVENTIVE' as any,
      };

      const expectedService = {
        id: 'uuid-1',
        ...dto,
        fecha: new Date(dto.fecha),
        photos: [],
        pdfs: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.service.create.mockResolvedValue(expectedService);

      const result = await service.create(dto, 'user-1');

      expect(result).toEqual(expectedService);
      expect(mockPrismaService.service.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          razonSocial: dto.razonSocial,
          ubicacion: dto.ubicacion,
          ordenTrabajo: dto.ordenTrabajo,
          createdBy: 'user-1',
        }),
        include: { photos: true, pdfs: true },
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated services', async () => {
      const mockServices = [
        {
          id: 'uuid-1',
          razonSocial: 'Test Corp',
          ubicacion: 'Santiago',
          deletedAt: null,
          photos: [],
          pdfs: [],
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([1, mockServices]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toEqual({
        data: mockServices,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    it('should apply ubicacion filter', async () => {
      mockPrismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll({ ubicacion: 'Santiago', page: 1, limit: 20 });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should apply date range filter', async () => {
      mockPrismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll({
        fechaDesde: '2024-01-01',
        fechaHasta: '2024-12-31',
        page: 1,
        limit: 20,
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should apply search filter', async () => {
      mockPrismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll({ search: 'Test', page: 1, limit: 20 });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a service by id', async () => {
      const mockService = {
        id: 'uuid-1',
        razonSocial: 'Test Corp',
        deletedAt: null,
        photos: [],
        pdfs: [],
        user: null,
      };

      mockPrismaService.service.findFirst.mockResolvedValue(mockService);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(mockService);
    });

    it('should throw NotFoundException when service not found', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a service', async () => {
      const mockService = {
        id: 'uuid-1',
        razonSocial: 'Test Corp',
        deletedAt: null,
        photos: [],
        pdfs: [],
        user: null,
      };

      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.service.update.mockResolvedValue({
        ...mockService,
        deletedAt: new Date(),
      });

      const result = await service.softDelete('uuid-1');

      expect(mockPrismaService.service.update).toHaveBeenCalledWith({
        where: { id: 'uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
    });

    it('should throw NotFoundException when service not found for deletion', async () => {
      mockPrismaService.service.findFirst.mockResolvedValue(null);

      await expect(service.softDelete('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a service', async () => {
      const mockService = {
        id: 'uuid-1',
        razonSocial: 'Test Corp',
        deletedAt: null,
        photos: [],
        pdfs: [],
        user: null,
      };

      const updateDto = { razonSocial: 'Updated Corp' };

      mockPrismaService.service.findFirst.mockResolvedValue(mockService);
      mockPrismaService.service.update.mockResolvedValue({
        ...mockService,
        ...updateDto,
      });

      const result = await service.update('uuid-1', updateDto);

      expect(result.razonSocial).toBe('Updated Corp');
    });
  });
});
