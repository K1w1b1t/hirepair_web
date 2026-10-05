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
  async reserveAnalysis(visitorId: string, ip = 'unknown'): Promise<void> {
    const key = this.key(visitorId, ip);
    try {
      const allowed = await this.redis.set(`guest-analysis:${key}`, '1', 'EX', DAY_SECONDS, 'NX');
      if (allowed !== 'OK')
        throw new HttpException(
          {
            statusCode: HttpStatus.BAD_REQUEST,
            code: 'GUEST_ANALYSIS_LIMIT_REACHED',
            message: 'Sua análise gratuita volta em até 24 horas.',
          },
          HttpStatus.BAD_REQUEST,
        );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException('A análise está temporariamente indisponível.');
    }
  }
  async releaseAnalysis(visitorId: string, ip = 'unknown'): Promise<void> {
    try {
      await this.redis.del(`guest-analysis:${this.key(visitorId, ip)}`);
    } catch {
      // A reserva permanece como proteção conservadora se o Redis cair durante a liberação.
    }
  }
  private key(visitorId: string, ip: string): string {
    return createHmac('sha256', process.env.GUEST_ACCESS_SECRET ?? 'local-guest-access-secret')
      .update(`${visitorId}:${ip}`)
      .digest('hex');
  }
  onApplicationShutdown(): Promise<'OK'> {
    return this.redis.quit();
  }
}
