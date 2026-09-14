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
