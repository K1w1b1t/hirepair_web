import { HttpException, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { HttpLoggingInterceptor } from './http-logging.interceptor';
import { REQUEST_CONTEXT_KEYS } from '../request-context/request-context.constants';

describe('HttpLoggingInterceptor', () => {
  const store: Record<string, unknown> = { [REQUEST_CONTEXT_KEYS.GLOBAL_TRACE_ID]: 'trace-1' };
  const cls = { get: (key: string) => store[key] } as never;
  const createInterceptor = (isProduction: boolean) => {
    const interceptor = new HttpLoggingInterceptor(cls);
    Object.defineProperty(interceptor, 'isProduction', { value: isProduction });
    return interceptor;
  };
  const context = (request: object, statusCode = 200) =>
    ({
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ statusCode }) }),
    }) as never;
  let log: jest.SpyInstance;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('logs only metadata in production', (done) => {
    const interceptor = createInterceptor(true);
    interceptor
      .intercept(
        context({
          method: 'POST',
          url: '/resumes?x=secret',
          headers: { authorization: 'Bearer x' },
          body: { contentMarkdown: 'private' },
        }),
        { handle: () => of({ private: true }) },
      )
      .subscribe({
        complete: () => {
          const payloads = log.mock.calls.map(([payload]) => payload as Record<string, unknown>);
          expect(payloads[0]).toEqual(
            expect.objectContaining({
              msg: 'Incoming request',
              route: '/resumes',
              traceId: 'trace-1',
            }),
          );
          expect(payloads[0]).not.toHaveProperty('headers');
          expect(payloads[0]).not.toHaveProperty('body');
          expect(payloads[1]).not.toHaveProperty('body');
          done();
        },
      });
  });

  it('redacts and bounds development payloads', (done) => {
    const interceptor = createInterceptor(false);
    interceptor
      .intercept(
        context({
          method: 'POST',
          url: '/users',
          headers: { authorization: 'Bearer x', accept: 'json' },
          body: { email: 'a@b.com', safe: 'visible', nested: { password: 'x' } },
        }),
        { handle: () => of({ value: 'x'.repeat(600) }) },
      )
      .subscribe({
        complete: () => {
          const calls = log.mock.calls as unknown as Array<[Record<string, unknown>]>;
          const incoming = calls[0][0] as {
            headers: Record<string, unknown>;
            body: Record<string, unknown>;
          };
          expect(incoming.headers.authorization).toBe('[REDACTED]');
          expect(incoming.body.email).toBe('[REDACTED]');
          expect(incoming.body.safe).toBe('visible');
          expect(JSON.stringify(calls[1][0])).toContain('[+88 chars]');
          done();
        },
      });
  });

  it('skips OPTIONS/non-http and classifies errors', (done) => {
    const interceptor = createInterceptor(true);
    interceptor
      .intercept(context({ method: 'OPTIONS', url: '/', headers: {}, body: null }), {
        handle: () => of(null),
      })
      .subscribe({
        complete: () => {
          expect(log).not.toHaveBeenCalled();
          interceptor
            .intercept({ getType: () => 'rpc' } as never, { handle: () => of('ok') })
            .subscribe({
              complete: () => {
                interceptor
                  .intercept(
                    context({ method: 'GET', url: '/bad', headers: {}, body: null }, 400),
                    { handle: () => throwError(() => new HttpException('bad', 400)) },
                  )
                  .subscribe({
                    error: () => {
                      expect(warn).toHaveBeenCalled();
                      interceptor
                        .intercept(
                          context({ method: 'GET', url: '/boom', headers: {}, body: null }, 500),
                          { handle: () => throwError(() => new Error('boom')) },
                        )
                        .subscribe({
                          error: () => {
                            expect(error).toHaveBeenCalled();
                            done();
                          },
                        });
                    },
                  });
              },
            });
        },
      });
  });
});
