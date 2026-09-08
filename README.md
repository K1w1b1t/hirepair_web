# Candidate Assistant

Aplicativo **mobile-first (React Native)**, **offline-first**, para ajudar
brasileiros a montar currículos que passem na triagem automática (ATS) e caibam no
WhatsApp — sem cobrança predatória.

## A ideia

No Brasil, fazer um bom currículo é uma dificuldade real e disseminada. Os apps que
existem ou são caros e cheios de "pegadinhas" de cobrança, ou geram currículos
bonitos que a IA dos ATS (Gupy, Kenoby, etc.) não consegue ler. Este produto ataca
os dois pontos:

- **Funciona offline:** monta e gera o PDF localmente, sem gastar a franquia de
  dados — pensado para quem tem acesso precário à internet.
- **PDF compatível com ATS:** estrutura limpa, sem colunas/tabelas/imagens que
  quebram o parser dos robôs de recrutamento.
- **Sem cobrança enganosa:** claro sobre o que é grátis e o que é pago.

### Dois públicos

- **Baixa renda / operacional** — plano **gratuito**: monta, exporta PDF e envia por
  WhatsApp/e-mail rodando local. Monetização via anúncios discretos (quando online).
- **Transição de carreira** — plano **premium**: login com Google, currículos salvos
  na conta e **IA para otimizar** o currículo (reescrever experiências, inserir
  palavras-chave de ATS), pago por currículo.

## Protótipo visual estático

O exemplo navegável de interface fica em [`docs/design/web/`](./docs/design/web/). Ele é um conjunto de páginas HTML, CSS, assets e pequenas simulações locais para comunicar o fluxo e o sistema visual do HirePair. Não há servidor, API, persistência ou dados reais.

Para visualizar, abra [`docs/design/web/index.html`](./docs/design/web/index.html) diretamente no navegador. As convenções, telas e decisões de implementação estão descritas no [guia do protótipo](./docs/design/web/README.md).

## Aplicação

Backend & Frontend do produto (**Next.js** + **NestJS** + **Prisma** + **PostgreSQL** & **Redis** via **Docker Compose**).
O monorepo está organizado em `apps/web` (Next.js App Router, React 19, Tailwind v4, TypeScript) e `apps/api` (NestJS API, Prisma 7).

Em produção o Postgres é o **Supabase**, consumido apenas pela connection string —
não usamos a CLI do Supabase nem Supabase Auth. Detalhes do schema, da política de
RLS e do fluxo de migration em [`docs/database/`](./docs/database/README.md).

## 🚀 Execução do Monorepo

### Deploy do frontend na Vercel

O projeto pode ser conectado à Vercel pela raiz deste repositório. O
[`vercel.json`](./vercel.json) restringe a instalação e o build ao workspace
`@hirepair/web`, para que o deploy do frontend não execute o `postinstall` nem
o build da API. Configure `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_SITE_URL` nas
variáveis de ambiente do projeto Vercel para cada ambiente de deploy.

### Pré-requisitos

- Node.js (v20 ou superior)
- Docker & Docker Compose

### Instalação e Comandos Básicos

```bash
# Copiar variáveis de ambiente
cp .env.example .env

# Subir banco de dados Postgres (porta 5434) e Redis (porta 6379)
npm run db:up

# Criar o schema no banco e popular com dado de amostra
npm run db:migrate
npm run db:seed

# Rodar a aplicação Web (Next.js - http://localhost:3000)
npm run dev:web

# Rodar a API Backend (NestJS - http://localhost:3001)
npm run dev:api

# Executar lint em todos os pacotes
npm run lint

# Verificar formatação (Prettier)
npm run format:check

# Executar verificação de tipos em todos os pacotes
npm run typecheck

# Executar os testes de todos os pacotes
npm run test

# Executar build de produção
npm run build
```

## 🗄️ Operando o banco de dados

**Prisma 7** é o ORM e a ferramenta de migration. Localmente o banco é o Postgres
16 do `docker-compose.yml`; em produção é o **Supabase**, que entra apenas pela
connection string. Não usamos a CLI do Supabase, nem Supabase Auth.

O modelo de dados, a decisão de RLS e as convenções do schema estão em
[`docs/database/README.md`](./docs/database/README.md). Abaixo é o dia a dia.

### Referência dos comandos

Todos existem na raiz do monorepo e repassam para `apps/api`.

| Comando               | O que faz                                                                            |
| :-------------------- | :----------------------------------------------------------------------------------- |
| `npm run db:up`       | Sobe Postgres (`5434`) e Redis (`6379`)                                              |
| `npm run db:down`     | Derruba os containers, preservando os dados                                          |
| `npm run db:logs`     | Acompanha o log dos containers                                                       |
| `npm run db:migrate`  | `prisma migrate dev` — gera e aplica migration de uma mudança no schema              |
| `npm run db:deploy`   | `prisma migrate deploy` — só aplica pendentes, sem gerar nada. É o comando do deploy |
| `npm run db:seed`     | Popula com dado de amostra. Idempotente                                              |
| `npm run db:generate` | Regenera o Prisma Client (o `npm ci` já faz isso)                                    |
| `npm run db:studio`   | Abre o Prisma Studio para navegar nos dados                                          |
| `npm run db:reset`    | **Destrói** o banco, reaplica tudo e roda o seed                                     |

### Primeira vez

```bash
cp .env.example .env     # os valores padrão já servem para o local
npm run db:up            # Postgres 16 na 5434 + Redis 7
npm run db:migrate       # cria o schema
npm run db:seed          # usuário dev@hirepair.local + rodada de amostra
```

Conferindo que a API fala com o banco:

```bash
npm run dev:api
curl localhost:3001/health/db     # {"database":"ok","latencyMs":1}
```

`/health/db` faz um `SELECT 1` de verdade e **sempre responde 200** — o veredito
está no corpo, em `database`. Health check que responde 500 é indistinguível de
aplicação morta, e a informação útil é "API de pé, banco fora".

### Mudando o schema

```bash
# 1. edite apps/api/prisma/schema.prisma
# 2. gere e aplique a migration
npm run db:migrate
```

O Prisma pede um nome e cria `apps/api/prisma/migrations/<timestamp>_<nome>/`.
Commite a pasta junto com o schema.

Três regras que evitam a maior parte dos problemas:

- **Não escreva migration à mão** como fluxo principal. Deixe o Prisma gerar o
  diff a partir do schema.
- **Nunca edite uma migration já aplicada.** O checksum muda e o Prisma passa a
  acusar migration modificada em todo comando seguinte. Para corrigir, crie uma
  migration nova — ou, em desenvolvimento e sabendo que perde os dados,
  `npm run db:reset`.
- **Depois de mudar o schema, rode o ciclo completo** antes de abrir PR, porque é
  o que o CI faz:

  ```bash
  npm run db:migrate
  npm run db:seed && npm run db:seed     # a segunda prova a idempotência
  ```

#### Quando o SQL não cabe no schema do Prisma

RLS, grants, trigger, função e índice parcial não existem no DSL. Nesses casos:

```bash
cd apps/api
npx prisma migrate dev --create-only --name minha_mudanca   # gera sem aplicar
# edite o migration.sql: anexe o SQL manual ABAIXO do diff gerado,
# com um comentário explicando o motivo
cd ../.. && npm run db:migrate                              # agora aplica
```

A migration de RLS
([`20260902041335_init`](./apps/api/prisma/migrations/20260902041335_init/migration.sql))
é o exemplo vivo desse padrão.

> **Toda tabela precisa de RLS habilitada.** Não é o mecanismo de autorização
> (esse fica na API), mas o Supabase publica automaticamente o schema `public`
> pela Data API, e uma tabela sem RLS fica legível com a chave anônima do
> projeto. Um modelo novo sem a linha `ENABLE ROW LEVEL SECURITY` **falha o
> `npm run test`**, por conta de
> [`schema-rls.spec.ts`](./apps/api/src/prisma/schema-rls.spec.ts). O porquê está
> em [`docs/database/README.md`](./docs/database/README.md#row-level-security).

### Inspecionando os dados

```bash
npm run db:studio        # interface web do Prisma

# ou psql direto no container
docker exec -it hirepair-postgres psql -U hirepair -d hirepair
```

Conferindo o estado da RLS:

```bash
docker exec hirepair-postgres psql -U hirepair -d hirepair -c \
  "select relname, relrowsecurity from pg_class
   where relnamespace='public'::regnamespace and relkind='r' order by 1;"
# toda linha deve ter relrowsecurity = t

docker exec hirepair-postgres psql -U hirepair -d hirepair -c \
  "select count(*) from pg_policies where schemaname='public';"
# deve ser 0 — RLS ativa sem policy nega tudo
```

### Recomeçando do zero

```bash
npm run db:reset          # apaga os dados, reaplica as migrations e roda o seed
```

Se o próprio container ficar num estado ruim (por exemplo, ao trocar as
credenciais do `.env` depois do primeiro `db:up` — o volume mantém as antigas):

```bash
npm run db:down -- -v     # remove também os volumes
npm run db:up && npm run db:migrate && npm run db:seed
```

### Deploy: as migrations aplicam sozinhas

`apps/api/package.json` declara `prestart:prod`, e o npm o roda automaticamente
antes de `start:prod`:

```json
"prestart:prod": "prisma migrate deploy",
"start:prod": "node dist/main"
```

Então qualquer ambiente que suba a API com `npm run start:prod` aplica as
migrations pendentes primeiro. Sem `DATABASE_URL` no ambiente o comando falha
alto — de propósito: melhor não subir do que subir contra um schema desatualizado.

Para apontar para o Supabase, preencha no ambiente de deploy (as strings estão em
_Project Settings → Database → Connection string_):

| Variável       | Qual copiar                       | Usada por        |
| :------------- | :-------------------------------- | :--------------- |
| `DATABASE_URL` | Transaction pooler (porta `6543`) | A API em runtime |
| `DIRECT_URL`   | Session pooler (porta `5432`)     | `prisma migrate` |

São duas porque o pooler em modo transaction é o certo para a aplicação, mas não
sustenta o advisory lock que a migration usa. Localmente `DIRECT_URL` fica em
branco e o Prisma cai para `DATABASE_URL`.

### Problemas comuns

| Sintoma                                                      | Causa e solução                                                                                                   |
| :----------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `Can't reach database server at localhost:5434`              | Container não está de pé: `npm run db:up`                                                                         |
| `Configuracao de ambiente invalida: DATABASE_URL...` no boot | Falta o `.env`: `cp .env.example .env`                                                                            |
| `The migration ... was modified after it was applied`        | Uma migration já aplicada foi editada. Crie uma nova, ou `npm run db:reset` em desenvolvimento                    |
| `Drift detected` no `db:migrate`                             | O banco saiu de sincronia com as migrations (alteração feita à mão via psql). `npm run db:reset`                  |
| Erro de tipo em `@prisma/client` após mudar o schema         | O Client não foi regenerado: `npm run db:generate`                                                                |
| `password authentication failed`                             | As credenciais do `.env` mudaram depois do primeiro `db:up`. O volume manteve as antigas: `npm run db:down -- -v` |

**Status:** infraestrutura e camada de persistência prontas (Task 01 e Task 02
concluídas).

## Documentação de negócio

O plano de negócio e o planejamento do MVP estão em [`docs/business/`](./docs/business/):

- [`docs/business/plano-de-negocio.md`](./docs/business/plano-de-negocio.md) — hipótese,
  públicos, concorrência, monetização e dinâmica de ATS no Brasil.
- [`docs/business/proximos-passos-mvp.md`](./docs/business/proximos-passos-mvp.md) — roteiro
  para definir o MVP: pesquisa de público, funcionalidades, marca/linguagem,
  gateway de pagamento, LGPD e demais regulações.
- [`docs/business/survey-validacao.md`](./docs/business/survey-validacao.md) — survey curto de
  validação das hipóteses de produto.

## Metodologia

Como o produto trata um currículo: o que é regra dura do sistema, o que o usuário
escolhe e como a informação entra.

- [`docs/business/methodology/metodologia-do-sistema.md`](./docs/business/methodology/metodologia-do-sistema.md)
  — a metodologia do produto: três camadas, pipeline de 9 etapas, matriz de estrutura
  por arquétipo, guardrails e decisões ainda abertas.
- [`docs/business/methodology/cases/`](./docs/business/methodology/cases/) — casos reais que
  originaram (e corrigiram) a metodologia, e o processo manual de análise.

## Protótipo da metodologia (demo em Python)

O protótipo descartável para validar a metodologia fica em [`docs/demo/`](./docs/demo/).
Ele não é parte do backend do produto e tem ambiente, chaves, execução, retomada e
limitações documentados no [guia da demo](./docs/demo/README.md).
