import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  describe('getHealthStatus', () => {
    it('reports the API as operational', () => {
      const result = service.getHealthStatus();

      expect(result.status).toBe('ok');
      expect(result.message).toBe('HirePair API Operational');
    });

    it('stamps the response with a valid ISO timestamp', () => {
      const before = Date.now();
      const { timestamp } = service.getHealthStatus();
      const after = Date.now();

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
      expect(Date.parse(timestamp)).toBeGreaterThanOrEqual(before);
      expect(Date.parse(timestamp)).toBeLessThanOrEqual(after);
    });
  });
});
