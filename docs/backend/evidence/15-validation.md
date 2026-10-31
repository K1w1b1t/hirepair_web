# TASK-12 (#15) — Entrevista adaptativa e confirmação

## Objetivo

Conduzir a entrevista e a revisão na interface de `/conversa`, com ou sem currículo,
até confirmar explicitamente um conjunto de fatos e liberar o estado `ready`.
A redação pertence à #18 e não é chamada nesta entrega.

## Alterações

- Entrada sem currículo, perguntas individuais, ditado editável antes do envio,
  saídas explícitas, pausa, retomada e revisão parcial.
- Análise incremental por bloco com contrato fechado, origens verificadas,
  pendências, limites locais e orçamento central compartilhado.
- Revisão de fatos e experiências: manter, corrigir, remover, reabrir e confirmar.
  Edição invalida confirmação anterior e conteúdo dependente.
- Cabeçalho opcional separado no IndexedDB; exclusão também remove o perfil e
  impede respostas tardias de restaurar a jornada.
- `facts_confirmed` somente após confirmação consolidada persistida, pelo helper
  existente e com o mesmo `funnel_session_id`.

## Decisões e compatibilidade

- Contratos v1 da [fundação #43](../../architecture/adr-0043-evidence-interview.md),
  com campos opcionais adicionais para sessões antigas. Não há migration Prisma.
- Até duas reformulações sem ganho, 100 turnos, 10.000 caracteres por resposta e
  20 minutos de entrevista visível, contabilizados em intervalos de cinco segundos.
  Limites menores de payload/tokens do servidor também se aplicam.
- Cinco chamadas/30.000 tokens antes da redação, incluindo preparação, dentro da
  franquia total de seis/36.000 por sessão e visitante em sete dias. A #18 deverá
  habilitar a sexta chamada para sua operação de redação nos mesmos contadores.
- Sem conta implícita, novo gravador ou armazenamento de áudio. Perfil opcional
  não entra nos pedidos ao provedor. Relatos brutos são removidos na confirmação
  ou após 30 dias na próxima abertura.
- Labels, foco de títulos, navegação por teclado, erros anunciados e progresso
  acessível; telas responsivas conforme a referência visual existente.
- Referências: [metodologia](../../business/methodology/metodologia-do-sistema.md),
  [dados](../../database/README.md), [fluxo visual](../../design/web/README.md),
  [marca](../../design/Hirepair_Brand_Manual.html) e
  [operação](../operational-foundation.md).

## Validação

- [x] `npm run lint` — aprovado em todos os workspaces, sem avisos.
- [x] `npm run format:check` — todos os arquivos conformes.
- [x] `npm run typecheck` — aprovado em todos os workspaces.
- [x] `npm run test` — 658 testes aprovados (257 API, 295 web, 106 motor).
- [x] `npm run build` — NestJS, Next.js e pacote do motor compilados.
- [x] `npm run test:e2e` — 15 jornadas/fronteiras aprovadas no Chromium.
- [ ] Validação de PostHog em staging — esta entrega local não foi publicada;
      conferir consentimento e evento real pelo runbook antes da ativação publicada.

Os testes usam dados sintéticos e provedor simulado. Comprovam contratos, políticas
locais e fronteiras; não constituem avaliação da qualidade semântica de um modelo
em produção. Não foram usadas entrevistas reais nem chamadas reais ao provedor.

- `npm run test:cov -w @hirepair/interview-engine` — 106 testes; 100% de statements,
  branches, functions e lines em todo o pacote.
- Cobertura dirigida do frontend alterado — 100% nas quatro dimensões; 295 testes.
- Cobertura dirigida da API alterada — 100% nas quatro dimensões; 257 testes.
- `npm run test:operational -w @hirepair/api` — Redis isolado na porta 16379;
  concorrência, posse por visitante, lock compartilhado, idempotência, orçamento
  e contratos HTTP aprovados. Nenhum Postgres ou Supabase é usado neste teste.
- `npm run test:e2e` — jornadas com/sem currículo, ditado corrigido, áudio
  indisponível, retomada, exclusão, confirmação obsoleta e resposta tardia.

Comandos exatos das verificações dirigidas, sem reduzir thresholds existentes:

```sh
npm run test:cov -w @hirepair/web -- --runInBand --collectCoverageFrom='src/app/conversa/_components/{conversation-page-client,header-profile,interview-workspace,job-example-step}.tsx' --collectCoverageFrom='src/app/conversa/_lib/{engine-storage,guest-api,interview-session,journey-storage}.ts' --coverageThreshold='{"global":{"statements":100,"branches":100,"functions":100,"lines":100}}'
npm run test:cov -w @hirepair/api -- --runInBand --collectCoverageFrom='{guest/{guest-quota.service,guest.module},interview/{block.service,preparation.controller},operational/ai-budget.service}.ts' --coverageThreshold='{"global":{"statements":100,"branches":100,"functions":100,"lines":100}}'
```

## Risco e rollback

A suficiência semântica depende da saída do provedor; validação estrutural e
confirmação do candidato não certificam veracidade. Uma resposta perdida após o
processamento não pode ser recuperada do servidor, que não armazena conteúdo
pessoal. A interface preserva relatos e oferece revisão parcial, sem repetir a
cobrança silenciosamente. Disponibilidade e qualidade do provedor e consentimento
nos ambientes publicados precisam de validação operacional própria.

Rollback: reverter a entrega e os limites operacionais juntos. Não há migration ou
nova variável obrigatória. Materiais locais continuam sujeitos à posse e retenção
definidas no ADR; a reversão não deve apagar dados da pessoa.

## Evidências visuais

- [Entrevista desktop](./15-entrevista-desktop.png).
- [Entrevista mobile](./15-entrevista-mobile.png).
- [Confirmação com currículo](./15-confirmacao-com-curriculo.png).
- [Confirmação sem currículo](./15-confirmacao-sem-curriculo.png).
