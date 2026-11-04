# Validação da #20 — PDF e biblioteca local

Fixtures sintéticas, sem dados reais ou chamadas a provedor de IA.
Node 22.23.4, conforme `.nvmrc`. Decisões: [ADR 0020](../../../architecture/adr-0020-local-pdf-library.md).

## Gate de qualidade

- `npm run lint`: aprovado; ESLint dos três workspaces.
- `npm run format:check`: aprovado; Prettier do repositório.
- `npm run typecheck`: aprovado; TypeScript dos três workspaces.
- `npm run test`: aprovado; 940 testes em 105 suítes (API 296, web 428, motor 216).
- `npm run build`: aprovado; NestJS, Next.js e motor, sem banco de dados.

O teste HTTP existente de rate limiting exige permissão para abrir uma porta
local. Build e Playwright usam as variáveis sintéticas declaradas na configuração
do E2E (`ph_test_e2e`), sem credenciais reais. O acesso às fontes já usadas pelo
Next.js foi permitido durante o build.

## Cobertura unitária

Comando: `npm run test -w apps/web -- --runInBand --coverage --coverageReporters=json --coverageReporters=json-summary`.

428 testes web, em 50 suítes. Os 20 arquivos de produção novos/alterados têm
100% de statements, branches, functions e lines. O [relatório filtrado](unit-coverage.json)
é extraído do `coverage-summary.json` produzido pelo Jest. Os arquivos legados
não tocados mantêm suas lacunas; nenhum threshold foi reduzido.

O teste inicial de limites de páginas foi executado antes da implementação:
os cinco casos falharam com retorno 0 em vez de 1/2. A implementação passou a
respeitar os limites; testes adicionais cobrem validade de aprovação, hashes,
revisões concorrentes, escrita inicial tardia após descarte, falhas de armazenamento,
limpeza interrompida, expiração de rascunho bruto, retomada e cancelamento.

## Navegador e integridade do PDF

Comando: `PLAYWRIGHT_PORT=3020 npm run test:e2e -w apps/web -- --workers=2`.
23 E2E aprovados no Chromium. O servidor foi iniciado com o build de produção do código validado.

Os cenários de `resume-export.spec.ts` verificam que a revisão exibe somente as
seções editáveis e que a tela aprovada mostra somente a prévia do PDF, mantendo
a alternativa textual para leitores de tela. Também exercitam aprovação, download, reabertura,
retomada em outra aba, reload, estado vazio, cancelamento e confirmação do descarte,
e retorno à home pelo histórico do navegador. A suíte também inclui as jornadas
existentes de importação, entrevista, voz e consentimento.

PDF.js 6.4.299 lê o arquivo efetivamente baixado, independentemente de
`@react-pdf/renderer` 4.9.0. Os casos incluem uma e duas páginas, nome longo,
quebra de seção, URLs, datas e acentos. O caso de duas páginas compara o texto
completo na ordem esperada. Reabrir e baixar novamente preserva o SHA-256 dos
bytes. Exceder uma página no arquétipo de entrada bloqueia aprovação com motivo
explícito, sem corte. Isso não certifica compatibilidade universal com ATS.

## Evidências visuais

| Tela                         | Desktop                        | Mobile                       |
| ---------------------------- | ------------------------------ | ---------------------------- |
| Home com acesso à biblioteca | [Print](home-desktop.png)      | —                            |
| Revisão por seções           | [Print](review-desktop.png)    | —                            |
| Currículo aprovado           | [Print](approved-desktop.png)  | [Print](approved-mobile.png) |
| Meus currículos              | [Print](library-desktop.png)   | [Print](library-mobile.png)  |
| Biblioteca vazia             | —                              | [Print](empty-mobile.png)    |
| Confirmação de descarte      | —                              | [Print](discard-mobile.png)  |
| Preferências de cookies      | [Print](cookies-desktop.png)   | [Print](cookies-mobile.png)  |
| Duas páginas e nome longo    | [Print](two-pages-desktop.png) | —                            |

As páginas usam landmarks e títulos, links com nomes claros, alternativa textual
para o PDF, mensagens com `role="alert"`/`status` e modal nativo com foco contido,
retorno do foco e Escape para cancelar. O aviso de cookies é recusado explicitamente
nos cenários que geram estes prints.

## Limites da entrega

PDF e armazenamento local apenas. DOCX permanece pendente na #20, compartilhamento
na #21. Não há novo serviço, endpoint, variável obrigatória, conta ou migração Prisma.
A biblioteca pertence ao perfil do navegador e é removida ao limpar seus dados.

O botão de preferências de cookies permanece fixo no canto inferior direito da
janela, com a área segura do dispositivo respeitada. Dois E2E conferem suas
coordenadas em home, página legal, biblioteca e conversa, antes e depois de rolar
a página, em larguras de 390 e 1280 pixels.
