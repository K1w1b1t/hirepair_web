-- Migration ESCRITA A MAO — excecao consciente a regra "sempre gerar com
-- `prisma migrate dev`" (AGENTS.md). O motivo: RLS e grants nao existem no DSL do
-- Prisma, entao nao ha diff a ser gerado. Toda alteracao aqui e manual e revisada.
--
-- POR QUE RLS, se a autorizacao e feita na camada NestJS
--
-- O Supabase publica AUTOMATICAMENTE todas as tabelas do schema `public` pela
-- Data API (PostgREST), acessivel com a chave anonima do projeto. Uma tabela
-- criada pelo Prisma sem RLS fica, por isso, legivel por qualquer um que tenha
-- essa chave — e Profile, Story e Resume sao recheados de dado pessoal (LGPD).
--
-- RLS habilitada SEM NENHUMA POLICY nega tudo. E exatamente o que queremos: a
-- Data API fica fechada, e o Prisma continua funcionando porque conecta com o
-- papel dono do schema, que faz bypass de RLS (nao usamos FORCE ROW LEVEL
-- SECURITY justamente para preservar esse bypass).
--
-- Consequencia pratica: acesso ao dado passa OBRIGATORIAMENTE pela API NestJS,
-- que e onde a regra de "cada um so ve o que e seu" e escrita e testada. Se algum
-- dia quisermos leitura direta do cliente, o caminho e adicionar policies
-- explicitas por tabela — nunca desabilitar RLS.
--
-- Uma tabela nova SEM linha aqui nasce exposta. O guarda em
-- src/prisma/schema-rls.spec.ts falha o `npm test` nesse caso.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserConsent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileExperience" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileEducation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileSkill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileLink" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UploadedDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DiagnosticFinding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobRequirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Resume" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ResumeExport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;

-- A tabela de controle do proprio Prisma tambem vive em `public` e tambem seria
-- publicada pela Data API. Nao tem dado pessoal, mas expoe o historico de schema
-- de graca — e deixa-la de fora abriria uma excecao no invariante "toda tabela em
-- public tem RLS", que e o que o guarda automatizado verifica.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Segunda camada, defesa em profundidade: retirar os grants dos papeis da Data
-- API. RLS ja bastaria, mas um `ENABLE` esquecido numa tabela futura deixaria de
-- ser uma brecha se o papel nem chega a ter privilegio.
--
-- Envolvido em DO/IF porque `anon` e `authenticated` sao papeis criados pelo
-- Supabase: no Postgres local do docker-compose eles nao existem, e um REVOKE
-- direto abortaria a migration. Cada papel e tratado de forma independente.
DO $$
DECLARE
  target_role text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      RAISE NOTICE 'Papel % ausente (Postgres local) — REVOKE ignorado.', target_role;
      CONTINUE;
    END IF;

    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', target_role);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', target_role);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', target_role);
    EXECUTE format('REVOKE ALL ON SCHEMA public FROM %I', target_role);

    -- Sem isto, cada tabela criada por uma migration FUTURA voltaria a nascer com
    -- os grants padrao do Supabase para esse papel. `current_user` porque as
    -- default privileges sao por papel criador, e quem cria e quem roda a
    -- migration (`postgres` no Supabase, `hirepair` no local).
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
      current_user, target_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
      current_user, target_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I',
      current_user, target_role
    );
  END LOOP;
END
$$;
