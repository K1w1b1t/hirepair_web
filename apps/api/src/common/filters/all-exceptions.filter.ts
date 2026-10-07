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
      this.handleHttpException(exception, response, traceId);
      return;
    }
    if (this.isBodyParserException(exception)) {
      this.handleBodyParserException(exception, response, traceId);
      return;
    }
    this.handleUnexpectedException(exception, request, response, traceId);
  }
  private handleHttpException(
    exception: HttpException,
    response: Response,
    traceId: string | undefined,
  ): void {
    const statusCode = exception.getStatus();
    const raw = exception.getResponse();
    const payload = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const code = this.httpCode(payload, statusCode);
    if (statusCode === 429 && typeof payload.retryAfterSeconds === 'number')
      response.setHeader('Retry-After', String(payload.retryAfterSeconds));
    response.status(statusCode).json({ ...payload, statusCode, code, message: code, traceId });
  }
  private httpCode(payload: Record<string, unknown>, statusCode: number): string {
    if (typeof payload.code === 'string') return payload.code;
    if (statusCode === 429) return 'RATE_LIMIT_REACHED';
    if (statusCode === 400) return 'VALIDATION_ERROR';
    return 'HTTP_ERROR';
  }
  private isBodyParserException(
    exception: unknown,
  ): exception is { type: 'entity.too.large' | 'entity.parse.failed' } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'type' in exception &&
      (exception.type === 'entity.too.large' || exception.type === 'entity.parse.failed')
    );
  }
  private handleBodyParserException(
    exception: { type: 'entity.too.large' | 'entity.parse.failed' },
    response: Response,
    traceId: string | undefined,
  ): void {
    const isTooLarge = exception.type === 'entity.too.large';
    const statusCode = isTooLarge ? 413 : 400;
    response.status(statusCode).json({
      statusCode,
      code: isTooLarge ? 'BODY_TOO_LARGE' : 'VALIDATION_ERROR',
      traceId,
    });
  }
  private handleUnexpectedException(
    exception: unknown,
    request: Request,
    response: Response,
    traceId: string | undefined,
  ): void {
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
