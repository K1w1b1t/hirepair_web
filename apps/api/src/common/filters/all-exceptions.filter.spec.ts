import { ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function host() {
  const captured = { status: 0, body: {} as Record<string, unknown> };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
  };
  return {
    captured,
    value: {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/boom?secret=x' }),
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
    expect(target.captured).toEqual({ status: 400, body: 'bad' });
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
