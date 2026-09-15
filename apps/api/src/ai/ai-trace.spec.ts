import { AiService } from './ai.service';

describe('AiService trace propagation', () => {
  const originalFetch = global.fetch;
  afterAll(() => {
    global.fetch = originalFetch;
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    jest.restoreAllMocks();
  });

  it('forwards the current global trace ID', async () => {
    process.env.GEMINI_API_KEY = 'key';
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), {
        status: 200,
      }),
    );
    global.fetch = fetchMock;
    await new AiService({ getTraceId: () => 'trace-1' } as never).generateText({ prompt: 'hello' });
    const [, requestInit] = fetchMock.mock.lastCall as unknown as [unknown, RequestInit];
    expect(new Headers(requestInit?.headers).get('x-global-trace-id')).toBe('trace-1');
  });
});
