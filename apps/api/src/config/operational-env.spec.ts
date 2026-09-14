import { validate } from './env.validation';

const DATABASE_URL = 'postgresql://user:pass@localhost:5434/hirepair';

describe('operational environment', () => {
  it('accepts valid CORS, docs and Discord settings', () => {
    const result = validate({
      DATABASE_URL,
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
