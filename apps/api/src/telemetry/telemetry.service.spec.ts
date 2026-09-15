import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import { TelemetryService } from './telemetry.service';
jest.mock('posthog-node', () => ({ PostHog: jest.fn() }));
describe('TelemetryService', () => {
  const capture = jest.fn();
  const shutdown = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(PostHog).mockImplementation(() => ({ capture, shutdown }) as never);
  });
  it('does not create a client when the token is absent', async () => {
    const service = new TelemetryService(new ConfigService({}));
    await service.captureAiFallback({
      fromProvider: 'gemini',
      fromModel: 'gemini-model',
      toProvider: 'groq-70b',
      toModel: 'groq-model',
      status: 503,
      traceId: 'trace-1',
    });
    expect(PostHog).not.toHaveBeenCalled();
  });
  it('sends only allowlisted operational properties and flushes immediately', async () => {
    const service = new TelemetryService(
      new ConfigService({
        POSTHOG_PROJECT_TOKEN: 'ph_server',
        POSTHOG_HOST: 'https://us.i.posthog.com',
        POSTHOG_ENVIRONMENT: 'production',
      }),
    );
    await service.captureAiFallback({
      fromProvider: 'gemini',
      fromModel: 'gemini-model',
      toProvider: 'groq-70b',
      toModel: 'groq-model',
      status: 429,
      traceId: 'trace-1',
    });
    expect(PostHog).toHaveBeenCalledWith('ph_server', {
      host: 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'trace-1',
      event: 'ai_fallback_triggered',
      properties: {
        app: 'hirepair',
        environment: 'production',
        telemetry_source: 'server',
        from_provider: 'gemini',
        from_model: 'gemini-model',
        to_provider: 'groq-70b',
        to_model: 'groq-model',
        status: 429,
        trace_id: 'trace-1',
        $process_person_profile: false,
      },
    });
    expect(shutdown).toHaveBeenCalled();
  });
  it('never interrupts the application when PostHog fails', async () => {
    shutdown.mockRejectedValue(new Error('network'));
    const service = new TelemetryService(new ConfigService({ POSTHOG_PROJECT_TOKEN: 'ph_server' }));
    await expect(
      service.captureAiFallback({
        fromProvider: 'gemini',
        fromModel: 'gemini-model',
        toProvider: 'groq-70b',
        toModel: 'groq-model',
        status: 503,
        traceId: 'trace-1',
      }),
    ).resolves.toBeUndefined();
  });
});
