import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

// Hash válido usado cuando el email no existe, para que la respuesta tarde lo mismo
// y no revele qué emails están registrados.
const DUMMY_HASH = '$2b$10$lplHNhK7pn0oCyTUZNGkSeiQzM/IylWV1Zaq.RHP6qLc3LtQbu0VC';

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

    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  }
}
