/** Product-owned synthetic examples. These describe writing quality, never candidate facts. */
export const KNOWLEDGE_VERSION = '2026-11-guided-1';
export const RESUME_KNOWLEDGE = [
  {
    id: 'general',
    tags: [],
    example:
      'Descrever atividade, participação individual e resultado observado, mesmo sem números.',
    question:
      'Conte uma atividade que você fez e que gostaria de aproveitar no seu próximo trabalho.',
  },
  {
    id: 'first-job',
    tags: ['escola', 'curso', 'projeto', 'estud'],
    example: 'Organização de inscrições de um projeto escolar, com escopo declarado.',
    question: 'Em algum projeto ou atividade da escola, o que ficou por sua conta?',
  },
  {
    id: 'informal',
    tags: ['informal', 'bico', 'família', 'familia', 'autônom'],
    example: 'Atendimento em atividade informal, sem inventar vínculo ou cargo.',
    question: 'Quando você ajudava nessa atividade, o que fazia pessoalmente?',
  },
  {
    id: 'operational',
    tags: ['estoque', 'atendimento', 'produção', 'loja'],
    example: 'Atividade operacional descrita com rotina e ferramentas realmente mencionadas.',
    question: 'Como era um dia comum nessa atividade?',
  },
  {
    id: 'transition',
    tags: ['transição', 'mudar', 'outra área'],
    example: 'Destacar uma experiência transferível sem atribuir experiência na nova profissão.',
    question: 'Qual atividade anterior você acha que pode ajudar nessa nova área?',
  },
  {
    id: 'specialist',
    tags: ['desenvolv', 'engenh', 'especialista', 'arquitet'],
    example: 'Distinguir participação pessoal do trabalho da equipe e dos resultados coletivos.',
    question: 'Nesse projeto, qual parte você realizou pessoalmente?',
  },
] as const;
export function knowledgeFor(text: string) {
  const lower = text.toLocaleLowerCase('pt-BR');
  return [
    RESUME_KNOWLEDGE[0],
    ...RESUME_KNOWLEDGE.slice(1).filter((item) => item.tags.some((tag) => lower.includes(tag))),
  ].slice(0, 2);
}
