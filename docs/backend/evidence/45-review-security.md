# Correções do PR 45 e atualização de segurança

## Revisão

- Corrigida a preservação das decisões de fatos após colisão de IDs, confirmação e nova preparação dos mesmos materiais. O teste de regressão falhou antes da correção, mostrando perda de confirmação, uso e revisão, e passou depois.
- Tratados os 15 apontamentos da análise original do SonarCloud: expressão regular, ternários, propriedades somente leitura, espaço explícito no label, complexidade e operações assíncronas em laços. A importação mantém a ordem sequencial dos arquivos; a reserva de seis sessões usa concorrência e Redis atômico.
- As refatorações seguem os contratos de [preparação e limites operacionais](../operational-foundation.md) e o [fluxo web](../../design/web/README.md).

## Versões e reprodução

Node 22.23.4 é o mínimo da linha 22, registrado em `.nvmrc`, nos engines e nos workflows. React/React DOM 19.3.1 e Next/eslint-config-next 15.5.28 mantêm a linha principal já usada pelo produto. As demais dependências diretas recebem os patches/minors compatíveis disponíveis. Não há alteração de schema ou migration.

Overrides atualizam dependências transitivas fixadas por consumidores: Multer, YAML 5, PostCSS, Axios, form-data, follow-redirects, minimatch 10 e brace-expansion. O lockfile precisa ser instalado com os scripts normais, incluindo Prisma Client e o build do pacote compartilhado.

Fontes verificadas em 29/10/2026:

- [Node: release de segurança de outubro](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases).
- [React: correções de Server Functions](https://github.com/react/react/security/advisories/GHSA-h3gv-c5rc-p453).
- [deepmerge: CVE-2026-93753, sem versão corrigida publicada](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).

## Limites e deploy

A auditoria inicial encontrou 28 dependências afetadas (3 críticas, 12 altas, 5 moderadas e 8 baixas). A resolução final mantém somente os oito avisos baixos derivados de deepmerge; nenhuma versão corrigida está publicada.

O aviso de deepmerge é transitivo das ferramentas de desenvolvimento Jest e Nest CLI. Não foi aplicado downgrade para ocultar o aviso. Uma auditoria de todas as dependências continua necessária quando o fornecedor publicar correção; a árvore de produção deve ser auditada separadamente.

O patch efetivo do Node fornecido pela hospedagem precisa ser confirmado após o deploy. Vercel escolhe o runtime pela linha principal; `engines` e `.nvmrc` não comprovam o patch servido. Nenhuma configuração externa ou habilitação de IA pública foi alterada.

Rollback: reverter as alterações de código, manifests, lockfile e configuração de Node em conjunto. Dados locais e banco não exigem migração.

## Validação da instalação final

Com Node 22.23.4 e npm 11.6.0:

- `npm ci` — instalação reproduzível concluída, com scripts de instalação habilitados.
- `npm run lint` — três workspaces sem erros.
- `npm run format:check` — todos os arquivos no padrão Prettier.
- `npm run typecheck` — três workspaces sem erros.
- `npm run test` — 72 suítes, 513 testes (API 249, web 233, domínio 31).
- `npm run build` — API, web e domínio compilados; oito páginas estáticas geradas.
- `npm run test:cov -w apps/api -- --runInBand` — 249 testes; controller alterado com 100% de statements, branches, functions e lines. Dívida legada dos demais arquivos permanece inalterada.
- `npm run test:cov -w apps/web -- --runInBand` — 233 testes; todos os arquivos alterados com 100% nas quatro métricas.
- `npm run test:cov -w @hirepair/interview-engine` — 31 testes e pacote inteiro com 100% nas quatro métricas.
- `npm run test:operational -w apps/api` — contratos HTTP, quotas, concorrência e accounting aprovados com Redis exclusivo descartável em 16379; provedor externo simulado.
- `npm run test:e2e` — 11 cenários Chromium aprovados. Capturas de objetivo e plano regeneradas com dados sintéticos.
- `npm audit --omit=dev --json` — zero vulnerabilidades, código de saída 0.
- `npm audit --json` — oito avisos baixos derivados de deepmerge, código de saída 1; zero avisos moderados, altos ou críticos. Não representa auditoria totalmente limpa.

A nova análise hospedada do SonarCloud depende da execução do CI após o push. Validação de configuração e runtime na hospedagem não foi executada nesta etapa local.
