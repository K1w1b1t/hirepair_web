import { createSession } from './engine';
import { parseResumeWriting, type ResumeDraft } from './writing';
import type { Experience, Strategy } from './contracts';
export const WRITING_RUBRIC_VERSION = 1;
/** Synthetic fixtures only. Structural checks do not establish semantic fidelity. */
type WritingCaseInput = [
  id: string,
  kind: Experience['kind'],
  archetype: Strategy['archetype'],
  fact: string,
  rejectedOutput?: string,
];
const writingInputs: WritingCaseInput[] = [
  ['school', 'project', 'A_FIRST_JOB', 'Organizou inscrições na feira escolar.'],
  ['informal', 'informal', 'A_FIRST_JOB', 'Atendeu clientes em uma feira.'],
  ['operational', 'work', 'C_OPERATIONAL', 'Conferiu entradas e saídas do estoque.'],
  ['transition', 'work', 'B_CAREER_CHANGE', 'Preparou materiais para atendimento.'],
  ['specialist', 'work', 'E_SPECIALIST', 'Desenvolveu consultas SQL para relatórios internos.'],
  [
    'inflated',
    'project',
    'A_FIRST_JOB',
    'Participou de projeto escolar.',
    'Liderou a produção e ampliou a receita em 900%.',
  ],
  [
    'unsupported-keyword',
    'work',
    'C_OPERATIONAL',
    'Conferiu entradas no estoque.',
    'Conferiu entradas usando SAP.',
  ],
];
export const WRITING_CASES = writingInputs.map(([id, kind, archetype, fact, rejectedOutput]) => ({
  id,
  kind,
  archetype,
  fact,
  output: rejectedOutput ?? fact,
  accepted: rejectedOutput === undefined,
}));

export function evaluateWritingFixture(item: (typeof WRITING_CASES)[number]) {
  const session = createSession('synthetic-writing', 'synthetic-funnel', {
    resumes: 'r',
    job: 'j',
    objective: 'o',
    facts: 'f',
  });
  session.objective = { value: 'ENTER_FAST', provisional: false };
  session.phase = 'ready';
  const origin = { sourceId: 'synthetic', sourceVersion: '1', quote: item.fact };
  session.experiences = [
    {
      id: 'experience',
      title: 'Experiência sintética',
      kind: item.kind,
      start: null,
      end: null,
      current: false,
      origin,
    },
  ];
  session.facts = [
    {
      id: 'fact',
      experienceId: 'experience',
      storyId: null,
      text: item.fact,
      origin,
      revision: 1,
      usable: true,
      confirmation: 'confirmed',
      externallyVerified: false,
    },
  ];
  session.confirmation = {
    id: 'confirmation',
    version: 1,
    inputs: session.inputs,
    dependencies: [],
    valid: true,
    factIds: ['fact'],
  };
  const content: ResumeDraft = {
    version: 1,
    explanation: 'Exemplo sintético para avaliação.',
    sections: [
      {
        id: 'section',
        title: 'Experiência',
        experienceId: 'experience',
        units: [{ id: 'bullet', text: item.output, factIds: ['fact'], criterionIds: [] }],
      },
    ],
  };
  let accepted = false;
  try {
    parseResumeWriting(JSON.stringify(content), session);
    accepted = true;
  } catch {
    accepted = false;
  }
  return {
    id: item.id,
    provenance: 'synthetic',
    structuralPass: accepted === item.accepted,
    accepted,
    humanReview: {
      status: 'pending',
      fidelity: null,
      relevance: null,
      clarity: null,
      proportionality: null,
      reviewer: null,
      failures: [],
    },
  };
}
