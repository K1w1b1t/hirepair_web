import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';
import { THROTTLE_SCRIPT } from './redis.scripts';
import { appEnvironment, opaqueId } from './operational.config';

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}
  async increment(key: string, ttl: number, limit: number, blockDuration: number) {
    const prefix = `{hirepair:${process.env.AI_QUOTA_POOL ?? 'local'}}:${appEnvironment()}:throttle:${opaqueId(key)}`;
    const [totalHits, expire, block] = await this.redis.run<[number, number, number]>(
      THROTTLE_SCRIPT,
      [`${prefix}:hits`, `${prefix}:block`],
      [ttl, limit, blockDuration],
    );
    return {
      totalHits,
      timeToExpire: Math.ceil(expire / 1000),
      isBlocked: block > 0,
      timeToBlockExpire: Math.ceil(block / 1000),
    };
  }
}
