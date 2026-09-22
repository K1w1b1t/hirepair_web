import {
  BadGatewayException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AiService } from './ai.service';
import type { AiFallbackTelemetry } from '../telemetry/telemetry.service';

const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();
const originalFetch = global.fetch;
const captureAiFallback: jest.MockedFunction<(payload: AiFallbackTelemetry) => Promise<void>> = jest
  .fn()
  .mockResolvedValue(undefined);

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function jsonBody(init?: RequestInit): unknown {
  if (typeof init?.body !== 'string') {
    throw new Error('A chamada de IA deveria conter um corpo JSON.');
  }

  return JSON.parse(init.body) as unknown;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  return input instanceof URL ? input.href : input.url;
}

describe('AiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.GROQ_API_KEY = 'groq-key';
    delete process.env.GEMINI_MODEL;
    delete process.env.GROQ_70B_MODEL;
    delete process.env.GROQ_8B_MODEL;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it.each([429, 503])(
    'troca Gemini HTTP %i por Groq 70B sem alterar o contexto',
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(response(status, { error: { message: 'temporario' } }))
        .mockResolvedValueOnce(
          response(200, { choices: [{ message: { content: 'Resposta pronta' } }] }),
        );
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      const result = await new AiService(undefined, { captureAiFallback } as never).generateText({
        systemInstruction: 'Seja objetivo.',
        prompt: 'Descreva minha experiencia.',
        temperature: 0.2,
        maxOutputTokens: 120,
      });

      expect(result).toEqual({
        text: 'Resposta pronta',
        provider: 'groq-70b',
        model: 'llama-3.3-70b-versatile',
      });
      expect(requestUrl(fetchMock.mock.calls[0][0])).toContain('gemini-2.5-flash:generateContent');
      expect(requestUrl(fetchMock.mock.calls[1][0])).toBe(
        'https://api.groq.com/openai/v1/chat/completions',
      );
      expect(jsonBody(fetchMock.mock.calls[1][1])).toEqual(
        expect.objectContaining({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'Seja objetivo.' },
            { role: 'user', content: 'Descreva minha experiencia.' },
          ],
        }),
      );
      expect(warn).toHaveBeenCalledTimes(1);
      expect(captureAiFallback).toHaveBeenCalledTimes(1);
      const [telemetryPayload] = captureAiFallback.mock.calls[0];
      expect(telemetryPayload).toEqual({
        fromProvider: 'gemini',
        fromModel: 'gemini-2.5-flash',
        toProvider: 'groq-70b',
        toModel: 'llama-3.3-70b-versatile',
        status,
        traceId: telemetryPayload.traceId,
      });
      expect(telemetryPayload.traceId).toMatch(/^[0-9a-f-]{36}/);
    },
  );

  it('usa Groq 8B se Groq 70B tambem estiver temporariamente indisponivel', async () => {
    fetchMock
      .mockResolvedValueOnce(response(503, {}))
      .mockResolvedValueOnce(response(429, {}))
      .mockResolvedValueOnce(response(200, { choices: [{ message: { content: 'Plano B' } }] }));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(new AiService().generateText({ prompt: 'Continue a sessao.' })).resolves.toEqual({
      text: 'Plano B',
      provider: 'groq-8b',
      model: 'llama-3.1-8b-instant',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(jsonBody(fetchMock.mock.calls[2][1])).toEqual(
      expect.objectContaining({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Continue a sessao.' }],
      }),
    );
  });

  it('nao mascara erros que nao sao 429 ou 503', async () => {
    fetchMock.mockResolvedValue(response(401, {}));

    await expect(new AiService().generateText({ prompt: 'Teste.' })).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pede JSON nativo ao Gemini para respostas estruturadas', async () => {
    fetchMock.mockResolvedValue(
      response(200, { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
    );

    await new AiService().generateText({ prompt: 'Responda com dados estruturados.' });

    const body = jsonBody(fetchMock.mock.calls[0][1]) as {
      generationConfig?: { responseMimeType?: string };
    };
    expect(body.generationConfig?.responseMimeType).toBe('application/json');
  });

  it('repete uma falha transitória do único provedor antes de ficar indisponível', async () => {
    delete process.env.GROQ_API_KEY;
    fetchMock
      .mockResolvedValueOnce(response(503, { error: { message: 'temporario' } }))
      .mockResolvedValueOnce(
        response(200, {
          candidates: [{ content: { parts: [{ text: '{"targetKind":"same_track"}' }] } }],
        }),
      );

    await expect(new AiService().generateText({ prompt: 'Teste.' })).resolves.toMatchObject({
      provider: 'gemini',
      text: '{"targetKind":"same_track"}',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('informa quando o único provedor atingiu o limite de uso', async () => {
    delete process.env.GROQ_API_KEY;
    fetchMock.mockResolvedValue(response(429, { error: { message: 'limite atingido' } }));

    await expect(new AiService().generateText({ prompt: 'Teste.' })).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('informa indisponibilidade quando nenhuma chave foi configurada', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;

    await expect(new AiService().generateText({ prompt: 'Teste.' })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
