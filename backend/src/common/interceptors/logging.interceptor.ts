import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'secret', 'authorization'];

function maskSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj;
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    masked[key] = SENSITIVE_FIELDS.some((f) => key.toLowerCase().includes(f)) ? '[REDACTED]' : value;
  }
  return masked;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const { method, url, ip, body } = request;
    const userAgent = request.headers['user-agent'] || '';
    const startTime = Date.now();

    if (body && Object.keys(body).length > 0) {
      this.logger.debug(`${method} ${url} body=${JSON.stringify(maskSensitive(body))}`);
    }

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        const elapsed = Date.now() - startTime;
        this.logger.log(`${method} ${url} ${statusCode} ${elapsed}ms - ${ip} ${userAgent}`);
      }),
    );
  }
}
