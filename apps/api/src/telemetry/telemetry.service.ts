import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostHog } from 'posthog-node';
import type { AiProvider } from '../ai/ai.types';

export interface AiFallbackTelemetry {
  fromProvider: AiProvider;
  fromModel: string;
  toProvider: AiProvider;
  toModel: string;
  status: number;
  traceId: string;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  constructor(private readonly config: ConfigService) {}

  async captureAiFallback(payload: AiFallbackTelemetry): Promise<void> {
    const token = this.config.get<string>('POSTHOG_PROJECT_TOKEN');
    if (!token) return;
    const client = new PostHog(token, {
      host: this.config.get<string>('POSTHOG_HOST') ?? 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
    try {
      client.capture({
        distinctId: payload.traceId,
        event: 'ai_fallback_triggered',
        properties: {
          app: 'hirepair',
          environment: this.config.get<string>('POSTHOG_ENVIRONMENT') ?? 'development',
          telemetry_source: 'server',
          from_provider: payload.fromProvider,
          from_model: payload.fromModel,
          to_provider: payload.toProvider,
          to_model: payload.toModel,
          status: payload.status,
          trace_id: payload.traceId,
          $process_person_profile: false,
        },
      });
      await client.shutdown();
    } catch (error) {
      this.logger.warn(
        `Falha isolada na telemetria PostHog: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
