import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, CreateLocationDto } from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  // ── Companies ──────────────────────────────────────────

  async findAllCompanies() {
    return this.prisma.company.findMany({
      include: { locations: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCompany(dto: CreateCompanyDto) {
    const existing = await this.prisma.company.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Ya existe una empresa con ese nombre');
    return this.prisma.company.create({ data: { name: dto.name }, include: { locations: true } });
  }

  async updateCompany(id: string, dto: CreateCompanyDto) {
    await this.findCompany(id);
    return this.prisma.company.update({
      where: { id },
      data: { name: dto.name },
      include: { locations: { orderBy: { name: 'asc' } } },
    });
  }

  async removeCompany(id: string) {
    await this.findCompany(id);
    await this.prisma.company.delete({ where: { id } });
  }

  private async findCompany(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');
    return company;
  }

  // ── Locations ─────────────────────────────────────────

  async findLocationsByCompany(companyId: string) {
    await this.findCompany(companyId);
    return this.prisma.location.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async createLocation(companyId: string, dto: CreateLocationDto) {
    await this.findCompany(companyId);
    const existing = await this.prisma.location.findUnique({
      where: { companyId_name: { companyId, name: dto.name } },
    });
    if (existing) throw new ConflictException('Ya existe esa ubicación para esta empresa');
    return this.prisma.location.create({ data: { name: dto.name, companyId } });
  }

  async removeLocation(companyId: string, locationId: string) {
    const location = await this.prisma.location.findFirst({
      where: { id: locationId, companyId },
    });
    if (!location) throw new NotFoundException('Ubicación no encontrada');
    await this.prisma.location.delete({ where: { id: locationId } });
  }
}
