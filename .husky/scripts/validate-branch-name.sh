#!/usr/bin/env sh

set -e

# Defensivo para contextos de CI fora de um worktree.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

# `symbolic-ref` devolve vazio em HEAD destacado (rebase, cherry-pick,
# bisect). `rev-parse --abbrev-ref HEAD` devolveria a string "HEAD", que
# nao casa com o padrao e bloquearia commits legitimos durante um rebase.
BRANCH_NAME="$(git symbolic-ref --short HEAD 2>/dev/null || true)"

if [ -z "$BRANCH_NAME" ]; then
  exit 0
fi

# Branches protegidas nao seguem o padrao de issue.
case "$BRANCH_NAME" in
  master | main | develop | release)
    exit 0
    ;;
esac

# Padrao do repositorio (GitHub Projects): {numero_da_issue}-{titulo_da_issue}
if echo "$BRANCH_NAME" | grep -Eq '^[0-9]+-.+$'; then
  exit 0
fi

echo "ERRO: nome de branch invalido: $BRANCH_NAME" >&2
echo "O padrao deve ser: {numero_da_issue}-{titulo_da_issue}" >&2
echo "Exemplo: 4-task-01-inicializar-monorepo" >&2
echo "Renomeie com: git branch -m <numero>-<titulo>" >&2
exit 1
