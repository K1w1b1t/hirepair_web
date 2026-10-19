import {
  analyzeGuest,
  inputFingerprint,
  apiRoot,
  AnalysisFailure,
  ANALYSIS_MESSAGES,
  isJobAnalysisResult,
  GUEST_CREDENTIAL_KEY,
} from './guest-api';
import { writeBrowserValue, readBrowserValue } from './browser-storage';
const documents = [{ id: 'id', text: 'Mecânico CPF: 123.456.789-00 email@example.com' }];
const draft = { hasJob: true, jobText: 'Manutenção', targetRole: 'Técnico', accepted: true };
const challenge = { token: 'proof', termsVersion: 'v', privacyVersion: 'v' };
const result = {
  targetRole: 'Mecânico',
  reason: 'Razão',
  summary: 'Resumo',
  suggestedArchetype: 'C_OPERATIONAL',
  suggestedObjective: 'ENTER_FAST',
  suggestedTone: 'DIRECT',
  requirements: [{ text: 'Manutenção', category: 'ELIMINATORY' }],
};
const reply = (data: unknown, ok = true) => ({ ok, json: () => Promise.resolve(data) });
describe('guest API client', () => {
  const mock = jest.fn();
  beforeEach(() => {
    localStorage.clear();
    mock.mockReset();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: mock });
    delete process.env.NEXT_PUBLIC_API_URL;
  });
  const success = () =>
    mock
      .mockResolvedValueOnce(reply({ accessToken: 'token', guestCredential: 'signed' }))
      .mockResolvedValueOnce(reply(result));
  it('hashes exact inputs independently of legal acceptance', async () => {
    expect(await inputFingerprint(documents, draft)).toMatch(/^[a-f0-9]{64}$/);
    expect(await inputFingerprint(documents, draft)).toBe(
      await inputFingerprint(documents, { ...draft, accepted: false }),
    );
    expect(await inputFingerprint(documents, draft)).not.toBe(
      await inputFingerprint(documents, { ...draft, hasJob: false }),
    );
  });
  it('normalizes the configured API URL and unknown error codes', () => {
    expect(apiRoot()).toBe('http://localhost:3001');
    process.env.NEXT_PUBLIC_API_URL = 'https://api.example/';
    expect(apiRoot()).toBe('https://api.example');
    expect(new AnalysisFailure('unrecognized').message).toBe(
      'Não foi possível analisar agora. Tente novamente.',
    );
  });
  it('sanitizes before transmission and retains the signed server credential', async () => {
    writeBrowserValue(GUEST_CREDENTIAL_KEY, 'previous');
    success();
    expect(await analyzeGuest(documents, draft, challenge)).toEqual(result);
    expect(JSON.parse(mock.mock.calls[0][1].body)).toMatchObject({
      guestCredential: 'previous',
      acceptedTerms: true,
      acceptedPrivacy: true,
    });
    expect(mock.mock.calls[1][1].body).not.toContain('123.456.789-00');
    expect(mock.mock.calls[1][1].body).not.toContain('email@example.com');
    expect(readBrowserValue(GUEST_CREDENTIAL_KEY)).toBe('signed');
    expect(readBrowserValue('hirepair_analysis_pending')).toBeNull();
  });
  it('accepts target-role mode and an access response without renewal', async () => {
    mock
      .mockResolvedValueOnce(reply({ accessToken: 'token' }))
      .mockResolvedValueOnce(reply(result));
    await analyzeGuest(documents, { ...draft, hasJob: false }, challenge);
    expect(JSON.parse(mock.mock.calls[1][1].body)).toMatchObject({ targetRole: 'Técnico' });
  });
  it('blocks missing consent and excessive input locally', async () => {
    await expect(
      analyzeGuest(documents, { ...draft, accepted: false }, challenge),
    ).rejects.toHaveProperty('code', 'CONSENT_REQUIRED');
    await expect(
      analyzeGuest([{ id: 'id', text: 'x'.repeat(20_001) }], draft, challenge),
    ).rejects.toHaveProperty('code', 'AI_INPUT_TOO_LARGE');
    expect(mock).not.toHaveBeenCalled();
  });
  it.each([null, {}, { accessToken: 3 }])('rejects malformed access %j', async (access) => {
    mock.mockResolvedValue(reply(access));
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toHaveProperty(
      'code',
      'GUEST_ACCESS_INVALID',
    );
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it.each([null, 'body', {}, { code: 3 }])('handles unknown HTTP failures %j', async (payload) => {
    mock.mockResolvedValue(reply(payload, false));
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toHaveProperty(
      'code',
      'UNKNOWN',
    );
  });
  it('handles a non-JSON error without showing provider content', async () => {
    mock.mockResolvedValue({ ok: false, json: () => Promise.reject(new Error('private content')) });
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toHaveProperty(
      'code',
      'UNKNOWN',
    );
  });
  it('distinguishes validation and expired credentials by code', async () => {
    success();
    mock.mockReset();
    writeBrowserValue(GUEST_CREDENTIAL_KEY, 'expired');
    mock.mockResolvedValue(reply({ code: 'GUEST_ACCESS_INVALID' }, false));
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toHaveProperty(
      'code',
      'GUEST_ACCESS_INVALID',
    );
    expect(readBrowserValue(GUEST_CREDENTIAL_KEY)).toBeNull();
    mock.mockReset();
    mock
      .mockResolvedValueOnce(reply({ accessToken: 'token' }))
      .mockResolvedValueOnce(reply({ code: 'AI_INPUT_TOO_LARGE' }, false));
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toHaveProperty(
      'message',
      'Reduza os materiais e os requisitos da vaga para analisar.',
    );
  });
  it('reuses idempotency after an uncertain network failure and in-progress response', async () => {
    mock
      .mockResolvedValueOnce(reply({ accessToken: 'token' }))
      .mockRejectedValueOnce(new Error('network'));
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toThrow('network');
    const key = mock.mock.calls[1][1].headers['Idempotency-Key'];
    mock
      .mockResolvedValueOnce(reply({ accessToken: 'token' }))
      .mockResolvedValueOnce(reply({ code: 'ANALYSIS_IN_PROGRESS' }, false));
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toHaveProperty(
      'code',
      'ANALYSIS_IN_PROGRESS',
    );
    expect(mock.mock.calls[3][1].headers['Idempotency-Key']).toBe(key);
    success();
    await analyzeGuest(documents, draft, challenge);
    expect(mock.mock.calls[5][1].headers['Idempotency-Key']).toBe(key);
  });
  it.each(['not-json', JSON.stringify({ hash: 'different', key: 'old' })])(
    'recovers corrupt or stale pending input %s',
    async (pending) => {
      writeBrowserValue('hirepair_analysis_pending', pending);
      success();
      await analyzeGuest(documents, draft, challenge);
      expect(mock.mock.calls[1][1].headers['Idempotency-Key']).not.toBe('old');
    },
  );
  it('rejects a malformed successful analysis', async () => {
    mock
      .mockResolvedValueOnce(reply({ accessToken: 'token' }))
      .mockResolvedValueOnce(reply({ text: 'unbounded output' }));
    await expect(analyzeGuest(documents, draft, challenge)).rejects.toHaveProperty(
      'code',
      'AI_INVALID_RESPONSE',
    );
  });
  it.each([
    null,
    'text',
    {},
    { ...result, reason: null },
    { ...result, summary: null },
    { ...result, suggestedArchetype: 'invalid' },
    { ...result, suggestedObjective: 'invalid' },
    { ...result, suggestedTone: 'invalid' },
    { ...result, requirements: null },
    { ...result, requirements: [null] },
    { ...result, requirements: [{ text: 3 }] },
    { ...result, requirements: [{ text: 'a', category: 3 }] },
  ])('validates response shape %j', (value) => expect(isJobAnalysisResult(value)).toBe(false));
});

it('provides distinct actionable messages for validation and quota failures', () => {
  expect(ANALYSIS_MESSAGES.VALIDATION_ERROR).not.toBe(
    ANALYSIS_MESSAGES.GUEST_ANALYSIS_LIMIT_REACHED,
  );
});
