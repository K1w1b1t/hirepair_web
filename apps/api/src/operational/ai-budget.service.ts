import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DiscordService } from '../common/discord/discord.service';
import { RedisService } from './redis.service';
import {
  ONCE_SCRIPT,
  RESERVE_AI_SCRIPT,
  SET_RECORD_SCRIPT,
  SETTLE_AI_SCRIPT,
} from './redis.scripts';
import {
  appEnvironment,
  DAY_MS,
  opaqueId,
  operationalError,
  requirePublicAi,
  WEEK_MS,
} from './operational.config';

// Only server-selected business operations belong here. Never accept a prompt/operation from HTTP.
export interface AiExecutionContext {
  principalId: string;
  scopeId: string;
  operation: 'job-analysis';
  idempotencyKey: string;
  inputVersion: string;
}
export interface AiReservation {
  id: string;
  tokens: number;
  tokenKeys: Array<{ key: string }>;
  context: AiExecutionContext;
  model: string;
  recordKey: string;
}
interface Counter {
  key: string;
  amount: number;
  limit: number;
  ttl: number;
}
@Injectable()
export class AiBudgetService {
  constructor(
    private readonly redis: RedisService,
    private readonly discord: DiscordService,
  ) {}
  private root(): string {
    return `{hirepair:${process.env.AI_QUOTA_POOL ?? 'local'}}`;
  }
  async reserve(
    context: AiExecutionContext,
    model: string,
    tokens: number,
  ): Promise<AiReservation> {
    requirePublicAi();
    if (
      context.operation !== 'job-analysis' ||
      !Number.isInteger(tokens) ||
      tokens <= 0 ||
      tokens > 6000
    )
      throw operationalError('AI_INPUT_TOO_LARGE', 400);
    const now = Date.now();
    const date = new Date(now);
    const day = date.toISOString().slice(0, 10);
    const month = day.slice(0, 7);
    const dayTtl = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - now;
    const monthTtl = Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - now;
    const root = this.root();
    const env = appEnvironment();
    const staging = env === 'staging';
    const shared = `${root}:groq:${model}:${day}`;
    const daily = `${root}:${env}:groq:${model}:${day}`;
    const monthly = `${root}:${env}:month:${month}`;
    const scope = `${root}:${env}:scope:${opaqueId(`${context.principalId}:${context.scopeId}`)}`;
    const specs: Counter[] = [
      { key: `${shared}:calls`, amount: 1, limit: 800, ttl: dayTtl },
      { key: `${shared}:tokens`, amount: tokens, limit: 160_000, ttl: dayTtl },
      { key: `${daily}:calls`, amount: 1, limit: staging ? 80 : 720, ttl: dayTtl },
      { key: `${daily}:tokens`, amount: tokens, limit: staging ? 16_000 : 144_000, ttl: dayTtl },
      { key: `${monthly}:calls`, amount: 1, limit: staging ? 240 : 2400, ttl: monthTtl },
      {
        key: `${monthly}:tokens`,
        amount: tokens,
        limit: staging ? 1_440_000 : 14_400_000,
        ttl: monthTtl,
      },
      { key: `${scope}:calls`, amount: 1, limit: 6, ttl: WEEK_MS },
      { key: `${scope}:tokens`, amount: tokens, limit: 36_000, ttl: WEEK_MS },
    ];
    const id = randomUUID();
    const reservation: AiReservation = {
      id,
      tokens,
      tokenKeys: specs.filter((spec) => spec.key.endsWith(':tokens')).map(({ key }) => ({ key })),
      context,
      model,
      recordKey: `${root}:${env}:usage:${id}`,
    };
    const [blocked, retryMs, percent] = await this.redis.run<[number, number, number]>(
      RESERVE_AI_SCRIPT,
      [
        `${root}:groq:circuit`,
        `${root}:groq:${model}:minute`,
        ...specs.map((spec) => spec.key),
        reservation.recordKey,
      ],
      [
        now,
        id,
        tokens,
        JSON.stringify(specs),
        JSON.stringify(this.record(reservation, 'reserved')),
      ],
    );
    if (blocked !== 0) {
      if (blocked <= 6) await this.alert(model, 100, day);
      throw operationalError('AI_CAPACITY_EXHAUSTED', 503, Math.ceil(retryMs / 1000));
    }
    if (percent >= 80) await this.alert(model, 80, day);
    return reservation;
  }
  async settle(
    reservation: AiReservation,
    outcome: string,
    usage?: { prompt_tokens: number; completion_tokens: number },
    durationMs = 0,
  ): Promise<void> {
    const valid =
      usage &&
      Number.isInteger(usage.prompt_tokens) &&
      Number.isInteger(usage.completion_tokens) &&
      usage.prompt_tokens >= 0 &&
      usage.completion_tokens >= 0;
    const actual = valid ? usage.prompt_tokens + usage.completion_tokens : reservation.tokens;
    // An unavailable accounting write never authorizes another provider call; its original reservation stays charged.
    try {
      await this.redis.run(
        SETTLE_AI_SCRIPT,
        [reservation.recordKey, ...reservation.tokenKeys.map(({ key }) => key)],
        [
          JSON.stringify(reservation.tokenKeys),
          actual - reservation.tokens,
          JSON.stringify({
            ...this.record(reservation, outcome),
            actualTokens: valid ? actual : null,
            durationMs,
            promptTokens: valid ? usage.prompt_tokens : null,
            completionTokens: valid ? usage.completion_tokens : null,
          }),
        ],
      );
    } catch {
      return;
    }
  }
  async openCircuit(_model: string, seconds: number): Promise<void> {
    // Shared by all Groq models: a provider 429 must not fan out to another model.
    await this.redis.run(
      SET_RECORD_SCRIPT,
      [`${this.root()}:groq:circuit`],
      ['1', Math.max(1, seconds) * 1000],
    );
  }
  private record(reservation: AiReservation, outcome: string): object {
    return {
      attemptId: reservation.id,
      principal: opaqueId(reservation.context.principalId),
      scope: opaqueId(reservation.context.scopeId),
      operation: reservation.context.operation,
      inputVersion: opaqueId(reservation.context.inputVersion),
      request: opaqueId(reservation.context.idempotencyKey),
      model: reservation.model,
      reservedTokens: reservation.tokens,
      outcome,
      timestamp: Date.now(),
      environment: appEnvironment(),
    };
  }
  private async alert(model: string, threshold: number, day: string): Promise<void> {
    try {
      const once = await this.redis.run<string>(
        ONCE_SCRIPT,
        [`${this.root()}:${appEnvironment()}:alert:${model}:${day}:${threshold}`],
        [DAY_MS],
      );
      if (once === 'OK')
        await this.discord.sendAiBudget({ model, threshold, environment: appEnvironment() });
    } catch {
      return;
    }
  }
}
