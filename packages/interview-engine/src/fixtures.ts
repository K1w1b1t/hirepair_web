import type { Extraction, CriteriaAnalysis } from './contracts';
export const source = {
  id: 'cv',
  version: 'v1',
  text: 'Atendeu clientes na loja entre 2020 e 2023.',
};
const origin = { sourceId: 'cv', sourceVersion: 'v1', quote: 'Atendeu clientes' };
export const extraction: Extraction = {
  experiences: [{ id: 'e', title: 'Loja', start: '2020', end: '2023', current: false, origin }],
  facts: [{ id: 'f', experienceId: 'e', text: 'Atendeu clientes', origin }],
};
export const analysis: CriteriaAnalysis = {
  criteria: [
    {
      id: 'c',
      text: 'Atendimento',
      kind: 'explicit',
      category: 'NEGOTIABLE',
      quote: 'Atendimento',
      reason: 'Entender o atendimento realizado',
      evidenceNeeded: 'Uma situação concreta',
      objectiveBasis: false,
      relevance: 3,
    },
  ],
  links: [
    {
      id: 'l',
      criterionId: 'c',
      experienceId: 'e',
      factIds: ['f'],
      status: 'candidate',
      declarationTurnId: null,
    },
  ],
  archetype: 'A_FIRST_JOB',
  reason: 'Experiências práticas com espaço para detalhar.',
};

/** Synthetic contract scenarios, never real participant records. */
export const cases = [
  {
    name: 'entry',
    archetype: 'A_FIRST_JOB',
    text: 'Organizei as inscrições de uma feira escolar.',
    answer: 'Eu organizava as inscrições e conferia os nomes.',
  },
  {
    name: 'operational',
    archetype: 'C_OPERATIONAL',
    text: 'Conferi entradas e saídas no estoque da loja.',
    answer: 'Usei a planilha diariamente para conferir entradas e saídas.',
  },
  {
    name: 'transition',
    archetype: 'B_CAREER_CHANGE',
    text: 'Atendi clientes e preparei material visual para a loja.',
    answer: 'Fazia de tudo um pouco.',
  },
  {
    name: 'same-field-return',
    archetype: 'D_SAME_FIELD_RETURN',
    text: 'Trabalhei com atendimento antes de uma pausa profissional.',
    answer: 'Não lembro o número de atendimentos.',
  },
  {
    name: 'specialist',
    archetype: 'E_SPECIALIST',
    text: 'Liderei toda a arquitetura e aumentei a produtividade em 900%.',
    answer: 'Era um projeto escolar; eu fiz uma parte do script.',
  },
].map((item) => {
  const origin = { sourceId: item.name, sourceVersion: 'v1', quote: item.text };
  return {
    ...item,
    provenance: 'synthetic' as const,
    source: { id: item.name, version: 'v1', text: item.text },
    extraction: {
      experiences: [{ ...extraction.experiences[0], origin }],
      facts: [{ ...extraction.facts[0], text: item.text, origin }],
    },
    analysis: { ...analysis, archetype: item.archetype as CriteriaAnalysis['archetype'] },
  };
});
