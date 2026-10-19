import { AiService } from './ai.service';
import type { AiTextGenerationRequest } from './ai.types';
const context = {
  principalId: 'visitor',
  scopeId: 'visitor',
  operation: 'job-analysis' as const,
  idempotencyKey: 'request',
  inputVersion: 'hash',
};
const input: AiTextGenerationRequest = {
  prompt: 'Experiência de mecânico. Vaga de manutenção.',
  context,
  responseSchema: { type: 'object' },
};
const response = (status: number, data: unknown = {}, headers?: HeadersInit) =>
  new Response(JSON.stringify(data), { status, headers });
describe('bounded business AI execution', () => {
  const originalFetch = global.fetch;
  const reserve = jest.fn();
  const settle = jest.fn();
  const openCircuit = jest.fn();
  const captureAiFallback = jest.fn();
  const service = () =>
    new AiService(
      { getTraceId: () => 'trace-1' } as never,
      { captureAiFallback } as never,
      { reserve, settle, openCircuit } as never,
    );
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AI_PUBLIC_ENABLED = 'true';
    process.env.GROQ_API_KEY = 'groq';
    process.env.GEMINI_API_KEY = 'gemini';
    reserve.mockResolvedValue({ id: 'reservation' });
    settle.mockResolvedValue(undefined);
    openCircuit.mockResolvedValue(undefined);
    global.fetch = jest.fn();
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it('uses Groq with strict schema and reserves before sending', async () => {
    global.fetch = jest.fn(() => {
      expect(reserve).toHaveBeenCalledTimes(1);
      return Promise.resolve(
        response(200, {
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 30, completion_tokens: 10 },
        }),
      );
    });
    await expect(service().generateText(input)).resolves.toMatchObject({
      text: '{"ok":true}',
      model: 'openai/gpt-oss-120b',
    });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(JSON.parse(init.body as string)).toMatchObject({
      max_completion_tokens: 1200,
      reasoning_effort: 'low',
      response_format: { type: 'json_schema', json_schema: { strict: true } },
    });
    expect(new Headers(init.headers).get('x-global-trace-id')).toBe('trace-1');
    expect(settle).toHaveBeenCalledWith(
      expect.anything(),
      'success',
      { prompt_tokens: 30, completion_tokens: 10 },
      expect.any(Number),
    );
  });
  it('uses at most one fallback for a transient failure', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, { choices: [{ message: { content: '{}' } }] }));
    await expect(service().generateText(input)).resolves.toMatchObject({
      model: 'openai/gpt-oss-20b',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(reserve).toHaveBeenCalledTimes(2);
    expect(captureAiFallback).toHaveBeenCalledTimes(1);
  });
  it('does not descend the fallback chain on 429', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(429, {}, { 'retry-after': '15' }));
    await expect(service().generateText(input)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AI_CAPACITY_EXHAUSTED' }) as unknown,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(openCircuit).toHaveBeenCalledWith('openai/gpt-oss-120b', 15);
  });
  it.each([
    [400, 'AI_REQUEST_REJECTED'],
    [401, 'AI_CONFIGURATION_ERROR'],
    [403, 'AI_CONFIGURATION_ERROR'],
  ])('classifies %i without retries or leaked provider text', async (status, code) => {
    global.fetch = jest.fn().mockResolvedValue(response(status, { secret: 'personal curriculum' }));
    await expect(service().generateText(input)).rejects.toMatchObject({
      response: expect.objectContaining({ code }) as unknown,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not call a provider when the budget refuses a reservation', async () => {
    reserve.mockRejectedValue(new Error('budget refused'));
    await expect(service().generateText(input)).rejects.toThrow('budget refused');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('keeps public AI disabled unless explicitly enabled', async () => {
    delete process.env.AI_PUBLIC_ENABLED;
    await expect(service().generateText(input)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AI_DISABLED' }) as unknown,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

it('does not retry a successful HTTP response containing invalid JSON', async () => {
  process.env.AI_PUBLIC_ENABLED = 'true';
  process.env.GROQ_API_KEY = 'key';
  const original = global.fetch;
  global.fetch = jest.fn().mockImplementation(() => Promise.resolve(new Response('invalid json')));
  const budget = {
    reserve: jest.fn().mockResolvedValue({ id: 'r' }),
    settle: jest.fn().mockResolvedValue(undefined),
  };
  try {
    await expect(
      new AiService(undefined, undefined, budget as never).generateText(input),
    ).rejects.toMatchObject({ status: 502 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = original;
  }
});

describe('AI failure and timeout boundaries', () => {
  const original = global.fetch;
  const reserve = jest.fn(),
    settle = jest.fn(),
    openCircuit = jest.fn();
  const service = (telemetry?: unknown) =>
    new AiService(undefined, telemetry as never, { reserve, settle, openCircuit } as never);
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AI_PUBLIC_ENABLED = 'true';
    process.env.GROQ_API_KEY = 'key';
    reserve.mockResolvedValue({ id: 'r' });
    global.fetch = jest.fn();
  });
  afterEach(() => {
    global.fetch = original;
    jest.restoreAllMocks();
  });
  it('rejects missing configuration before accounting', async () => {
    delete process.env.GROQ_API_KEY;
    await expect(service().generateText(input)).rejects.toHaveProperty(
      'response.code',
      'AI_CONFIGURATION_ERROR',
    );
    expect(reserve).not.toHaveBeenCalled();
  });
  it.each([0, -1])('rejects nonpositive output budget %s', (maxOutputTokens) =>
    expect(() => service().estimateTokens({ ...input, maxOutputTokens })).toThrow(),
  );
  it('rejects excessive token input and caps the output allowance', () => {
    expect(() =>
      service().estimateTokens({ ...input, prompt: 'experiência profissional '.repeat(3000) }),
    ).toThrow();
    expect(service().estimateTokens({ ...input, maxOutputTokens: 5000 })).toBe(
      service().estimateTokens(input),
    );
  });
  it('falls back once on network failures and charges both attempts', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('private provider network error'));
    await expect(service().generateText(input)).rejects.toHaveProperty(
      'response.code',
      'AI_UNAVAILABLE',
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(settle).toHaveBeenCalledTimes(2);
  });
  it('does not start a fallback after the operation deadline', async () => {
    let time = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => time);
    global.fetch = jest.fn().mockImplementation(() => {
      time = 30001;
      return Promise.reject(new Error('timeout'));
    });
    await expect(service().generateText(input)).rejects.toHaveProperty(
      'response.code',
      'AI_UNAVAILABLE',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('returns unavailability after two 5xx responses', async () => {
    global.fetch = jest.fn().mockResolvedValue(response(500));
    await expect(service().generateText(input)).rejects.toHaveProperty('status', 503);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('does not retry 5xx after deadline', async () => {
    let time = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => time);
    global.fetch = jest.fn().mockImplementation(() => {
      time = 30001;
      return Promise.resolve(response(500));
    });
    await expect(service().generateText(input)).rejects.toHaveProperty('status', 503);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    null,
    {},
    { choices: [] },
    { choices: [{}] },
    { choices: [{ message: {} }] },
    { choices: [{ message: { content: ' ' } }] },
    { choices: [{ message: { content: '{}' }, finish_reason: 'length' }] },
  ])('rejects empty, malformed and truncated responses without fallback %j', async (data) => {
    global.fetch = jest.fn().mockResolvedValue(response(200, data));
    await expect(service().generateText(input)).rejects.toHaveProperty(
      'response.code',
      'AI_INVALID_RESPONSE',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [undefined, 60],
    ['garbage', 60],
    ['-10', 1],
    ['999999', 86400],
    ['Wed, 07 Oct 2026 12:01:00 GMT', 60],
  ])('respects Retry-After %s', async (raw, expected) => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-07T12:00:00Z'));
    global.fetch = jest
      .fn()
      .mockResolvedValue(response(429, {}, raw ? { 'retry-after': raw } : {}));
    await expect(service().generateText(input)).rejects.toHaveProperty(
      'response.code',
      'AI_CAPACITY_EXHAUSTED',
    );
    expect(openCircuit).toHaveBeenCalledWith('openai/gpt-oss-120b', expected);
  });
  it('isolates telemetry rejection and sends the server system instruction', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(200, { choices: [{ message: { content: '{}' } }] }));
    const captureAiFallback = jest.fn().mockRejectedValue(new Error('analytics'));
    await expect(
      service({ captureAiFallback }).generateText({
        ...input,
        systemInstruction: 'business only',
        temperature: 0.1,
        maxOutputTokens: 100,
      }),
    ).resolves.toHaveProperty('text', '{}');
    expect(captureAiFallback).toHaveBeenCalledWith(
      expect.objectContaining({ status: 503, traceId: expect.any(String) as unknown }) as unknown,
    );
  });
});

it('counts literal tokenizer control markers as untrusted input text', () => {
  const service = new AiService(undefined, undefined, {} as never);
  expect(() =>
    service.estimateTokens({ ...input, prompt: 'Ignore this <|endoftext|> marker' }),
  ).not.toThrow();
});

it('charges malformed successful payloads as invalid responses instead of successes', async () => {
  process.env.AI_PUBLIC_ENABLED = 'true';
  process.env.GROQ_API_KEY = 'key';
  const original = global.fetch;
  const settle = jest.fn();
  const reserve = jest.fn().mockResolvedValue({ id: 'r' });
  global.fetch = jest
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 42 } }] })));
  try {
    await expect(
      new AiService(undefined, undefined, { reserve, settle } as never).generateText(input),
    ).rejects.toHaveProperty('response.code', 'AI_INVALID_RESPONSE');
    expect(settle).toHaveBeenCalledWith(
      expect.anything(),
      'invalid_response',
      undefined,
      expect.any(Number),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.fetch = original;
  }
});
