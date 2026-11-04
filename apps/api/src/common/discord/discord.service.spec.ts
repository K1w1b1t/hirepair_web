import { Logger } from '@nestjs/common';
import { DiscordService } from './discord.service';

describe('DiscordService', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();
  afterAll(() => {
    global.fetch = originalFetch;
  });
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('is disabled without a webhook', async () => {
    const service = new DiscordService({ get: () => undefined } as never);
    service.onModuleInit();
    await service.sendError500({ method: 'GET', path: '/x', route: '/x', errorMessage: 'boom' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends one sanitized alert per route in the cooldown', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const service = new DiscordService(
      {
        get: (key: string) =>
          key === 'DISCORD_WEBHOOK_URL' ? 'https://discord.test/hook' : 'test',
      } as never,
      () => 1_000,
    );
    service.onModuleInit();
    const payload = {
      traceId: 'trace-1',
      method: 'GET',
      path: '/resumes',
      route: '/resumes/:id',
      errorMessage: 'boom',
      stack: 'x'.repeat(1100),
    };
    await service.sendError500(payload);
    await service.sendError500(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.lastCall as unknown as [unknown, RequestInit];
    expect(typeof requestInit.body === 'string' ? requestInit.body : '').not.toContain(
      'contentMarkdown',
    );
  });

  it('does not throw when Discord fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const service = new DiscordService({ get: () => 'https://discord.test/hook' } as never);
    service.onModuleInit();
    await expect(
      service.sendJobFailure({ queue: 'audio', jobId: '1', failedReason: 'bad' }),
    ).resolves.toBeUndefined();
  });
});

it('sends budget notifications and sanitized job fallbacks without free text', async () => {
  const original = global.fetch;
  const mock = jest.fn().mockResolvedValue(new Response('{}', { status: 500 }));
  global.fetch = mock;
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  try {
    const s = new DiscordService({ get: () => 'https://discord.test/hook' } as never);
    s.onModuleInit();
    await s.sendAiBudget({ environment: 'test', model: 'model', threshold: 80 });
    await s.sendJobFailure({ queue: 'queue', jobName: 'named', failedReason: 'private-text' });
    await s.sendJobFailure({ queue: 'queue' });
    await s.sendError500({
      method: 'GET',
      path: '/route',
      route: '/route',
      errorMessage: 'private-text',
    });
    expect(JSON.stringify(mock.mock.calls)).not.toContain('private-text');
    expect(mock).toHaveBeenCalledTimes(4);
    expect(warn).toHaveBeenCalled();
  } finally {
    global.fetch = original;
    warn.mockRestore();
  }
});
it('expires cooldown entries and bounds deduplication memory', async () => {
  const original = global.fetch;
  global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));
  let now = 0;
  const s = new DiscordService({ get: () => 'https://discord.test/hook' } as never, () => now);
  s.onModuleInit();
  try {
    await s.sendJobFailure({ queue: 'q', jobId: 'same', traceId: 'trace' });
    now = 300001;
    await s.sendJobFailure({ queue: 'q', jobId: 'same' });
    for (let index = 0; index < 5001; index++)
      await s.sendJobFailure({ queue: 'q', jobId: String(index) });
    await s.sendJobFailure({ queue: 'q', jobId: '0' });
    expect(fetch).toHaveBeenCalledTimes(5004);
  } finally {
    global.fetch = original;
  }
});
