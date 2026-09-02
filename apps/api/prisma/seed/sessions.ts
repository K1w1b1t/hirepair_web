import {
  ApplicationChannel,
  ApplicationStatus,
  Archetype,
  ExportChannel,
  ExportFormat,
  FindingKind,
  FindingSeverity,
  ImpactFormula,
  type PrismaClient,
  RequirementCategory,
  RequirementSituation,
  ResumeKind,
  SessionObjective,
  SessionPhase,
  StoryFactKind,
  StorySource,
  WritingTone,
} from '@prisma/client';

const IDS = {
  session: '00000000-0000-4000-8000-000000000100',
  document: '00000000-0000-4000-8000-000000000101',
  findingSensitive: '00000000-0000-4000-8000-000000000102',
  findingParsing: '00000000-0000-4000-8000-000000000103',
  story: '00000000-0000-4000-8000-000000000104',
  job: '00000000-0000-4000-8000-000000000105',
  export: '00000000-0000-4000-8000-000000000106',
  baselineApplication: '00000000-0000-4000-8000-000000000107',
} as const;

/**
 * Uma rodada completa da metodologia, do diagnostico ao curriculo gerado.
 *
 * Serve de fixture navegavel para o front e, sobretudo, exercita as relacoes que
 * um teste de fumaca nao alcancaria: transcricao -> fatos -> curriculo,
 * classificacao de requisito de vaga, e a candidatura de BASELINE (sem
 * `resumeId`), que e o caso que a secao 10 da metodologia trata como o dado mais
 * valioso do sistema.
 */
export async function seedSessions(prisma: PrismaClient, params: { userId: string }) {
  const session = await prisma.session.upsert({
    where: { publicCode: 'a1b2c3' },
    update: {},
    create: {
      id: IDS.session,
      userId: params.userId,
      publicCode: 'a1b2c3',
      objective: SessionObjective.ENTER_FAST,
      archetype: Archetype.C_OPERATIONAL,
      tone: WritingTone.WELCOMING,
      // ESCOPO, nao XYZ: a metodologia proibe XYZ nos arquetipos A e C, onde nao
      // ha numero que sustente a afirmacao.
      formula: ImpactFormula.SCOPE,
      phase: SessionPhase.RESUME,
    },
  });

  const target = await prisma.sessionTarget.upsert({
    where: {
      sessionId_role: { sessionId: session.id, role: 'Atendente de loja' },
    },
    update: {},
    create: { sessionId: session.id, role: 'Atendente de loja', sortOrder: 0 },
  });

  const document = await prisma.uploadedDocument.upsert({
    where: { id: IDS.document },
    update: {},
    create: {
      id: IDS.document,
      sessionId: session.id,
      fileName: 'curriculo-antigo.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 184_320,
      pageCount: 2,
      imageCount: 1,
      isBase: true,
      extractedText: 'JOANA RIBEIRO DA SILVA CPF 000.000.000-00 Atendentede padaria Guarulhos SP',
    },
  });

  await prisma.diagnosticFinding.upsert({
    where: { id: IDS.findingSensitive },
    update: {},
    create: {
      id: IDS.findingSensitive,
      sessionId: session.id,
      documentId: document.id,
      kind: FindingKind.SENSITIVE_DATA,
      severity: FindingSeverity.CRITICAL,
      message: 'Seu curriculo tem CPF. Isso nao ajuda na selecao e expoe seus dados — vamos tirar.',
      detail: { matches: ['CPF'] },
    },
  });

  await prisma.diagnosticFinding.upsert({
    where: { id: IDS.findingParsing },
    update: {},
    create: {
      id: IDS.findingParsing,
      sessionId: session.id,
      documentId: document.id,
      kind: FindingKind.PARSING,
      severity: FindingSeverity.HIGH,
      message: 'Algumas palavras estao colando uma na outra quando o sistema le o PDF.',
      detail: { glued: ['Atendentede'] },
    },
  });

  const story = await prisma.story.upsert({
    where: { id: IDS.story },
    update: {},
    create: {
      id: IDS.story,
      sessionId: session.id,
      label: 'padaria',
      source: StorySource.VOICE,
      transcript:
        'Eu atendo no balcao, monto a vitrine de manha e fecho o caixa quando a dona sai mais cedo.',
      // Audio descartado apos a transcricao: e a opcao mais segura em LGPD, e a
      // coluna existe para registrar que houve audio sem guardar o arquivo.
      audioDeletedAt: new Date('2026-09-01T12:05:00.000Z'),
      confirmedAt: new Date('2026-09-01T12:06:00.000Z'),
    },
  });

  const facts: { kind: StoryFactKind; value: string; isConfirmed: boolean }[] = [
    {
      kind: StoryFactKind.FACT,
      value: 'Atende no balcao e monta a vitrine no periodo da manha',
      isConfirmed: true,
    },
    {
      kind: StoryFactKind.FACT,
      value: 'Faz o fechamento de caixa na ausencia da proprietaria',
      isConfirmed: true,
    },
    { kind: StoryFactKind.TOOL, value: 'Sistema de PDV', isConfirmed: true },
    {
      kind: StoryFactKind.COMPETENCY,
      value: 'Responsabilidade por valores',
      isConfirmed: true,
    },
    {
      // Duvida devolvida a pessoa: enquanto nao confirmada, nao pode virar bullet.
      kind: StoryFactKind.QUESTION,
      value: 'Quantos clientes por dia, mais ou menos?',
      isConfirmed: false,
    },
  ];

  for (const [index, fact] of facts.entries()) {
    await prisma.storyFact.upsert({
      where: {
        id: `00000000-0000-4000-8000-00000000011${index}`,
      },
      update: {},
      create: {
        id: `00000000-0000-4000-8000-00000000011${index}`,
        storyId: story.id,
        sortOrder: index,
        ...fact,
      },
    });
  }

  const job = await prisma.job.upsert({
    where: { id: IDS.job },
    update: {},
    create: {
      id: IDS.job,
      sessionId: session.id,
      title: 'Atendente de loja',
      company: 'Rede Bom Preco',
      rawText:
        'Vaga para atendente de loja. Ensino medio completo. Disponibilidade para escala 6x1. Desejavel experiencia com PDV. Perfil dinamico e proativo.',
      // Recomendacao em texto, com o motivo. Nunca um score: numero daria falsa
      // precisao matematica a um julgamento que nao a tem.
      recommendation:
        'Vale tentar: voce atende o eliminatorio (ensino medio e escala) e ja usa PDV.',
    },
  });

  const requirements: {
    text: string;
    category: RequirementCategory;
    reason: string;
    situation: RequirementSituation;
  }[] = [
    {
      text: 'Ensino medio completo',
      category: RequirementCategory.ELIMINATORY,
      reason: 'Objetivo e verificavel por documento.',
      situation: RequirementSituation.HAS_AND_PRESENT,
    },
    {
      text: 'Disponibilidade para escala 6x1',
      category: RequirementCategory.ELIMINATORY,
      reason: 'Condicao de contratacao, nao habilidade.',
      situation: RequirementSituation.HAS_NOT_PRESENT,
    },
    {
      text: 'Desejavel experiencia com PDV',
      category: RequirementCategory.NEGOTIABLE,
      reason: 'O proprio anuncio marca como desejavel.',
      situation: RequirementSituation.HAS_NOT_PRESENT,
    },
    {
      text: 'Perfil dinamico e proativo',
      category: RequirementCategory.DECORATIVE,
      reason: 'Nao e verificavel nem elimina ninguem.',
      situation: RequirementSituation.DOES_NOT_HAVE,
    },
  ];

  for (const [index, requirement] of requirements.entries()) {
    await prisma.jobRequirement.upsert({
      where: { id: `00000000-0000-4000-8000-00000000012${index}` },
      update: {},
      create: {
        id: `00000000-0000-4000-8000-00000000012${index}`,
        jobId: job.id,
        sortOrder: index,
        ...requirement,
      },
    });
  }

  const resume = await prisma.resume.upsert({
    where: { sessionId_version: { sessionId: session.id, version: 1 } },
    update: {},
    create: {
      userId: params.userId,
      sessionId: session.id,
      sessionTargetId: target.id,
      kind: ResumeKind.DEFAULT,
      archetype: Archetype.C_OPERATIONAL,
      title: 'Atendente de loja',
      version: 1,
      // Coluna unica, sem tabela e sem icone: e a saida que um parser de ATS le
      // sem perder nada.
      contentMarkdown: [
        '# Joana Ribeiro da Silva',
        'Atendente de padaria',
        '',
        'Guarulhos/SP | +55 11 90000-0000 | joana.ribeiro@example.com',
        '',
        '## Experiencia',
        '',
        '**Atendente** - Padaria Sao Jorge (mar/2024 - atual)',
        '',
        '- Atende no balcao e monta a vitrine no periodo da manha.',
        '- Faz o fechamento de caixa na ausencia da proprietaria.',
        '',
      ].join('\n'),
      content: {
        nome: 'Joana Ribeiro da Silva',
        oficio: 'Atendente de padaria',
        contato: ['Guarulhos/SP', '+55 11 90000-0000', 'joana.ribeiro@example.com'],
        experiencias: [
          {
            cargo: 'Atendente',
            empresa: 'Padaria Sao Jorge',
            periodo: 'mar/2024 - atual',
            bullets: [
              'Atende no balcao e monta a vitrine no periodo da manha.',
              'Faz o fechamento de caixa na ausencia da proprietaria.',
            ],
          },
        ],
      },
    },
  });

  await prisma.resumeExport.upsert({
    where: { id: IDS.export },
    update: {},
    create: {
      id: IDS.export,
      resumeId: resume.id,
      format: ExportFormat.PDF,
      channel: ExportChannel.WHATSAPP,
    },
  });

  // Candidatura de BASELINE: enviada ANTES de usar o sistema, por isso sem
  // `resumeId` e sem `jobId`. E o que permite comparar depois se mudar o
  // curriculo mudou a taxa de resposta.
  await prisma.application.upsert({
    where: { id: IDS.baselineApplication },
    update: {},
    create: {
      id: IDS.baselineApplication,
      userId: params.userId,
      company: 'Supermercado Central',
      role: 'Operadora de caixa',
      channel: ApplicationChannel.IN_PERSON,
      appliedAt: new Date('2026-07-15T00:00:00.000Z'),
      status: ApplicationStatus.NO_REPLY,
      notes: 'Entregou impresso na loja. Sem retorno.',
    },
  });

  console.log(
    `Seed: sessao ${session.publicCode} (arquetipo C) com relato, vaga e curriculo v${resume.version}.`,
  );

  return { session, resume };
}
