import { Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { countTokens } from 'gpt-tokenizer/cjs/encoding/o200k_harmony';
import type { AiTextGenerationRequest, AiTextGenerationResult, AiProvider } from './ai.types';
import { AiBudgetService } from '../operational/ai-budget.service';
import { operationalError, requirePublicAi } from '../operational/operational.config';
import { RequestContextService } from '../common/request-context/request-context.service';
import { TelemetryService } from '../telemetry/telemetry.service';

type GroqPayload = {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens: number; completion_tokens: number };
};
type ProviderConfig = { provider: AiProvider; model: string };
const providers: ProviderConfig[] = [
  { provider: 'groq-120b', model: 'openai/gpt-oss-120b' },
  { provider: 'groq-20b', model: 'openai/gpt-oss-20b' },
];

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
    const deadline = Date.now() + 30_000;
    for (const [index, provider] of providers.entries()) {
      const result = await this.generateWithProvider(request, provider, tokens, deadline, index);
      if (result) return result;
    }
    throw operationalError('AI_UNAVAILABLE');
  }
  private async generateWithProvider(
    request: AiTextGenerationRequest,
    provider: ProviderConfig,
    tokens: number,
    deadline: number,
    index: number,
  ): Promise<AiTextGenerationResult | undefined> {
    const reservation = await this.budget.reserve(request.context, provider.model, tokens);
    const startedAt = Date.now();
    const response = await this.requestProvider(request, provider, deadline);
    if (!response) {
      await this.budget.settle(
        reservation,
        'network_or_timeout',
        undefined,
        Date.now() - startedAt,
      );
      if (this.canFallback(index, deadline)) {
        void this.fallback(503);
        return undefined;
      }
      throw operationalError('AI_UNAVAILABLE');
    }
    const payload = await this.parsePayload(response);
    if (!payload) {
      await this.budget.settle(reservation, 'invalid_response', undefined, Date.now() - startedAt);
      throw operationalError('AI_INVALID_RESPONSE', 502);
    }
    const text = this.contentFrom(payload);
    const validContent = Boolean(text) && payload.choices?.[0]?.finish_reason !== 'length';
    await this.budget.settle(
      reservation,
      this.outcome(response, validContent),
      payload.usage,
      Date.now() - startedAt,
    );
    if (!response.ok) return this.handleFailedResponse(response, provider, deadline, index);
    if (!validContent) throw operationalError('AI_INVALID_RESPONSE', 502);
    return { text, provider: provider.provider, model: provider.model };
  }
  private async requestProvider(
    request: AiTextGenerationRequest,
    provider: ProviderConfig,
    deadline: number,
  ): Promise<Response | undefined> {
    try {
      return await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: this.headers(),
        signal: AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - Date.now()))),
        body: JSON.stringify(this.requestBody(request, provider.model)),
      });
    } catch {
      return undefined;
    }
  }
  private headers(): Headers {
    const headers = new Headers({
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    });
    const traceId = this.requestContext?.getTraceId();
    if (traceId) headers.set('x-global-trace-id', traceId);
    return headers;
  }
  private requestBody(request: AiTextGenerationRequest, model: string) {
    return {
      model,
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
    };
  }
  private async parsePayload(response: Response): Promise<GroqPayload | undefined> {
    if (!response.ok) return {};
    try {
      const payload: unknown = await response.json();
      return payload && typeof payload === 'object' ? payload : undefined;
    } catch {
      return undefined;
    }
  }
  private contentFrom(payload: GroqPayload): string {
    const content = payload.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content.trim() : '';
  }
  private outcome(response: Response, validContent: boolean): string {
    if (!response.ok) return `http_${response.status}`;
    return validContent ? 'success' : 'invalid_response';
  }
  private async handleFailedResponse(
    response: Response,
    provider: ProviderConfig,
    deadline: number,
    index: number,
  ): Promise<undefined> {
    if (response.status === 429) {
      const seconds = this.retryAfterSeconds(response.headers.get('retry-after'));
      await this.budget.openCircuit(provider.model, seconds);
      throw operationalError('AI_CAPACITY_EXHAUSTED', 503, seconds);
    }
    if (response.status === 401 || response.status === 403)
      throw operationalError('AI_CONFIGURATION_ERROR');
    if (response.status >= 500 && this.canFallback(index, deadline)) {
      void this.fallback(response.status);
      return undefined;
    }
    throw this.errorForStatus(response.status);
  }
  private retryAfterSeconds(raw: string | null): number {
    const numeric = Number(raw);
    if (raw && Number.isFinite(numeric)) return Math.min(Math.max(1, Math.ceil(numeric)), 86_400);
    const date = raw ? Date.parse(raw) : Number.NaN;
    if (Number.isFinite(date))
      return Math.min(Math.max(1, Math.ceil((date - Date.now()) / 1000)), 86_400);
    return 60;
  }
  private canFallback(index: number, deadline: number): boolean {
    return index === 0 && Date.now() < deadline;
  }
  private errorForStatus(status: number) {
    if (status >= 500) return operationalError('AI_UNAVAILABLE', 503);
    return operationalError('AI_REQUEST_REJECTED', 422);
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
