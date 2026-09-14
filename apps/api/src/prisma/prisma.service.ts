import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import {
  type DbRequestMetrics,
  REQUEST_CONTEXT_KEYS,
} from '../common/request-context/request-context.constants';

const DEFAULT_POOL_SIZE = 10;
function resolvePoolSize(): number {
  const parsed = Number(process.env['PRISMA_CONNECTION_LIMIT']);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POOL_SIZE;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  constructor(@Optional() private cls?: ClsService) {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString)
      throw new Error('DATABASE_URL ausente: nao e possivel conectar ao banco.');
    super({
      adapter: new PrismaPg({ connectionString, max: resolvePoolSize() }),
      omit: { user: { passwordHash: true } },
      log: [{ emit: 'event', level: 'query' }],
    });
    (this as unknown as PrismaClient<{ log: [{ emit: 'event'; level: 'query' }] }>).$on(
      'query',
      (event) => this.countStatement(event.duration),
    );
  }
  private countStatement(duration: number): void {
    try {
      if (!this.cls?.isActive()) return;
      const metrics = this.cls.get<DbRequestMetrics | undefined>(REQUEST_CONTEXT_KEYS.DB_METRICS);
      if (metrics) {
        metrics.statementCount += 1;
        metrics.totalMs += duration;
        return;
      }
      this.cls.set<DbRequestMetrics>(REQUEST_CONTEXT_KEYS.DB_METRICS, {
        statementCount: 1,
        totalMs: duration,
      });
    } catch {
      /* Instrumentation must never fail a query. */
    }
  }
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Conectado ao Postgres.');
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
