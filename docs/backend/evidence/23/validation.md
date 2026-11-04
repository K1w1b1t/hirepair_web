# Validação #23

## Resultado e limites

O corpus v1 contém 12 casos (10 sintéticos e 2 derivados anonimizados).
O harness determinístico verifica contratos e encerramento, sem certificar a
qualidade semântica do provedor. Referências e critérios estão em
[docs/eval/README.md](../../../eval/README.md).

Foi reproduzida em teste a ausência/invalidação da estratégia após extração;
a correção atualiza a estratégia com os hashes vigentes e permite a redação real
com e sem currículo. Na ausência de análise ou estratégia anterior, o padrão é
conservador de entrada. Isso não inventa fatos ou senioridade.

A avaliação real foi solicitada com `--live --agent --judge`, mas não pôde iniciar:
este workspace não possui chave Groq/configuração operacional. Zero chamadas reais.
Revisão humana dos casos e equivalência de qualidade aos PDFs de referência
permanecem pendentes. Não existe declaração de aprovação semântica nesta entrega.

## Evidências

As imagens são de uma jornada sintética com API real e provedor controlado.
O conteúdo curto foi editado propositalmente para comprovar aprovação e exportação;
não representa benchmark da redação do modelo nem o currículo de uma pessoa real.

- [Revisão desktop](review-desktop.png)
- [PDF aprovado desktop](approved-desktop.png)
- [Revisão mobile sem currículo](review-mobile.png)
- [PDF aprovado mobile](approved-mobile.png)

A nova CI publica traces/HTML/screenshots somente de casos sintéticos, em job com
PostgreSQL/Redis descartáveis. Credenciais e relatórios de execução real ficam fora
do Git. Não houve alteração de schema, migração nova, conta implícita ou persistência
de currículos no backend.

## Comandos executados

- `npm run lint` — passou.
- `npm run format:check` — passou.
- `npm run typecheck` — passou.
- `npm run test` — 951 testes passaram (296 API, 428 web, 227 motor).
- `npm run build` — passou para os workspaces.
- `npm run test:cov -w @hirepair/interview-engine` — 100% em instruções, ramos, funções e linhas.
- `npm run test:cov -w @hirepair/web -- --runInBand --collectCoverageFrom=src/app/conversa/_lib/interview-blocks.ts` — 100% no módulo alterado.
- `npm run test:journey:http -w apps/api` — nove cenários passaram em HTTP real.
- `npm run test:e2e` — 23 cenários passaram.
- `npm run test:e2e:integration -w apps/web` — duas jornadas passaram em 10,9 minutos; com currículo ruim e sem currículo/áudio, HTTP real até edição, aprovação, download e reabertura do PDF com hash idêntico.
- `npm run eval:journey -w apps/api` — 12 contratos passaram; aprovação semântica falsa.
- `npm run db:deploy` com URL explícita de `hirepair_eval` — migration existente aplicada em Postgres descartável.
- `npm run eval:journey -w apps/api -- --live --cases reference-engineering,reference-software --agent --judge` — falhou antes de chamar IA por configuração ausente; relatório local `last-error.json`.

Na primeira execução real de navegador foi reproduzida a estratégia inválida que
impedia redação. O teste unitário da correção falhou antes da implementação e
passou após atualizar a estratégia compartilhada. A suíte de captura também foi
ajustada para não disputar a rolagem com o foco acessível, e o cenário seguinte
aguarda a janela compartilhada de tokens da redação anterior.

Os scripts foram separados por responsabilidade após a análise do SonarCloud;
os 12 casos determinísticos e as nove fronteiras HTTP passaram novamente.
O novo job usa credencial efêmera do próprio run para o Postgres descartável,
sem senha fixa no workflow. As pausas dos E2E refletem a janela real de orçamento,
não um aumento da franquia ou uma chamada de IA real na CI.

A instalação do novo job foi conferida numa cópia descartável em `/tmp`:
`npm ci --ignore-scripts`, inicialização explícita do engine Prisma,
`npm run db:generate` e build do motor passaram. Sharp e bindings SWC carregaram;
o binário Playwright local respondeu `Version 1.64.1`. O workflow usa esse binário
resolvido pelo lockfile, sem instalação implícita via `npx`. A leitura de versão
Git no harness usa `/usr/bin/git`, sem resolução pelo `PATH`.
