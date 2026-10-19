import { ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function host() {
  const captured = { status: 0, body: {} as Record<string, unknown> };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    setHeader: jest.fn(),
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };
  return {
    captured,
    value: {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/boom?secret=x', route: { path: '/boom' } }),
        getResponse: () => response,
      }),
    } as ArgumentsHost,
  };
}

describe('AllExceptionsFilter', () => {
  const context = { getTraceId: () => 'trace-1' } as never;
  const sendError500 = jest.fn().mockResolvedValue(undefined);
  const discord = { sendError500 } as never;
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());

  it('passes through deliberate HTTP exceptions', () => {
    const target = host();
    new AllExceptionsFilter(context, discord).catch(new HttpException('bad', 400), target.value);
    expect(target.captured).toMatchObject({
      status: 400,
      body: { code: 'VALIDATION_ERROR', traceId: 'trace-1' },
    });
    expect(sendError500).not.toHaveBeenCalled();
  });

  it('returns a safe traceable 500 and alerts without the query string', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const target = host();
    new AllExceptionsFilter(context, discord).catch(new Error('boom'), target.value);
    expect(target.captured.status).toBe(500);
    expect(target.captured.body).toEqual({
      statusCode: 500,
      message: 'Erro interno do servidor.',
      error: 'Internal Server Error',
      traceId: 'trace-1',
    });
    expect(sendError500).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/boom', route: '/boom' }),
    );
  });
});

it('maps body-parser size errors to a safe 413 response', () => {
  const target = host();
  new AllExceptionsFilter(
    { getTraceId: () => 'trace' } as never,
    { sendError500: jest.fn() } as never,
  ).catch(
    Object.assign(new Error('private body'), { type: 'entity.too.large', status: 413 }),
    target.value,
  );
  expect(target.captured).toMatchObject({
    status: 413,
    body: { code: 'BODY_TOO_LARGE', traceId: 'trace' },
  });
});

it.each([
  [429, {}],
  [429, { retryAfterSeconds: 60 }],
  [422, { code: 'CONTENT_REJECTED' }],
  [404, {}],
])('normalizes HTTP %s', (status, payload) => {
  const target = host();
  new AllExceptionsFilter(
    { getTraceId: () => 't' } as never,
    { sendError500: jest.fn() } as never,
  ).catch(new HttpException(payload, status), target.value);
  expect(target.captured.status).toBe(status);
  expect(target.captured.body.traceId).toBe('t');
});
it('handles malformed JSON and arbitrary thrown values safely', () => {
  const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  const sendError500 = jest.fn();
  const filter = new AllExceptionsFilter(
    { getTraceId: () => 't' } as never,
    { sendError500 } as never,
  );
  const target = host();
  filter.catch({ type: 'entity.parse.failed' }, target.value);
  expect(target.captured.status).toBe(400);
  for (const exception of [null, 'private', { type: 'other' }]) {
    filter.catch(exception, target.value);
    expect(target.captured.status).toBe(500);
  }
  const empty = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '?secret' }),
      getResponse: () => ({ status: () => ({ json: jest.fn() }) }),
    }),
  };
  filter.catch('oops', empty as never);
  const missing = {
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET' }),
      getResponse: () => ({ status: () => ({ json: jest.fn() }) }),
    }),
  };
  filter.catch('oops', missing as never);
  expect(sendError500).toHaveBeenCalledWith(
    expect.objectContaining({ path: '/unmatched' }) as unknown,
  );
  log.mockRestore();
});
