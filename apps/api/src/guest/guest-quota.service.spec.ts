import { GuestQuotaService } from './guest-quota.service';
describe('GuestQuotaService', () => {
  const run = jest.fn<Promise<unknown>, [string, string[], Array<string | number>]>();
  const service = () => new GuestQuotaService({ run } as never);
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GUEST_ACCESS_SECRET = 's'.repeat(32);
  });
  it('reserves independently by server visitor and network', async () => {
    run.mockResolvedValue(['OK', 0]);
    const lease = await service().reserveAnalysis('visitor', '127.0.0.1', 'idempotency', 'hash');
    expect(lease.keys).toHaveLength(2);
    expect(run.mock.calls[0][1][2]).not.toContain('127.0.0.1');
    await service().finishAnalysis(lease, false);
    expect(run.mock.calls[1][2][1]).toBe('failed');
    // The finish script releases only concurrency, never the charged attempt.
    expect(run.mock.calls[1][1]).toHaveLength(2);
  });
  it.each([
    'GUEST_ANALYSIS_LIMIT_REACHED',
    'NETWORK_LIMIT_REACHED',
    'IDEMPOTENCY_CONFLICT',
    'ANALYSIS_IN_PROGRESS',
    'ANALYSIS_ALREADY_PROCESSED',
  ])('reports %s', async (code) => {
    run.mockResolvedValue([code, 60_000]);
    await expect(service().reserveAnalysis('visitor', 'ip', 'key', 'hash')).rejects.toMatchObject({
      response: expect.objectContaining({ code }) as unknown,
    });
  });
  it('records versioned consent without raw IP or content', async () => {
    run.mockResolvedValue(1);
    await service().recordConsent('visitor');
    expect(JSON.parse(String(run.mock.calls[0][2][0]))).toMatchObject({
      termsVersion: '2026-10-07',
      privacyVersion: '2026-10-07',
    });
  });
  it('reserves access and reports the window expiration', async () => {
    run.mockResolvedValue([0, 0]);
    await service().reserveAccess('network');
    run.mockResolvedValue([1, 30_000]);
    await expect(service().reserveAccess('network')).rejects.toMatchObject({ status: 429 });
  });
  it('keeps conservative accounting when finalization fails', async () => {
    run.mockRejectedValue(new Error('offline'));
    await expect(
      service().finishAnalysis({ owner: 'owner', keys: ['idempotency', 'lock'] }, true),
    ).resolves.toBeUndefined();
  });
});
