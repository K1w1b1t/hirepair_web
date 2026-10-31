import { createSession, nextAction, replan } from './index';

it('asks for a concrete experience in an interview without documents', () => {
  const s = createSession('s', 'f', { resumes: '', job: 'j', objective: 'o', facts: '' });
  s.objective = { value: 'ENTER_FAST', provisional: false };
  s.phase = 'interview';
  s.plan = replan(s);
  expect(nextAction(s)).toMatchObject({ kind: 'ask', topic: { id: 'discovery' } });
});
import {
  startWithoutDocuments,
  interviewState,
  INTERVIEW_LIMITS,
  answerInterview,
  addActiveTime,
  requestReview,
  reopenInterview,
  incorporateBlock,
  editFact,
  resolveFactConflict,
  applyCommand,
  prepare as sharedPrepare,
  confirm,
  canWrite,
  type Session,
  type Turn,
  type InterviewBlockResult,
} from './index';
import { extraction, analysis } from './fixtures';
const prepare: typeof sharedPrepare = (s, e, a) =>
  sharedPrepare(s, structuredClone(e), structuredClone(a));
function session(): Session {
  const s = createSession('s', 'f', { resumes: '', job: 'j', objective: 'o', facts: '' });
  s.objective = { value: 'ENTER_FAST', provisional: false };
  return startWithoutDocuments(s);
}
function turn(id = 't', kind: Turn['answer']['kind'] = 'specific'): Turn {
  return {
    id,
    question: { text: 'Conte', topicId: 'discovery' },
    answer: { text: 'Usei Excel diariamente para conferir entradas e saídas', kind },
    factIds: [],
  };
}
function block(s: Session, sufficient = true): InterviewBlockResult {
  return {
    version: 1,
    revision: s.revision,
    extraction: {
      experiences: [
        {
          ...extraction.experiences[0],
          origin: { sourceId: 't', sourceVersion: 'hash', quote: 'Usei Excel' },
        },
      ],
      facts: [
        {
          ...extraction.facts[0],
          text: 'Usei Excel diariamente para conferir entradas e saídas',
          origin: { sourceId: 't', sourceVersion: 'hash', quote: 'Usei Excel' },
        },
      ],
    },
    analysis: null,
    assessments: [
      {
        topicId: 'discovery',
        sufficient,
        evidence: sufficient ? ['atividade', 'ferramenta', 'frequência'] : [],
        question: sufficient ? null : 'Conte uma situação concreta e o que você fez.',
        contradictionFactIds: [],
      },
    ],
  };
}
it('starts the same aggregate without documents and rejects implicit objectives or documents', () => {
  expect(session()).toMatchObject({
    version: 1,
    phase: 'interview',
    sources: [],
    interview: { limits: INTERVIEW_LIMITS },
  });
  const s = session();
  expect(interviewState(s)).toBe(s.interview);
  for (const bad of [
    { ...s, objective: null },
    { ...s, sources: [{ id: 's', version: 'v', text: 'CV' }] },
    s,
  ])
    expect(() => startWithoutDocuments(bad)).toThrow('INVALID_PREPARATION');
});
it.each(['absence', 'declined', 'unknown', 'forgotten', 'skipped'] as const)(
  'records %s without filling gaps or persisting invented facts',
  (kind) => {
    const s = answerInterview(session(), turn('t', kind));
    expect(s.interview!.topics.discovery.status).toBe(kind);
    expect(s.facts).toEqual([]);
    expect(nextAction(s).kind).toBe('review');
    expect(s.pending[0].blocking).toBe(false);
  },
);
it('records declared absence on the relevant criterion with a declaration reference', () => {
  const s = prepare({ ...session(), phase: 'preparation' }, extraction, analysis);
  const t = { ...turn('a', 'absence'), question: { text: 'Conte', topicId: s.plan!.topics[0].id } };
  const next = answerInterview(s, t);
  expect(next.links[0]).toMatchObject({ status: 'declared_absence', declarationTurnId: 'a' });
  expect(replan(next).topics).toEqual([]);
});
it('asks concrete local questions without deciding semantic sufficiency by word count', () => {
  const s = answerInterview(session(), turn());
  expect(nextAction(s)).toMatchObject({
    kind: 'ask',
    question: 'Onde foi essa atividade e o que você fazia lá?',
  });
  expect(s.facts).toEqual([]);
  const next = incorporateBlock(s, block(s), ['t'], 'facts1');
  expect(next.facts[0]).toMatchObject({
    confirmation: 'candidate',
    externallyVerified: false,
    storyId: 'story:t:e',
  });
  expect(nextAction(next).kind).toBe('review');
  expect(next.sources).toEqual([]);
  expect(next.stories[0].text).toBe('');
  expect(next.turns[0].factIds).toEqual(['f']);
});
it('deepens long vague responses and closes after two analyses without evidence gain', () => {
  let s = answerInterview(session(), {
    ...turn(),
    answer: { kind: 'specific', text: 'Fazia tudo com qualidade e dedicação. '.repeat(30) },
  });
  let result = block(s, false);
  result.extraction = { experiences: [], facts: [] };
  s = incorporateBlock(s, result, ['t'], 'h1');
  expect(nextAction(s)).toMatchObject({
    kind: 'deepen',
    question: 'Conte uma situação concreta e o que você fez.',
  });
  s = answerInterview(s, turn('t2'));
  result = { ...result, revision: s.revision };
  s = incorporateBlock(s, result, ['t2'], 'h2');
  expect(nextAction(s).kind).toBe('review');
  expect(s.interview!.topics.discovery.status).toBe('limit');
});
it('resets no-gain count when a new evidence dimension appears and preserves existing stories', () => {
  let s = answerInterview(session(), turn());
  s = incorporateBlock(s, block(s), ['t'], 'h1');
  s = reopenInterview(s);
  s = answerInterview(s, turn('t2'));
  const result = block(s, false);
  result.extraction.facts[0].id = 'f2';
  result.extraction.experiences = [];
  result.assessments[0].evidence = ['ação'];
  // The citation can reference any turn of the submitted block, and the existing story is reused.
  s.interview!.analyzedTurnIds = [];
  s = incorporateBlock(s, result, ['t', 't2'], 'h2');
  expect(s.stories).toHaveLength(1);
  expect(s.interview!.topics.discovery.noGain).toBe(0);
});
it('blocks stale, repeated, ungrounded and colliding block results', () => {
  const s = answerInterview(session(), turn());
  expect(() => incorporateBlock(s, { ...block(s), revision: 99 }, ['t'], 'h')).toThrow(
    'REVISION_CONFLICT',
  );
  expect(() => incorporateBlock(s, block(s), [], 'h')).toThrow('REVISION_CONFLICT');
  expect(() => incorporateBlock(s, block(s), ['missing'], 'h')).toThrow('REVISION_CONFLICT');
  const done = incorporateBlock(s, block(s), ['t'], 'h');
  expect(() => incorporateBlock(done, block(done), ['t'], 'h2')).toThrow('BLOCK_ALREADY_ANALYZED');
  const bad = block(s);
  bad.extraction.facts[0].origin.quote = 'Inventado';
  expect(() => incorporateBlock(s, bad, ['t'], 'h')).toThrow('INVALID_ORIGIN');
  bad.extraction.facts[0].origin.sourceId = 'missing';
  expect(() => incorporateBlock(s, bad, ['t'], 'h')).toThrow('INVALID_ORIGIN');
  expect(() => incorporateBlock({ ...s, facts: done.facts }, block(s), ['t'], 'h2')).toThrow(
    'DUPLICATE_ID',
  );
});
it('marks conflicting facts unusable until the person explicitly corrects or removes a version', () => {
  const s = answerInterview(session(), turn());
  const result = block(s);
  result.analysis = structuredClone(analysis);
  result.assessments[0].contradictionFactIds = ['f'];
  const next = incorporateBlock(s, result, ['t'], 'h');
  expect(next.pending[0].blocking).toBe(true);
  expect(next.facts[0].usable).toBe(false);
  expect(() => confirm(requestReview(next), ['f'])).toThrow('INVALID_CONFIRMATION');
  const edited = resolveFactConflict(
    editFact(next, 'f', 'Eu conferia somente as entradas.', 'h2'),
    'f',
  );
  expect(edited.facts[0]).toMatchObject({
    confirmation: 'candidate',
    revision: 2,
    externallyVerified: false,
  });
  expect(edited.factHistory![0].text).toBe(result.extraction.facts[0].text);
  expect(edited.pending).toEqual([]);
  result.assessments[0].contradictionFactIds = ['missing'];
  expect(() => incorporateBlock(s, result, ['t'], 'h')).toThrow('INVALID_REFERENCE');
  expect(() => editFact(next, 'missing', 'x', 'h2')).toThrow('INVALID_FACT_EDIT');
  expect(() => editFact(next, 'f', ' ', 'h2')).toThrow('INVALID_FACT_EDIT');
  expect(() => editFact(next, 'f', 'x'.repeat(501), 'h2')).toThrow('INVALID_FACT_EDIT');
});
it('asks neutral clarification before other topics when a link conflicts', () => {
  const s = prepare({ ...session(), phase: 'preparation' }, extraction, analysis);
  s.links[0].status = 'contradiction';
  s.links[0].declarationTurnId = 't';
  expect(nextAction(s)).toMatchObject({
    kind: 'clarify',
    question: expect.stringContaining('período'),
  });
  expect(resolveFactConflict(s, 'f').links[0]).toMatchObject({ status: 'unknown', factIds: [] });
});
it('reviews at time and turn limits, and never resets elapsed time on resume', () => {
  const s = addActiveTime(session(), INTERVIEW_LIMITS.activeMs);
  expect(nextAction(s).kind).toBe('review');
  expect(reopenInterview(requestReview(s)).interview!.activeMs).toBe(INTERVIEW_LIMITS.activeMs);
  expect(() => answerInterview(s, turn())).toThrow('INVALID_TURN');
  const turns = { ...session(), turns: Array.from({ length: 100 }, (_, i) => turn(`${i}`)) };
  expect(nextAction(turns).kind).toBe('review');
  expect(() => answerInterview(turns, turn())).toThrow('INVALID_TURN');
  for (const ms of [-1, Infinity, NaN]) expect(() => addActiveTime(s, ms)).toThrow('INVALID_TIME');
  expect(addActiveTime(s, 0).interview!.activeMs).toBe(INTERVIEW_LIMITS.activeMs);
});
it('refuses unexpected topics, oversized answers and review-phase answers', () => {
  const s = session();
  expect(() =>
    answerInterview(s, { ...turn(), question: { text: 'Q', topicId: 'other' } }),
  ).toThrow('INVALID_TURN');
  expect(() =>
    answerInterview(s, { ...turn(), answer: { kind: 'specific', text: 'a'.repeat(10001) } }),
  ).toThrow('INVALID_TURN');
  expect(() => answerInterview(requestReview(s), turn())).toThrow('INVALID_TURN');
  const overridden = session();
  overridden.interview!.limits.answerChars = 5;
  expect(() => answerInterview(overridden, turn())).toThrow('INVALID_TURN');
});
it('offers review after a local block instead of repeating questions indefinitely', () => {
  let s = session();
  for (let i = 0; i < 6; i++) s = answerInterview(s, turn(`${i}`));
  expect(nextAction(s)).toMatchObject({ kind: 'review', reason: expect.stringContaining('bloco') });
});
it('uses command revision checks and invalidates confirmation when reopening the conversation', () => {
  const s = session();
  const next = applyCommand(s, 'cmd', 'hash', 0, (value) => answerInterview(value, turn()));
  expect(next.revision).toBe(1);
  expect(() => applyCommand(next, 'other', 'hash', 0, (value) => value)).toThrow(
    'REVISION_CONFLICT',
  );
  let done = incorporateBlock(next, block(next), ['t'], 'facts');
  done.facts[0].confirmation = 'confirmed';
  done = confirm(requestReview(done), ['f']);
  expect(canWrite(done)).toBe(true);
  done.facts[0].revision++;
  expect(canWrite(done)).toBe(false);
  done.facts[0].revision--;
  done.phase = 'ready';
  expect(requestReview(done)).toBeTruthy();
  expect(reopenInterview(done, 'discovery').confirmation!.valid).toBe(false);
});
it('preserves unrelated facts, history and content while editing or reopening', () => {
  let s = answerInterview(session(), turn());
  s = incorporateBlock(s, block(s), ['t'], 'h');
  s.facts.push({ ...s.facts[0], id: 'other' });
  s.factHistory = [s.facts[0]];
  s.content = {
    id: 'content',
    version: 1,
    inputs: s.inputs,
    dependencies: ['facts'],
    valid: true,
    sections: [],
  };
  const next = editFact(s, 'f', 'Corrigido', 'h2');
  expect(next.facts[1]).toEqual(s.facts[1]);
  expect(next.factHistory).toHaveLength(2);
  expect(reopenInterview(s).content!.valid).toBe(false);
  const b = block(s, false);
  b.extraction = { experiences: [], facts: [] };
  b.assessments[0].topicId = 'new';
  b.assessments[0].question = null;
  s.interview!.analyzedTurnIds = [];
  s.pending.push({ id: 'other', criterionId: null, factIds: [], reason: 'Outro', blocking: false });
  expect(incorporateBlock(s, b, ['t'], 'h3').pending).toContainEqual(
    expect.objectContaining({ reason: 'Faltam detalhes deste tópico.' }),
  );
  const c = block(s);
  c.extraction.facts[0].id = 'new';
  c.assessments[0].contradictionFactIds = ['new'];
  expect(incorporateBlock(s, c, ['t'], 'h4').facts.find((f) => f.id === 'other')!.usable).toBe(
    true,
  );
  expect(requestReview(requestReview(s)).phase).toBe('confirmation');
});
import { editExperience } from './index';
it('makes experience corrections pending without losing rejected or unrelated facts', () => {
  const s = prepare({ ...session(), phase: 'preparation' }, extraction, analysis);
  s.facts.push({ ...s.facts[0], id: 'removed', confirmation: 'rejected' });
  s.facts.push({ ...s.facts[0], id: 'unrelated', experienceId: 'other' });
  const next = editExperience(
    s,
    'e',
    { title: 'Atividade informal', start: null, end: null },
    'new',
  );
  expect(next.experiences[0].title).toBe('Atividade informal');
  expect(next.facts[0].confirmation).toBe('candidate');
  expect(next.facts[1].confirmation).toBe('rejected');
  expect(next.facts[2]).toEqual(s.facts[2]);
  for (const patch of [
    { title: '', start: null, end: null },
    { title: 'x'.repeat(201), start: null, end: null },
    { title: 'x', start: 'x'.repeat(41), end: null },
    { title: 'x', start: null, end: 'x'.repeat(41) },
  ])
    expect(() => editExperience(s, 'e', patch, 'new')).toThrow('INVALID_EXPERIENCE_EDIT');
  expect(() =>
    editExperience(s, 'missing', { title: 'x', start: '2020', end: '2021' }, 'new'),
  ).toThrow('INVALID_EXPERIENCE_EDIT');
});
it('prioritizes pending contradictions with and without an existing topic reference', () => {
  const s = prepare({ ...session(), phase: 'preparation' }, extraction, analysis);
  const id = s.plan!.topics[0].id;
  s.pending = [
    {
      id: 'p',
      topicId: id,
      criterionId: 'c',
      factIds: ['f'],
      reason: 'Esclarecer participação',
      blocking: true,
    },
  ];
  expect(nextAction(s)).toMatchObject({ kind: 'clarify', topic: { id } });
  s.pending[0].topicId = 'new-topic';
  expect(nextAction(s)).toMatchObject({ kind: 'clarify', topic: { id: 'new-topic' } });
  delete s.pending[0].topicId;
  expect(nextAction(s)).toMatchObject({ kind: 'clarify', topic: { id: 'discovery' } });
  s.pending = [];
  const reopened = reopenInterview(s, id);
  expect(nextAction(reopened)).toMatchObject({
    topic: { id },
    reason: expect.stringContaining('Você pediu para revisitar'),
  });
  reopened.interview!.topics[id].status = 'sufficient';
  expect(nextAction(reopened)).toMatchObject({ topic: { id: 'discovery' } });
  s.experiences.push({ ...s.experiences[0], id: 'other' });
  s.factHistory = [s.facts[0]];
  expect(
    editExperience(s, 'e', { title: 'Loja corrigida', start: '2020', end: '2023' }, 'hash')
      .experiences[1],
  ).toEqual(s.experiences[1]);
});
it('uses an internal document finding to ask a simple question and resolves it after sufficient evidence', () => {
  const s = session();
  s.diagnostics = [
    {
      version: 1,
      rulesVersion: 2,
      contextVersion: 'ctx',
      status: 'available',
      document: null,
      limitations: [],
      findings: [
        {
          version: 1,
          id: 'finding',
          code: 'DATES_NEED_CLARIFICATION',
          severity: 'HIGH',
          nature: 'hypothesis',
          documentId: 'cv',
          documentHash: 'h',
          evidence: [],
          title: 'Achado interno',
          explanation: 'Relatório interno de cronologia',
          action: 'Esclarecer período',
          investigation: {
            experienceId: null,
            missingEvidence: 'qual período corresponde à atividade',
          },
          restriction: null,
        },
      ],
    },
  ];
  s.pending = [
    {
      id: 'internal',
      diagnosticFindingId: 'finding',
      criterionId: null,
      factIds: [],
      reason: 'Relatório interno de cronologia',
      blocking: false,
    },
  ];
  s.plan = replan(s);
  const action = nextAction(s);
  expect(action.reason).toBe('Vamos conferir um detalhe da sua experiência.');
  const topic = 'diagnostic:finding';
  const answered = answerInterview(s, {
    ...turn(),
    question: { text: 'Qual período?', topicId: topic },
  });
  const result = block(answered);
  result.assessments[0].topicId = topic;
  const next = incorporateBlock(answered, result, ['t'], 'diagnostic-facts');
  expect(next.pending.some((p) => p.diagnosticFindingId === 'finding')).toBe(false);
});
it('selects consolidated confirmation after the person has explicitly kept usable facts', () => {
  const s = requestReview(prepare({ ...session(), phase: 'preparation' }, extraction, analysis));
  s.facts[0].confirmation = 'confirmed';
  expect(nextAction(s)).toMatchObject({ kind: 'confirm', factIds: ['f'] });
  s.pending = [{ id: 'p', criterionId: null, factIds: ['f'], reason: 'Conflito', blocking: true }];
  expect(nextAction(s).kind).toBe('review');
  s.pending = [];
  s.links[0].status = 'contradiction';
  s.links[0].declarationTurnId = 't';
  expect(nextAction(s).kind).toBe('review');
});
