import {
  ConsentType,
  EducationStatus,
  type PrismaClient,
  ProfileSkillKind,
  UserRole,
  UserStatus,
} from '@prisma/client';

/**
 * Ids fixos para o dado de amostra.
 *
 * Sem chave natural em `ProfileExperience` e `ProfileEducation`, o id e o que
 * torna o `upsert` idempotente: sem ele cada `db:seed` criaria uma experiencia
 * nova. Sao uuids validos e reconheciveis de proposito.
 */
export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEV_PROFILE_ID = '00000000-0000-4000-8000-000000000002';

const DEV_EXPERIENCE_IDS = {
  bakery: '00000000-0000-4000-8000-000000000010',
  market: '00000000-0000-4000-8000-000000000011',
} as const;

const DEV_EDUCATION_ID = '00000000-0000-4000-8000-000000000020';

/** Email do usuario de desenvolvimento. Tambem usado pelos testes manuais. */
export const DEV_USER_EMAIL = 'dev@hirepair.local';

/**
 * Usuario de desenvolvimento com perfil profissional preenchido.
 *
 * O perfil e proposital: uma pessoa do arquetipo C (operacional), que e a persona
 * primaria do MVP — experiencia informal, sem numero para sustentar formula XYZ, e
 * um curso tecnico concluido, que e o gatilho do orientador proativo de carreira.
 *
 * `passwordHash` fica nulo: a task de autenticacao ainda nao existe, e semear um
 * hash inventado daria a impressao falsa de que ha uma senha conhecida. O login
 * local sera semeado pela task que implementar o hashing de verdade.
 */
export async function seedUsers(prisma: PrismaClient) {
  const user = await prisma.user.upsert({
    where: { email: DEV_USER_EMAIL },
    // `update: {}` em todo o seed: reexecutar nunca sobrescreve uma edicao feita
    // a mao no banco local.
    update: {},
    create: {
      id: DEV_USER_ID,
      email: DEV_USER_EMAIL,
      status: UserStatus.ACTIVE,
      role: UserRole.CANDIDATE,
      emailVerifiedAt: new Date('2026-09-01T12:00:00.000Z'),
    },
  });

  await prisma.userConsent.upsert({
    where: { id: '00000000-0000-4000-8000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000003',
      userId: user.id,
      type: ConsentType.TERMS,
      version: '2026-09-01',
      ipAddress: '127.0.0.1',
    },
  });

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      id: DEV_PROFILE_ID,
      userId: user.id,
      fullName: 'Joana Ribeiro da Silva',
      headline: 'Atendente de padaria',
      phone: '+55 11 90000-0000',
      contactEmail: 'joana.ribeiro@example.com',
      city: 'Guarulhos',
      state: 'SP',
      objective: 'Trabalhar como atendente em padaria ou mercado, com carteira assinada.',
    },
  });

  await prisma.profileExperience.upsert({
    where: { id: DEV_EXPERIENCE_IDS.bakery },
    update: {},
    create: {
      id: DEV_EXPERIENCE_IDS.bakery,
      profileId: profile.id,
      role: 'Atendente',
      company: 'Padaria Sao Jorge',
      startedOn: new Date('2024-03-01'),
      isCurrent: true,
      description: 'Atendimento no balcao, montagem de vitrine e fechamento de caixa.',
      sortOrder: 0,
    },
  });

  await prisma.profileExperience.upsert({
    where: { id: DEV_EXPERIENCE_IDS.market },
    update: {},
    create: {
      id: DEV_EXPERIENCE_IDS.market,
      profileId: profile.id,
      role: 'Repositora',
      company: 'Mercado do Bairro',
      startedOn: new Date('2022-06-01'),
      endedOn: new Date('2023-11-01'),
      // Vinculo informal: conta na linha do tempo, mas fica fora do calculo de
      // meses formais que sugere o arquetipo.
      isInformal: true,
      description: 'Reposicao de mercadoria e controle de validade.',
      sortOrder: 1,
    },
  });

  await prisma.profileEducation.upsert({
    where: { id: DEV_EDUCATION_ID },
    update: {},
    create: {
      id: DEV_EDUCATION_ID,
      profileId: profile.id,
      course: 'Tecnico em Administracao',
      institution: 'ETEC',
      startedOn: new Date('2023-02-01'),
      endedOn: new Date('2025-12-01'),
      // COMPLETED de proposito: e o caso que dispara o alerta proativo de que a
      // formacao ja qualifica para vaga acima de "atendente".
      status: EducationStatus.COMPLETED,
    },
  });

  const skills: { name: string; kind: ProfileSkillKind }[] = [
    { name: 'Atendimento ao cliente', kind: ProfileSkillKind.SKILL },
    { name: 'Fechamento de caixa', kind: ProfileSkillKind.SKILL },
    { name: 'Sistema de PDV', kind: ProfileSkillKind.TOOL },
  ];

  for (const skill of skills) {
    await prisma.profileSkill.upsert({
      where: {
        profileId_kind_name: {
          profileId: profile.id,
          kind: skill.kind,
          name: skill.name,
        },
      },
      update: {},
      create: { ...skill, profileId: profile.id, isConfirmed: true },
    });
  }

  console.log(`Seed: usuario ${user.email} e perfil de amostra prontos.`);

  return { user, profile };
}
