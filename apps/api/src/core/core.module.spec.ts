import type { Server } from 'node:http';
import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DiscordService } from '../common/discord/discord.service';
import { CoreModule } from './core.module';

@Controller('rate-limit-contract')
class RateLimitContractController {
  @Get()
  get(): { status: string } {
    return { status: 'ok' };
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), CoreModule],
  controllers: [RateLimitContractController],
})
class RateLimitContractModule {}

describe('CoreModule rate limiting', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({ imports: [RateLimitContractModule] })
      .overrideProvider(DiscordService)
      .useValue({})
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('returns 429 after ten requests from the same client in one minute', async () => {
    const server = app.getHttpServer() as Server;

    for (let count = 0; count < 10; count += 1) {
      await request(server).get('/rate-limit-contract').expect(200);
    }

    await request(server).get('/rate-limit-contract').expect(429);
  });
});
