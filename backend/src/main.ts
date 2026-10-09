import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProduction ? ['log', 'error', 'warn'] : ['log', 'error', 'warn', 'debug'],
    bodyParser: false,
  });

  // Firma del receptor viaja como data URL PNG dentro del JSON → límite de 1 MB
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // Detrás de un proxy inverso (Caddy/Nginx/Railway) la IP real viene en X-Forwarded-For.
  // Sin esto todas las peticiones comparten la IP del proxy y el rate limit es global.
  // TRUST_PROXY = número de proxies delante del backend (1 con Caddy en Lightsail).
  app.set('trust proxy', parseInt(process.env.TRUST_PROXY || '1', 10));

  // Shutdown hooks: permite que Prisma y BullMQ cierren conexiones limpiamente
  app.enableShutdownHooks();

  // Security middleware
  app.use(helmet());

  // Rate limiting estricto para login (brute force protection)
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: true,
      message: { error: 'Too many login attempts, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Rate limiting global por IP
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
      message: { error: 'Too many requests, please try again later.' },
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // CORS: acepta uno o varios orígenes separados por coma
  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Nombre de archivo de las descargas (informe mensual, ZIP, CSV)
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters y interceptors
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Health check con ping a la base de datos
  const prisma = app.get(PrismaService);
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/api/health', async (_req: any, res: any) => {
    const checks: Record<string, string> = {};
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.db = 'ok';
    } catch {
      checks.db = 'error';
    }
    const healthy = Object.values(checks).every((v) => v === 'ok');
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      ...checks,
    });
  });

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`Elemental Pro API running on port ${port}`);
}

bootstrap();
