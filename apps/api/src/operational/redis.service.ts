import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { operationalError } from './operational.config';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly client: Redis;
  constructor() {
    const options = { maxRetriesPerRequest: 1, connectTimeout: 3000, commandTimeout: 3000 };
    this.client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, options)
      : new Redis({
          ...options,
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
        });
    this.client.on('error', () => undefined);
  }
  async run<T>(script: string, keys: string[], args: Array<string | number> = []): Promise<T> {
    try {
      return (await this.client.eval(script, keys.length, ...keys, ...args)) as T;
    } catch {
      throw operationalError('OPERATIONAL_STORAGE_UNAVAILABLE');
    }
  }
  onApplicationShutdown(): void {
    this.client.disconnect();
  }
}
