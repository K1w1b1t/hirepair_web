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

## Correção das evidências após revisão visual

As capturas antigas `approved-desktop.png`/`approved-mobile.png` usavam `fullPage`.
No desktop, uma viewport de 1280×720 produziu uma imagem de 1280×1592. O controle
fixo de cookies continuou a 16 px do fundo da viewport, parecendo deslocado quando
a imagem do documento inteiro era vista como uma única tela. A página é rolável;
a captura não representava a janela disponível. As capturas da jornada passam a
usar `fullPage: false` e verificam as distâncias do controle à viewport.

O teste de apresentação mede também a posição antes/depois da rolagem e as dimensões
do PNG: 1280×800 no desktop e 390×844 no mobile. Não foi necessário alterar o CSS
do controle de cookies.

As referências abaixo têm conteúdo completo, derivado e anonimizado dos exemplos
autorizados de engenharia e software. São **conteúdo esperado inserido manualmente**
no renderizador real, não resultado de entrevista ou geração por IA. Elas testam
apresentação, limites de páginas, preservação de texto e cabeçalhos sem órfãos;
não certificam a capacidade do motor de produzir esse conteúdo a partir de relatos.

| Referência                       | PDF integral                                   | Viewport desktop                                 | Viewport mobile                                 |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- |
| Entrada em engenharia — 1 página | [PDF esperado](engineering-entry-expected.pdf) | [Janela](engineering-entry-desktop-viewport.png) | [Janela](engineering-entry-mobile-viewport.png) |
| Carreira em software — 2 páginas | [PDF esperado](software-career-expected.pdf)   | [Janela](software-career-desktop-viewport.png)   | [Janela](software-career-mobile-viewport.png)   |

As imagens `*-expected-page-*.png` são páginas do PDF exportado, sem controles do
site. As imagens `*-scrolled.png` comprovam a posição do botão após rolar a página.
A separação entre PDF integral e captura da janela evita repetir a ambiguidade.

O caso de software revelou um título de experiência órfão no fim da primeira
página. A correção coloca títulos e parágrafos no mesmo fluxo da página, onde a
reserva de espaço funciona; seções longas continuam podendo quebrar sem cortar
texto. O teste unitário falhou antes da correção. O teste de PDF exige o título
e o primeiro parágrafo de cada seção na mesma página. Novos PDFs usam
`single-column-v2`; arquivos já aprovados continuam preservados na biblioteca.

Validação desta correção: os cinco gates (`npm run lint`, `npm run format:check`,
`npm run typecheck`, `npm run test`, `npm run build`) passaram; 952 testes unitários
(296 API, 429 web, 227 motor). `npm run test:e2e` passou com 25 cenários, incluindo
os dois PDFs completos e posição do controle antes/depois da rolagem.
`npm run test:cov -w @hirepair/web -- --runInBand --collectCoverageFrom=src/app/conversa/_lib/render-pdf.tsx`
mediu 100% nas quatro métricas do renderizador alterado. As duas jornadas HTTP
integradas foram executadas anteriormente; nesta revisão suas mudanças se limitam
a capturas e asserções de posição, com nova execução pela CI.

## Padrão visual do currículo — revisão das referências locais

O layout `reference-column-v3` usa cabeçalho azul com nome, título profissional
e contatos em linha, divisória principal e títulos de áreas em caixa alta com
linhas finas. Experiências identificadas pelo contrato `experienceId` ficam sob
“Experiência e projetos”, com subtítulos em negrito e marcadores. Não se infere
tipo de experiência a partir do texto nem se reordena ou elimina conteúdo.
A conferência editável segue essa hierarquia; aprovado e download usam o mesmo
PDF armazenado. Arquivos já aprovados não são alterados retroativamente.

O editor local oferece nome, título, cidade/UF, e-mail, telefone, LinkedIn,
GitHub e portfólio/site. Campos ausentes em perfis antigos continuam opcionais;
somente dados preenchidos pela pessoa entram no cabeçalho, sem envio à IA.
Não se acrescentam foto, documentos, endereço completo ou informações inferidas.
As referências de engenharia e software continuam anonimizadas e manuais,
com PDFs completos de uma e duas páginas, sem atribuição de geração pela IA.

A correção da CI cobre duas causas verificadas: rejeição de Promise sem um
`Error` no helper de IndexedDB (SonarCloud) e CSS que ocultava o controle de consentimento durante toda a entrevista,
inclusive a conferência. A regra foi removida e o teste integrado configura
consentimento negado antes da navegação; chamadas reais de IA continuam desativadas.

As evidências atuais incluem `*-review-viewport.png` para a conferência e
`*-desktop-viewport.png`/`*-mobile-viewport.png` para o aprovado, além das páginas
extraídas do PDF baixado. Contatos diretos ficam em uma linha; links profissionais
em outra, com quebra natural em telas estreitas. Os cenários verificam todos os
campos preenchidos no PDF, todos os parágrafos e os limites de páginas, além de
título e primeiro parágrafo juntos. O cenário artificial de duas páginas usa
48 itens após a compactação visual, preservando a comparação integral do texto.

Validação final do design: `npm run test:e2e` — 25 cenários passaram.
`npm run test` — 958 testes passaram (296 API, 435 web, 227 motor).
A cobertura unitária dos cinco módulos de apresentação alterados é 100% em
instruções, ramos, funções e linhas: renderizador, apresentação compartilhada,
cabeçalho, conferência e alternativa acessível da biblioteca. O teste de
contatos em duas linhas e a alternativa acessível falharam antes da implementação.
