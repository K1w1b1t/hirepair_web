/** Local integration stack: real HTTP, parsers, Redis and PostgreSQL; only external services are controlled. */
import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { CoreModule } from '../src/core/core.module';
import { AiModule } from '../src/ai/ai.module';
import { GuestModule } from '../src/guest/guest.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { RedisService } from '../src/operational/redis.service';
import { AiBudgetService } from '../src/operational/ai-budget.service';
import { operationalError } from '../src/operational/operational.config';
import { configureApp } from '../src/app.setup';
import type { Source, Experience, Topic } from '@hirepair/interview-engine';

interface Prompt {
  sources?: Source[];
  topics?: Topic[];
  context?: { experiences: Experience[] };
  facts?: Array<{ id: string; experienceId: string; text: string }>;
  experiences?: Experience[];
}
/** Deterministic provider deliberately uses the supplied evidence, never reference answers. */
export function controlledOutput(system: string, p: Prompt) {
  if (system.startsWith('Redija')) {
    return {
      version: 1,
      pending: null,
      explanation: 'Organização de evidências sintéticas.',
      sections: [
        {
          id: 'experience',
          title: 'Experiência profissional',
          experienceId: p.facts![0].experienceId,
          units: p
            .facts!.filter((f) => f.experienceId === p.facts![0].experienceId)
            .slice(0, 4)
            .map((f, i) => ({ id: `u${i}`, text: f.text, factIds: [f.id], criterionIds: [] })),
        },
      ],
    };
  }
  if (system.startsWith('Analise somente'))
    return {
      criteria: [],
      links: [],
      archetype: 'C_OPERATIONAL',
      reason: 'Caso sintético operacional.',
    };
  const experiences: Experience[] = [];
  const facts: Array<{
    id: string;
    experienceId: string;
    text: string;
    origin: Experience['origin'];
  }> = [];
  for (const source of p.sources!) {
    if ((source as Source & { answerKind?: string }).answerKind === 'absence') continue;
    if (/dedicado|qualidade|ignore instruções/i.test(source.text)) continue;
    const known = p.context?.experiences[0];
    const origin = {
      sourceId: source.id,
      sourceVersion: source.version,
      quote: source.text.slice(0, 180),
    };
    if (!known && !experiences.length)
      experiences.push({
        id: `exp-${source.id}`,
        title: 'Atendente na Feira Azul',
        start: '2024',
        end: null,
        current: true,
        origin,
      });
    facts.push({
      id: `fact-${source.id}`,
      experienceId: known?.id ?? experiences[0].id,
      text: origin.quote,
      origin,
    });
  }
  const extraction = { experiences, facts };
  if (!p.topics) return extraction;
  return {
    extraction,
    analysis: null,
    assessments: p.topics.map((topic) => ({
      topicId: topic.id,
      sufficient: facts.length > 0,
      evidence: facts.length ? ['responsibility'] : [],
      question: facts.length ? null : 'O que você fez nessa experiência?',
      contradictionFactIds: [],
    })),
  };
}
export async function createJourneyStack(live = false, port = 0) {
  const db =
    process.env.INTEGRATION_DATABASE_URL ??
    'postgresql://hirepair:hirepair_secret@127.0.0.1:15434/hirepair_eval';
  const redis = process.env.INTEGRATION_REDIS_URL ?? 'redis://127.0.0.1:16379';
  if (
    !['localhost', '127.0.0.1'].includes(new URL(db).hostname) ||
    !new URL(db).pathname.endsWith('_eval')
  )
    throw new Error('Disposable local *_eval database required');
  if (!live && !/^redis:\/\/127\.0\.0\.1:\d+\/?$/.test(redis))
    throw new Error('Isolated loopback Redis required');
  if (
    live &&
    (!process.env.GROQ_API_KEY ||
      process.env.GROQ_ZDR_CONFIRMED !== 'true' ||
      process.env.GROQ_FREE_TIER_CONFIRMED !== 'true')
  )
    throw new Error('Live Groq configuration required');
  process.env.DATABASE_URL = db;
  if (!live) {
    process.env.REDIS_URL = redis;
    process.env.APP_ENV = 'development';
  } else if (!process.env.APP_ENV) throw new Error('Shared APP_ENV required for live accounting');
  process.env.NODE_ENV = 'test';
  process.env.AI_PUBLIC_ENABLED = 'true';
  if (!live) process.env.AI_QUOTA_POOL = `journey_test_${randomUUID()}`;
  if (!process.env.AI_QUOTA_POOL) throw new Error('AI_QUOTA_POOL required');
  process.env.GUEST_ACCESS_SECRET =
    process.env.GUEST_ACCESS_SECRET || 'journey-only-local-secret-not-a-real-credential';
  if (!live) process.env.GROQ_API_KEY = 'synthetic-key';
  process.env.TURNSTILE_SECRET_KEY = 'synthetic-key';
  process.env.TURNSTILE_SITE_KEY = 'synthetic-site';
  process.env.CORS_ORIGIN = JSON.stringify(['http://127.0.0.1:3100']);
  delete process.env.DISCORD_WEBHOOK_URL;
  delete process.env.POSTHOG_PROJECT_TOKEN;
  delete process.env.VERCEL;
  const originalFetch = global.fetch;
  let reservedTokens = 0;
  const control: { failure: 'invalid' | '429' | '503' | null } = { failure: null };
  const calls: Array<{
    model: string;
    promptHash: string;
    schemaHash: string;
    systemHash: string;
    latencyMs: number;
    promptTokens: number | null;
    completionTokens: number | null;
    status: number;
  }> = [];
  global.fetch = async (url, options) => {
    const address = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    if (address.startsWith('https://challenges.cloudflare.com/'))
      return new Response(
        JSON.stringify({ success: true, hostname: '127.0.0.1', action: 'guest_access' }),
      );
    if (address.startsWith('https://api.groq.com/')) {
      if (typeof options?.body !== 'string') throw new Error('Expected JSON provider body');
      const body = JSON.parse(options.body) as {
        model: string;
        messages: Array<{ content: string }>;
        response_format: unknown;
      };
      const start = Date.now();
      if (!live && control.failure) {
        calls.push({
          model: body.model,
          promptHash: '',
          schemaHash: '',
          systemHash: '',
          latencyMs: 0,
          promptTokens: null,
          completionTokens: null,
          status: control.failure === 'invalid' ? 200 : Number(control.failure),
        });
        return control.failure === 'invalid'
          ? new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }))
          : new Response('{}', {
              status: Number(control.failure),
              headers: { 'retry-after': '60' },
            });
      }
      const result = live
        ? await originalFetch(url, options)
        : new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify(
                      controlledOutput(
                        body.messages[0].content,
                        JSON.parse(body.messages[1].content) as Prompt,
                      ),
                    ),
                  },
                  finish_reason: 'stop',
                },
              ],
              usage: { prompt_tokens: 100, completion_tokens: 100 },
            }),
          );
      const usage = (await result
        .clone()
        .json()
        .catch(() => ({}))) as { usage?: { prompt_tokens: number; completion_tokens: number } };
      const hash = (value: unknown) =>
        createHash('sha256').update(JSON.stringify(value)).digest('hex');
      calls.push({
        model: body.model,
        promptHash: hash(body.messages[1].content),
        systemHash: hash(body.messages[0].content),
        schemaHash: hash(body.response_format),
        latencyMs: Date.now() - start,
        promptTokens: usage.usage?.prompt_tokens ?? null,
        completionTokens: usage.usage?.completion_tokens ?? null,
        status: result.status,
      });
      return result;
    }
    // Unexpected external effects are forbidden in this integration process.
    if (!['localhost', '127.0.0.1'].includes(new URL(address).hostname))
      throw new Error('Unexpected external request');
    return originalFetch(url, options);
  };
  let app: NestExpressApplication;
  try {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        CoreModule,
        AiModule,
        GuestModule,
        PrismaModule,
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    const budget = app.get(AiBudgetService);
    const reserve = budget.reserve.bind(budget);
    budget.reserve = async (...args: Parameters<AiBudgetService['reserve']>) => {
      if (live && reservedTokens + args[2] > 30000)
        throw operationalError('AI_CAPACITY_EXHAUSTED', 503);
      const reservation = await reserve(...args);
      reservedTokens += reservation.tokens;
      return reservation;
    };
    configureApp(app);
    await app.listen(port, '127.0.0.1');
  } catch (error) {
    global.fetch = originalFetch;
    throw error;
  }
  return {
    app,
    root: await app.getUrl(),
    calls,
    control,
    get reservedTokens() {
      return reservedTokens;
    },
    async close() {
      try {
        if (!live)
          await app
            .get(RedisService)
            .run(
              `local keys = redis.call('KEYS', ARGV[1]); for _, key in ipairs(keys) do redis.call('DEL', key) end; return #keys`,
              [],
              [`{hirepair:${process.env.AI_QUOTA_POOL}}*`],
            );
      } finally {
        await app.close();
        global.fetch = originalFetch;
      }
    },
  };
}
if (require.main === module) {
  void createJourneyStack(false, 3101)
    .then((stack) => {
      process.stdout.write('Journey integration API ready on 127.0.0.1:3101\n');
      for (const signal of ['SIGINT', 'SIGTERM'])
        process.once(signal, () => {
          void stack.close().then(() => process.exit(0));
        });
    })
    .catch(() => {
      process.stderr.write('Journey stack failed: verify disposable PostgreSQL/Redis.\n');
      process.exitCode = 1;
    });
}
