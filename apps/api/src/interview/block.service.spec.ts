import { BlockService, buildInterviewGeneration } from './block.service';
it('reserves a visitor-owned idempotent block before extracting candidate facts', async () => {
  const ai = {
    generateText: jest.fn().mockResolvedValue({ text: '{}' }),
    estimateTokens: jest.fn(),
  };
  const quota = {
    reserveInterviewBlock: jest.fn().mockResolvedValue({}),
    finishAnalysis: jest.fn(),
  };
  const access = { verify: jest.fn().mockReturnValue({ visitorId: 'v' }) };
  const service = new BlockService(ai as never, quota as never, access as never);
  process.env.AI_PUBLIC_ENABLED = 'true';
  await expect(
    service.analyze(
      'token',
      {
        version: 1,
        sessionId: 's',
        funnelSessionId: 'f',
        revision: 0,
        inputsHash: 'h',
        objective: 'ENTER_FAST',
        jobText: '',
        targetRole: 'Loja',
        turns: [{ id: 't', topicId: 'discovery', text: 'Atendi clientes' }],
        context: { experiences: [], facts: [] },
        topics: [
          {
            id: 'discovery',
            criterionId: null,
            experienceId: null,
            missingEvidence: 'Experiência',
            reason: 'Conhecer',
            impact: 1,
            uncertainty: 3,
            relevance: 1,
          },
        ],
      },
      'net',
      'key',
    ),
  ).rejects.toHaveProperty('status', 502);
  expect(quota.reserveInterviewBlock).toHaveBeenCalledWith('v', 'net', 'key', expect.any(String));
  expect(ai.generateText).toHaveBeenCalledWith(
    expect.objectContaining({
      maxAttempts: 1,
      context: expect.objectContaining({
        principalId: 'v',
        scopeId: 's',
        operation: 'interview-extraction',
      }) as unknown,
    }),
  );
  expect(quota.finishAnalysis).toHaveBeenCalledWith({}, false);
});
import { createHash } from 'node:crypto';
import { discovery, type InterviewBlockRequest } from '@hirepair/interview-engine';
const request: InterviewBlockRequest = {
  version: 1,
  sessionId: 's',
  funnelSessionId: 'f',
  revision: 0,
  inputsHash: 'h',
  objective: 'ENTER_FAST',
  jobText: '',
  targetRole: 'Atendente',
  turns: [{ id: 't', topicId: 'discovery', text: 'Atendi clientes' }],
  context: { experiences: [], facts: [] },
  topics: [discovery],
};
it('passes a factual absence explicitly to the extraction provider without changing its provenance', () => {
  const { generation, sources } = buildInterviewGeneration(
    {
      ...request,
      turns: [{ ...request.turns[0], text: 'Não tenho essa experiência.', kind: 'absence' }],
    },
    'v',
    'key',
  );
  expect(sources[0]).toMatchObject({
    id: 't',
    answerKind: 'absence',
    text: 'Não tenho essa experiência.',
  });
  expect(generation.systemInstruction).toContain('não extraia deles fatos candidatos');
});
it('uses local synthetic references to prioritize grounded evidence from the vacancy and context', () => {
  const context = {
    ...request.context,
    facts: [
      {
        id: 'existing',
        experienceId: 'e',
        text: 'Atendimento informal na loja',
        origin: { sourceId: 'cv', sourceVersion: 'v', quote: 'Atendimento' },
      },
    ],
  };
  const { generation } = buildInterviewGeneration({ ...request, context }, 'v', 'key');
  const data = JSON.parse(generation.prompt) as {
    references: { version: string; examples: { id: string }[] };
    context: InterviewBlockRequest['context'];
  };
  expect(data.references.version).toBe('2026-11-guided-1');
  expect(data.references.examples[1].id).toBe('informal');
  expect(data.context.facts[0].id).toBe('existing');
  expect(generation.systemInstruction).toContain('nunca fatos da pessoa');
});
describe('incremental interview boundary', () => {
  const ai = { generateText: jest.fn(), estimateTokens: jest.fn() };
  const quota = { reserveInterviewBlock: jest.fn(), finishAnalysis: jest.fn() };
  const access = { verify: jest.fn() };
  const service = () => new BlockService(ai as never, quota as never, access as never);
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.AI_PUBLIC_ENABLED = 'true';
    access.verify.mockReturnValue({ visitorId: 'v' });
    quota.reserveInterviewBlock.mockResolvedValue({ owner: 'lease' });
  });
  it('returns grounded candidates, strips identifiers and finalizes a successful extraction', async () => {
    const text = 'Atendi clientes';
    const origin = {
      sourceId: 't',
      sourceVersion: createHash('sha256').update(text).digest('hex'),
      quote: text,
    };
    ai.generateText.mockResolvedValue({
      text: JSON.stringify({
        extraction: {
          experiences: [{ id: 'e', title: 'Loja', start: null, end: null, current: null, origin }],
          facts: [{ id: 'f', experienceId: 'e', text, origin }],
        },
        analysis: null,
        assessments: [
          {
            topicId: 'discovery',
            sufficient: true,
            evidence: ['atividade'],
            question: null,
            contradictionFactIds: [],
          },
        ],
      }),
    });
    const result = await service().analyze('token', request, 'network', 'key');
    expect(result.extraction.facts[0].origin).toEqual(origin);
    expect(result).not.toHaveProperty('confirmation');
    expect(quota.finishAnalysis).toHaveBeenCalledWith({ owner: 'lease' }, true);
  });
  it('validates before reservations and refuses prompt injection through the wire contract', async () => {
    for (const body of [null, { ...request, operation: 'write' }, { ...request, turns: [] }])
      await expect(service().analyze('token', body as never, 'net', 'key')).rejects.toHaveProperty(
        'status',
        400,
      );
    const huge = {
      ...request,
      turns: Array.from({ length: 3 }, (_, i) => ({
        id: `t${i}`,
        topicId: 'discovery',
        text: 'a'.repeat(9999),
      })),
    };
    await expect(service().analyze('token', huge, 'net', 'key')).rejects.toHaveProperty(
      'response.code',
      'AI_INPUT_TOO_LARGE',
    );
    expect(quota.reserveInterviewBlock).not.toHaveBeenCalled();
  });
  it('minimizes nested context, including nulls and optional values, without logging content', async () => {
    ai.generateText.mockRejectedValue(new Error('offline'));
    const origin = { sourceId: 'old', sourceVersion: 'hash', quote: 'Atendi clientes' };
    await expect(
      service().analyze(
        'token',
        {
          ...request,
          context: {
            experiences: [
              {
                id: 'e',
                title: 'Loja pessoa@example.test',
                start: null,
                end: null,
                current: false,
                origin,
              },
            ],
            facts: [],
          },
        },
        'net',
        'key',
      ),
    ).rejects.toThrow('offline');
    const generation = (ai.generateText.mock.calls[0] as unknown[])[0] as { prompt: string };
    expect(generation.prompt).not.toContain('pessoa@example.test');
    expect(quota.finishAnalysis).toHaveBeenCalledWith({ owner: 'lease' }, false);
  });
  it('does not call the provider on denied access, unavailable Redis or token overflow', async () => {
    access.verify.mockImplementationOnce(() => {
      throw new Error('denied');
    });
    await expect(service().analyze('token', request, 'net', 'key')).rejects.toThrow('denied');
    ai.estimateTokens.mockImplementationOnce(() => {
      throw new Error('tokens');
    });
    await expect(service().analyze('token', request, 'net', 'key')).rejects.toThrow('tokens');
    quota.reserveInterviewBlock.mockRejectedValueOnce(new Error('redis'));
    await expect(service().analyze('token', request, 'net', 'key')).rejects.toThrow('redis');
    expect(ai.generateText).not.toHaveBeenCalled();
  });
});
