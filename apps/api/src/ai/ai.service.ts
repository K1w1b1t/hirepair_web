import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { countTokens } from 'gpt-tokenizer/cjs/encoding/o200k_harmony';
import type { AiTextGenerationRequest, AiTextGenerationResult, AiProvider } from './ai.types';
import { AiBudgetService } from '../operational/ai-budget.service';
import { operationalError, requirePublicAi } from '../operational/operational.config';
import { RequestContextService } from '../common/request-context/request-context.service';
import { TelemetryService } from '../telemetry/telemetry.service';

@Injectable()
export class AiService {
  constructor(
    @Optional() private readonly requestContext: RequestContextService | undefined,
    @Optional() private readonly telemetry: TelemetryService | undefined,
    private readonly budget: AiBudgetService,
  ) {}
  estimateTokens(request: AiTextGenerationRequest): number {
    const input = countTokens(
      JSON.stringify({
        prompt: request.prompt,
        system: request.systemInstruction,
        schema: request.responseSchema,
      }),
      { disallowedSpecial: new Set() },
    );
    const output = Math.min(request.maxOutputTokens ?? 1200, 1200);
    const tokens = Math.ceil((input + 128) * 1.2) + output;
    if (tokens > 6000 || output <= 0) throw operationalError('AI_INPUT_TOO_LARGE', 400);
    return tokens;
  }
  async generateText(request: AiTextGenerationRequest): Promise<AiTextGenerationResult> {
    requirePublicAi();
    if (!process.env.GROQ_API_KEY) throw operationalError('AI_CONFIGURATION_ERROR');
    const tokens = this.estimateTokens(request);
    const providers: Array<{ provider: AiProvider; model: string }> = [
      { provider: 'groq-120b', model: 'openai/gpt-oss-120b' },
      { provider: 'groq-20b', model: 'openai/gpt-oss-20b' },
    ];
    const deadline = Date.now() + 30_000;
    for (let index = 0; ; index += 1) {
      const provider = providers[index];
      const reservation = await this.budget.reserve(request.context, provider.model, tokens);
      const startedAt = Date.now();
      let response: Response;
      let payload: {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };
      try {
        const headers = new Headers({
          'content-type': 'application/json',
          authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        });
        const traceId = this.requestContext?.getTraceId();
        if (traceId) headers.set('x-global-trace-id', traceId);
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - Date.now()))),
          body: JSON.stringify({
            model: provider.model,
            messages: [
              ...(request.systemInstruction
                ? [{ role: 'system', content: request.systemInstruction }]
                : []),
              { role: 'user', content: request.prompt },
            ],
            temperature: request.temperature ?? 0,
            reasoning_effort: 'low',
            max_completion_tokens: Math.min(request.maxOutputTokens ?? 1200, 1200),
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'job_analysis', strict: true, schema: request.responseSchema },
            },
          }),
        });
      } catch {
        await this.budget.settle(
          reservation,
          'network_or_timeout',
          undefined,
          Date.now() - startedAt,
        );
        if (index === 0 && Date.now() < deadline) {
          void this.fallback(503);
          continue;
        }
        throw operationalError('AI_UNAVAILABLE');
      }
      // Invalid successful responses are charged, but never retried.
      try {
        payload = response.ok ? ((await response.json()) as typeof payload) : {};
        if (!payload || typeof payload !== 'object') throw new Error('invalid_response');
      } catch {
        await this.budget.settle(
          reservation,
          'invalid_response',
          undefined,
          Date.now() - startedAt,
        );
        throw operationalError('AI_INVALID_RESPONSE', 502);
      }
      const content = payload.choices?.[0]?.message?.content;
      const text = typeof content === 'string' ? content.trim() : '';
      const validContent = Boolean(text) && payload.choices?.[0]?.finish_reason !== 'length';
      await this.budget.settle(
        reservation,
        response.ok ? (validContent ? 'success' : 'invalid_response') : `http_${response.status}`,
        payload.usage,
        Date.now() - startedAt,
      );
      if (response.status === 429) {
        const raw = response.headers.get('retry-after');
        const numeric = Number(raw);
        const seconds =
          raw && Number.isFinite(numeric)
            ? Math.max(1, Math.ceil(numeric))
            : raw && Number.isFinite(Date.parse(raw))
              ? Math.max(1, Math.ceil((Date.parse(raw) - Date.now()) / 1000))
              : 60;
        await this.budget.openCircuit(provider.model, Math.min(seconds, 86_400));
        throw operationalError('AI_CAPACITY_EXHAUSTED', 503, Math.min(seconds, 86_400));
      }
      if (response.status === 401 || response.status === 403)
        throw operationalError('AI_CONFIGURATION_ERROR');
      if (response.status >= 500 && index === 0 && Date.now() < deadline) {
        void this.fallback(response.status);
        continue;
      }
      if (!response.ok)
        throw operationalError(
          response.status >= 500 ? 'AI_UNAVAILABLE' : 'AI_REQUEST_REJECTED',
          response.status >= 500 ? 503 : 422,
        );
      if (!validContent) throw operationalError('AI_INVALID_RESPONSE', 502);
      return { text, provider: provider.provider, model: provider.model };
    }
  }
  private async fallback(status: number): Promise<void> {
    try {
      await this.telemetry?.captureAiFallback({
        fromProvider: 'groq-120b',
        fromModel: 'openai/gpt-oss-120b',
        toProvider: 'groq-20b',
        toModel: 'openai/gpt-oss-20b',
        status,
        traceId: this.requestContext?.getTraceId() ?? randomUUID(),
      });
    } catch {
      return;
    }
  }
}
