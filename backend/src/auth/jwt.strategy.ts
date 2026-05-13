import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  // No se usan parameter properties para que TypeScript permita super() dentro de if/else
  private isLocal: boolean;
  private db: PrismaService;

  constructor(configService: ConfigService, prismaService: PrismaService) {
    const isLocal = configService.get<string>('LOCAL_AUTH') === 'true';
    const region = configService.get<string>('COGNITO_REGION', 'us-east-1');
    const userPoolId = configService.get<string>('COGNITO_USER_POOL_ID', '');

    if (isLocal) {
      const secret = configService.get<string>('JWT_SECRET');
      if (!secret) throw new Error('JWT_SECRET environment variable is not set');
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: secret,
        ignoreExpiration: false,
      });
    } else {
      super({
        secretOrKeyProvider: passportJwtSecret({
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
          jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
        }),
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        audience: undefined,
        issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
        algorithms: ['RS256'],
      });
    }

    this.isLocal = isLocal;
    this.db = prismaService;
  }

  async validate(payload: any) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Para auth local: consultar BD para obtener rol actualizado y verificar que no esté eliminado
    if (this.isLocal) {
      const user = await this.db.user.findFirst({
        where: { id: payload.sub, deletedAt: null },
        select: { id: true, email: true, name: true, role: true },
      });
      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado o desactivado');
      }
      return {
        id: user.id,
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }

    // Cognito: usar payload del JWT
    const groups: string[] = payload['cognito:groups'] || [];
    const role = payload.role || (groups.includes('ADMIN') ? 'ADMIN' : 'TECHNICIAN');
    return {
      id: payload.sub,
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      role,
    };
  }
}
