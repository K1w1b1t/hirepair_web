import {
  HttpException,
  HttpStatus,
  Injectable,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import Redis from 'ioredis';

const DAY_SECONDS = 24 * 60 * 60;
@Injectable()
export class GuestQuotaService implements OnApplicationShutdown {
  private readonly redis: Redis;
  constructor() {
    const url = process.env.REDIS_URL;
    this.redis = url
      ? new Redis(url, { maxRetriesPerRequest: 1 })
      : new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          maxRetriesPerRequest: 1,
        });
  }
  async consumeAnalysis(visitorId: string, ip = 'unknown'): Promise<void> {
    const key = createHmac('sha256', process.env.GUEST_ACCESS_SECRET ?? 'local-guest-access-secret')
      .update(`${visitorId}:${ip}`)
      .digest('hex');
    try {
      const allowed = await this.redis.set(`guest-analysis:${key}`, '1', 'EX', DAY_SECONDS, 'NX');
      if (allowed !== 'OK')
        throw new HttpException(
          'Sua análise gratuita volta em até 24 horas.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('A análise está temporariamente indisponível.');
    }
  }
  onApplicationShutdown(): Promise<'OK'> {
    return this.redis.quit();
  }
}
