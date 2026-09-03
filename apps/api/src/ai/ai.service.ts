import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiProvider, AiTextGenerationRequest, AiTextGenerationResult } from './ai.types';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 15_000;

interface AiProviderDefinition {
  provider: AiProvider;
  model: string;
  apiKey?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

interface GroqResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

class AiProviderError extends Error {
  constructor(
    readonly provider: AiProvider,
    readonly model: string,
    readonly status?: number,
  ) {
    super(`Falha no provedor ${provider} (${model})${status ? `: HTTP ${status}` : '.'}`);
  }
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  /**
   * Gera texto sem expor a troca de provedores a quem controla a conversa.
   * Apenas indisponibilidade temporaria (429/503) avanca pela cadeia; os demais
   * erros continuam visiveis para nao mascarar credencial ou requisicao invalida.
   */
  async generateText(request: AiTextGenerationRequest): Promise<AiTextGenerationResult> {
    const providers = this.providers();
    if (providers.length === 0) {
      throw new ServiceUnavailableException('Nenhum provedor de IA foi configurado.');
    }

    let lastError: AiProviderError | undefined;

    for (const provider of providers) {
      try {
        const text = await this.generateWithProvider(provider, request);
        return { text, provider: provider.provider, model: provider.model };
      } catch (error) {
        if (!(error instanceof AiProviderError)) {
          throw error;
        }

        if (!this.shouldFallback(error)) {
          throw new BadGatewayException(`Falha no provedor de IA (${error.provider}).`);
        }

        if (provider === providers.at(-1)) {
          throw this.toServiceUnavailable(error);
        }

        lastError = error;
        this.logger.warn(
          `IA temporariamente indisponivel em ${provider.provider} (${provider.model}, HTTP ${error.status}); alternando provedor.`,
        );
      }
    }

    throw this.toServiceUnavailable(lastError);
  }

  private providers(): AiProviderDefinition[] {
    return [
      {
        provider: 'gemini',
        model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
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
    ].filter((provider): provider is AiProviderDefinition & { apiKey: string } =>
      Boolean(provider.apiKey),
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
          generationConfig: this.generationConfig(request),
        }),
      },
      provider,
    );
    const payload = (await response.json()) as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new AiProviderError(provider.provider, provider.model, response.status);
    }

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

    if (!text) {
      throw new AiProviderError(provider.provider, provider.model, response.status);
    }

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
      const response = await fetch(url, { ...init, method: 'POST', signal: controller.signal });
      if (!response.ok) {
        throw new AiProviderError(provider.provider, provider.model, response.status);
      }
      return response;
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      // Timeouts e falhas de rede sao indisponibilidade temporaria do provedor.
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

  private shouldFallback(error: AiProviderError): boolean {
    return error.status === 429 || error.status === 503;
  }

  private toServiceUnavailable(error?: AiProviderError): ServiceUnavailableException {
    const provider = error ? ` (${error.provider})` : '';
    return new ServiceUnavailableException(`Os provedores de IA estao indisponiveis${provider}.`);
  }
}
