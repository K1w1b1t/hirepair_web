import { createHmac } from 'node:crypto';
import { GuestAccessService } from '../guest/guest-access.service';
import { clientNetwork } from './client-ip';
import { guestSecret, requirePublicAi } from './operational.config';
import { RedisService } from './redis.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import Redis from 'ioredis';
jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn() }));
describe('operational boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.VERCEL;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    process.env.GUEST_ACCESS_SECRET = 's'.repeat(32);
  });
  it.each([
    ['127.0.0.1', '127.0.0.1'],
    ['::ffff:127.0.0.1', '127.0.0.1'],
    ['::ffff:7f00:1', '127.0.0.1'],
    ['2001:db8:abcd:1234:1:2:3:4', '2001:0db8:abcd:1234::/64'],
    ['2001:db8::1', '2001:0db8:0000:0000::/64'],
    ['::1', '0000:0000:0000:0000::/64'],
  ])('canonicalizes %s', (address, expected) => {
    expect(
      clientNetwork({
        headers: { 'x-forwarded-for': 'forged' },
        socket: { remoteAddress: address },
      } as never),
    ).toBe(expected);
  });
  it('uses only the platform header in Vercel and fails closed if it is invalid', () => {
    process.env.VERCEL = '1';
    expect(
      clientNetwork({
        headers: { 'x-vercel-forwarded-for': '192.0.2.1', 'x-forwarded-for': 'forged' },
        socket: {},
      } as never),
    ).toBe('192.0.2.1');
    for (const value of [
      undefined,
      ['127.0.0.1'],
      'invalid',
      '127.0.0.1, 1.1.1.1',
      'fe80::1%eth0',
    ]) {
      expect(() =>
        clientNetwork({ headers: { 'x-vercel-forwarded-for': value }, socket: {} } as never),
      ).toThrow();
    }
  });
  it('does not provide any secret or AI-enabled fallback', () => {
    delete process.env.GUEST_ACCESS_SECRET;
    expect(guestSecret).toThrow();
    process.env.GUEST_ACCESS_SECRET = 'short';
    expect(guestSecret).toThrow();
    delete process.env.AI_PUBLIC_ENABLED;
    expect(requirePublicAi).toThrow();
    process.env.AI_PUBLIC_ENABLED = 'true';
    expect(requirePublicAi).not.toThrow();
  });
  it('rejects oversized and signed malformed access claims', () => {
    process.env.APP_ENV = 'test';
    const service = new GuestAccessService();
    expect(() => service.verify('x'.repeat(2049))).toThrow();
    const sign = (value: string) => Buffer.from(value).toString('base64url');
    const malformed = sign('not-json');
    const signature = createHmac('sha256', process.env.GUEST_ACCESS_SECRET!)
      .update(malformed)
      .digest('base64url');
    expect(() => service.verify(`${malformed}.${signature}`)).toThrow();
    const claims = {
      visitorId: 'v'.repeat(36),
      purpose: 'access',
      environment: 'test',
      exp: Date.now() + 10000,
      termsVersion: 'old',
      privacyVersion: 'old',
    };
    const payload = sign(JSON.stringify(claims));
    expect(() =>
      service.verify(
        `${payload}.${createHmac('sha256', process.env.GUEST_ACCESS_SECRET!).update(payload).digest('base64url')}`,
      ),
    ).toThrow();
  });
  it('shares one Redis connection and maps its errors without leaking details', async () => {
    const evalMock = jest.fn().mockResolvedValue('ok');
    const on = jest.fn();
    const disconnect = jest.fn();
    (Redis as unknown as jest.Mock).mockImplementation(() => ({ eval: evalMock, on, disconnect }));
    const local = new RedisService();
    expect(await local.run('return 1', [])).toBe('ok');
    (on.mock.calls as unknown as [string, () => void][])[0][1]();
    evalMock.mockRejectedValue(new Error('redis://user:private@host'));
    await expect(local.run('test', [], ['x', 1])).rejects.toHaveProperty(
      'response.code',
      'OPERATIONAL_STORAGE_UNAVAILABLE',
    );
    local.onApplicationShutdown();
    expect(disconnect).toHaveBeenCalled();
    process.env.REDIS_URL = 'rediss://example.test';
    new RedisService();
    delete process.env.REDIS_URL;
    process.env.REDIS_HOST = 'redis';
    process.env.REDIS_PORT = '1234';
    new RedisService();
    expect(Redis).toHaveBeenLastCalledWith(expect.objectContaining({ host: 'redis', port: 1234 }));
  });
  it('exposes throttle durations in seconds', async () => {
    const run = jest.fn().mockResolvedValue([11, 1501, 1001]);
    expect(
      await new RedisThrottlerStorage({ run } as never).increment('key', 60_000, 10, 60_000),
    ).toEqual({ totalHits: 11, timeToExpire: 2, isBlocked: true, timeToBlockExpire: 2 });
  });
});
