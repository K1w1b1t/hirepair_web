import { createSession, canWrite } from './engine';
import { startGuided, applyGuidedBlock, completeGuided } from './guided';
import { preserveNegativeAnswer } from './negative-answer';
import { editFact, resolveFactConflict, discovery } from './interview';
import type { DiagnosticFinding } from './diagnostic';
import type { Turn } from './contracts';
function setup() {
  const s = startGuided(
    createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' }),
  );
  s.objective = { value: 'ENTER_FAST', provisional: false };
  const origin = { sourceId: 'cv', sourceVersion: 'v', quote: 'Usei Excel.' };
  s.experiences = [{ id: 'e', title: 'Loja', start: '2020', end: null, current: true, origin }];
  s.facts = ['excel', 'orders', 'other', 'removed'].map((id) => ({
    id,
    experienceId: id === 'other' ? 'other' : 'e',
    storyId: null,
    text: id === 'orders' ? 'Conferi pedidos.' : 'Usei Excel.',
    origin: id === 'orders' ? { ...origin, quote: 'Conferi pedidos.' } : origin,
    confirmation: id === 'removed' ? ('rejected' as const) : ('candidate' as const),
    externallyVerified: false,
    usable: true,
    revision: 1,
  }));
  const topic = { ...discovery, id: 'question', experienceId: 'e', criterionId: 'c' };
  const turn: Turn = {
    id: 't',
    question: { text: 'Você usou Excel?', topicId: topic.id },
    answer: { text: 'Não tenho essa experiência.', kind: 'absence' },
    factIds: [],
  };
  return { s, topic, turn };
}
it.each(['specific', 'unknown', 'declined'] as const)(
  'does not turn a %s response into a factual contradiction',
  (kind) => {
    const { s, topic, turn } = setup();
    turn.answer.kind = kind;
    expect(preserveNegativeAnswer(s, turn, topic)).toBe(s);
  },
);
it.each(['guided:first', 'guided:first-informal', 'guided:next:e'])(
  'does not negate the previous job when closing timeline discovery %s',
  (id) => {
    const { s, topic, turn } = setup();
    topic.id = id;
    expect(preserveNegativeAnswer(s, turn, topic)).toBe(s);
  },
);
it('blocks the scoped criterion evidence and invalidates dependent content without touching unrelated facts', () => {
  const { s, topic, turn } = setup();
  s.links = [
    {
      id: 'link',
      criterionId: 'c',
      experienceId: 'e',
      factIds: ['excel'],
      status: 'candidate',
      declarationTurnId: null,
    },
  ];
  const next = preserveNegativeAnswer(s, turn, topic);
  expect(next.facts.filter((f) => !f.usable).map((f) => f.id)).toEqual(['excel']);
  expect(next.inputs.facts).not.toBe(s.inputs.facts);
  expect(next.pending[0]).toMatchObject({
    id: 'negative:t',
    blocking: true,
    topicId: 'question',
    factIds: ['excel'],
  });
  expect(s.facts.every((f) => f.usable)).toBe(true);
});
it('blocks only facts matching the literal finding and permits explicit correction or removal to resolve the pending state', () => {
  const { s, topic, turn } = setup();
  const finding: DiagnosticFinding = {
    version: 1,
    id: 'finding',
    code: 'SKILL_NEEDS_EXAMPLE',
    severity: 'HIGH',
    nature: 'hypothesis',
    documentId: 'cv',
    documentHash: 'v',
    evidence: [{ start: 0, end: 5, quote: 'EXCEL' }],
    title: 'Habilidade',
    explanation: 'Falta exemplo',
    action: 'Esclarecer',
    investigation: { experienceId: 'e', missingEvidence: 'Exemplo' },
    restriction: null,
  };
  s.diagnostics = [
    {
      version: 1,
      rulesVersion: 2,
      contextVersion: 'j',
      status: 'available',
      document: null,
      findings: [finding],
      limitations: [],
    },
  ];
  const next = preserveNegativeAnswer(s, turn, { ...topic, diagnosticFindingId: 'finding' });
  expect(next.facts.filter((f) => !f.usable).map((f) => f.id)).toEqual(['excel']);
  const corrected = resolveFactConflict(
    editFact(next, 'excel', 'Usei Excel para conferir pedidos.', 'correction'),
    'excel',
  );
  expect(corrected.facts[0]).toMatchObject({
    usable: true,
    revision: 2,
    confirmation: 'candidate',
  });
  expect(corrected.pending).toEqual([]);
  corrected.guided!.timeline!.latest = true;
  expect(canWrite(completeGuided(corrected))).toBe(true);
  finding.evidence = [{ start: 0, end: 1, quote: ' ' }];
  expect(preserveNegativeAnswer(s, turn, { ...topic, diagnosticFindingId: 'finding' })).toBe(s);
  finding.evidence = [{ start: 0, end: 5, quote: 'Power BI' }];
  expect(preserveNegativeAnswer(s, turn, { ...topic, diagnosticFindingId: 'finding' })).toBe(s);
});
it('uses the experience scope when there is no narrower finding or criterion link', () => {
  const { s, topic, turn } = setup();
  const next = preserveNegativeAnswer(s, turn, topic);
  expect(next.facts.filter((f) => !f.usable).map((f) => f.id)).toEqual(['excel', 'orders']);
});
it('rejects a provider attempt to create resume facts from the absence itself', () => {
  const { s, topic, turn } = setup();
  s.turns = [turn];
  const next = preserveNegativeAnswer(s, turn, topic);
  expect(() =>
    applyGuidedBlock(
      next,
      {
        version: 1,
        revision: next.revision,
        extraction: {
          experiences: [],
          facts: [
            {
              id: 'invented',
              experienceId: 'e',
              text: 'Domínio de Excel',
              origin: { sourceId: 't', sourceVersion: 'v', quote: turn.answer.text },
            },
          ],
        },
        analysis: null,
        assessments: [],
      },
      ['t'],
      'hash',
    ),
  ).toThrow('NEGATIVE_ANSWER_IS_NOT_A_FACT');
  expect(next.facts[0].usable).toBe(false);
});
it('does not create another professional experience from a negative answer', () => {
  const { s, turn } = setup();
  s.turns = [turn];
  expect(() =>
    applyGuidedBlock(
      s,
      {
        version: 1,
        revision: s.revision,
        extraction: {
          facts: [],
          experiences: [
            {
              id: 'invented',
              title: 'Operador de Excel',
              start: null,
              end: null,
              current: null,
              origin: { sourceId: 't', sourceVersion: 'v', quote: turn.answer.text },
            },
          ],
        },
        analysis: null,
        assessments: [],
      },
      ['t'],
      'hash',
    ),
  ).toThrow('NEGATIVE_ANSWER_IS_NOT_A_FACT');
});
