/** Real Redis + HTTP boundary checks. Run only against an isolated local Redis. */
import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Controller, Get } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisService } from '../src/operational/redis.service';
import { AiBudgetService } from '../src/operational/ai-budget.service';
import { GuestQuotaService } from '../src/guest/guest-quota.service';
import { AiService } from '../src/ai/ai.service';
import { GuestModule } from '../src/guest/guest.module';
import { AiModule } from '../src/ai/ai.module';
import { CoreModule } from '../src/core/core.module';
import { configureApp } from '../src/app.setup';
import { LEGAL_VERSION } from '../src/operational/operational.config';

@Controller('probe')
class ProbeController {
  @Get() get() {
    return { ok: true };
  }
}

async function main(): Promise<void> {
  const redisUrl = process.env.INTEGRATION_REDIS_URL ?? 'redis://127.0.0.1:16379';
  if (!/^redis:\/\/127\.0\.0\.1:\d+\/?$/.test(redisUrl))
    throw new Error('Use isolated loopback Redis only.');
  process.env.REDIS_URL = redisUrl;
  process.env.APP_ENV = 'test';
  process.env.NODE_ENV = 'test';
  process.env.AI_PUBLIC_ENABLED = 'true';
  process.env.AI_QUOTA_POOL = `41_test_${randomUUID()}`;
  process.env.GUEST_ACCESS_SECRET = 'test-only-secret-not-a-production-credential';
  process.env.GROQ_API_KEY = 'test-key';
  process.env.TURNSTILE_SECRET_KEY = 'test-key';
  process.env.CORS_ORIGIN = '["http://localhost:3000"]';
  delete process.env.VERCEL;
  delete process.env.DISCORD_WEBHOOK_URL;
  const redis = new RedisService();
  const quota = new GuestQuotaService(redis);
  const budget = new AiBudgetService(redis, { sendAiBudget: () => Promise.resolve() } as never);
  const prefix = `{hirepair:${process.env.AI_QUOTA_POOL}}`;
  const clean = () =>
    redis.run(
      `local keys = redis.call('KEYS', ARGV[1]); for _, key in ipairs(keys) do redis.call('DEL', key) end; return #keys`,
      [],
      [`${prefix}*`],
    );
  const originalFetch = global.fetch;
  let app: NestExpressApplication | undefined;
  try {
    const attempts = await Promise.allSettled(
      Array.from({ length: 40 }, (_, index) =>
        quota.reserveAnalysis('same-visitor', 'same-network', `request-${index}`, 'hash'),
      ),
    );
    const winners = attempts.filter(
      (
        result,
      ): result is PromiseFulfilledResult<Awaited<ReturnType<typeof quota.reserveAnalysis>>> =>
        result.status === 'fulfilled',
    );
    assert.equal(winners.length, 1, 'one concurrent analysis per visitor');
    await quota.finishAnalysis(winners[0].value, false);
    for (const key of ['second', 'third'])
      await quota.finishAnalysis(
        await quota.reserveAnalysis('same-visitor', 'same-network', key, 'hash'),
        false,
      );
    await assert.rejects(
      quota.reserveAnalysis('same-visitor', 'other-network', 'fourth', 'hash'),
      /GUEST_ANALYSIS_LIMIT_REACHED/,
    );
    await assert.rejects(
      quota.reserveAnalysis('same-visitor', 'same-network', 'second', 'hash'),
      /ANALYSIS_ALREADY_PROCESSED/,
    );
    await assert.rejects(
      quota.reserveAnalysis('same-visitor', 'same-network', 'second', 'changed'),
      /IDEMPOTENCY_CONFLICT/,
    );
    await clean();
    for (let index = 0; index < 30; index++)
      await quota.finishAnalysis(
        await quota.reserveAnalysis(`visitor-${index}`, 'network', `key-${index}`, 'hash'),
        true,
      );
    await assert.rejects(
      quota.reserveAnalysis('another-visitor', 'network', 'different', 'hash'),
      /NETWORK_LIMIT_REACHED/,
    );
    await clean();
    const context = {
      principalId: 'visitor',
      scopeId: 'visitor',
      operation: 'job-analysis' as const,
      idempotencyKey: 'key',
      inputVersion: 'hash',
    };
    const reservations = await Promise.allSettled(
      ['a', 'b'].map((scopeId) =>
        budget.reserve({ ...context, scopeId }, 'openai/gpt-oss-120b', 4000),
      ),
    );
    assert.equal(
      reservations.filter(({ status }) => status === 'fulfilled').length,
      1,
      'atomic token reservations cannot overshoot',
    );
    const charged = reservations.find(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof budget.reserve>>> =>
        result.status === 'fulfilled',
    )!.value;
    await budget.settle(charged, 'success', { prompt_tokens: 800, completion_tokens: 200 });
    await assert.rejects(
      budget.reserve({ ...context, scopeId: 'c' }, 'openai/gpt-oss-120b', 3000),
      /AI_CAPACITY_EXHAUSTED/,
    );
    // Minute reservations remain conservative even after actual-usage reconciliation.
    await clean();
    // Monthly budget is shared across models and instances; only the last call can win.
    const month = new Date().toISOString().slice(0, 7);
    const monthlyCalls = `${prefix}:test:month:${month}:calls`;
    await redis.run(
      `return redis.call('SET', KEYS[1], ARGV[1], 'PX', 60000)`,
      [monthlyCalls],
      [2399],
    );
    const monthly = await Promise.allSettled(
      ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'].map((model) =>
        budget.reserve(context, model, 1000),
      ),
    );
    assert.equal(
      monthly.filter((item) => item.status === 'fulfilled').length,
      1,
      'monthly calls cannot overshoot across models',
    );
    assert.equal(
      await redis.run<string>(`return redis.call('GET', KEYS[1])`, [monthlyCalls]),
      '2400',
    );
    await clean();
    const day = new Date().toISOString().slice(0, 10);
    const sharedTokens = `${prefix}:groq:openai/gpt-oss-120b:${day}:tokens`;
    await redis.run(
      `return redis.call('SET', KEYS[1], ARGV[1], 'PX', 60000)`,
      [sharedTokens],
      [159500],
    );
    await assert.rejects(
      budget.reserve(context, 'openai/gpt-oss-120b', 1000),
      /AI_CAPACITY_EXHAUSTED/,
    );
    assert.equal(
      await redis.run<number>(
        `return #redis.call('KEYS', ARGV[1])`,
        [],
        [`${prefix}:test:usage:*`],
      ),
      0,
      'rejected reservation creates no attempt',
    );
    await clean();
    for (let i = 0; i < 6; i++) await budget.reserve(context, 'openai/gpt-oss-120b', 100);
    await assert.rejects(
      budget.reserve(context, 'openai/gpt-oss-120b', 100),
      /AI_CAPACITY_EXHAUSTED/,
    );
    await clean();
    let providerCalls = 0;
    global.fetch = () => {
      providerCalls++;
      return Promise.resolve(
        new Response(
          JSON.stringify(
            providerCalls === 1
              ? {}
              : {
                  choices: [{ message: { content: '{}' } }],
                  usage: { prompt_tokens: 100, completion_tokens: 10 },
                },
          ),
          { status: providerCalls === 1 ? 503 : 200 },
        ),
      );
    };
    await new AiService(undefined, undefined, budget).generateText({
      prompt: 'synthetic professional material',
      responseSchema: { type: 'object' },
      context,
    });
    assert.equal(providerCalls, 2, 'one bounded fallback');
    const usageKeys = await redis.run<string[]>(
      `return redis.call('KEYS', ARGV[1])`,
      [],
      [`${prefix}:test:usage:*`],
    );
    assert.equal(usageKeys.length, 2);
    const usageRecords = await redis.run<string[]>(
      `return redis.call('MGET', unpack(KEYS))`,
      usageKeys,
    );
    assert(
      !JSON.stringify(usageRecords).includes('synthetic professional material'),
      'accounting excludes content',
    );
    await clean();
    providerCalls = 0;
    global.fetch = () => {
      providerCalls++;
      return Promise.resolve(new Response('{}', { status: 429, headers: { 'retry-after': '60' } }));
    };
    const ai = new AiService(undefined, undefined, budget);
    await assert.rejects(
      ai.generateText({ prompt: 'synthetic', responseSchema: {}, context }),
      /AI_CAPACITY_EXHAUSTED/,
    );
    await assert.rejects(
      ai.generateText({ prompt: 'synthetic', responseSchema: {}, context }),
      /AI_CAPACITY_EXHAUSTED/,
    );
    assert.equal(
      providerCalls,
      1,
      'provider cooldown prevents fallback and repeated external calls',
    );
    await clean();
    providerCalls = 0;
    global.fetch = (url, options) => {
      if (
        (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).startsWith(
          'https://challenges.cloudflare.com/',
        )
      )
        return Promise.resolve(
          new Response(
            JSON.stringify({ success: true, hostname: 'localhost', action: 'guest_access' }),
          ),
        );
      if (
        (typeof url === 'string' ? url : url instanceof URL ? url.href : url.url).startsWith(
          'https://api.groq.com/',
        )
      ) {
        providerCalls++;
        return Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      targetKind: 'same_track',
                      targetRole: 'Mecânico',
                      requirements: [],
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 100, completion_tokens: 50 },
            }),
          ),
        );
      }
      return originalFetch(url, options);
    };
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CoreModule,
        AiModule,
        GuestModule,
      ],
      controllers: [ProbeController],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    const root = await app.getUrl();
    const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
      originalFetch(`${root}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
      });
    assert.equal((await post('/guest/job-analysis', { prompt: 'generic request' })).status, 400);
    assert.equal(providerCalls, 0);
    const issued = await post('/guest/access', {
      turnstileToken: 'synthetic-test-token',
      acceptedTerms: true,
      acceptedPrivacy: true,
      termsVersion: LEGAL_VERSION,
      privacyVersion: LEGAL_VERSION,
    });
    assert.equal(issued.status, 201);
    const access = (await issued.json()) as { accessToken: string };
    const material = {
      documents: [{ id: 'resume', text: 'Mecânico CPF: 123.456.789-00' }],
      jobText: 'Manutenção',
    };
    assert.equal(
      (
        await post('/guest/job-analysis', material, {
          authorization: `Bearer ${access.accessToken}`,
          'idempotency-key': 'integration-key-0001',
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await post('/guest/job-analysis', material, {
          authorization: `Bearer ${access.accessToken}`,
          'idempotency-key': 'integration-key-0001',
        })
      ).status,
      409,
    );
    assert.equal(providerCalls, 1);
    assert.equal((await post('/probe', { text: 'x'.repeat(300_000) })).status, 413);
    const failedValidation = await post('/guest/access', { acceptedTerms: 'false' });
    assert.equal(failedValidation.status, 400);
    console.log(
      'PASS: real Redis concurrency, network/visitor quotas, failure accounting, idempotency, token reservation, fallback/circuit and HTTP contracts.',
    );
  } finally {
    global.fetch = originalFetch;
    if (app) await app.close();
    await clean();
    redis.onApplicationShutdown();
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
