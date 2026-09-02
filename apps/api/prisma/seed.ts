import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { loadCliEnv } from './env';
import { seedSessions } from './seed/sessions';
import { seedUsers } from './seed/users';

loadCliEnv();

const connectionString = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];

if (!connectionString) {
  console.error('Seed abortado: defina DATABASE_URL (ou DIRECT_URL) no .env. Ver .env.example.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * Seed de desenvolvimento: dado de amostra, nao dado de configuracao.
 *
 * Todo write e `upsert` com `update: {}`, entao rodar duas vezes nao duplica nem
 * sobrescreve edicao feita a mao no banco local. Quando existir dado de
 * configuracao que precise ir a producao, ele vai num `seed.production.ts`
 * separado — nao aqui.
 */
async function main() {
  if (process.env['NODE_ENV'] === 'production') {
    console.error('Seed de desenvolvimento nao deve rodar em producao.');
    process.exit(1);
  }

  const { user } = await seedUsers(prisma);
  await seedSessions(prisma, { userId: user.id });

  console.log('Seed concluido.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
