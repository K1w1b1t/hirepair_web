import { createSession, replan, transition, changeInput, applyCommand } from './engine';
import type { Session } from './contracts';
const inputs = { resumes: 'r', job: 'j', objective: 'o', facts: 'f' };
function base(): Session {
  return createSession('s', 'funnel', inputs);
}
it('requires declared objective before interview', () => {
  expect(() => transition(base(), 'interview')).toThrow('OBJECTIVE_REQUIRED');
});
it('starts with no confirmed facts or accidental progress', () => {
  expect(base().phase).toBe('preparation');
  expect(base().facts).toEqual([]);
});
it('preserves confirmed facts when a job changes', () => {
  const s = base();
  s.objective = { value: 'ENTER_FAST', provisional: true };
  s.plan = replan(s);
  const updated = changeInput(s, 'job', 'new');
  expect(updated.facts).toEqual(s.facts);
  expect(updated.plan?.valid).toBe(false);
  expect(updated.phase).toBe('preparation');
});
it('deduplicates commands and rejects changed retries and stale revisions', () => {
  const first = applyCommand(base(), 'c', 'h', 0, (s) => ({
    ...s,
    objective: { value: 'ENTER_FAST', provisional: false },
  }));
  expect(
    applyCommand(first, 'c', 'h', 0, () => {
      throw new Error('duplicate');
    }),
  ).toBe(first);
  expect(() => applyCommand(first, 'c', 'other', 1, (s) => s)).toThrow('IDEMPOTENCY_CONFLICT');
  expect(() => applyCommand(first, 'd', 'h', 0, (s) => s)).toThrow('REVISION_CONFLICT');
});
import {
  prepare,
  canWrite,
  confirm,
  equalInputs,
  evidenceStatus,
  interrupt,
  resume,
  validateContent,
} from './index';
import { analysis, extraction, cases } from './fixtures';
import type { EvidenceLink, GroundedContent } from './contracts';
function prepared() {
  const s = base();
  s.objective = { value: 'ENTER_FAST', provisional: true };
  return prepare(s, structuredClone(extraction), structuredClone(analysis));
}
function confirmed() {
  const s = prepared();
  s.facts[0].confirmation = 'confirmed';
  s.phase = 'confirmation';
  return confirm(s, ['f']);
}
it.each(cases)(
  'exercises the $name synthetic case with candidate and vague evidence',
  ({ name, provenance, extraction: candidate, analysis: target, source: material, answer }) => {
    expect(provenance).toBe('synthetic');
    const initial = base();
    initial.objective = { value: 'ENTER_FAST', provisional: true };
    initial.sources = [material];
    const s = prepare(initial, candidate, target);
    expect(s.facts[0].text).toBe(material.text);
    s.turns.push({
      id: name,
      question: { text: 'Conte um exemplo', topicId: 'c' },
      answer: { text: answer, kind: 'vague' },
      factIds: [],
    });
    expect(replan(s).topics).toHaveLength(1);
    expect(canWrite(s)).toBe(false);
  },
);
it('guards all transitions and explicit interruption reasons', () => {
  const s = prepared();
  expect(() => transition(s, 'writing')).toThrow('INVALID_TRANSITION');
  expect(transition(s, 'confirmation').phase).toBe('confirmation');
  expect(transition(confirmed(), 'ready').phase).toBe('ready');
  expect(transition({ ...confirmed(), phase: 'ready' }, 'writing').phase).toBe('writing');
  expect(transition(confirmed(), 'interview').phase).toBe('interview');
  expect(() => transition({ ...s, phase: 'ready' }, 'writing')).toThrow('EVIDENCE_REQUIRED');
  expect(() => transition({ ...s, phase: 'confirmation' }, 'ready')).toThrow('EVIDENCE_REQUIRED');
  for (const kind of ['paused', 'budget_exhausted', 'partial'] as const) {
    const stopped = interrupt(s, kind, 'Limite explícito');
    expect(canWrite(stopped)).toBe(false);
    expect(() => transition(stopped, 'confirmation')).toThrow();
    expect(resume(stopped).interruption).toBeNull();
  }
  expect(() => interrupt(s, 'paused', ' ')).toThrow('REASON_REQUIRED');
});
it('distinguishes confirmation, external verification, silence and declared absence', () => {
  const s = prepared();
  const link = s.links[0];
  expect(evidenceStatus(link, s.facts)).toBe('candidate');
  s.facts[0].confirmation = 'confirmed';
  expect(evidenceStatus(link, s.facts)).toBe('confirmed');
  expect(s.facts[0].externallyVerified).toBe(false);
  s.facts[0].confirmation = 'rejected';
  expect(evidenceStatus(link, s.facts)).toBe('unknown');
  expect(evidenceStatus({ ...link, factIds: [] }, s.facts)).toBe('unknown');
  expect(() => evidenceStatus({ ...link, factIds: ['missing'] }, s.facts)).toThrow(
    'INVALID_REFERENCE',
  );
  expect(() => evidenceStatus({ ...link, experienceId: 'wrong' }, s.facts)).toThrow(
    'INVALID_REFERENCE',
  );
  for (const status of ['contradiction', 'declared_absence'] as const) {
    expect(() => evidenceStatus({ ...link, status }, s.facts)).toThrow('DECLARATION_REQUIRED');
    expect(evidenceStatus({ ...link, status, declarationTurnId: 't' }, s.facts)).toBe(status);
  }
});
it('replans all evidence states without keyword scores', () => {
  const s = prepared();
  s.criteria = Array.from({ length: 8 }, (_, i) => ({
    ...analysis.criteria[0],
    id: `c${i}`,
    category: i === 0 ? 'ELIMINATORY' : i < 5 ? 'NEGOTIABLE' : 'DECORATIVE',
    relevance: i % 4,
  }));
  s.links = s.criteria.slice(0, 7).map((c, i): EvidenceLink => ({
    ...analysis.links[0],
    id: `l${i}`,
    criterionId: c.id,
    experienceId: i === 2 ? null : 'e',
    factIds: i === 2 ? [] : ['f'],
    status: i === 0 ? 'contradiction' : i === 1 ? 'declared_absence' : 'candidate',
    declarationTurnId: i < 2 ? 't' : null,
  }));
  const plan = replan(s);
  expect(plan.topics[0].criterionId).toBe('c0');
  expect(plan.topics.some((t) => t.criterionId === 'c1')).toBe(false);
  s.facts[0].confirmation = 'confirmed';
  expect(replan(s).topics.some((t) => t.criterionId === 'c3')).toBe(false);
  s.plan = plan;
  expect(replan(s).version).toBe(plan.version + 1);
  s.links = [];
  expect(replan(s).topics[0].impact).toBe(3);
  s.criteria = [
    { ...analysis.criteria[0], id: 'a' },
    { ...analysis.criteria[0], id: 'b' },
  ];
  expect(replan(s).topics.map((t) => t.criterionId)).toEqual(['a', 'b']);
});
it('invalidates only declared dependencies and preserves independent content', () => {
  const s = confirmed();
  s.plan = replan(s);
  s.content = { ...s.plan, dependencies: ['job'], sections: [] };
  expect(changeInput(s, 'facts', 'new').content?.valid).toBe(true);
  expect(changeInput(s, 'facts', 'new').confirmation?.valid).toBe(false);
  expect(changeInput(s, 'facts', 'new').phase).toBe('interview');
  expect(changeInput(s, 'facts', s.inputs.facts)).toBe(s);
  s.content.valid = false;
  expect(changeInput(s, 'resumes', 'new').content?.valid).toBe(false);
  expect(changeInput(base(), 'objective', 'new').confirmation).toBeNull();
});
it('requires current, confirmed, usable and noncontradictory evidence', () => {
  expect(canWrite(base())).toBe(false);
  expect(canWrite(prepared())).toBe(false);
  expect(canWrite(confirmed())).toBe(true);
  const s = confirmed();
  s.confirmation!.valid = false;
  expect(canWrite(s)).toBe(false);
  s.confirmation!.valid = true;
  s.confirmation!.inputs.job = 'stale';
  expect(canWrite(s)).toBe(false);
  s.confirmation!.inputs = { ...s.inputs };
  s.confirmation!.factIds = [];
  expect(canWrite(s)).toBe(false);
  s.confirmation!.factIds = ['missing'];
  expect(canWrite(s)).toBe(false);
  s.confirmation!.factIds = ['f'];
  s.facts[0].confirmation = 'candidate';
  expect(canWrite(s)).toBe(false);
  s.facts[0].confirmation = 'confirmed';
  s.facts[0].usable = false;
  expect(canWrite(s)).toBe(false);
  s.facts[0].usable = true;
  s.pending = [{ id: 'p', criterionId: null, factIds: [], reason: 'Contradição', blocking: true }];
  expect(canWrite(s)).toBe(false);
  s.pending[0].blocking = false;
  s.links[0].status = 'contradiction';
  expect(canWrite(s)).toBe(false);
  s.links[0].status = 'confirmed';
  s.interruption = {
    kind: 'partial',
    reason: 'Encerramento solicitado',
    resumePhase: 'confirmation',
  };
  expect(canWrite(s)).toBe(false);
  for (const key of ['resumes', 'job', 'objective', 'facts'] as const)
    expect(equalInputs(inputs, { ...inputs, [key]: 'changed' })).toBe(false);
});
it('discards raw stories on confirmation and never accepts candidate facts', () => {
  const s = prepared();
  expect(() => confirm(s, ['f'])).toThrow('INVALID_CONFIRMATION');
  s.phase = 'confirmation';
  for (const ids of [[], ['f', 'f'], ['missing'], ['f']])
    expect(() => confirm(s, ids)).toThrow('INVALID_CONFIRMATION');
  s.facts[0].confirmation = 'confirmed';
  s.facts[0].usable = false;
  expect(() => confirm(s, ['f'])).toThrow();
  s.facts[0].usable = true;
  s.stories = [{ id: 'story', experienceId: 'e', text: 'Relato bruto', turnId: 't' }];
  s.turns = [
    {
      id: 't',
      question: { text: 'Conte', topicId: s.plan!.topics[0].id },
      answer: { text: 'Relato bruto', kind: 'specific' },
      factIds: ['f'],
    },
  ];
  const result = confirm(s, ['f']);
  expect(result.stories[0].text).toBe('');
  expect(result.turns[0].answer.text).toBe('');
  expect(confirm(result, ['f']).confirmation?.version).toBe(2);
});
it('rejects ungrounded final content and stale source hashes', () => {
  const s: Session = { ...confirmed(), phase: 'ready' };
  const content: GroundedContent = {
    ...s.confirmation!,
    sections: [{ text: 'Atendeu clientes', factIds: ['f'] }],
  };
  expect(() => validateContent(s, content)).not.toThrow();
  expect(() => validateContent(base(), content)).toThrow('UNGROUNDED_CONTENT');
  expect(() => validateContent({ ...prepared(), phase: 'ready' }, content)).toThrow(
    'UNGROUNDED_CONTENT',
  );
  expect(() => validateContent({ ...s, phase: 'writing' }, content)).not.toThrow();
  expect(() => validateContent(s, { ...content, valid: false })).toThrow();
  expect(() => validateContent(s, { ...content, inputs: { ...inputs, job: 'stale' } })).toThrow();
  expect(() => validateContent(s, { ...content, sections: [] })).toThrow();
  for (const section of [
    { text: ' ', factIds: ['f'] },
    { text: 'X', factIds: [] },
    { text: 'X', factIds: ['invented'] },
  ])
    expect(() => validateContent(s, { ...content, sections: [section] })).toThrow();
});
it('uses safe communication formulas and validates preparation state', () => {
  expect(() => prepare(base(), extraction, analysis)).toThrow('INVALID_PREPARATION');
  expect(() => prepare(prepared(), extraction, analysis)).toThrow();
  for (const archetype of [
    'A_FIRST_JOB',
    'B_CAREER_CHANGE',
    'C_OPERATIONAL',
    'D_SAME_FIELD_RETURN',
    'E_SPECIALIST',
  ] as const) {
    const s = base();
    s.objective = { value: 'ENTER_FAST', provisional: false };
    const p = prepare(s, extraction, { ...analysis, archetype });
    expect(p.strategy?.formula).toBe(archetype === 'C_OPERATIONAL' ? 'SCOPE_COMPLIANCE' : 'CAR');
    s.strategy = p.strategy;
    expect(prepare(s, extraction, analysis).strategy?.version).toBe(2);
  }
});

it('orders equal impact by uncertainty and handles candidates without experience', () => {
  const s = prepared();
  s.criteria = [
    { ...analysis.criteria[0], id: 'a' },
    { ...analysis.criteria[0], id: 'b' },
  ];
  s.links = [
    { ...analysis.links[0], criterionId: 'a' },
    {
      ...analysis.links[0],
      id: 'u',
      criterionId: 'b',
      experienceId: null,
      factIds: [],
      status: 'unknown',
    },
  ];
  expect(replan(s).topics[0].criterionId).toBe('b');
  s.criteria = [{ ...analysis.criteria[0], category: 'ELIMINATORY' }];
  s.links = [analysis.links[0]];
  expect(replan(s).topics[0].impact).toBe(3);
});
import { recordTurn } from './index';
it('stores bounded identified turns without promoting vague responses to facts', () => {
  const s = prepared();
  const turn = {
    recordedAt: 100,
    id: 't',
    question: { text: 'Conte um exemplo', topicId: s.plan!.topics[0].id },
    answer: { text: 'Fazia tudo', kind: 'vague' as const },
    factIds: [],
  };
  const result = recordTurn(s, turn);
  expect(result.facts[0].confirmation).toBe('candidate');
  expect(recordTurn(result, turn)).toBe(result);
  expect(() =>
    recordTurn(result, { ...turn, answer: { ...turn.answer, text: 'Outra resposta' } }),
  ).toThrow('IDEMPOTENCY_CONFLICT');
  for (const invalid of [
    { ...s, phase: 'ready' as const },
    interrupt(s, 'paused', 'pausa'),
    { ...s, plan: null },
    { ...s, turns: Array(100).fill(turn) },
  ])
    expect(() => recordTurn(invalid, turn)).toThrow('INVALID_TURN');
  for (const invalid of [
    { ...turn, id: '' },
    { ...turn, question: { ...turn.question, text: '' } },
    { ...turn, answer: { ...turn.answer, text: '' } },
    { ...turn, question: { ...turn.question, topicId: 'x' } },
    { ...turn, factIds: ['x'] },
    { ...turn, answer: { ...turn.answer, text: 'a'.repeat(10_001) } },
  ])
    expect(() => recordTurn(s, invalid)).toThrow('INVALID_TURN');
  const withFact = { ...turn, factIds: ['f'] };
  expect(recordTurn(s, withFact).turns[0].factIds).toEqual(['f']);
  expect(() => recordTurn({ ...s, plan: { ...s.plan!, valid: false } }, turn)).toThrow();
});
import { decideFact } from './index';
it('records explicit candidate decisions, invalidates old confirmation and replans', () => {
  const s = confirmed();
  s.facts.push({ ...s.facts[0], id: 'other' });
  const updated = decideFact(s, 'f', 'confirmed', true, 'new');
  expect(updated.facts[0].revision).toBe(2);
  expect(updated.confirmation?.valid).toBe(false);
  expect(updated.links[0].status).toBe('confirmed');
  expect(s.inputs.facts).toBe('f');
  for (const [session, id, decision, usable, hash] of [
    [{ ...s, phase: 'writing' }, 'f', 'confirmed', true, 'new'],
    [s, 'missing', 'confirmed', true, 'new'],
    [s, 'f', 'invented', true, 'new'],
    [s, 'f', 'confirmed', 'yes', 'new'],
    [s, 'f', 'confirmed', true, ''],
    [s, 'f', 'confirmed', true, s.inputs.facts],
  ] as const)
    expect(() =>
      decideFact(session as Session, id, decision as never, usable as boolean, hash),
    ).toThrow('INVALID_FACT_DECISION');
});
import { mergeHistory } from './index';
it('preserves confirmed history and remaps colliding extraction identities on retargeting', () => {
  const previous = confirmed();
  const incoming = prepared();
  expect(mergeHistory(previous, incoming).facts[0].confirmation).toBe('confirmed');
  incoming.experiences[0].title = 'Outro título';
  incoming.facts[0].text = 'Outra declaração';
  incoming.links.push({
    ...incoming.links[0],
    id: 'unknown',
    experienceId: null,
    factIds: [],
    status: 'unknown',
  });
  const result = mergeHistory(previous, incoming);
  expect(result.facts).toHaveLength(2);
  expect(result.facts.find((f) => f.id === 'f')?.confirmation).toBe('confirmed');
  expect(result.links[0].experienceId).not.toBe('e');
  expect(result.links[1].experienceId).toBeNull();
  expect(mergeHistory(base(), incoming).facts).toHaveLength(1);
});
import { nextAction } from './index';
it('chooses a versioned next action from the evidence state, never a fixed questionnaire', () => {
  expect(nextAction(base()).kind).toBe('prepare');
  expect(nextAction({ ...base(), phase: 'interview' })).toMatchObject({
    kind: 'investigate',
    topic: null,
  });
  const s = prepared();
  expect(nextAction(s).kind).toBe('investigate');
  expect(nextAction(interrupt(s, 'partial', 'Escolheu encerrar'))).toMatchObject({
    kind: 'stop',
    reason: 'Escolheu encerrar',
  });
  expect(nextAction({ ...confirmed(), phase: 'ready' })).toMatchObject({
    kind: 'write',
    confirmationVersion: 1,
  });
  expect(nextAction({ ...confirmed(), phase: 'writing' }).kind).toBe('write');
  const confirmedFact = confirmed();
  expect(nextAction(confirmedFact)).toMatchObject({ kind: 'confirm', factIds: ['f'] });
  confirmedFact.facts[0].confirmation = 'rejected';
  expect(nextAction(confirmedFact).kind).toBe('investigate');
  const empty = base();
  empty.phase = 'interview';
  empty.facts = [...s.facts, { ...s.facts[0], id: 'unused', usable: false }];
  expect(nextAction(empty)).toMatchObject({ kind: 'confirm', factIds: ['f'] });
  const old = prepared();
  old.sources = [{ id: 'old', version: 'v1', text: 'Fonte original' }];
  const incoming = prepared();
  incoming.sources = [old.sources[0]];
  expect(mergeHistory(old, incoming).sources).toHaveLength(1);
  incoming.sources = [];
  expect(mergeHistory(old, incoming).sources).toHaveLength(1);
});
import { purgeRaw } from './index';
it('expires raw text after 30 days while preserving origin IDs and facts', () => {
  const s = prepared();
  const turn = {
    id: 'old',
    recordedAt: 100,
    question: { text: 'Conte', topicId: s.plan!.topics[0].id },
    answer: { text: 'Relato privado', kind: 'specific' as const },
    factIds: ['f'],
  };
  s.turns = [
    turn,
    { ...turn, id: 'recent', recordedAt: 30 * 86400000 },
    { ...turn, id: 'legacy', recordedAt: undefined },
  ];
  s.stories = [
    { id: 'old', turnId: 'old', experienceId: 'e', text: 'Relato privado' },
    { id: 'recent', turnId: 'recent', experienceId: 'e', text: 'Recente' },
  ];
  const purged = purgeRaw(s, 30 * 86400000 + 100);
  expect(purged.turns[0].answer.text).toBe('');
  expect(purged.turns[1].answer.text).toBe('Relato privado');
  expect(purged.stories[0].text).toBe('');
  expect(purged.stories[1].text).toBe('Recente');
  expect(purged.facts).toEqual(s.facts);
  expect(purgeRaw(prepared(), Date.now()).turns).toEqual([]);
  const empty = prepared();
  empty.plan = null;
  expect(
    recordTurn({ ...s, turns: [], plan: replan(s) }, { ...turn, id: 'new', recordedAt: undefined })
      .turns[0].recordedAt,
  ).toBeGreaterThan(0);
  expect(purgeRaw(empty, 1)).toBe(empty);
});
