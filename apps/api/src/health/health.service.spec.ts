import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function build(queryRaw: jest.Mock) {
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();

    return moduleRef.get(HealthService);
  }

  it('reporta ok quando a consulta responde', async () => {
    const service = await build(jest.fn().mockResolvedValue([{ '1': 1 }]));

    const result = await service.checkDatabase();

    expect(result.database).toBe('ok');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reporta down em vez de lancar quando o banco esta inalcancavel', async () => {
    // O comportamento que importa: health que responde 500 e indistinguivel de
    // aplicacao morta, e a informacao util e "API de pe, banco fora".
    const service = await build(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    // O log de erro e comportamento esperado aqui; silenciado para nao encher a
    // saida do teste com um stack trace que nao indica falha.
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    await expect(service.checkDatabase()).resolves.toEqual(
      expect.objectContaining({ database: 'down' }),
    );
  });
});
