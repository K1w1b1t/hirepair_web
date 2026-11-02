import { createSession } from './engine';
import { parseResumeWriting, type ResumeDraft } from './writing';
import type { Experience, Strategy } from './contracts';
export const WRITING_RUBRIC_VERSION = 1;
/** Synthetic fixtures only. Structural checks do not establish semantic fidelity. */
export const WRITING_CASES: Array<{
  id: string;
  kind: Experience['kind'];
  archetype: Strategy['archetype'];
  fact: string;
  output: string;
  accepted: boolean;
}> = [
  {
    id: 'school',
    kind: 'project',
    archetype: 'A_FIRST_JOB',
    fact: 'Organizou inscrições na feira escolar.',
    output: 'Organizou inscrições na feira escolar.',
    accepted: true,
  },
  {
    id: 'informal',
    kind: 'informal',
    archetype: 'A_FIRST_JOB',
    fact: 'Atendeu clientes em uma feira.',
    output: 'Atendeu clientes em uma feira.',
    accepted: true,
  },
  {
    id: 'operational',
    kind: 'work',
    archetype: 'C_OPERATIONAL',
    fact: 'Conferiu entradas e saídas do estoque.',
    output: 'Conferiu entradas e saídas do estoque.',
    accepted: true,
  },
  {
    id: 'transition',
    kind: 'work',
    archetype: 'B_CAREER_CHANGE',
    fact: 'Preparou materiais para atendimento.',
    output: 'Preparou materiais para atendimento.',
    accepted: true,
  },
  {
    id: 'specialist',
    kind: 'work',
    archetype: 'E_SPECIALIST',
    fact: 'Desenvolveu consultas SQL para relatórios internos.',
    output: 'Desenvolveu consultas SQL para relatórios internos.',
    accepted: true,
  },
  {
    id: 'inflated',
    kind: 'project',
    archetype: 'A_FIRST_JOB',
    fact: 'Participou de projeto escolar.',
    output: 'Liderou a produção e ampliou a receita em 900%.',
    accepted: false,
  },
  {
    id: 'unsupported-keyword',
    kind: 'work',
    archetype: 'C_OPERATIONAL',
    fact: 'Conferiu entradas no estoque.',
    output: 'Conferiu entradas usando SAP.',
    accepted: false,
  },
];
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
