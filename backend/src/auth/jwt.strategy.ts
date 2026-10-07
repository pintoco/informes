import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET environment variable is not set');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      ignoreExpiration: false,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: { sub?: string; iat?: number }) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Consultar BD: rol actualizado, usuario no eliminado y token emitido
    // después del último cambio de contraseña.
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, passwordChangedAt: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o desactivado');
    }
    if (
      user.passwordChangedAt &&
      payload.iat &&
      payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000
    ) {
      throw new UnauthorizedException('Sesión expirada, vuelve a iniciar sesión');
    }

    return {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
