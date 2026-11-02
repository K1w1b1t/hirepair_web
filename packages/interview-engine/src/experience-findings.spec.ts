import { createSession } from './engine';
import { startGuided, guidedQuestion, guidedAnswer, applyGuidedBlock } from './guided';
import { experienceFinding } from './experience-findings';
import { diagnoseDocument, type DiagnosticCode } from './diagnostic';
function fixture(code: DiagnosticCode = 'SKILL_NEEDS_EXAMPLE', assigned: string | null = null) {
  const s = startGuided(
    createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' }),
  );
  s.objective = { value: 'ENTER_FAST', provisional: false };
  s.experiences = [
    {
      id: 'e',
      title: 'Atendente na Loja Sol',
      start: '2020',
      end: null,
      current: true,
      origin: { sourceId: 'cv', sourceVersion: 'v', quote: 'Atendente' },
    },
  ];
  const report = diagnoseDocument({
    document: {
      id: 'cv',
      hash: 'v',
      text: 'Atendente\nHabilidades: Excel',
      usedInApplications: 'unknown',
    },
    contextVersion: 'j',
    nowMonth: 2026 * 12,
  });
  const f = report.findings.find((f) => f.investigation)!;
  f.code = code;
  f.investigation!.experienceId = assigned;
  s.diagnostics = [report];
  s.pending = [
    {
      id: 'p',
      diagnosticFindingId: f.id,
      criterionId: null,
      factIds: [],
      reason: f.action,
      blocking: false,
    },
  ];
  return { s, f, anchor: { experienceId: 'e', label: 'a experiência “Atendente na Loja Sol”' } };
}
it.each([
  ['SKILL_NEEDS_EXAMPLE', 'Excel'],
  ['SCOPE_NEEDS_SUPPORT', 'participação'],
  ['DATES_NEED_CLARIFICATION', 'período'],
  ['CHRONOLOGY_INTERVAL', 'intervalo'],
] as const)(
  'asks a concrete question about the %s finding in the candidate experience',
  (code, word) => {
    const { s, f, anchor } = fixture(code, 'e');
    const q = experienceFinding(s, anchor)!;
    expect(q.text).toContain('Atendente na Loja Sol');
    expect(q.text).toContain(word);
    expect(q.topic).toMatchObject({ diagnosticFindingId: f.id, experienceId: 'e' });
  },
);
it('does not assign a finding from another experience or document to the current job', () => {
  const { s, f, anchor } = fixture('DATES_NEED_CLARIFICATION', 'other');
  expect(experienceFinding(s, anchor)).toBeNull();
  f.investigation!.experienceId = null;
  f.documentId = 'other-cv';
  expect(experienceFinding(s, anchor)).toBeNull();
  expect(experienceFinding(s, { ...anchor, experienceId: null })).toBeNull();
  s.diagnostics = undefined;
  expect(experienceFinding(s, anchor)).toBeNull();
});
it('does not repeat an answered finding and resolves it only after semantic assessment', () => {
  const setup = fixture();
  let s = setup.s;
  const f = setup.f;
  const q = guidedQuestion(s)!;
  expect(q.topic.diagnosticFindingId).toBe(f.id);
  s = guidedAnswer(s, {
    id: 'answer',
    question: { text: q.text, topicId: q.topic.id },
    answer: { text: 'Eu conferia pedidos usando Excel.', kind: 'specific' },
    factIds: [],
  });
  expect(guidedQuestion(s)!.topic.id).not.toBe(q.topic.id);
  expect(s.pending).toHaveLength(1);
  s = applyGuidedBlock(
    s,
    {
      version: 1,
      revision: s.revision,
      extraction: { experiences: [], facts: [] },
      analysis: null,
      assessments: [
        {
          topicId: q.topic.id,
          sufficient: true,
          evidence: ['ferramenta'],
          question: null,
          contradictionFactIds: [],
        },
      ],
    },
    ['answer'],
    'h',
  );
  expect(s.pending).toHaveLength(0);
});
it('ignores unsupported investigation codes without inventing a question', () => {
  const { s, anchor } = fixture('REPEATED_TEXT');
  expect(experienceFinding(s, anchor)).toBeNull();
});
it('keeps an AI followup about a finding tied to its actual experience', () => {
  const setup = fixture('SKILL_NEEDS_EXAMPLE', 'e');
  let s = setup.s;
  const q = guidedQuestion(s)!;
  s = guidedAnswer(s, {
    id: 'answer',
    question: { text: q.text, topicId: q.topic.id },
    answer: { text: 'Eu fazia várias coisas.', kind: 'specific' },
    factIds: [],
  });
  s = applyGuidedBlock(
    s,
    {
      version: 1,
      revision: s.revision,
      extraction: { experiences: [], facts: [] },
      analysis: null,
      assessments: [
        {
          topicId: q.topic.id,
          sufficient: false,
          evidence: [],
          question: 'Em quais tarefas você usou esse recurso?',
          contradictionFactIds: [],
        },
      ],
    },
    ['answer'],
    'h',
  );
  expect(guidedQuestion(s)!.text).toContain('Atendente na Loja Sol');
  expect(guidedQuestion(s)!.text).not.toContain('sua primeira experiência profissional');
});
