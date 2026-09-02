import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Pool padrao. Dez conexoes cabem folgadas no limite do Free Tier do Supabase
 * (que compartilha um pooler entre projetos) e ainda absorvem rajada de HTTP.
 * Ajustavel por `PRISMA_CONNECTION_LIMIT` quando o plano mudar.
 */
const DEFAULT_POOL_SIZE = 10;

function resolvePoolSize(): number {
  const parsed = Number(process.env['PRISMA_CONNECTION_LIMIT']);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POOL_SIZE;
}

/**
 * Cliente Prisma da aplicacao.
 *
 * `DATABASE_URL` (e nao `DIRECT_URL`) de proposito: em runtime queremos o pooler,
 * porque uma funcao serverless abrindo conexao direta esgota o Postgres. A
 * conexao direta so interessa a `prisma migrate`.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env['DATABASE_URL'];

    if (!connectionString) {
      // Alcancavel apenas se o ConfigModule for removido do AppModule; a
      // validacao de ambiente ja teria barrado o boot antes daqui.
      throw new Error('DATABASE_URL ausente: nao e possivel conectar ao banco.');
    }

    super({
      adapter: new PrismaPg({
        connectionString,
        max: resolvePoolSize(),
      }),
      // O hash de senha e retirado de TODA leitura, para que nao escape por
      // resposta de controller, log ou payload de fila. Para conferir a senha no
      // login, o caso que precisa dela, peca explicitamente na consulta:
      // `omit: { passwordHash: false }`.
      omit: {
        user: { passwordHash: true },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao Postgres.');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
