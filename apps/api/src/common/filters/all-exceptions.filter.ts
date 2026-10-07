import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DiscordService } from '../discord/discord.service';
import { RequestContextService } from '../request-context/request-context.service';
import { requestRoute } from '../request-context/request-route';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  constructor(
    private readonly context: RequestContextService,
    private readonly discord: DiscordService,
  ) {}
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const traceId = this.context.getTraceId();
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const raw = exception.getResponse();
      const payload =
        typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
      const code =
        typeof payload.code === 'string'
          ? payload.code
          : statusCode === 429
            ? 'RATE_LIMIT_REACHED'
            : statusCode === 400
              ? 'VALIDATION_ERROR'
              : 'HTTP_ERROR';
      if (statusCode === 429 && typeof payload.retryAfterSeconds === 'number')
        response.setHeader('Retry-After', String(payload.retryAfterSeconds));
      response.status(statusCode).json({ ...payload, statusCode, code, message: code, traceId });
      return;
    }
    if (
      exception &&
      typeof exception === 'object' &&
      'type' in exception &&
      (exception.type === 'entity.too.large' || exception.type === 'entity.parse.failed')
    ) {
      const statusCode = exception.type === 'entity.too.large' ? 413 : 400;
      response.status(statusCode).json({
        statusCode,
        code: statusCode === 413 ? 'BODY_TOO_LARGE' : 'VALIDATION_ERROR',
        traceId,
      });
      return;
    }
    const errorMessage = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const path = requestRoute(request);
    this.logger.error({
      msg: 'Unhandled exception',
      traceId,
      method: request.method,
      route: path,
    });
    void this.discord.sendError500({
      traceId,
      method: request.method,
      path,
      route: path,
      errorMessage,
      stack,
    });
    response.status(500).json({
      statusCode: 500,
      message: 'Erro interno do servidor.',
      error: 'Internal Server Error',
      traceId,
    });
  }
}
