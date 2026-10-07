import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../operational/redis.service';
import {
  BEGIN_ANALYSIS_SCRIPT,
  COUNTERS_SCRIPT,
  FINISH_ANALYSIS_SCRIPT,
  SET_RECORD_SCRIPT,
} from '../operational/redis.scripts';
import {
  appEnvironment,
  LEGAL_VERSION,
  opaqueId,
  operationalError,
  RECORD_TTL_MS,
} from '../operational/operational.config';

export interface AnalysisLease {
  owner: string;
  keys: string[];
}
@Injectable()
export class GuestQuotaService {
  constructor(private readonly redis: RedisService) {}
  private prefix(): string {
    return `{hirepair:${process.env.AI_QUOTA_POOL ?? 'local'}}:${appEnvironment()}:guest`;
  }
  async recordConsent(visitorId: string): Promise<void> {
    await this.redis.run(
      SET_RECORD_SCRIPT,
      [`${this.prefix()}:consent:${opaqueId(visitorId)}`],
      [
        JSON.stringify({
          acceptedAt: Date.now(),
          termsVersion: LEGAL_VERSION,
          privacyVersion: LEGAL_VERSION,
        }),
        RECORD_TTL_MS,
      ],
    );
  }
  async reserveAccess(network: string): Promise<void> {
    const root = `${this.prefix()}:access:${opaqueId(network)}`;
    const specs = [
      { amount: 1, limit: 5, ttl: 60_000 },
      { amount: 1, limit: 30, ttl: 3_600_000 },
    ];
    const [blocked, ttl] = await this.redis.run<[number, number]>(
      COUNTERS_SCRIPT,
      [`${root}:minute`, `${root}:hour`],
      [JSON.stringify(specs)],
    );
    if (blocked) throw operationalError('NETWORK_LIMIT_REACHED', 429, Math.ceil(ttl / 1000));
  }
  async reserveAnalysis(
    visitorId: string,
    network: string,
    key: string,
    hash: string,
  ): Promise<AnalysisLease> {
    const subject = opaqueId(visitorId);
    const prefix = this.prefix();
    const keys = [
      `${prefix}:idempotency:${subject}:${opaqueId(key)}`,
      `${prefix}:lock:${subject}`,
      `${prefix}:attempts:${subject}`,
      `${prefix}:network:${opaqueId(network)}`,
    ];
    const owner = randomUUID();
    const [code, ttl] = await this.redis.run<[string, number]>(BEGIN_ANALYSIS_SCRIPT, keys, [
      hash,
      owner,
      3,
      30,
      RECORD_TTL_MS,
    ]);
    if (code !== 'OK')
      throw operationalError(
        code,
        code.includes('LIMIT') ? 429 : 409,
        Math.max(1, Math.ceil(ttl / 1000)),
      );
    return { owner, keys: keys.slice(0, 2) };
  }
  async finishAnalysis(lease: AnalysisLease, completed: boolean): Promise<void> {
    try {
      await this.redis.run(FINISH_ANALYSIS_SCRIPT, lease.keys, [
        lease.owner,
        completed ? 'completed' : 'failed',
      ]);
    } catch {
      return;
    }
  }
}
