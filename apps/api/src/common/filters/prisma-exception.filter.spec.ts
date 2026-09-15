import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function buildHost(body: unknown) {
  const captured = { status: 0, body: {} as Record<string, unknown> };
  const response = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      captured.body = payload;
      return this;
    },
  };
  return {
    captured,
    host: {
      switchToHttp: () => ({
        getRequest: () => ({ body, method: 'POST', url: '/users' }),
        getResponse: () => response,
      }),
    } as ArgumentsHost,
  };
}
function violation(code: string, meta: Record<string, unknown> = {}) {
  return new Prisma.PrismaClientKnownRequestError('database detail', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('PrismaExceptionFilter', () => {
  const sendError500 = jest.fn().mockResolvedValue(undefined);
  const filter = new PrismaExceptionFilter(
    { getTraceId: () => 'trace-1' } as never,
    { sendError500 } as never,
  );
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it.each([
    [{ target: ['email'] }, { email: 'a@b.com' }, 'O campo "email" ja esta em uso.'],
    [
      { target: ['profileId', 'kind', 'name'] },
      { name: 'Atendimento' },
      'O campo "name" ja esta em uso.',
    ],
    [
      { driverAdapterError: { cause: { constraint: { fields: ['"userId"'] } } } },
      { userId: 'x' },
      'O campo "userId" ja esta em uso.',
    ],
    [{}, {}, 'Registro duplicado.'],
  ])('maps P2002 safely', (meta, body, message) => {
    const target = buildHost(body);
    filter.catch(violation('P2002', meta), target.host);
    expect(target.captured.status).toBe(409);
    expect(target.captured.body.message).toBe(message);
    expect(sendError500).not.toHaveBeenCalled();
  });

  it('returns a safe traceable 500 and alerts for other Prisma errors', () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const target = buildHost({});
    filter.catch(violation('P2000', { column_name: 'passwordHash' }), target.host);
    expect(target.captured).toEqual({
      status: 500,
      body: {
        statusCode: 500,
        message: 'Erro interno do servidor.',
        error: 'Internal Server Error',
        traceId: 'trace-1',
      },
    });
    expect(sendError500).toHaveBeenCalledWith(expect.objectContaining({ route: '/users' }));
  });
});
