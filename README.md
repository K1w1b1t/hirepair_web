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
([`enable_rls_deny_by_default`](./apps/api/prisma/migrations/20260902041400_enable_rls_deny_by_default/migration.sql))
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

Script de terminal para **testar a metodologia com uma pessoa de verdade**: lê os
currículos que ela já tem, diagnostica o documento, conduz a entrevista, analisa a vaga
que ela quer e escreve um currículo estruturado em Markdown.

É protótipo descartável para validação — **não** é o backend do produto. As regras duras
da metodologia estão em [`docs/demo/metodologia.py`](./docs/demo/metodologia.py) (é o arquivo que se
edita quando a metodologia muda); a condução das fases está em
[`docs/demo/demo.py`](./docs/demo/demo.py). O Gemini é chamado só para extrair perfil, extrair fatos
de um relato, classificar requisitos de vaga e redigir.

### 1. Ambiente

Requer Python 3.10 ou superior.

```bash
python3 -m venv .venv && source .venv/bin/activate && pip install -r docs/demo/requirements.txt
```

### 2. Chaves da API do Gemini

1. Acesse **https://aistudio.google.com/apikey** e entre com uma conta Google.
2. Clique em **Create API key** (pode ser preciso escolher/criar um projeto) e copie a chave.
3. Crie o arquivo de configuração e cole a chave nele:

```bash
cp docs/demo/.env.example docs/demo/.env
```

O `docs/demo/.env` fica assim — só a primeira linha é obrigatória:

```
GEMINI_API_KEY=sua-chave-aqui
GEMINI_API_KEY_2=
GEMINI_API_KEY_3=
GEMINI_MODEL=gemini-3.6-flash
```

O Gemini tem camada gratuita com limite de requisições por minuto e por dia; uma sessão
completa desta demo faz cerca de 6 a 12 chamadas. Se o modelo do exemplo deixar de existir,
troque `GEMINI_MODEL` por outro da [lista de modelos](https://ai.google.dev/gemini-api/docs/models).

**Chaves reserva (opcional, mas recomendado para sessão com pessoa de verdade).** A cota
gratuita acaba no meio de uma entrevista longa. Se `GEMINI_API_KEY_2` e `GEMINI_API_KEY_3`
estiverem preenchidas, o script oferece trocar de conta na hora, sem perder nada do que já
foi coletado. Como a cota é **por conta Google**, a reserva só ajuda se for de outra conta —
repita os passos 1 e 2 logado em outra conta.

> O `.env` e a pasta de saída estão no `.gitignore`. **Nunca commite nenhum dos dois** —
> a chave é pessoal e a saída contém currículo de gente real.

### 3. Rodar

```bash
python docs/demo/demo.py docs/business/methodology/cases/joao_pedro/curriculo.pdf
```

Aceita mais de um currículo (`demo.py um.pdf outro.pdf` — ele pergunta qual está em uso
hoje) e também roda sem nenhum, coletando tudo pela conversa. Digite `/ajuda` em qualquer
pergunta para ver os comandos.

### 4. Parar no meio e continuar depois

Cada sessão tem um id curto, mostrado ao iniciar e sempre que ela é salva. A sessão é
gravada em disco a cada passo, então `/sair`, Ctrl-C, cota estourada ou queda de rede não
perdem nada.

```bash
python docs/demo/demo.py --sessoes          # lista as sessões salvas com o próximo passo de cada
python docs/demo/demo.py --resume ea8e67    # continua de onde parou
```

`--sessoes` não fala com o modelo, então funciona mesmo com a cota estourada. O id aceita
prefixo (`--resume ea8`) e também aceita o caminho do arquivo `-sessao.json`.

**Quando a cota do Gemini acabar** no meio da sessão, o script para e pergunta o que fazer:
esperar 60 segundos e tentar de novo (quando é limite por minuto), trocar para uma conta
reserva (quando há chave preenchida no `.env`), ou salvar e continuar amanhã. Retomar uma
sessão já concluída não regenera o currículo sozinho — chamada de modelo é o recurso
escasso, então isso fica no menu.

### O que acontece na sessão

| Fase | O que faz                                                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Extrai o texto do PDF como um ATS extrairia e mostra os defeitos: palavras coladas, dado sensível, imagem embutida, gaps na linha do tempo |
| 2    | Pergunta o objetivo pessoal — nada é escrito antes disso                                                                                   |
| 3    | Deriva o arquétipo e mostra a estrutura pré-definida que ele impõe                                                                         |
| 4    | Tom de escrita e fórmula de impacto, com as travas aplicadas                                                                               |
| 5    | Pergunta sobre cada experiência, extrai os fatos, pede confirmação e redige                                                                |
| 6    | Lê a vaga colada, classifica os requisitos e mostra o que falta (sem nota de aderência)                                                    |
| 7    | Escreve o currículo em `docs/demo/out/*.md`                                                                                                |

### Limitações conhecidas

- **Só texto.** A metodologia é áudio-first (a pessoa fala, o sistema escreve), mas esta
  versão coleta digitando. É a próxima iteração.
- Sem geração de PDF, sem preset visual, sem pesquisa de mercado.
- O diagnóstico automático é heurístico: ele acha o que dá para achar no texto extraído,
  não substitui a leitura humana do documento.
