import { serialize, deserialize } from 'node:v8';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (v: unknown) => deserialize(serialize(v)),
});
import {
  createSession,
  startGuided,
  validInterviewRequest,
  interviewState,
  type InterviewBlockResult,
  type Session,
} from '@hirepair/interview-engine';
import {
  planInterviewBlock,
  pendingInterviewTurns,
  applyInterviewBlockPlan,
  type BlockPlan,
} from './interview-blocks';
const draft = {
  hasJob: true,
  jobText: 'Atendimento ao público',
  targetRole: 'Atendente',
  accepted: true,
};
function session(count = 1, text = 'Eu conferia os pedidos.'): Session {
  const s = startGuided(
    createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' }),
  );
  s.objective = { value: 'ENTER_FAST', provisional: false };
  s.experiences = [
    {
      id: 'e',
      title: 'Loja',
      start: '2020',
      end: null,
      current: true,
      origin: { sourceId: 'cv', sourceVersion: 'v', quote: 'Loja' },
    },
  ];
  s.turns = Array.from({ length: count }, (_, i) => ({
    id: `t${i}`,
    question: { text: 'Na Loja, o que ficava por sua conta?', topicId: `guided:e:question${i}` },
    answer: { kind: 'specific' as const, text },
    factIds: [],
    decision: {
      kind: 'ask',
      criterionId: 'c',
      experienceId: 'e',
      reason: 'Esclarecer participação',
    },
  }));
  return s;
}
function result(s: Session, plan: BlockPlan, sufficient = true): InterviewBlockResult {
  return {
    version: 1,
    revision: s.revision,
    extraction: { experiences: [], facts: [] },
    analysis: null,
    assessments: plan.request!.topics.map((t) => ({
      topicId: t.id,
      sufficient,
      evidence: [],
      question: sufficient ? null : 'Qual foi sua participação?',
      contradictionFactIds: [],
    })),
  };
}
it('waits without an AI request when there is no pending evidence', () => {
  const s = session(0);
  s.objective = null;
  expect(planInterviewBlock(s, draft, 'hash')).toMatchObject({
    request: null,
    pendingCount: 0,
    blocked: false,
    deferred: false,
  });
});
it('includes a factual absence with its question and the disputed facts, but skips absence of history', () => {
  const s = session(2);
  s.turns.forEach((t) => (t.answer.kind = 'absence'));
  s.turns[1].question.topicId = 'guided:first';
  s.pending = [
    {
      id: 'negative:t0',
      topicId: s.turns[0].question.topicId,
      criterionId: 'c',
      factIds: ['f'],
      blocking: true,
      reason: 'Negativa',
    },
  ];
  s.facts = [
    {
      id: 'f',
      experienceId: 'e',
      storyId: null,
      text: 'Usei Excel',
      origin: { sourceId: 'cv', sourceVersion: 'v', quote: 'Loja' },
      usable: false,
      confirmation: 'candidate',
      externallyVerified: false,
      revision: 1,
    },
  ];
  const plan = planInterviewBlock(s, draft, 'hash');
  expect(plan.request!.turns).toEqual([expect.objectContaining({ id: 't0', kind: 'absence' })]);
  expect(plan.request!.context.facts).toHaveLength(1);
  expect(plan.request!.topics[0]).toMatchObject({
    criterionId: 'c',
    experienceId: 'e',
    missingEvidence: s.turns[0].question.text,
  });
});
it('counts job, context, escaped answers and topic metadata in the complete JSON limit', () => {
  const s = session(3, 'Conferi pedidos. ' + 'a'.repeat(6980));
  const job = { ...draft, jobText: 'Requisitos '.repeat(150) };
  const plan = planInterviewBlock(s, job, 'h'.repeat(64));
  expect(plan.chunks.map((c) => c.id)).toEqual(['t0', 't1']);
  expect(JSON.stringify(plan.request).length).toBeLessThanOrEqual(20000);
  expect(plan).toMatchObject({ pendingCount: 3, deferred: true, blocked: false });
  expect(validInterviewRequest(plan.request)).toBe(true);
  const next = applyInterviewBlockPlan(s, result(s, plan), plan, 'hash1');
  expect(pendingInterviewTurns(next).map((t) => t.id)).toEqual(['t2']);
  expect(next.turns[2].answer.text).toBe(s.turns[2].answer.text);
});
it('preserves the three-turn batch limit and does not duplicate a topic or send rejected facts', () => {
  const s = session(4);
  s.turns[1].question.topicId = s.turns[0].question.topicId;
  delete s.turns[0].decision;
  s.facts = [
    {
      id: 'removed',
      experienceId: 'e',
      storyId: null,
      text: 'Removed',
      origin: s.experiences[0].origin,
      usable: false,
      confirmation: 'rejected',
      externallyVerified: false,
      revision: 1,
    },
  ];
  const plan = planInterviewBlock(s, { ...draft, hasJob: false }, 'h');
  expect(plan.request!.turns).toHaveLength(3);
  expect(plan.request!.topics).toHaveLength(2);
  expect(plan.request!.topics[0]).toMatchObject({ criterionId: null, experienceId: null });
  expect(plan.request!.jobText).toBe('');
  expect(plan.request!.context.facts).toEqual([]);
  expect(plan.deferred).toBe(true);
});
it('splits one answer without breaking Unicode, preserves origins and resumes every remaining character', () => {
  let s = session(1, '😀"\n'.repeat(1500));
  const original = s.turns[0].answer.text;
  let joined = '',
    blocks = 0;
  while (pendingInterviewTurns(s).length) {
    const plan = planInterviewBlock(s, draft, 'hash', 2000);
    expect(plan.blocked).toBe(false);
    expect(JSON.stringify(plan.request).length).toBeLessThanOrEqual(2000);
    const text = plan.request!.turns[0].text;
    expect(Array.from(text).every((p) => p !== '\ud83d' && p !== '\ude00')).toBe(true);
    joined += text;
    blocks++;
    const response = result(s, plan, false);
    if (blocks === 1)
      response.extraction.facts = [
        {
          id: 'f',
          experienceId: 'e',
          text: 'Relato declarado',
          origin: { sourceId: 't0', sourceVersion: 'chunk-version', quote: text.slice(0, 4) },
        },
      ];
    s = applyInterviewBlockPlan(s, response, plan, `hash${blocks}`);
    expect(s.turns[0].answer.text).toBe(original);
    if (!plan.chunks[0].complete) {
      expect(interviewState(s).analyzedTurnIds).not.toContain('t0');
      expect(s.guided!.clarification).toBeNull();
      expect(interviewState(s).topics[plan.request!.topics[0].id]).toBeUndefined();
    }
  }
  expect(joined).toBe(original);
  expect(blocks).toBeGreaterThan(1);
  expect(interviewState(s).analyzedCharacters).toEqual({});
  expect(s.facts[0].origin).toMatchObject({ sourceId: 't0', sourceVersion: 'chunk-version' });
});
it('blocks an envelope that cannot fit even one character and leaves all history intact', () => {
  const s = session(),
    original = structuredClone(s);
  expect(planInterviewBlock(s, draft, 'hash', 1)).toMatchObject({
    blocked: true,
    request: null,
    pendingCount: 1,
  });
  expect(s).toEqual(original);
});
