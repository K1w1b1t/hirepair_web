# Instruções do Codex — hirepair_web

## Regra inegociável: leia o AGENTS.md antes de qualquer coisa

Antes de responder, planejar, ler código ou editar **qualquer** arquivo deste
repositório, leia o [`AGENTS.md`](../AGENTS.md) na raiz. Ele é a fonte da
verdade e tem precedência sobre qualquer outra instrução em caso de conflito.

Isso vale para toda interação, inclusive as que parecem triviais (uma pergunta
rápida, um ajuste de uma linha). Não presuma o conteúdo do `AGENTS.md` a partir
de sessões anteriores — releia no início de cada sessão.

## Ordem de leitura

1. [`AGENTS.md`](../AGENTS.md) — stack, estrutura de diretórios, padrão de
   branch/commit, setup local e gates de qualidade.
2. Os arquivos vizinhos ao alvo da tarefa, antes de editar.

## Gate de qualidade (obrigatório antes de entregar)

Todos os comandos abaixo precisam passar:

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test
npm run build
```

Não use atalhos para forçar pipeline verde: nada de `skip`, `only`, `--no-verify`,
regra de lint desativada ad hoc ou teste comentado.

## Padrão de branch e commit

Este repositório usa **GitHub Projects**, não Linear:

- Branch: `{numero_da_issue}-{titulo_da_issue}` (ex.: `4-task-01-inicializar-monorepo`)
- Commit: `type(scope): subject` com escopo obrigatório (ex.: `feat(4): setup monorepo`)

Os hooks do Husky validam os dois. Não proponha mudanças que os quebrem.
