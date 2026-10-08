import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { ServicesModule } from './services/services.module';
import { PdfsModule } from './pdfs/pdfs.module';
import { StorageModule } from './storage/storage.module';
import { TextTemplatesModule } from './text-templates/text-templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    ServicesModule,
    PdfsModule,
    StorageModule,
    TextTemplatesModule,
  ],
})
export class AppModule {}
