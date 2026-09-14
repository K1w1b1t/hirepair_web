import { GlobalTraceIdMiddleware } from './global-trace-id.middleware';
import {
  GLOBAL_TRACE_ID_HEADER,
  REQUEST_CONTEXT_KEYS,
} from '../request-context/request-context.constants';

describe('GlobalTraceIdMiddleware', () => {
  const set = jest.fn();
  const middleware = new GlobalTraceIdMiddleware({ set } as never);

  beforeEach(() => jest.clearAllMocks());

  it('reuses an incoming trace and records request context', () => {
    const req = {
      headers: { [GLOBAL_TRACE_ID_HEADER]: ['trace-1', 'trace-2'] },
      method: 'GET',
      originalUrl: '/resumes/123?preview=true',
      url: '/fallback',
    } as never;
    const setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(req, { setHeader } as never, next);

    expect(set).toHaveBeenCalledWith(REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID, 'trace-1');
    expect(set).toHaveBeenCalledWith(REQUEST_CONTEXT_KEYS.HTTP_ROUTE, '/resumes/:id');
    expect((req as { traceId?: string }).traceId).toBe('trace-1');
    expect(setHeader).toHaveBeenCalledWith(GLOBAL_TRACE_ID_HEADER, 'trace-1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a UUID and falls back to req.url', () => {
    const req = { headers: {}, method: 'POST', url: '/sessions' } as never;
    const setHeader = jest.fn();

    middleware.use(req, { setHeader } as never, jest.fn());

    const traceId = (req as { traceId: string }).traceId;
    expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(set).toHaveBeenCalledWith(REQUEST_CONTEXT_KEYS.HTTP_URL, '/sessions');
  });
});
