import { PrismaService } from './prisma.service';
import { REQUEST_CONTEXT_KEYS } from '../common/request-context/request-context.constants';

describe('Prisma request metrics', () => {
  it('counts statements in the active CLS context and never lets instrumentation fail', () => {
    const store: Record<string, unknown> = {};
    const cls = {
      isActive: () => true,
      get: (key: string) => store[key],
      set: (key: string, value: unknown) => {
        store[key] = value;
      },
    };
    const service = Object.create(PrismaService.prototype) as {
      countStatement(duration: number): void;
      cls: typeof cls;
    };
    service.cls = cls;
    service.countStatement(2.5);
    service.countStatement(1.5);
    expect(store[REQUEST_CONTEXT_KEYS.DB_METRICS]).toEqual({ statementCount: 2, totalMs: 4 });
    service.cls = { ...cls, isActive: () => false };
    expect(() => service.countStatement(1)).not.toThrow();
  });
});
