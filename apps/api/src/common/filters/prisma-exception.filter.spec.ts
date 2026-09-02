import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

interface Captured {
  status: number;
  body: Record<string, unknown>;
}

function buildHost(body: unknown): { host: ArgumentsHost; captured: Captured } {
  const captured: Captured = { status: 0, body: {} };

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

  const host = {
    switchToHttp: () => ({
      getRequest: () => ({ body, method: 'POST', url: '/users' }),
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, captured };
}

function uniqueViolation(meta: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta,
  });
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('traduz P2002 em 409 nomeando o campo que o cliente enviou', () => {
    const { host, captured } = buildHost({ email: 'joana@example.com' });

    filter.catch(uniqueViolation({ target: ['email'] }), host);

    expect(captured.status).toBe(409);
    expect(captured.body.message).toBe('O campo "email" ja esta em uso.');
  });

  it('prefere o campo presente no corpo numa unique composta', () => {
    // ProfileSkill tem @@unique([profileId, kind, name]). Nomear `profileId` nao
    // diria nada a quem chamou — o campo de negocio e `name`.
    const { host, captured } = buildHost({ name: 'Atendimento' });

    filter.catch(uniqueViolation({ target: ['profileId', 'kind', 'name'] }), host);

    expect(captured.body.message).toBe('O campo "name" ja esta em uso.');
  });

  it('remove as aspas que o adapter-pg traz do DETAIL do Postgres', () => {
    // O Postgres cita identificador com maiuscula no DETAIL (`Key ("userId")=...`),
    // e o adapter repassa as aspas. Sem a limpeza, a mensagem sairia com elas e a
    // comparacao com as chaves do corpo nunca casaria.
    const { host, captured } = buildHost({ userId: 'abc' });

    filter.catch(
      uniqueViolation({
        driverAdapterError: { cause: { constraint: { fields: ['"userId"'] } } },
      }),
      host,
    );

    expect(captured.body.message).toBe('O campo "userId" ja esta em uso.');
  });

  it('cai para mensagem generica quando nao ha campo identificavel', () => {
    const { host, captured } = buildHost({});

    filter.catch(uniqueViolation({}), host);

    expect(captured.status).toBe(409);
    expect(captured.body.message).toBe('Registro duplicado.');
  });

  it('devolve 500 sem vazar detalhe de schema em codigo nao tratado', () => {
    const { host, captured } = buildHost({});
    // O log de erro e comportamento esperado no ramo nao tratado.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    filter.catch(
      new Prisma.PrismaClientKnownRequestError('Value too long for column', {
        code: 'P2000',
        clientVersion: 'test',
        meta: { column_name: 'passwordHash' },
      }),
      host,
    );

    expect(captured.status).toBe(500);
    expect(JSON.stringify(captured.body)).not.toContain('passwordHash');
  });
});
