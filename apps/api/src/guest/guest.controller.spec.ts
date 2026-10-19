import { GuestController, GuestAccessDto, GuestAnalysisDto } from './guest.controller';
import { LEGAL_VERSION } from '../operational/operational.config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
const request = { headers: {}, socket: { remoteAddress: '127.0.0.1' } };
describe('guest business HTTP contract', () => {
  const access = { issue: jest.fn(), verify: jest.fn() };
  const analysis = { analyze: jest.fn() };
  const quota = { reserveAccess: jest.fn(), recordConsent: jest.fn() };
  const turnstile = { verify: jest.fn() };
  const controller = new GuestController(
    access as never,
    analysis as never,
    quota as never,
    turnstile,
  );
  const consent = {
    acceptedTerms: true,
    acceptedPrivacy: true,
    termsVersion: LEGAL_VERSION,
    privacyVersion: LEGAL_VERSION,
    turnstileToken: 'challenge',
  };
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.VERCEL;
    delete process.env.TURNSTILE_SITE_KEY;
    process.env.AI_PUBLIC_ENABLED = 'true';
    access.issue.mockReturnValue({ accessToken: 'token' });
    access.verify.mockReturnValue({ visitorId: 'visitor' });
  });
  it('publishes only public challenge configuration', () => {
    expect(controller.config()).toEqual({
      enabled: true,
      siteKey: '',
      termsVersion: LEGAL_VERSION,
      privacyVersion: LEGAL_VERSION,
    });
    process.env.AI_PUBLIC_ENABLED = 'false';
    process.env.TURNSTILE_SITE_KEY = 'public';
    expect(controller.config()).toMatchObject({ enabled: false, siteKey: 'public' });
  });
  it.each([
    { acceptedTerms: false },
    { acceptedPrivacy: false },
    { termsVersion: 'old' },
    { privacyVersion: 'old' },
  ])('requires explicit current consent: %j', async (change) => {
    await expect(
      controller.accessToken({ ...consent, ...change }, request as never),
    ).rejects.toHaveProperty('response.code', 'CONSENT_REQUIRED');
    expect(turnstile.verify).not.toHaveBeenCalled();
  });
  it('reserves access, validates challenge and records signed consent', async () => {
    expect(
      await controller.accessToken({ ...consent, guestCredential: 'signed' }, request as never),
    ).toEqual({ accessToken: 'token' });
    expect(quota.reserveAccess).toHaveBeenCalledWith('127.0.0.1');
    expect(turnstile.verify).toHaveBeenCalledWith('challenge');
    expect(access.issue).toHaveBeenCalledWith('signed');
    expect(quota.recordConsent).toHaveBeenCalledWith('visitor');
  });
  it.each([undefined, '', 'Bearer forged', 'Basic a.b'])(
    'rejects invalid authorization %s',
    (authorization) => {
      expect(() =>
        controller.analyze(authorization, 'valid-request-key', { documents: [] }, request as never),
      ).toThrow();
    },
  );
  it.each([undefined, 'short', 'x'.repeat(101), 'request key invalid'])(
    'requires idempotency %s',
    (key) => {
      expect(
        () => void controller.analyze('Bearer a.b', key, { documents: [] }, request as never),
      ).toThrow();
    },
  );
  it('forwards only the business input and trusted network', () => {
    const body = { documents: [{ id: 'd', text: 'Mecânico' }], targetRole: 'Mecânico' };
    void controller.analyze('Bearer a.b', 'valid-request-key', body, request as never);
    expect(analysis.analyze).toHaveBeenCalledWith('a.b', body, '127.0.0.1', 'valid-request-key');
  });
  it('rejects generic prompts, model selection and coerced consent at DTO boundary', () => {
    expect(
      validateSync(plainToInstance(GuestAccessDto, { ...consent, acceptedTerms: 'false' })),
    ).not.toHaveLength(0);
    expect(
      validateSync(
        plainToInstance(GuestAnalysisDto, {
          documents: [{ id: 'd', text: 'work' }],
          prompt: 'write anything',
          model: 'other',
        }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).toHaveLength(2);
  });
});
