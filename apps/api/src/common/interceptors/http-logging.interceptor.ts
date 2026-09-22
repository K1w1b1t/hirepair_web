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
import { normalizeRoutePath } from '../request-context/route-path.util';

const SENSITIVE_HEADER = /api.?key|authorization|x-access-token|cookie|^auth$/i;
const SENSITIVE_FIELD =
  /password|secret|token|api.?key|cookie|email|phone|cpf|address|ipAddress|content|markdown|transcript|prompt|audio|file|buffer|rawText|documents|jobText|targetRole/i;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 10;
const MAX_OBJECT_KEYS = 50;
const MAX_STRING_CHARS = 512;

function safeValue(value: unknown, depth = 0, key = ''): unknown {
  if (SENSITIVE_FIELD.test(key)) return '[REDACTED]';
  if (typeof value === 'string')
    return value.length > MAX_STRING_CHARS
      ? `${value.slice(0, MAX_STRING_CHARS)}…[+${value.length - MAX_STRING_CHARS} chars]`
      : value;
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH)
    return Array.isArray(value) ? `[ARRAY(${value.length}) DEPTH_CAPPED]` : '[OBJECT DEPTH_CAPPED]';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    const kept = value.slice(0, MAX_ARRAY_ITEMS).map((entry) => safeValue(entry, depth + 1));
    return value.length > MAX_ARRAY_ITEMS
      ? [...kept, `…[+${value.length - MAX_ARRAY_ITEMS} more items]`]
      : kept;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const result = Object.fromEntries(
    entries
      .slice(0, MAX_OBJECT_KEYS)
      .map(([entryKey, entry]) => [entryKey, safeValue(entry, depth + 1, entryKey)]),
  );
  if (entries.length > MAX_OBJECT_KEYS)
    result['…'] = `[+${entries.length - MAX_OBJECT_KEYS} more keys]`;
  return result;
}

function safeHeaders(headers: Request['headers']): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      SENSITIVE_HEADER.test(key) ? '[REDACTED]' : value,
    ]),
  );
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(HttpLoggingInterceptor.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    if (req.method === 'OPTIONS') return next.handle();
    const res = http.getResponse<Response>();
    const traceId = this.cls.get<string | undefined>(REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID);
    const route = normalizeRoutePath(req.url);
    this.logger.log({
      msg: 'Incoming request',
      traceId,
      method: req.method,
      route,
      ...(!this.isProduction
        ? { headers: safeHeaders(req.headers), body: safeValue(req.body) }
        : {}),
    });
    const startedAt = Date.now();
    return next.handle().pipe(
      tap({
        next: (body) =>
          this.logger.log({
            msg: 'Outgoing response',
            traceId,
            statusCode: res.statusCode,
            responseTimeMs: Date.now() - startedAt,
            ...this.dbMetrics(),
            ...(!this.isProduction ? { body: safeValue(body) } : {}),
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
