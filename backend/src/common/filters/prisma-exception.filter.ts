import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

// Traduce errores conocidos de Prisma a respuestas HTTP claras en vez de un 500 genérico.
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Error interno del servidor';

    if (exception.code === 'P2002') {
      status = HttpStatus.CONFLICT;
      const fields = (exception.meta?.target as string[] | undefined)?.join(', ');
      message = fields?.includes('ordenTrabajo')
        ? 'Ya existe un servicio con ese número de orden de trabajo'
        : `Ya existe un registro con ese valor${fields ? ` (${fields})` : ''}`;
    } else if (exception.code === 'P2025') {
      status = HttpStatus.NOT_FOUND;
      message = 'Registro no encontrado';
    } else {
      this.logger.error(`Prisma ${exception.code} en ${request.method} ${request.url}`, exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    });
  }
}
