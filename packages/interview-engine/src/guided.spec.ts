import { createSession, canWrite } from './engine';
import { startGuided, completeGuided } from './guided';
const initial = () => {
  const s = createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  s.objective = { value: 'ENTER_FAST' as const, provisional: false };
  s.phase = 'interview';
  return s;
};
it('starts a short guided interview with no human confirmation workflow', () => {
  expect(startGuided(initial())).toMatchObject({
    guided: { version: 1, maxAnswers: 12, activeLimitMs: 480000 },
  });
});
it('requires grounded material before completing', () => {
  expect(canWrite(completeGuided(startGuided(initial())))).toBe(false);
  expect(completeGuided(startGuided(initial()))).toMatchObject({ guided: { status: 'partial' } });
});
it('ends the interview when the person asks to stop without fabricating missing evidence', () => {
  const s = startGuided(initial()),
    question = guidedQuestion(s)!;
  const next = guidedAnswer(s, {
    id: 'stop',
    question: { text: question.text, topicId: question.topic.id },
    answer: { text: 'Quero parar', kind: 'declined' },
    factIds: [],
  });
  expect(guidedQuestion(next)).toBeNull();
  expect(completeGuided(next).guided!.status).toBe('partial');
  expect(next.facts).toEqual([]);
  const refusal = guidedAnswer(s, {
    id: 'refuse',
    question: { text: question.text, topicId: question.topic.id },
    answer: { text: 'Prefiro não responder', kind: 'declined' },
    factIds: [],
  });
  expect(guidedQuestion(refusal)).not.toBeNull();
});
it('reopens an automatic completion when its selected inputs become obsolete', () => {
  const s = completeGuided(groundedSession());
  const changed = changeInput(s, 'job', 'new-vacancy');
  expect(startGuided(changed).guided!.status).toBe('interview');
  expect(canWrite(changed)).toBe(false);
});
import { guidedQuestion, guidedAnswer, validEngineSelection, selectedFactIds } from './guided';
import { knowledgeFor, KNOWLEDGE_VERSION } from './resume-knowledge';
import { changeInput, validateContent, nextAction } from './engine';
function groundedSession() {
  const s = startGuided(initial());
  delete s.guided!.timeline; // Legacy selection contracts remain supported.
  s.sources = [{ id: 'cv', version: 'v', text: 'Conferi o estoque da loja.' }];
  s.experiences = [
    {
      id: 'e',
      title: 'Loja',
      start: null,
      end: null,
      current: null,
      origin: { sourceId: 'cv', sourceVersion: 'v', quote: 'estoque' },
    },
  ];
  s.facts = [
    {
      id: 'f',
      revision: 1,
      experienceId: 'e',
      storyId: null,
      text: 'Conferi o estoque',
      origin: { sourceId: 'cv', sourceVersion: 'v', quote: 'Conferi o estoque' },
      confirmation: 'candidate',
      externallyVerified: false,
      usable: true,
    },
  ];
  return s;
}
it('selects grounded facts without representing a human confirmation', () => {
  const s = completeGuided(groundedSession());
  expect(s.phase).toBe('ready');
  expect(s.facts[0].confirmation).toBe('candidate');
  expect(s.confirmation).toBeNull();
  expect(canWrite(s)).toBe(true);
  expect(s.selection).toMatchObject({ kind: 'engine', knowledgeVersion: KNOWLEDGE_VERSION });
  expect(selectedFactIds(s)).toEqual(['f']);
  expect(nextAction(s).kind).toBe('write');
  validateContent(s, {
    id: 'draft',
    version: 1,
    inputs: s.inputs,
    dependencies: ['facts'],
    valid: true,
    sections: [{ text: 'Atuação no estoque.', factIds: ['f'] }],
  });
  expect(canWrite(changeInput(s, 'facts', 'changed'))).toBe(false);
  s.facts[0].revision++;
  expect(canWrite(s)).toBe(false);
});
it('refuses obsolete selection rules and newly conflicting facts before writing', () => {
  const s = completeGuided(groundedSession());
  s.selection!.rulesVersion = 0;
  expect(canWrite(s)).toBe(false);
  s.selection!.rulesVersion = 1;
  s.pending.push({
    id: 'new-conflict',
    criterionId: null,
    factIds: ['f'],
    reason: 'Datas divergentes',
    blocking: true,
  });
  expect(canWrite(s)).toBe(false);
  s.pending = [];
  s.links.push({
    id: 'l',
    criterionId: 'c',
    experienceId: 'e',
    factIds: ['f'],
    status: 'contradiction',
    declarationTurnId: null,
  });
  expect(canWrite(s)).toBe(false);
});
it('excludes conflicts, rejected facts and examples from the knowledge base', () => {
  const s = groundedSession();
  s.facts.push({ ...s.facts[0], id: 'conflict' });
  s.facts.push({ ...s.facts[0], id: 'rejected', confirmation: 'rejected' });
  s.facts.push({
    ...s.facts[0],
    id: 'fake',
    origin: { sourceId: 'example', sourceVersion: 'x', quote: 'invented' },
  });
  s.pending = [
    { id: 'p', criterionId: null, factIds: ['conflict'], reason: 'Conflito', blocking: true },
  ];
  s.links = [
    {
      id: 'l',
      criterionId: 'c',
      experienceId: 'e',
      factIds: ['f'],
      status: 'candidate',
      declarationTurnId: null,
    },
  ];
  const next = completeGuided(s);
  expect(selectedFactIds(next)).toEqual(['f']);
  expect(next.selection!.excluded).toHaveLength(3);
  s.links[0].status = 'contradiction';
  expect(completeGuided(s).guided!.status).toBe('partial');
});
it('uses the same origins for narrated and corrected facts, and preserves partial history', () => {
  const s = groundedSession();
  s.sources = [];
  s.turns = [
    {
      id: 't',
      question: { text: 'q', topicId: 'guided:activity' },
      answer: { text: 'Conferi o estoque', kind: 'specific' },
      factIds: ['f'],
    },
  ];
  s.facts[0].origin = { sourceId: 't', sourceVersion: 'v', quote: 'Conferi o estoque' };
  expect(completeGuided(s).turns[0].answer.text).toBe('');
  s.turns[0].answer.text = '';
  expect(canWrite(completeGuided(s))).toBe(true);
  s.facts[0].origin = { sourceId: 'edit:f', sourceVersion: 'edit', quote: s.facts[0].text };
  expect(canWrite(completeGuided(s))).toBe(true);
  s.facts[0].origin.quote = ' ';
  expect(completeGuided(s).guided!.status).toBe('partial');
});
it('asks contextual questions and respects answered topics, limits and valid exits', () => {
  let s = startGuided(initial());
  const first = guidedQuestion(s)!;
  expect(first.text).toContain('primeira experiência profissional');
  s = guidedAnswer(s, {
    id: 't',
    question: { text: first.text, topicId: first.topic.id },
    answer: { text: 'Não lembro', kind: 'forgotten' },
    factIds: [],
  });
  expect(guidedQuestion(s)!.topic.id).toBe('guided:first-informal');
  expect(() =>
    guidedAnswer(s, {
      id: 'x',
      question: { text: 'q', topicId: 'wrong' },
      answer: { text: 'x', kind: 'specific' },
      factIds: [],
    }),
  ).toThrow('INVALID_TURN');
  s.guided!.clarification = { topic: first.topic, question: 'Qual foi sua parte?' };
  expect(guidedQuestion(s)!.text).toContain('qual foi sua parte?');
  s.guided!.clarification = null;
  s.guided!.answered = Array(12).fill('guided:activity');
  expect(guidedQuestion(s)).toBeNull();
  s.guided!.answered = [];
  s.guided!.activeMs = 480000;
  expect(guidedQuestion(s)).toBeNull();
  s.guided!.activeMs = 0;
  s.guided!.status = 'partial';
  expect(guidedQuestion(s)).toBeNull();
});
it('avoids asking known periods, contextualizes participation and selects synthetic guidance', () => {
  const s = groundedSession();
  s.experiences[0].start = '2020';
  s.guided!.timeline = {
    anchors: [],
    completed: ['e'],
    latest: true,
    noProfessionalHistory: false,
    halted: false,
  };
  s.guided!.answered = [
    'guided:e:responsibility',
    'guided:e:context',
    'guided:e:tools',
    'guided:e:frequency',
    'guided:e:action',
    'guided:e:result',
  ];
  expect(guidedQuestion(s)).toBeNull();
  expect(startGuided(s)).toBe(s);
  s.phase = 'ready';
  delete s.guided;
  expect(startGuided(s).guided!.status).toBe('complete');
  for (const value of ['escola', 'informal', 'estoque', 'transição', 'engenharia', 'nenhum'])
    expect(knowledgeFor(value).length).toBeGreaterThan(0);
  const entry = startGuided(initial());
  entry.facts = [{ ...groundedSession().facts[0], text: 'projeto escolar' }];
  expect(guidedQuestion(entry)!.text).toContain('primeira experiência profissional');
  expect(validEngineSelection(initial())).toBe(false);
  expect(selectedFactIds(initial())).toEqual([]);
});
it('ranks linked evidence ahead of general experience and keeps stable selection versions', () => {
  const s = groundedSession();
  s.facts.push({ ...s.facts[0], id: 'other' });
  s.facts.push({ ...s.facts[0], id: 'third' });
  s.links = [
    {
      id: 'l',
      criterionId: 'c',
      experienceId: 'e',
      factIds: ['other'],
      status: 'candidate',
      declarationTurnId: null,
    },
  ];
  s.stories = [{ id: 'story', turnId: 't', experienceId: 'e', text: 'raw' }];
  const done = completeGuided(s);
  expect(done.selection!.facts[0].id).toBe('other');
  expect(done.stories[0].text).toBe('');
  expect(completeGuided(done).selection!.version).toBe(2);
  done.selection!.knowledgeVersion = 'old';
  expect(validEngineSelection(done)).toBe(false);
  done.selection!.valid = false;
  expect(validEngineSelection(done)).toBe(false);
  const legacy = initial();
  legacy.confirmation = {
    id: 'c',
    version: 1,
    inputs: legacy.inputs,
    dependencies: [],
    valid: true,
    factIds: ['legacy'],
  };
  expect(selectedFactIds(legacy)).toEqual(['legacy']);
});
it('does not repeat tool, frequency and date questions already answered for this experience', () => {
  const s = groundedSession();
  s.facts[0].text = 'Usei Excel diariamente desde 2020.';
  s.guided!.timeline = {
    anchors: [],
    completed: ['e'],
    latest: true,
    noProfessionalHistory: false,
    halted: false,
  };
  s.guided!.answered = ['guided:e:responsibility', 'guided:e:context'];
  expect(guidedQuestion(s)!.topic.id).toBe('guided:e:action');
  s.interview = {
    topics: {
      'guided:e:result': {
        status: 'sufficient',
        noGain: 0,
        evidence: [
          'resultado',
          'context',
          'período',
          'responsabilidade',
          'ferramenta',
          'frequência',
          'dificuldade',
        ],
        question: null,
      },
    },
    analyzedTurnIds: [],
    activeMs: 0,
    reviewRequested: false,
    limits: { reformulations: 2, turns: 100, answerChars: 10000, activeMs: 1200000 },
  };
  expect(guidedQuestion(s)).toBeNull();
});
import { applyGuidedBlock } from './guided';
it('uses the model followup in the shared policy without repeating it beyond the evidence limit', () => {
  let s = startGuided(initial());
  const q = guidedQuestion(s)!;
  s = guidedAnswer(s, {
    id: 't',
    question: { text: q.text, topicId: q.topic.id },
    answer: { text: 'Fazia tudo', kind: 'specific' },
    factIds: [],
  });
  const block = {
    version: 1 as const,
    revision: s.revision,
    extraction: { experiences: [], facts: [] },
    analysis: null,
    assessments: [
      {
        topicId: q.topic.id,
        sufficient: false,
        evidence: [],
        question: 'Qual foi uma atividade que você fez pessoalmente?',
        contradictionFactIds: [],
      },
    ],
  };
  let next = applyGuidedBlock(s, block, ['t'], 'h1');
  expect(guidedQuestion(next)!.text).toContain('sua primeira experiência profissional');
  expect(guidedQuestion(next)!.text).toContain('qual foi uma atividade');
  expect(next.turns[0].decision?.kind).toBe('ask');
  next = guidedAnswer(next, {
    id: 't2',
    question: { text: block.assessments[0].question, topicId: q.topic.id },
    answer: { text: 'Não lembro', kind: 'forgotten' },
    factIds: [],
  });
  const last = applyGuidedBlock(next, { ...block, revision: next.revision }, ['t2'], 'h2');
  expect(last.guided!.clarification).toBeNull();
  expect(last.turns[1].decision?.kind).toBe('clarify');
});
it('invalidates an automatic selection on new answers and handles legacy turns without decision metadata', () => {
  let s = completeGuided(groundedSession());
  s.phase = 'interview';
  s.guided!.status = 'interview';
  s.guided!.answered = [];
  const q = guidedQuestion(s)!;
  s = guidedAnswer(s, {
    id: 't',
    question: { text: q.text, topicId: q.topic.id },
    answer: { text: 'Outro contexto', kind: 'specific' },
    factIds: [],
  });
  expect(s.selection!.valid).toBe(false);
  delete s.turns[0].decision;
  const block = {
    version: 1 as const,
    revision: s.revision,
    extraction: { experiences: [], facts: [] },
    analysis: null,
    assessments: [
      {
        topicId: q.topic.id,
        sufficient: false,
        evidence: ['contexto'],
        question: 'Onde foi?',
        contradictionFactIds: [],
      },
    ],
  };
  expect(
    applyGuidedBlock(s, block, ['t'], 'x1').guided!.clarification?.topic.criterionId,
  ).toBeNull();
  const sufficient = {
    ...block,
    assessments: [{ ...block.assessments[0], sufficient: true, question: null }],
  };
  expect(applyGuidedBlock(s, sufficient, ['t'], 'x2').guided!.clarification).toBeNull();
  s.turns[0].decision = {
    kind: 'ask',
    reason: 'Vaga',
    criterionId: 'criterion',
    experienceId: 'experience',
  };
  expect(applyGuidedBlock(s, block, ['t'], 'x3').guided!.clarification?.topic).toMatchObject({
    criterionId: 'criterion',
    experienceId: 'experience',
  });
});
import { analysis as targetAnalysis } from './fixtures';
it('prioritizes the vacancy context when building the investigation question', () => {
  const s = groundedSession();
  s.criteria = structuredClone(targetAnalysis.criteria);
  const q = guidedQuestion(s)!;
  expect(q.topic.criterionId).toBe('c');
  expect(q.topic.reason).toBe(targetAnalysis.criteria[0].reason);
});
