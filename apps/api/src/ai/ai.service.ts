import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AiProvider, AiTextGenerationRequest, AiTextGenerationResult } from './ai.types';
import { GLOBAL_TRACE_ID_HEADER } from '../common/request-context/request-context.constants';
import { RequestContextService } from '../common/request-context/request-context.service';
import { TelemetryService } from '../telemetry/telemetry.service';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const MAX_ATTEMPTS_PER_PROVIDER = 2;
const MAX_RETRY_DELAY_MS = 8_000;

interface AiProviderDefinition {
  provider: AiProvider;
  model: string;
  apiKey?: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

class AiProviderError extends Error {
  constructor(
    readonly provider: AiProvider,
    readonly model: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(`Falha no provedor ${provider} (${model})${status ? `: HTTP ${status}` : '.'}`);
  }
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Optional() private readonly requestContext?: RequestContextService,
    @Optional() private readonly telemetry?: TelemetryService,
  ) {}

  async generateText(request: AiTextGenerationRequest): Promise<AiTextGenerationResult> {
    const providers = this.providers();
    if (providers.length === 0) {
      throw new ServiceUnavailableException('Nenhum provedor de IA foi configurado.');
    }

    const errors: AiProviderError[] = [];
    for (const [index, provider] of providers.entries()) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt += 1) {
        try {
          const text = await this.generateWithProvider(provider, request);
          return { text, provider: provider.provider, model: provider.model };
        } catch (error) {
          if (!(error instanceof AiProviderError)) throw error;
          errors.push(error);
          if (!this.shouldRetry(error)) {
            this.logger.warn(
              `IA recusou a requisição em ${error.provider} (${error.model}, HTTP ${error.status ?? 'rede'}).`,
            );
            if (error.status === 400 || error.status === 401 || error.status === 403) {
              throw new HttpException(
                {
                  statusCode: HttpStatus.SERVICE_UNAVAILABLE,
                  code: 'AI_CONFIGURATION_ERROR',
                  message: 'O provedor de IA está com uma configuração inválida.',
                },
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }
            throw new BadGatewayException(`Falha no provedor de IA (${error.provider}).`);
          }
          if (attempt < MAX_ATTEMPTS_PER_PROVIDER) await this.waitBeforeRetry(error, attempt);
        }
      }

      const nextProvider = providers[index + 1];
      if (nextProvider) {
        const error = errors.at(-1)!;
        await this.telemetry?.captureAiFallback({
          fromProvider: provider.provider,
          fromModel: provider.model,
          toProvider: nextProvider.provider,
          toModel: nextProvider.model,
          status: error.status ?? 503,
          traceId: this.requestContext?.getTraceId() ?? randomUUID(),
        });
        this.logger.warn(
          `IA temporariamente indisponivel em ${error.provider} (${error.model}, HTTP ${error.status ?? 'rede'}); alternando provedor.`,
        );
      }
    }

    if (errors.length > 0 && errors.every((error) => error.status === 429)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          code: 'AI_CAPACITY_EXHAUSTED',
          message: 'A capacidade gratuita da IA foi atingida. Tente novamente mais tarde.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    throw this.toServiceUnavailable(errors.at(-1));
  }

  private providers(): AiProviderDefinition[] {
    return [
      {
        provider: 'gemini',
        model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
        apiKey: process.env.GEMINI_API_KEY,
      },
      {
        provider: 'gemini',
        model: process.env.GEMINI_FALLBACK_MODEL ?? DEFAULT_GEMINI_FALLBACK_MODEL,
        apiKey: process.env.GEMINI_API_KEY,
      },
      {
        provider: 'groq-70b',
        model: process.env.GROQ_70B_MODEL ?? 'llama-3.3-70b-versatile',
        apiKey: process.env.GROQ_API_KEY,
      },
      {
        provider: 'groq-8b',
        model: process.env.GROQ_8B_MODEL ?? 'llama-3.1-8b-instant',
        apiKey: process.env.GROQ_API_KEY,
      },
    ].filter(
      (provider, index, all): provider is AiProviderDefinition & { apiKey: string } =>
        Boolean(provider.apiKey) &&
        all.findIndex((item) => item.model === provider.model) === index,
    );
  }

  private async generateWithProvider(
    provider: AiProviderDefinition,
    request: AiTextGenerationRequest,
  ): Promise<string> {
    return provider.provider === 'gemini'
      ? this.generateWithGemini(provider, request)
      : this.generateWithGroq(provider, request);
  }

  private async generateWithGemini(
    provider: AiProviderDefinition,
    request: AiTextGenerationRequest,
  ): Promise<string> {
    const response = await this.request(
      `${GEMINI_ENDPOINT}/${encodeURIComponent(provider.model)}:generateContent`,
      {
        headers: { 'content-type': 'application/json', 'x-goog-api-key': provider.apiKey ?? '' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          ...(request.systemInstruction
            ? { systemInstruction: { parts: [{ text: request.systemInstruction }] } }
            : {}),
          generationConfig: {
            ...this.generationConfig(request),
            responseMimeType: 'application/json',
          },
        }),
      },
      provider,
    );
    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!text) throw new AiProviderError(provider.provider, provider.model, response.status);
    return text;
  }

  private async generateWithGroq(
    provider: AiProviderDefinition,
    request: AiTextGenerationRequest,
  ): Promise<string> {
    const response = await this.request(
      GROQ_ENDPOINT,
      {
        headers: {
          authorization: `Bearer ${provider.apiKey ?? ''}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            ...(request.systemInstruction
              ? [{ role: 'system', content: request.systemInstruction }]
              : []),
            { role: 'user', content: request.prompt },
          ],
          ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
          ...(request.maxOutputTokens === undefined
            ? {}
            : { max_completion_tokens: request.maxOutputTokens }),
        }),
      },
      provider,
    );
    const payload = (await response.json()) as GroqResponse;
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AiProviderError(provider.provider, provider.model, response.status);
    return text;
  }

  private async request(
    url: string,
    init: RequestInit,
    provider: AiProviderDefinition,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(controller.abort.bind(controller), this.timeoutMs());
    try {
      const headers = new Headers(init.headers);
      const traceId = this.requestContext?.getTraceId();
      if (traceId) headers.set(GLOBAL_TRACE_ID_HEADER, traceId);
      const response = await fetch(url, {
        ...init,
        headers,
        method: 'POST',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AiProviderError(
          provider.provider,
          provider.model,
          response.status,
          this.retryAfterMs(response.headers.get('retry-after')),
        );
      }
      return response;
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError(provider.provider, provider.model, 503);
    } finally {
      clearTimeout(timeout);
    }
  }

  private generationConfig(request: AiTextGenerationRequest): Record<string, number> {
    return {
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.maxOutputTokens === undefined
        ? {}
        : { maxOutputTokens: request.maxOutputTokens }),
    };
  }

  private timeoutMs(): number {
    return Number(process.env.AI_REQUEST_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  }

  private shouldRetry(error: AiProviderError): boolean {
    return error.status === 408 || error.status === 429 || (error.status ?? 0) >= 500;
  }

  private async waitBeforeRetry(error: AiProviderError, attempt: number): Promise<void> {
    const configuredBase = Number(process.env.AI_RETRY_BASE_MS);
    const base = Number.isFinite(configuredBase) ? configuredBase : 1_000;
    const exponential = Math.min(MAX_RETRY_DELAY_MS, base * 2 ** (attempt - 1));
    const delay = Math.min(MAX_RETRY_DELAY_MS, error.retryAfterMs ?? exponential);
    const jitter = Math.floor(Math.random() * 250);
    await new Promise<void>((resolve) => setTimeout(resolve, delay + jitter));
  }

  private retryAfterMs(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
  }

  private toServiceUnavailable(error?: AiProviderError): ServiceUnavailableException {
    const provider = error ? ` (${error.provider})` : '';
    return new ServiceUnavailableException({
      code: 'AI_TEMPORARILY_UNAVAILABLE',
      message: `Os provedores de IA estao indisponiveis${provider}.`,
    });
  }
}
