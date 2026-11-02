import { evaluateInterview } from './evaluation';
import type { AiTextGenerationRequest } from '../ai/ai.types';
import type { InterviewBlockResult } from '@hirepair/interview-engine';
function client() {
  return {
    estimateTokens: jest.fn(() => 2000),
    generateText: jest.fn((request: AiTextGenerationRequest) => {
      const { sources, topics } = JSON.parse(request.prompt) as {
        sources: { id: string; version: string; text: string }[];
        topics: { id: string }[];
      };
      const origin = {
        sourceId: sources[0].id,
        sourceVersion: sources[0].version,
        quote: sources[0].text,
      };
      return Promise.resolve({
        provider: 'groq-120b' as const,
        model: 'synthetic',
        text: JSON.stringify({
          extraction: {
            experiences: [],
            facts: [{ id: 'new', experienceId: 'exp', text: origin.quote, origin }],
          },
          analysis: null,
          assessments: topics.map((t: { id: string }) => ({
            topicId: t.id,
            sufficient: true,
            evidence: ['atividade'],
            question: null,
            contradictionFactIds: [],
          })),
        }),
      });
    }),
  };
}
it('runs every deterministic fixture without a provider or a reservation', async () => {
  const report = await evaluateInterview({});
  expect(report).toMatchObject({
    mode: 'fixtures',
    calls: 0,
    reservedTokens: 0,
    pass: true,
  });
  expect(report.cases).toContainEqual(expect.objectContaining({ id: 'negative', pass: true }));
});
it('uses the production extraction prompt, parser and question policy with bounded live cases', async () => {
  const ai = client();
  const report = await evaluateInterview({ live: true }, ai);
  expect(report).toMatchObject({ mode: 'live', calls: 2, reservedTokens: 4000, pass: true });
  expect(ai.generateText).toHaveBeenCalledTimes(2);
  expect(ai.generateText.mock.calls[0][0]).toMatchObject({
    maxAttempts: 1,
    maxOutputTokens: 1200,
    context: { operation: 'interview-extraction', principalId: 'hirepair-guided-eval' },
  });
});
it.each([true, false])(
  'reports the optional judge result %s without pretending it is deterministic proof',
  async (pass) => {
    const ai = client();
    const implementation = ai.generateText.getMockImplementation()!;
    ai.generateText.mockImplementation(async (request) =>
      request.maxOutputTokens === 500
        ? {
            provider: 'groq-120b',
            model: 'synthetic-judge',
            text: JSON.stringify({ pass, reason: 'Synthetic judgment' }),
          }
        : implementation(request),
    );
    const report = await evaluateInterview({ live: true, judge: true, caseIds: ['informal'] }, ai);
    expect(report).toMatchObject({ calls: 2, judge: { pass }, pass });
  },
);
it('refuses invalid mode, missing provider and unbounded or unknown live cases', async () => {
  await expect(evaluateInterview({ judge: true })).rejects.toThrow('--judge requires --live');
  await expect(evaluateInterview({ live: true })).rejects.toThrow('EVAL_AI_REQUIRED');
  for (const caseIds of [[], ['missing'], ['with-resume', 'informal', 'negative']])
    await expect(evaluateInterview({ live: true, caseIds }, client())).rejects.toThrow(
      'EVAL_CASES_INVALID',
    );
});
it('reserves no more than thirty thousand tokens including the optional judge', async () => {
  const ai = client();
  ai.estimateTokens.mockReturnValue(16000);
  await expect(evaluateInterview({ live: true }, ai)).rejects.toThrow('EVAL_BUDGET_EXHAUSTED');
  expect(ai.generateText).toHaveBeenCalledTimes(1);
  const judged = client();
  judged.estimateTokens.mockReturnValue(16000);
  await expect(
    evaluateInterview({ live: true, judge: true, caseIds: ['informal'] }, judged),
  ).rejects.toThrow('EVAL_BUDGET_EXHAUSTED');
  expect(judged.generateText).toHaveBeenCalledTimes(1);
});
it('distinguishes infrastructure or invalid JSON from a quality result', async () => {
  const ai = client();
  ai.generateText.mockRejectedValueOnce(new Error('offline'));
  await expect(evaluateInterview({ live: true }, ai)).rejects.toThrow('offline');
  ai.generateText.mockResolvedValueOnce({ provider: 'groq-120b', model: 'synthetic', text: '{}' });
  await expect(evaluateInterview({ live: true }, ai)).rejects.toThrow();
});
it.each(['long', 'missing', 'no-question-mark'])(
  'fails quality assertions for %s next questions',
  async (variant) => {
    const ai = client();
    const implementation = ai.generateText.getMockImplementation()!;
    ai.generateText.mockImplementation(async (request) => {
      const output = await implementation(request),
        data = JSON.parse(output.text) as Pick<
          InterviewBlockResult,
          'extraction' | 'analysis' | 'assessments'
        >;
      data.assessments[0] = {
        ...data.assessments[0],
        sufficient: variant === 'missing',
        evidence:
          variant === 'missing'
            ? [
                'atividade',
                'contexto',
                'período',
                'responsabilidade',
                'ferramenta',
                'frequência',
                'dificuldade',
                'resultado',
              ]
            : [],
        question:
          variant === 'missing'
            ? null
            : variant === 'long'
              ? 'Qual atividade ' + 'a'.repeat(200) + '?'
              : 'Conte uma situação concreta',
      };
      return { ...output, text: JSON.stringify(data) };
    });
    expect(await evaluateInterview({ live: true, caseIds: ['informal'] }, ai)).toMatchObject({
      pass: false,
    });
  },
);
