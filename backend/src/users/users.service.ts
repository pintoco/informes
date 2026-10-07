import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private select = {
    id: true,
    email: true,
    name: true,
    phone: true,
    role: true,
    createdAt: true,
    updatedAt: true,
  };

  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [total, data] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: this.select,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: this.select,
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim();
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException('El email ya está registrado');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        role: dto.role || 'TECHNICIAN',
      },
      select: this.select,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.role !== undefined) {
      if (user.role === 'ADMIN' && dto.role !== 'ADMIN') await this.assertNotLastAdmin();
      data.role = dto.role;
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
      // Invalida los tokens emitidos antes del cambio (ver JwtStrategy.validate)
      data.passwordChangedAt = new Date();
    }

    return this.prisma.user.update({ where: { id }, data, select: this.select });
  }

  async remove(id: string, deletedBy?: string) {
    const user = await this.findOne(id);
    if (id === deletedBy) {
      throw new BadRequestException('No puedes eliminar tu propio usuario');
    }
    if (user.role === 'ADMIN') await this.assertNotLastAdmin();

    // Verificar si el usuario tiene servicios activos antes de eliminar
    const serviceCount = await this.prisma.service.count({
      where: { createdBy: id, deletedAt: null },
    });
    if (serviceCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el usuario tiene ${serviceCount} servicio(s) activo(s)`,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date(), deletedBy: deletedBy ?? null },
    });
  }

  private async assertNotLastAdmin() {
    const admins = await this.prisma.user.count({ where: { role: 'ADMIN', deletedAt: null } });
    if (admins <= 1) {
      throw new BadRequestException('Debe quedar al menos un administrador activo');
    }
  }
}
