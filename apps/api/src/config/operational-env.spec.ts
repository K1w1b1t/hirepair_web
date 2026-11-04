import { validate } from './env.validation';

const DATABASE_URL = 'postgresql://user:pass@localhost:5434/hirepair';

describe('operational environment', () => {
  it('accepts valid CORS, docs and Discord settings', () => {
    const result = validate({
      DATABASE_URL,
      GUEST_ACCESS_SECRET: 's'.repeat(32),
      CORS_ORIGIN: '["http://localhost:3000"]',
      API_DOCS_ENABLED: 'true',
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x',
    });
    expect(result.CORS_ORIGIN).toContain('localhost');
  });
  it('rejects invalid boolean and insecure webhook URLs', () => {
    expect(() => validate({ DATABASE_URL, API_DOCS_ENABLED: 'yes' })).toThrow();
    expect(() =>
      validate({ DATABASE_URL, DISCORD_WEBHOOK_URL: 'http://discord.test/x' }),
    ).toThrow();
  });
});

describe('public AI boot safety', () => {
  it('requires a secret even when AI is disabled', () => {
    expect(() => validate({ DATABASE_URL })).toThrow(/GUEST_ACCESS_SECRET/);
  });
  it('refuses public AI without verified privacy and abuse protection', () => {
    expect(() =>
      validate({ DATABASE_URL, GUEST_ACCESS_SECRET: 's'.repeat(32), AI_PUBLIC_ENABLED: 'true' }),
    ).toThrow();
  });
});

const enabled = {
  DATABASE_URL,
  GUEST_ACCESS_SECRET: 's'.repeat(32),
  AI_PUBLIC_ENABLED: 'true',
  APP_ENV: 'development',
  AI_QUOTA_POOL: 'organization',
  TURNSTILE_SECRET_KEY: 'real-secret',
  TURNSTILE_SITE_KEY: 'real-site',
  GROQ_API_KEY: 'groq',
  GROQ_ZDR_CONFIRMED: 'true',
  GROQ_FREE_TIER_CONFIRMED: 'true',
};
it('accepts complete local configuration and complete production configuration', () => {
  expect(validate(enabled).AI_PUBLIC_ENABLED).toBe('true');
  expect(
    validate({
      ...enabled,
      APP_ENV: 'production',
      REDIS_URL: 'rediss://example',
      DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x',
    }).APP_ENV,
  ).toBe('production');
});
it.each([
  'APP_ENV',
  'AI_QUOTA_POOL',
  'TURNSTILE_SECRET_KEY',
  'TURNSTILE_SITE_KEY',
  'GROQ_API_KEY',
  'GROQ_ZDR_CONFIRMED',
  'GROQ_FREE_TIER_CONFIRMED',
])('refuses incomplete enabled configuration: %s', (key) => {
  const config: Record<string, unknown> = { ...enabled };
  delete config[key];
  expect(() => validate(config)).toThrow();
});
it.each([
  {},
  { REDIS_URL: 'rediss://example' },
  {
    REDIS_URL: 'rediss://example',
    DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x',
    TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
  },
  {
    REDIS_URL: 'rediss://example',
    DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/1/x',
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
  },
])('refuses unsafe public configuration %j', (overrides) =>
  expect(() => validate({ ...enabled, APP_ENV: 'staging', ...overrides })).toThrow(),
);
