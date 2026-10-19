import {
  HttpException,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import {
  type DbRequestMetrics,
  REQUEST_CONTEXT_KEYS,
} from '../request-context/request-context.constants';
import { requestRoute } from '../request-context/request-route';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    if (req.method === 'OPTIONS') return next.handle();
    const res = http.getResponse<Response>();
    const traceId = this.cls.get<string | undefined>(REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID);
    const route = requestRoute(req);
    this.logger.log({
      msg: 'Incoming request',
      traceId,
      method: req.method,
      route,
    });
    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log({
            msg: 'Outgoing response',
            traceId,
            statusCode: res.statusCode,
            responseTimeMs: Date.now() - startedAt,
            ...this.dbMetrics(),
          }),
        error: (caught) => {
          const statusCode = caught instanceof HttpException ? caught.getStatus() : res.statusCode;
          const payload = {
            msg: 'Outgoing error response',
            traceId,
            statusCode,
            responseTimeMs: Date.now() - startedAt,
            ...this.dbMetrics(),
            errorType: caught instanceof Error ? caught.constructor.name : typeof caught,
          };
          if (statusCode >= 500) this.logger.error(payload);
          else this.logger.warn(payload);
        },
      }),
    );
  }

  private dbMetrics(): { dbStatementCount: number; dbTotalMs: number } {
    const metrics = this.cls.get<DbRequestMetrics | undefined>(REQUEST_CONTEXT_KEYS.DB_METRICS);
    return {
      dbStatementCount: metrics?.statementCount ?? 0,
      dbTotalMs: Math.round(metrics?.totalMs ?? 0),
    };
  }
}
