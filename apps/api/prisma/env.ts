import { config as loadDotenv } from 'dotenv';

/**
 * Carrega o `.env` para as ferramentas de linha de comando do Prisma (config do
 * CLI e seed).
 *
 * Existe porque o `.env` deste monorepo vive na raiz, e nao em `apps/api`, mas os
 * comandos do Prisma rodam com o CWD em `apps/api` — um `import 'dotenv/config'`
 * simples nao acharia o arquivo. O primeiro caminho que definir uma variavel
 * ganha, entao um `.env` local do app sobrepoe o da raiz quando existir.
 *
 * A aplicacao NestJS NAO usa esta funcao: la o carregamento e do `ConfigModule`.
 */
export function loadCliEnv(): void {
  loadDotenv({ path: ['.env', '../../.env'], quiet: true });
}
