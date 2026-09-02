import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  describe('getHello', () => {
    it('delegates the health payload from AppService', () => {
      const result = controller.getHello();

      expect(result).toEqual({
        message: 'HirePair API Operational',
        status: 'ok',
        timestamp: expect.any(String) as string,
      });
    });
  });
});
