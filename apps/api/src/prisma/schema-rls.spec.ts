import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guarda do critério de aceite da issue #5 ("tabelas e RLS configurados").
 *
 * Le o schema e as migrations do disco e falha quando um modelo nao tem
 * `ENABLE ROW LEVEL SECURITY` em nenhuma migration. Roda no `npm test`, sem banco.
 *
 * Por que um teste, e nao so a migration: o Supabase publica automaticamente
 * todas as tabelas do schema `public` pela Data API (PostgREST). Um modelo novo
 * cujo `ENABLE` alguem esquecer de escrever nasce legivel por qualquer um com a
 * chave anonima do projeto — e o autor do modelo nao teria como saber disso. Este
 * teste transforma esse esquecimento silencioso numa falha de CI.
 */
const PRISMA_DIR = join(__dirname, '..', '..', 'prisma');
const MIGRATIONS_DIR = join(PRISMA_DIR, 'migrations');

/** Tabela de controle do Prisma: nao vem de um `model`, mas vive em `public`. */
const PRISMA_MIGRATIONS_TABLE = '_prisma_migrations';

function readSchemaModels(): string[] {
  const schema = readFileSync(join(PRISMA_DIR, 'schema.prisma'), 'utf8');
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);

  return models;
}

function readMigrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(join(MIGRATIONS_DIR, entry.name, 'migration.sql'), 'utf8'))
    .join('\n');
}

function tablesWithRlsEnabled(sql: string): Set<string> {
  const matches = sql.matchAll(/ALTER\s+TABLE\s+"([^"]+)"\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi);

  return new Set([...matches].map((match) => match[1]));
}

describe('RLS nas migrations', () => {
  const models = readSchemaModels();
  const sql = readMigrationsSql();
  const enabled = tablesWithRlsEnabled(sql);

  it('encontra os modelos do schema', () => {
    // Sanidade dos regex acima: se a leitura falhar silenciosamente, os testes
    // seguintes passariam sem verificar nada.
    expect(models.length).toBeGreaterThan(0);
    expect(models).toContain('User');
  });

  it.each(readSchemaModels())('habilita row level security na tabela %s', (model) => {
    expect(enabled.has(model)).toBe(true);
  });

  it('habilita row level security na tabela de controle do Prisma', () => {
    expect(enabled.has(PRISMA_MIGRATIONS_TABLE)).toBe(true);
  });

  it('nao cria policy permissiva', () => {
    // RLS habilitada SEM policy nega tudo, e e disso que depende o fechamento da
    // Data API. Uma `CREATE POLICY` aqui seria uma abertura — legitima, talvez,
    // mas precisa ser uma decisao consciente que atualiza este teste e o
    // docs/database/README.md, nao um efeito colateral de outra migration.
    expect(sql).not.toMatch(/CREATE\s+POLICY/i);
  });

  it('nao usa FORCE ROW LEVEL SECURITY', () => {
    // FORCE faria a RLS valer tambem para o dono da tabela — que e justamente o
    // papel com que o Prisma conecta. Ativar isso sem policy nenhuma deixaria a
    // aplicacao sem acesso ao proprio banco.
    expect(sql).not.toMatch(/FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
  });
});
