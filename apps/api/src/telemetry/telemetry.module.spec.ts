import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import { TelemetryModule } from './telemetry.module';
import { TelemetryService } from './telemetry.service';
jest.mock('posthog-node', () => ({ PostHog: jest.fn() }));
describe('TelemetryModule', () => {
  it('is defined and isolates non-Error SDK failures with defaults', async () => {
    expect(TelemetryModule).toBeDefined();
    jest
      .mocked(PostHog)
      .mockImplementation(
        () => ({ capture: jest.fn(), shutdown: jest.fn().mockRejectedValue('offline') }) as never,
      );
    const service = new TelemetryService(new ConfigService({ POSTHOG_PROJECT_TOKEN: 'ph_server' }));
    await expect(
      service.captureAiFallback({
        fromProvider: 'gemini',
        fromModel: 'a',
        toProvider: 'groq-70b',
        toModel: 'b',
        status: 503,
        traceId: 'trace',
      }),
    ).resolves.toBeUndefined();
    expect(PostHog).toHaveBeenCalledWith('ph_server', {
      host: 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  });
});
