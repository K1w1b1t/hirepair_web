import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    process.env.CORS_ORIGIN = '["https://hirepair.com.br"]';
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it('accepts only the configured hostname and access action', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: 'hirepair.com.br',
          action: 'guest_access',
        }),
      ),
    );
    await expect(new TurnstileService().verify('challenge')).resolves.toBeUndefined();
  });
  it.each([
    { success: false },
    { success: true, hostname: 'attacker.test', action: 'guest_access' },
    { success: true, hostname: 'hirepair.com.br', action: 'other' },
  ])('rejects invalid challenges without issuing access', async (result) => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(result)));
    await expect(new TurnstileService().verify('challenge')).rejects.toMatchObject({ status: 400 });
  });
  it('fails closed on network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('private provider details'));
    await expect(new TurnstileService().verify('challenge')).rejects.toMatchObject({ status: 503 });
  });
});

it('rejects missing configuration and non-JSON / HTTP failures', async () => {
  const original = global.fetch;
  delete process.env.TURNSTILE_SECRET_KEY;
  await expect(new TurnstileService().verify('token')).rejects.toMatchObject({ status: 503 });
  process.env.TURNSTILE_SECRET_KEY = 'key';
  for (const result of [
    new Response('{}', { status: 500 }),
    new Response('not-json'),
    new Response('null'),
  ]) {
    global.fetch = jest.fn().mockResolvedValue(result);
    await expect(new TurnstileService().verify('token')).rejects.toThrow();
  }
  global.fetch = original;
});

it('rejects successful challenge responses missing the hostname', async () => {
  process.env.TURNSTILE_SECRET_KEY = 'key';
  const previous = global.fetch;
  global.fetch = jest
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true, action: 'guest_access' })));
  try {
    await expect(new TurnstileService().verify('token')).rejects.toHaveProperty(
      'response.code',
      'TURNSTILE_INVALID',
    );
  } finally {
    global.fetch = previous;
  }
});
