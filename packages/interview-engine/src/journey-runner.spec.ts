import { runJourney, type JourneyAdapter } from './journey-runner';
import { createSession } from './engine';
import { startWithoutDocuments, type InterviewBlockResult } from './interview';
import type { InterviewBlockRequest } from './block';
import { guidedQuestion } from './guided';
const initial = () => {
  const s = createSession('synthetic', 'synthetic', {
    resumes: '',
    job: '',
    objective: '',
    facts: '',
  });
  s.objective = { value: 'ENTER_FAST', provisional: false };
  return startWithoutDocuments(s);
};
const adapter = (): JourneyAdapter => ({
  answer: jest.fn().mockResolvedValue({ kind: 'declined', text: 'Quero parar' }),
  block: jest.fn(),
  write: jest.fn(),
});
it('honors stop without inventing a usable completion or calling writing', async () => {
  const a = adapter();
  const trace = await runJourney(initial(), 'Atendente', '', a);
  expect(trace.turns).toHaveLength(1);
  expect(trace.session.guided?.status).toBe('partial');
  expect(a.block).not.toHaveBeenCalled();
  expect(a.write).not.toHaveBeenCalled();
});
it('preserves a saved answer on provider failure', async () => {
  const a = adapter();
  a.answer = jest
    .fn()
    .mockResolvedValue({ kind: 'specific', text: 'Atualmente atendo na feira desde 2024.' });
  a.block = jest.fn().mockRejectedValue(new Error('quota'));
  const trace = await runJourney(initial(), 'Atendente', 'Atender', a);
  expect(trace.failure).toBe('provider-or-budget');
  expect(trace.session.turns[0].answer.text).toContain('feira');
  expect(trace.document).toBeNull();
});
it('reports failure of the simulated candidate without claiming completion', async () => {
  const a = adapter();
  a.answer = jest.fn().mockRejectedValue(new Error('quota'));
  expect((await runJourney(initial(), 'Atendente', '', a)).failure).toBe('provider-or-budget');
});
it('does not ask more than twelve answers for vague material', async () => {
  const a = adapter();
  a.answer = jest.fn().mockResolvedValue({ kind: 'unknown', text: 'Não sei' });
  const trace = await runJourney(initial(), 'Atendente', '', a);
  expect(trace.turns.length).toBeLessThanOrEqual(12);
  expect(trace.document).toBeNull();
});
it('uses actual block results and selection before writing, discarding raw answers on completion', async () => {
  const a = adapter();
  a.answer = jest
    .fn()
    .mockResolvedValue({ kind: 'specific', text: 'Atualmente atendo na feira desde 2024.' });
  a.block = jest.fn(async (request: InterviewBlockRequest): Promise<InterviewBlockResult> => {
    const t = request.turns[0];
    const origin = { sourceId: t.id, sourceVersion: 'v1', quote: t.text };
    return {
      version: 1,
      revision: request.revision,
      extraction: {
        experiences: request.context.experiences.length
          ? []
          : [{ id: 'e', title: 'Feira', start: '2024', end: null, current: true, origin }],
        facts: [{ id: `f-${t.id}`, experienceId: 'e', text: t.text, origin }],
      },
      analysis: null,
      assessments: request.topics.map((topic) => ({
        topicId: topic.id,
        sufficient: true,
        evidence: ['period', 'responsibility', 'context', 'tools', 'frequency', 'action', 'result'],
        question: null,
        contradictionFactIds: [],
      })),
    };
  });
  a.write = jest.fn().mockResolvedValue({ version: 1, explanation: 'sintético', sections: [] });
  const ready = initial();
  ready.facts = [
    {
      id: 'old',
      experienceId: 'e',
      text: 'Fato antigo',
      origin: { sourceId: 's', sourceVersion: 'v1', quote: 'Fato antigo' },
      storyId: null,
      revision: 1,
      usable: true,
      confirmation: 'candidate',
      externallyVerified: false,
    },
    {
      id: 'rejected',
      experienceId: 'e',
      text: 'Rejeitado',
      origin: { sourceId: 's', sourceVersion: 'v1', quote: 'Rejeitado' },
      storyId: null,
      revision: 1,
      usable: false,
      confirmation: 'rejected',
      externallyVerified: false,
    },
  ];
  const trace = await runJourney(ready, 'Atendente', '', a);
  expect(trace.failure).toBeNull();
  expect(trace.session.guided?.status).toBe('complete');
  expect(trace.session.turns.every((t) => t.answer.text === '')).toBe(true);
  expect(guidedQuestion(trace.session)).toBeNull();
  expect(a.write).toHaveBeenCalledTimes(1);
  a.write = jest.fn().mockRejectedValue(new Error('writing failed'));
  expect((await runJourney(initial(), 'Atendente', '', a)).failure).toBe('provider-or-budget');
});
