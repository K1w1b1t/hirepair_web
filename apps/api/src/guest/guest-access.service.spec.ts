import { GuestAccessService } from './guest-access.service';

describe('GuestAccessService security', () => {
  beforeEach(() => {
    process.env.GUEST_ACCESS_SECRET = 's'.repeat(32);
    process.env.APP_ENV = 'test';
  });
  it('rejects a token signed with the historical public fallback', () => {
    const service = new GuestAccessService();
    expect(() => service.verify('malformed')).toThrow();
  });
  it('issues a server identity and preserves it on credential renewal', () => {
    const service = new GuestAccessService();
    const first = service.issue();
    const second = service.issue(first.guestCredential);
    expect(service.verify(first.accessToken).visitorId).toMatch(/^[0-9a-f-]{36}$/);
    expect(service.verify(second.accessToken)).toEqual(service.verify(first.accessToken));
    expect(() => service.verify(first.guestCredential)).toThrow();
  });
  it('rejects cross-environment, malformed, expired and altered tokens', () => {
    const service = new GuestAccessService();
    const issued = service.issue();
    expect(() => service.verify(`${issued.accessToken}.extra`)).toThrow();
    expect(() => service.verify(`${issued.accessToken.slice(0, -1)}!`)).toThrow();
    process.env.APP_ENV = 'staging';
    expect(() => service.verify(issued.accessToken)).toThrow();
    process.env.APP_ENV = 'test';
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 3_600_001);
    expect(() => service.verify(issued.accessToken)).toThrow();
    jest.restoreAllMocks();
  });
});
