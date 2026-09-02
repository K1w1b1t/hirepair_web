import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('devolve o veredito do HealthService', async () => {
    const checkDatabase = jest.fn().mockResolvedValue({ database: 'ok', latencyMs: 3 });

    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { checkDatabase } }],
    }).compile();

    await expect(moduleRef.get(HealthController).checkDatabase()).resolves.toEqual({
      database: 'ok',
      latencyMs: 3,
    });
    expect(checkDatabase).toHaveBeenCalledTimes(1);
  });
});
