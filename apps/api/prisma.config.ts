import { defineConfig } from 'prisma/config';
import { loadCliEnv } from './prisma/env';

loadCliEnv();

/**
 * A URL do datasource vive aqui, e nao no bloco `datasource db` do schema, para
 * que o CLI e a aplicacao leiam a mesma variavel de ambiente.
 *
 * `DIRECT_URL` antes de `DATABASE_URL` porque `prisma migrate` precisa de conexao
 * direta: em producao o `DATABASE_URL` aponta para o pooler em modo transaction do
 * Supabase (porta 6543), que nao sustenta a sessao longa nem o advisory lock que a
 * migration usa. Localmente as duas apontam para o mesmo Postgres do
 * docker-compose e a distincao nao importa.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
});
