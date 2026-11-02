# Validação da redação e revisão final — #18

## Comportamento entregue

Uma geração server-side a partir da seleção vigente ou confirmação humana legada,
com schema fechado, referências por unidade factual e limites de densidade por
experiência. A revisão permite editar, incluir e remover seções; só a aprovação
geral confirma as declarações manuais e vincula documento/perfil por hash.

A escrita usa uma tentativa, sem fallback. Todas as etapas mantêm os mesmos
contadores, com a sexta chamada disponível apenas para redação. Pendência
essencial é devolvida ao motor sem evento de sucesso. O original e suas fontes
permanecem separados das alterações manuais. Não há conta, migration ou exportação.

## Comandos

- `npm run lint`: aprovado.
- `npm run format:check`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run test`: 865 testes aprovados em 92 suítes.
- `npm run build`: API, web e domínio compilados.
- `npm run test:e2e -w apps/web`: 17 cenários aprovados no Chromium.
- `npm run test:operational -w apps/api`: HTTP e Redis descartável aprovados;
  após cinco chamadas, só uma das oito reservas concorrentes de redação ocupa a sexta.
- `npm run eval:writing -w apps/api`: sete fixtures sintéticas aprovadas nos
  contratos, sem chamada ao provedor; revisão semântica humana permanece pendente.
- `npm run test:cov -w @hirepair/interview-engine`: 216 testes, cobertura de
  statements, branches, functions e lines em 100% em todo o pacote.

Cobertura de API, 100% nas quatro medidas para os módulos tocados:

```sh
npm run test:cov -w apps/api -- --runInBand --runTestsByPath src/interview/writing.service.spec.ts src/ai/ai.service.spec.ts src/operational/ai-budget.service.spec.ts '--collectCoverageFrom=interview/writing*.ts' '--collectCoverageFrom=ai/ai.service.ts' '--collectCoverageFrom=operational/ai-budget.service.ts' '--collectCoverageFrom=!**/*.spec.ts'
```

Cobertura web, 100% nas quatro medidas para os módulos tocados:

```sh
npm run test:cov -w apps/web -- --runInBand --collectCoverageFrom=src/app/conversa/_components/resume-review.tsx --collectCoverageFrom=src/app/conversa/_components/conversation-page-client.tsx --collectCoverageFrom=src/app/conversa/_components/interview-workspace.tsx --collectCoverageFrom=src/app/conversa/_lib/guest-api.ts --collectCoverageFrom=src/app/conversa/_lib/engine-storage.ts --collectCoverageFrom=src/app/conversa/_lib/interview-session.ts
```

Casos determinísticos incluem autorização obsoleta, IDs inexistentes, número
inventado, ferramenta sem evidência, inflação, limite agregado de bullets por
experiência, falhas de persistência, retomada, edição manual e aprovação global.
Os testes de regras novas de recusa e densidade foram observados falhando pela
falta do comportamento antes da correção.

## Evidências visuais

Imagens usam dados sintéticos e provedor simulado; não são currículos reais nem
avaliações de qualidade do modelo em produção.

- [Conferência antes de aprovar](18-review-desktop.png)
- [Editando uma experiência](18-edit-desktop.png)
- [Nova seção vazia](18-add-empty-desktop.png)
- [Nova seção preenchida](18-add-filled-desktop.png)
- [Currículo aprovado no desktop](18-approved-desktop.png)
- [Currículo aprovado no celular](18-approved-mobile.png)

Cada seção apresenta um botão Editar visível. Ele abre o mesmo editor de inclusão,
com título e conteúdo preenchidos; adicionar seção abre os campos vazios.
Campos têm labels; seções são acionáveis por teclado e o foco acompanha o título
na troca de visão. O editor retorna à conferência com salvamento local, sem IA.

## Limites de interpretação

Schema, rastreabilidade e verificações lexicais não comprovam verdade ou suporte
semântico completo. A rubrica versionada registra fidelidade, relevância, clareza
e proporcionalidade, com revisão humana pendente para integração à #23. Não houve
consumo de IA real ou avaliação semântica de modelo publicado nesta validação.
