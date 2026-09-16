import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { randomUUID } from 'node:crypto';
import {
  GLOBAL_TRACE_ID_HEADER,
  REQUEST_CONTEXT_KEYS,
} from '../request-context/request-context.constants';
import { normalizeRoutePath } from '../request-context/route-path.util';

export type TraceableRequest = Request & { traceId?: string };

@Injectable()
export class GlobalTraceIdMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: TraceableRequest, res: Response, next: NextFunction): void {
    const incoming = req.headers[GLOBAL_TRACE_ID_HEADER];
    const traceId = (Array.isArray(incoming) ? incoming[0] : incoming) ?? randomUUID();
    const url = req.originalUrl ?? req.url;

    this.cls.set(REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID, traceId);
    this.cls.set(REQUEST_CONTEXT_KEYS.HTTP_METHOD, req.method);
    this.cls.set(REQUEST_CONTEXT_KEYS.HTTP_URL, url.split(/[?#]/, 1)[0] || '/');
    this.cls.set(REQUEST_CONTEXT_KEYS.HTTP_ROUTE, normalizeRoutePath(url));
    req.traceId = traceId;
    res.setHeader(GLOBAL_TRACE_ID_HEADER, traceId);
    next();
  }
}
