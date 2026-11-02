import { createSession } from './engine';
import { startGuided, guidedQuestion, completeGuided, selectedFactIds } from './guided';
export const GUIDED_EVAL_CASES = [
  {
    id: 'with-resume',
    answer: 'Atendi clientes na loja.',
    pattern: 'Atividade sintética',
    imported: true,
  },
  {
    id: 'without-resume',
    answer: 'Organizei inscrições na feira.',
    pattern: 'primeira experiência profissional',
    imported: false,
  },
  {
    id: 'informal',
    answer: 'Fiz bicos de atendimento em uma feira.',
    pattern: 'primeira experiência profissional',
    imported: false,
  },
  {
    id: 'short-specific',
    answer: 'Usei Excel diariamente para conferir entradas e saídas.',
    pattern: 'primeira experiência profissional',
    imported: false,
  },
  {
    id: 'long-vague',
    answer: 'Sou muito dedicado e faço tudo com muita qualidade. '.repeat(8),
    pattern: 'primeira experiência profissional',
    imported: false,
    vague: true,
  },
  {
    id: 'negative',
    answer: 'Não tenho essa experiência.',
    pattern: 'primeira experiência profissional',
    imported: false,
    negative: true,
  },
  {
    id: 'contradiction',
    answer: 'Eu participei apenas da organização.',
    pattern: 'primeira experiência profissional',
    imported: false,
    conflict: true,
  },
  {
    id: 'corrected-transcription',
    answer: 'Conferi inscrições, não vendas.',
    pattern: 'primeira experiência profissional',
    imported: false,
  },
];
export function guidedEvalSession(item: (typeof GUIDED_EVAL_CASES)[number]) {
  let s = createSession('synthetic-session', 'synthetic-funnel', {
    resumes: 'r',
    job: 'j',
    objective: 'o',
    facts: 'f',
  });
  s.phase = 'interview';
  s.objective = { value: 'ENTER_FAST', provisional: false };
  const origin = { sourceId: 'synthetic', sourceVersion: 'v1', quote: item.answer };
  s.sources = [{ id: 'synthetic', version: 'v1', text: item.answer }];
  s.experiences = item.imported
    ? [{ id: 'exp', title: 'Atividade sintética', start: '2020', end: null, current: true, origin }]
    : [];
  const fact = {
    id: 'fact',
    experienceId: 'exp',
    storyId: null,
    text: item.answer,
    origin,
    confirmation: 'candidate' as const,
    externallyVerified: false,
    usable: true,
    revision: 1,
  };
  if (item.imported) s.facts = [fact];
  s = startGuided(s);
  return s;
}
export function runGuidedEval(item: (typeof GUIDED_EVAL_CASES)[number]) {
  const s = guidedEvalSession(item);
  const origin = { sourceId: 'synthetic', sourceVersion: 'v1', quote: item.answer };
  const fact = {
    id: 'fact',
    experienceId: 'exp',
    storyId: null,
    text: item.answer,
    origin,
    confirmation: 'candidate' as const,
    externallyVerified: false,
    usable: true,
    revision: 1,
  };
  const question = guidedQuestion(s)!.text;
  if (!item.negative && !item.vague) s.facts = [fact];
  if (item.conflict)
    s.pending = [
      { id: 'conflict', criterionId: null, factIds: ['fact'], reason: 'Sintético', blocking: true },
    ];
  // Selection fixtures describe a completed, synthetic single-experience history.
  s.guided!.timeline = {
    anchors: [],
    completed: [],
    latest: true,
    noProfessionalHistory: false,
    halted: false,
  };
  if (item.imported) s.guided!.timeline.completed = ['exp'];
  const result = completeGuided(s);
  const checks = {
    question: new RegExp(item.pattern, 'i').test(question),
    short: question.length <= 200,
    oneQuestion: question.split('?').length - 1 <= 1,
    grounded: result.selection!.facts.every((f) => f.id === 'fact'),
    noFabrication: !/(?:900%|milhões|avançado)/i.test(result.facts.map((f) => f.text).join(' ')),
    outcome:
      item.negative || item.vague || item.conflict
        ? result.guided!.status === 'partial'
        : selectedFactIds(result).length === 1,
  };
  return {
    id: item.id,
    checks,
    pass: Object.values(checks).every(Boolean),
    question,
    selectedFactIds: selectedFactIds(result),
  };
}
