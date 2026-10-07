import { AiBudgetService } from './ai-budget.service';
const context = {
  principalId: 'visitor',
  scopeId: 'visitor',
  operation: 'job-analysis' as const,
  idempotencyKey: 'key',
  inputVersion: 'hash',
};
describe('AI accounting contract', () => {
  const run = jest.fn<Promise<unknown>, [string, string[], Array<string | number>]>();
  const sendAiBudget = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_PUBLIC_ENABLED = 'true';
    process.env.GUEST_ACCESS_SECRET = 's'.repeat(32);
    run.mockResolvedValue([0, 0, 0]);
  });
  const service = () => new AiBudgetService({ run } as never, { sendAiBudget } as never);
  it('reserves before any provider attempt', async () => {
    await expect(service().reserve(context, 'openai/gpt-oss-120b', 2000)).resolves.toMatchObject({
      tokens: 2000,
    });
    const [, keys, args] = run.mock.calls[0];
    expect(keys).toContainEqual(expect.stringContaining('month:'));
    expect(JSON.parse(String(args[3]))).toContainEqual(expect.objectContaining({ limit: 2400 }));
  });
  it('blocks before provider access on exhausted capacity', async () => {
    run.mockResolvedValueOnce([1, 60000]);
    await expect(service().reserve(context, 'model', 2000)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'AI_CAPACITY_EXHAUSTED',
        retryAfterSeconds: 60,
      }) as unknown,
    });
  });
  it('keeps the conservative charge when usage is unavailable', async () => {
    const reservation = await service().reserve(context, 'model', 2000);
    await service().settle(reservation, 'timeout');
    expect(run.mock.calls[1][2][1]).toBe(0);
    expect(JSON.parse(String(run.mock.calls[1][2][2]))).toMatchObject({
      actualTokens: null,
      outcome: 'timeout',
    });
  });
});

it('does not send a global-capacity alert for a single exhausted visitor scope', async () => {
  process.env.AI_PUBLIC_ENABLED = 'true';
  process.env.GUEST_ACCESS_SECRET = 's'.repeat(32);
  const run = jest.fn().mockResolvedValue([7, 1000]);
  const sendAiBudget = jest.fn();
  await expect(
    new AiBudgetService({ run } as never, { sendAiBudget } as never).reserve(
      context,
      'model',
      1000,
    ),
  ).rejects.toHaveProperty('response.code', 'AI_CAPACITY_EXHAUSTED');
  expect(run).toHaveBeenCalledTimes(1);
  expect(sendAiBudget).not.toHaveBeenCalled();
});

describe('AI budget boundaries and usage reconciliation', () => {
  const run = jest.fn<Promise<unknown>, [string, string[], Array<string | number>]>();
  const sendAiBudget = jest.fn();
  const service = () => new AiBudgetService({ run } as never, { sendAiBudget } as never);
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AI_PUBLIC_ENABLED = 'true';
    process.env.GUEST_ACCESS_SECRET = 's'.repeat(32);
    delete process.env.AI_QUOTA_POOL;
    delete process.env.APP_ENV;
    run.mockResolvedValue([0, 0, 0]);
  });
  it.each([0, -1, 6001, 1.5, NaN])('rejects invalid reservation %s', async (tokens) => {
    await expect(service().reserve(context, 'model', tokens)).rejects.toHaveProperty('status', 400);
    expect(run).not.toHaveBeenCalled();
  });
  it('rejects non-business operations', async () => {
    await expect(
      service().reserve({ ...context, operation: 'generic' as never }, 'model', 10),
    ).rejects.toHaveProperty('status', 400);
  });
  it('applies smaller staging caps and stable pool alias', async () => {
    process.env.APP_ENV = 'staging';
    process.env.AI_QUOTA_POOL = 'org';
    await service().reserve(context, 'model', 1000);
    expect(run.mock.calls[0][1][0]).toBe('{hirepair:org}:groq:circuit');
    expect(JSON.parse(String(run.mock.calls[0][2][3]))).toContainEqual(
      expect.objectContaining({ limit: 240 }),
    );
  });
  it.each([
    undefined,
    { prompt_tokens: 12, completion_tokens: 3 },
    { prompt_tokens: 1.5, completion_tokens: 0 },
    { prompt_tokens: 0, completion_tokens: NaN },
    { prompt_tokens: -1, completion_tokens: 0 },
    { prompt_tokens: 0, completion_tokens: -1 },
  ])('accounts usage conservatively %j', async (usage) => {
    const s = service(),
      reservation = await s.reserve(context, 'model', 1000);
    await s.settle(reservation, 'finished', usage, 42);
    expect(JSON.parse(String(run.mock.calls[1][2][2]))).toMatchObject({
      durationMs: 42,
      actualTokens: usage?.prompt_tokens === 12 ? 15 : null,
    });
  });
  it('preserves a charge after accounting write failure', async () => {
    const s = service(),
      r = await s.reserve(context, 'model', 1000);
    run.mockRejectedValue(new Error('offline'));
    await expect(s.settle(r, 'failed')).resolves.toBeUndefined();
  });
  it('opens a shared provider cooldown and clamps nonpositive duration', async () => {
    await service().openCircuit('model', 0);
    expect(run.mock.calls[0][2]).toEqual(['1', 1000]);
  });
  it.each([80, 100])('deduplicates %s percent notifications', async (threshold) => {
    run
      .mockResolvedValueOnce(threshold === 80 ? [0, 0, 80] : [1, 60000, 0])
      .mockResolvedValueOnce('OK');
    if (threshold === 80) await service().reserve(context, 'model', 1000);
    else await expect(service().reserve(context, 'model', 1000)).rejects.toThrow();
    expect(sendAiBudget).toHaveBeenCalledWith({
      model: 'model',
      threshold,
      environment: 'development',
    });
  });
  it('isolates notification failure', async () => {
    run.mockResolvedValueOnce([0, 0, 90]).mockRejectedValueOnce(new Error('alert failed'));
    await expect(service().reserve(context, 'model', 1000)).resolves.toHaveProperty('tokens', 1000);
  });
});
