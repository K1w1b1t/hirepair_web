# TASK-12 (#15) — Entrevista guiada e seleção automática

## Objetivo

Conduzir a pessoa por uma pergunta narrada de cada vez, com ou sem currículo,
organizar evidências automaticamente e encerrar com material utilizável para a
futura redação (#18). A decisão de produto substituiu a revisão humana obrigatória
pela seleção automática do [ADR 0015](../../architecture/adr-0015-guided-interview.md).
Esta entrega não gera currículo.

## Alterações e compatibilidade

- Entrada direta na entrevista após preparação. Mobile prioriza o microfone;
  desktop abre o texto. No máximo dois botões por modo, sem voltar, pular,
  analisar bloco ou checklist de conferência. Progresso mostra três etapas e
  respostas recebidas, com estimativa de seis a oito respostas.
- Narração nativa, ditado com três segundos de silêncio e dois segundos para
  correção antes do envio automático. Escrever interrompe o envio e preserva o
  rascunho. Falha de áudio oferece texto, sem inventar transcrição.
- Extração automática por blocos, referências sintéticas locais versionadas,
  perguntas contextuais e seleção de evidências com origem. Negativas e fatos
  conflitantes não viram competências ou informações utilizáveis.
- Snapshot `selection` com IDs, revisões, origens e versões de regras/base;
  fatos continuam candidatos. Confirmação humana legada preserva seu significado.
  `canWrite` bloqueia snapshot obsoleto, revisões alteradas e conflitos novos.
- Defaults guiados: doze respostas, oito minutos ativos, dez mil caracteres por
  resposta e duas reformulações sem ganho por tópico. Desconhecimento, ausência,
  recusa e pedido para parar são aceitos por texto/voz. Falha preserva relatos e
  informa material parcial; conclusão utilizável descarta relatos brutos.
- Cinco chamadas/30.000 tokens antes da redação, incluindo preparação, nos mesmos
  contadores centrais; total permanece seis/36.000. Não há franquia por mensagem.
- `interview_completed` somente após conclusão persistida, com consentimento e
  mesmo `funnel_session_id`; nunca emite `facts_confirmed` por seleção automática.
  Recibo operacional permite retomar somente versões atuais de termos/política,
  por até 30 dias, sem aceitar versões novas silenciosamente.
- Mesma sessão v1 em IndexedDB, revisão esperada, idempotência e retenção da #43.
  Não há migration, nova variável obrigatória, novo gravador ou conta implícita.
  Nome/contatos opcionais continuam separados e não chegam ao provedor.

Referências: [fundação](../../architecture/adr-0043-evidence-interview.md),
[metodologia](../../business/methodology/metodologia-do-sistema.md),
[MVP](../../business/proximos-passos-mvp.md), [dados](../../database/README.md),
[fluxo visual](../../design/web/README.md), [marca](../../design/Hirepair_Brand_Manual.html)
e [operação](../operational-foundation.md).

## Validação

- [x] `npm run lint` — workspaces sem erros ou avisos.
- [x] `npm run format:check` — arquivos conformes ao Prettier.
- [x] `npm run typecheck` — API, web, testes e motor tipados.
- [x] `npm run test` — 702 testes: 268 API, 305 web e 129 motor.
- [x] `npm run build` — compilação da API, Next.js e motor.
- [x] `npm run test:e2e` — 15 jornadas/fronteiras Chromium.
- [x] `npm run test:operational -w @hirepair/api` — Redis descartável em 16379;
      concorrência, posse, idempotência, reserva, falhas e contratos HTTP aprovados.
- [x] `npm run eval:interview -w @hirepair/api` — oito fixtures sintéticas,
      assertivas determinísticas aprovadas e zero chamadas ao provedor.
- [ ] `npm run eval:interview -w @hirepair/api -- --live --judge` — manual,
      não executado para preservar cota; qualidade do modelo real não foi certificada.
- [ ] PostHog e permissões de voz em aparelhos reais no staging — sem publicação
      nesta entrega; seguir o runbook antes da ativação publicada.

Cobertura unitária: 100% de statements, branches, functions e lines em todo o motor
e nos arquivos de produção novos/alterados da web/API. Sem reduzir thresholds ou
ignorar testes. A CI exige essas mesmas coberturas antes do build. Comandos dirigidos:

```sh
npm run test:cov -w @hirepair/interview-engine
npm run test:cov -w @hirepair/web -- --runInBand --collectCoverageFrom='src/app/conversa/_components/{conversation-page-client,header-profile,interview-workspace,job-example-step,voice-text-field,wizard-shell}.tsx' --collectCoverageFrom='src/app/conversa/_components/use-guided-voice.ts' --collectCoverageFrom='src/app/conversa/_lib/{engine-storage,guest-api,interview-session,journey-storage}.ts' --collectCoverageFrom='src/analytics/analytics.ts' --coverageThreshold='{"global":{"statements":100,"branches":100,"functions":100,"lines":100}}'
npm run test:cov -w @hirepair/api -- --runInBand --collectCoverageFrom='{guest/{guest-quota.service,guest.module},interview/{block.service,preparation.controller,evaluation},operational/ai-budget.service}.ts' --coverageThreshold='{"global":{"statements":100,"branches":100,"functions":100,"lines":100}}'
```

Fixtures cobrem respostas telegráficas, prolixas, negativas, conflitos, primeiro
emprego e experiência informal. Unitários também verificam seleção obsoleta,
limites, eventos tardios, relógio concorrente com envio, narração bloqueada,
permissão negada, rascunho corrigido e falhas de armazenamento/provedor. E2E da
entrevista cobre entrada com/sem documento, conclusão, retomada após recarga e
correção de ditado para texto, sem conferência. Testes legados de edição/exclusão,
confirmação obsoleta, áudio indisponível e privacidade permanecem nas camadas
pertinentes; a antiga jornada de conferência visual foi substituída.

Avaliações reais opcionais reutilizam prompt/parser/política de produção e
reservas centrais, com até dois casos sequenciais e um judge opcional. Erros de
infraestrutura/schema não contam como aprovação de qualidade. A CI roda fixtures
e provedor simulado: comprova contratos e regras, sem prometer avaliação semântica
de IA real. Não foram usadas entrevistas nem currículos reais de terceiros.

## Risco e rollback

Seleção automática mantém origem e conflitos, mas não verifica externamente
informações declaradas. Narração/ditado dependem de suporte e permissões do
navegador; o texto permanece disponível. Falhas de capacidade ou ausência de
evidências encerram parcialmente; a tela não informa currículo pronto. Uma resposta
do provedor perdida antes da gravação local não é recuperável no backend, que não
armazena conteúdo pessoal. Nenhuma ativação de IA pública está implícita.

Rollback: reverter a entrega e quotas juntas, preservando dados locais. Campos
novos são opcionais; seleção automática não deve virar confirmação humana durante
uma reversão. A #18 deve consumir `canWrite` e os IDs selecionados atuais.

## Evidências visuais

- Atual: [desktop](15-guided-desktop.png), [mobile com microfone](15-guided-mobile.png),
  [alternativa por texto](15-guided-mobile-text.png) e [conclusão](15-guided-success.png).
- Antes do redesenho: [desktop](15-entrevista-desktop.png),
  [mobile](15-entrevista-mobile.png),
  [conferência com currículo](15-confirmacao-com-curriculo.png) e
  [conferência sem currículo](15-confirmacao-sem-curriculo.png).
