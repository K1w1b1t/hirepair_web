import { createSession } from './engine';
import {
  startGuided,
  guidedQuestion,
  guidedAnswer,
  completeGuided,
  applyGuidedBlock,
} from './guided';
import type { Session, Experience } from './contracts';
function session(experiences: Experience[] = []) {
  const s = createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  s.objective = { value: 'ENTER_FAST', provisional: false };
  s.experiences = experiences;
  return startGuided(s);
}
function answer(s: Session, text: string, kind: 'specific' | 'absence' = 'specific') {
  const q = guidedQuestion(s)!;
  return guidedAnswer(s, {
    id: `t${s.turns.length}`,
    question: { text: q.text, topicId: q.topic.id },
    answer: { text, kind },
    factIds: [],
  });
}
const experience = (
  id: string,
  title: string,
  start: string | null,
  current = false,
): Experience => ({
  id,
  title,
  start,
  end: null,
  current,
  origin: { sourceId: 'cv', sourceVersion: 'v', quote: title },
});
import { syncTimeline, timelineFinished, contextualFollowup } from './timeline';
it('asks for the first professional experience when no resume or experience exists', () => {
  expect(guidedQuestion(session())!.text).toMatch(/primeira experiência profissional/i);
  expect(guidedQuestion(session())!.text).not.toMatch(
    /conte uma atividade|gostaria de aproveitar/i,
  );
});
it('walks all imported experiences in chronological order, then deepens the current one', () => {
  let s = session([
    experience('c', 'Gerente', '2024', true),
    experience('a', 'Auxiliar', '2018'),
    experience('b', 'Atendente', '2021'),
  ]);
  for (const title of ['Auxiliar', 'Atendente', 'Gerente']) {
    expect(guidedQuestion(s)!.text).toContain(title);
    s = answer(s, `Eu cuidava dos pedidos como ${title}.`);
  }
  expect(timelineFinished(s)).toBe(true);
  for (const response of [
    'Na Loja Azul.',
    'Usava um caderno.',
    'Diariamente.',
    'Organizei os pedidos atrasados.',
    'Os pedidos foram entregues.',
  ]) {
    expect(guidedQuestion(s)!.text).toContain('Gerente');
    s = answer(s, response);
  }
  expect(guidedQuestion(s)).toBeNull();
});
it('orders month/year dates chronologically across supported imported formats', () => {
  const s = session([
    experience('new', 'Atual', '01/2024', true),
    experience('old', 'Primeiro', '12/2018'),
    experience('middle', 'Segundo', '2020-03'),
    experience('unknown', 'Sem data', 'aproximado'),
  ]);
  expect(guidedQuestion(s)!.topic.experienceId).toBe('old');
  expect(guidedQuestion(answer(s, 'Embalava pedidos.'))!.topic.experienceId).toBe('middle');
});
it('does not reuse dates, tools or model evidence from another experience', () => {
  let s = session([experience('a', 'Auxiliar', '2018'), experience('b', 'Atendente', null)]);
  s = answer(s, 'Usei Excel diariamente desde 2018 para conferir pedidos.');
  expect(guidedQuestion(s)!.topic.id).toBe('guided:b:period');
  s = answer(s, 'Em 2024.');
  s = answer(s, 'Atendi clientes.');
  expect(guidedQuestion(s)!.text).toContain('Depois da experiência “Atendente”');
  s = answer(s, 'Essa foi a última.');
  s = answer(s, 'No Mercado Sol.');
  expect(guidedQuestion(s)!.topic.id).toBe('guided:b:tools');
  expect(s.turns.at(-2)!.answer.kind).toBe('absence');
});
it('binds a narrated anchor to validated extraction without losing its answered questions', () => {
  let s = answer(session(), 'Minha primeira experiência foi na padaria.');
  s = answer(s, 'De 2018 a 2019.');
  s = answer(s, 'Eu embalava pedidos.');
  const t = s.turns[0],
    origin = { sourceId: t.id, sourceVersion: 'v', quote: t.answer.text };
  s = applyGuidedBlock(
    s,
    {
      version: 1,
      revision: s.revision,
      extraction: {
        experiences: [{ ...experience('padaria', 'Auxiliar na Padaria', null), origin }],
        facts: [],
      },
      analysis: null,
      assessments: [
        {
          topicId: t.question.topicId,
          sufficient: true,
          evidence: [],
          question: null,
          contradictionFactIds: [],
        },
      ],
    },
    [t.id],
    'h',
  );
  expect(syncTimeline(s).anchors).toHaveLength(1);
  expect(syncTimeline(s).anchors[0].experienceId).toBe('padaria');
  expect(guidedQuestion(s)!.text).toContain('Depois da experiência “Auxiliar na Padaria”');
  const restored = startGuided(structuredClone(s));
  expect(guidedQuestion(restored)).toEqual(guidedQuestion(s));
});
it('accepts an explicit lack of professional history and asks about a first concrete informal experience', () => {
  let s = answer(session(), 'Nunca trabalhei.');
  expect(s.turns[0].answer.kind).toBe('absence');
  expect(guidedQuestion(s)!.text).toContain('primeira experiência em um projeto');
  s = answer(s, 'Organizei inscrições em um projeto escolar.');
  expect(guidedQuestion(s)!.text).toContain('sua primeira experiência em um projeto');
  expect(s.facts).toEqual([]);
  const absent = answer(
    answer(session(), 'Não tenho experiência profissional.'),
    'Não tenho',
    'absence',
  );
  expect(guidedQuestion(absent)).toBeNull();
  expect(completeGuided(absent).guided!.status).toBe('partial');
});
it('halts unknown next experience without pretending the timeline is complete', () => {
  let s = session([experience('old', 'Auxiliar', '2018')]);
  s = answer(s, 'Eu embalava pedidos.');
  const q = guidedQuestion(s)!;
  s = guidedAnswer(s, {
    id: 'unknown',
    question: { text: q.text, topicId: q.topic.id },
    answer: { text: 'Não lembro', kind: 'forgotten' },
    factIds: [],
  });
  expect(guidedQuestion(s)).toBeNull();
  expect(timelineFinished(s)).toBe(false);
  expect(completeGuided(s).selection!.valid).toBe(false);
});
it('keeps model clarifications tied to the relevant earlier experience', () => {
  let s = session([experience('a', 'Auxiliar', '2018'), experience('b', 'Gerente', '2024', true)]);
  s = answer(s, 'Eu embalava pedidos.');
  expect(guidedQuestion(s)!.text).toContain('Gerente');
  expect(contextualFollowup(s, 'guided:a:responsibility', 'Qual era a sua participação?')).toBe(
    'Sobre a experiência “Auxiliar · 2018”, qual era a sua participação?',
  );
  expect(contextualFollowup(s, 'legacy', 'Conte mais.')).toContain(
    'primeira experiência profissional',
  );
  s.guided!.timeline!.noProfessionalHistory = true;
  expect(contextualFollowup(s, 'legacy', 'Conte mais.')).toContain(
    'primeira experiência em um projeto',
  );
});
it('distinguishes repeated roles by their declared place and period', () => {
  const s = session([
    { ...experience('a', 'Atendente', '2018'), place: 'Mercado Sol' },
    { ...experience('b', 'Atendente', '2024', true), place: 'Loja Azul' },
  ]);
  expect(guidedQuestion(s)!.text).toContain('Atendente · Mercado Sol · 2018');
  expect(guidedQuestion(answer(s, 'Cuidava dos pedidos.'))!.text).toContain(
    'Atendente · Loja Azul · 2024',
  );
});
it('uses stable ordering without inventing dates and migrates an existing interview', () => {
  const s = session([
    experience('b', 'Última sem data', null),
    experience('a', 'Primeira sem data', null),
  ]);
  delete s.guided!.timeline;
  const restored = startGuided(s);
  expect(guidedQuestion(restored)!.topic.experienceId).toBe('a');
  expect(restored.experiences.map((e) => e.start)).toEqual([null, null]);
  expect(startGuided(restored)).toBe(restored);
});
it('does not finish early when the turn cap is reached before the latest experience', () => {
  const s = answer(session(), 'Trabalhei numa padaria.');
  s.guided!.maxAnswers = 1;
  expect(guidedQuestion(s)).toBeNull();
  expect(completeGuided(s).guided!.status).toBe('partial');
  expect(completeGuided(s).turns[0].answer.text).toBe('Trabalhei numa padaria.');
});
it('continues to a second narrated job without claiming it is already the latest', () => {
  let s = answer(session(), 'Fui auxiliar na padaria.');
  s = answer(s, 'Em 2018.');
  s = answer(s, 'Embalava pedidos.');
  s = answer(s, 'Depois fui atendente no Mercado Sol.');
  expect(s.guided!.timeline!.latest).toBe(false);
  expect(guidedQuestion(s)!.text).toContain('sua 2ª experiência profissional');
});
it('ignores model dimensions from other experiences and can represent an empty finished timeline', () => {
  const s = session([
    experience('a', 'Auxiliar', '2018'),
    experience('b', 'Gerente', '2024', true),
  ]);
  s.interview = {
    topics: {
      'guided:b:period': { status: 'sufficient', noGain: 0, evidence: ['período'], question: null },
    },
    analyzedTurnIds: [],
    activeMs: 0,
    reviewRequested: false,
    limits: { reformulations: 2, turns: 100, answerChars: 10000, activeMs: 1200000 },
  };
  expect(guidedQuestion(s)!.topic.id).toBe('guided:a:responsibility');
  const empty = session();
  empty.guided!.timeline!.latest = true;
  expect(guidedQuestion(empty)).toBeNull();
});
it('anchors every followup to the experience supplied in the resume and starts with the earliest', () => {
  const s = session([
    experience('last', 'Supervisora na Loja Azul', '2024', true),
    experience('first', 'Auxiliar no Mercado Sol', '2018'),
  ]);
  expect(guidedQuestion(s)!.text).toContain('Auxiliar no Mercado Sol');
  expect(guidedQuestion(s)!.topic.experienceId).toBe('first');
});
it('continues from the first narrated experience toward the latest instead of ending after one activity', () => {
  let s = answer(session(), 'Fui auxiliar na padaria.');
  expect(guidedQuestion(s)!.text).toMatch(/primeira experiência profissional/i);
  s = answer(s, 'De 2018 a 2019.');
  s = answer(s, 'Eu embalava os pedidos.');
  expect(guidedQuestion(s)!.text).toMatch(
    /depois.*próxima experiência|próxima experiência.*depois/i,
  );
  s = answer(s, 'Atualmente sou atendente no Mercado Sol.');
  expect(guidedQuestion(s)!.text).toMatch(/experiência.*(?:atual|recente)/i);
});

import { diagnoseDocument } from './diagnostic';
it('clarifies the same narrated experience without creating another job', () => {
  const first = session(),
    q = guidedQuestion(first)!;
  let s = answer(first, 'Eu fazia várias coisas.');
  s.guided!.clarification = {
    topic: q.topic,
    question: 'Em qual lugar foi essa primeira experiência?',
  };
  s = answer(s, 'Na Padaria Sol.');
  expect(syncTimeline(s).anchors).toHaveLength(1);
  const turn = s.turns[1],
    origin = { sourceId: turn.id, sourceVersion: 'v', quote: turn.answer.text };
  s = applyGuidedBlock(
    s,
    {
      version: 1,
      revision: s.revision,
      extraction: {
        experiences: [{ ...experience('padaria', 'Auxiliar na Padaria Sol', null), origin }],
        facts: [],
      },
      analysis: null,
      assessments: [
        {
          topicId: q.topic.id,
          sufficient: true,
          evidence: ['contexto'],
          question: null,
          contradictionFactIds: [],
        },
      ],
    },
    [turn.id],
    'hash',
  );
  expect(syncTimeline(s).anchors).toHaveLength(1);
  expect(syncTimeline(s).anchors[0].experienceId).toBe('padaria');
});
it('prioritizes a concrete finding in the relevant experience instead of a generic questionnaire', () => {
  const s = session([
    {
      ...experience('a', 'Auxiliar', '2018'),
      origin: { sourceId: 'cv', sourceVersion: 'v', quote: 'Auxiliar' },
    },
  ]);
  const report = diagnoseDocument({
    document: {
      id: 'cv',
      hash: 'v',
      text: 'Auxiliar\nHabilidades: Excel',
      usedInApplications: 'unknown',
    },
    contextVersion: 'j',
    nowMonth: 2026 * 12,
  });
  s.diagnostics = [report];
  s.pending = report.findings
    .filter((f) => f.investigation)
    .map((f) => ({
      id: f.id,
      diagnosticFindingId: f.id,
      criterionId: null,
      factIds: [],
      reason: f.action,
      blocking: false,
    }));
  const q = guidedQuestion(s)!;
  expect(q.text).toContain('Auxiliar');
  expect(q.text).toContain('Excel');
  expect(q.topic.diagnosticFindingId).toBeDefined();
});
