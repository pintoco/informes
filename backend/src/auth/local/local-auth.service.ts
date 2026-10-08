import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as bcrypt from 'bcrypt';

// Hash válido usado cuando el email no existe, para que la respuesta tarde lo mismo
// y no revele qué emails están registrados.
const DUMMY_HASH = '$2b$10$lplHNhK7pn0oCyTUZNGkSeiQzM/IylWV1Zaq.RHP6qLc3LtQbu0VC';

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  contactEmail: true,
  role: true,
} as const;

@Injectable()
export class LocalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: dto.email.trim(), mode: 'insensitive' } },
    });

    const usable = !!user && user.deletedAt === null && !!user.passwordHash;
    const valid = await bcrypt.compare(dto.password, usable ? user.passwordHash! : DUMMY_HASH);
    if (!usable || !valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        contactEmail: user.contactEmail,
        role: user.role,
      },
      token: this.signToken(user.id, user.role),
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: PROFILE_SELECT,
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail.trim() || null;

    let passwordChanged = false;
    if (dto.newPassword) {
      const current = await this.prisma.user.findUnique({ where: { id: userId } });
      const ok =
        !!dto.currentPassword &&
        !!current?.passwordHash &&
        (await bcrypt.compare(dto.currentPassword, current.passwordHash));
      if (!ok) throw new BadRequestException('La contraseña actual no es correcta');
      data.passwordHash = await bcrypt.hash(dto.newPassword, 12);
      data.passwordChangedAt = new Date();
      passwordChanged = true;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: PROFILE_SELECT,
    });

    // Cambiar la contraseña invalida los tokens anteriores: se entrega uno nuevo
    // para que esta sesión siga activa.
    return passwordChanged ? { user, token: this.signToken(user.id, user.role) } : { user };
  }

  private signToken(id: string, role: string) {
    return this.jwtService.sign({ sub: id, role });
  }
}
