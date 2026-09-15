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
import { normalizeRoutePath } from '../request-context/route-path.util';

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
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    const traceId = this.context.getTraceId();
    const errorMessage = exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;
    const path = (request.url || '/').split(/[?#]/, 1)[0] || '/';
    this.logger.error({
      msg: 'Unhandled exception',
      traceId,
      method: request.method,
      route: normalizeRoutePath(path),
    });
    void this.discord.sendError500({
      traceId,
      method: request.method,
      path,
      route: normalizeRoutePath(path),
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
