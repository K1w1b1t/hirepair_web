import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const VALID_URL = 'postgresql://user:pass@localhost:5434/hirepair?schema=public';

describe('PrismaService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DATABASE_URL: VALID_URL };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('recusa construcao sem DATABASE_URL', () => {
    delete process.env.DATABASE_URL;

    expect(() => new PrismaService()).toThrow(/DATABASE_URL/);
  });

  it('conecta no onModuleInit e desconecta no onModuleDestroy', async () => {
    const service = new PrismaService();

    // Sem banco no `npm test`: o que este teste garante e a fiacao dos hooks de
    // ciclo de vida — sem ela o Prisma conectaria de forma preguicosa na primeira
    // consulta, e uma credencial errada so apareceria em producao no primeiro
    // acesso, e nao no boot.
    const connect = jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

    await service.onModuleInit();
    expect(connect).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('usa DATABASE_URL, e nao DIRECT_URL', () => {
    // DIRECT_URL e a conexao direta, reservada ao `prisma migrate`. Em runtime a
    // aplicacao precisa do pooler, senao esgota as conexoes do Postgres.
    process.env.DIRECT_URL = 'postgresql://user:pass@direct:5432/hirepair';

    expect(() => new PrismaService()).not.toThrow();

    delete process.env.DATABASE_URL;
    expect(() => new PrismaService()).toThrow(/DATABASE_URL/);
  });
});
