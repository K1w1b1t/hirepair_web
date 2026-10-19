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
          route: { path: '/resumes' },
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

  it('never logs headers, request bodies or responses in development either', (done) => {
    createInterceptor(false)
      .intercept(
        context({
          method: 'POST',
          url: '/users?secret=x',
          headers: { authorization: 'Bearer private' },
          body: { email: 'a@b.com', safe: 'also private' },
        }),
        { handle: () => of({ value: 'private response' }) },
      )
      .subscribe({
        complete: () => {
          expect(JSON.stringify(log.mock.calls)).not.toMatch(
            /Bearer private|a@b.com|also private|private response|secret=x/,
          );
          expect(
            (log.mock.calls as unknown as [Record<string, unknown>][])[0][0],
          ).not.toHaveProperty('body');
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

it('logs database metrics and safe types for non-Error failures', (done) => {
  const log = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  const interceptor = new HttpLoggingInterceptor({
    get: () => ({ statementCount: 2, totalMs: 3.5 }),
  } as never);
  interceptor
    .intercept(
      {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({ method: 'GET', url: '/x' }),
          getResponse: () => ({ statusCode: 400 }),
        }),
      } as never,
      { handle: () => throwError(() => 'private') },
    )
    .subscribe({
      error: () => {
        expect(log).toHaveBeenCalledWith(
          expect.objectContaining({
            dbStatementCount: 2,
            dbTotalMs: 4,
            errorType: 'string',
          }) as unknown,
        );
        log.mockRestore();
        done();
      },
    });
});
