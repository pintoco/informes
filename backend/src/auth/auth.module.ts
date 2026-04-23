import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { LocalAuthController } from './local/local-auth.controller';
import { LocalAuthService } from './local/local-auth.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [LocalAuthController],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard, LocalAuthService],
  exports: [JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
