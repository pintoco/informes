import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const isLocal = configService.get<string>('LOCAL_AUTH') === 'true';
    const region = configService.get<string>('COGNITO_REGION', 'us-east-1');
    const userPoolId = configService.get<string>('COGNITO_USER_POOL_ID', '');

    if (isLocal) {
      super({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: configService.get<string>('JWT_SECRET', 'dev-secret'),
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
  }

  async validate(payload: any) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Local JWT uses payload.role; Cognito uses cognito:groups
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
