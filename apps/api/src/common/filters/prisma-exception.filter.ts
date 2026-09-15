import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { DiscordService } from '../discord/discord.service';
import { RequestContextService } from '../request-context/request-context.service';
import { normalizeRoutePath } from '../request-context/route-path.util';

function extractUniqueFields(exception: Prisma.PrismaClientKnownRequestError): string[] {
  const raw = Array.isArray(exception.meta?.target)
    ? exception.meta.target
    : (
        exception.meta?.['driverAdapterError'] as
          { cause?: { constraint?: { fields?: unknown } } } | undefined
      )?.cause?.constraint?.fields;
  return Array.isArray(raw)
    ? (raw as string[]).map((field) => field.replace(/^"(.*)"$/, '$1'))
    : [];
}

function resolveConflictMessage(
  exception: Prisma.PrismaClientKnownRequestError,
  request: Request,
): string {
  const fields = extractUniqueFields(exception);
  const body = (request.body ?? {}) as Record<string, unknown>;
  const duplicated = fields.find((field) => field in body) ?? fields[0];
  return duplicated ? `O campo "${duplicated}" ja esta em uso.` : 'Registro duplicado.';
}

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);
  constructor(
    private readonly context: RequestContextService,
    private readonly discord: DiscordService,
  ) {}
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (exception.code === 'P2002') {
      const conflict = new ConflictException(resolveConflictMessage(exception, request));
      response.status(conflict.getStatus()).json(conflict.getResponse());
      return;
    }
    const traceId = this.context.getTraceId();
    const path = (request.url || '/').split(/[?#]/, 1)[0] || '/';
    this.logger.error({
      msg: 'Unhandled Prisma error',
      traceId,
      code: exception.code,
      method: request.method,
      route: normalizeRoutePath(path),
    });
    void this.discord.sendError500({
      traceId,
      method: request.method,
      path,
      route: normalizeRoutePath(path),
      errorMessage: `Prisma ${exception.code}: ${exception.message}`,
      stack: exception.stack,
    });
    response.status(500).json({
      statusCode: 500,
      message: 'Erro interno do servidor.',
      error: 'Internal Server Error',
      traceId,
    });
  }
}
