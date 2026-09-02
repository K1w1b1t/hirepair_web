import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface DatabaseHealth {
  database: 'ok' | 'down';
  latencyMs: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Faz um `SELECT 1` de verdade contra o Postgres.
   *
   * Nao usa o estado da conexao do Prisma: o pool pode reportar-se saudavel com o
   * banco inalcancavel do outro lado. Uma consulta e a unica prova.
   *
   * Nunca lanca — devolve `down`. Endpoint de health que responde 500 e
   * indistinguivel de aplicacao morta para quem esta do lado de fora, e a
   * informacao "a API esta de pe, o banco nao" e justamente a que importa.
   */
  async checkDatabase(): Promise<DatabaseHealth> {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: 'ok', latencyMs: Date.now() - startedAt };
    } catch (error) {
      this.logger.error('Health check do banco falhou.', error);
      return { database: 'down', latencyMs: Date.now() - startedAt };
    }
  }
}
