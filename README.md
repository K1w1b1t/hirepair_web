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

### Banco de dados

```bash
npm run db:migrate     # cria/aplica migration a partir do schema.prisma
npm run db:deploy      # só aplica pendentes (é o que roda no deploy)
npm run db:seed        # dado de amostra (idempotente)
npm run db:studio      # Prisma Studio
npm run db:reset       # destrói e recria — SÓ em desenvolvimento

curl localhost:3001/health/db     # {"database":"ok","latencyMs":1}
```

O guia completo — modelo de dados, decisão de RLS, fluxo de migration e as duas
URLs do Supabase — está em [`docs/database/README.md`](./docs/database/README.md).

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
