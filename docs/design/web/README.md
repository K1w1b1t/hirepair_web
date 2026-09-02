# Protótipo web do HirePair

Este diretório é uma referência visual estática para futuras implementações do front-end. As páginas usam dados demonstrativos e navegação por arquivos; não dependem de servidor, API, autenticação ou persistência.

## Telas e fluxo

- `index.html`: entrada e proposta de valor.
- `voice-flow.html`: conversa/entrevista com simulação local.
- `confirm-facts.html`: revisão de experiências e competências.
- `progress.html`: progresso e diagnóstico ATS.
- `preview.html`: pré-visualização do currículo e exportação demonstrativa.
- `dashboard.html`: visão geral do candidato.
- `jobs.html`: vagas e correspondência demonstrativas.
- `profile.html`: dados do perfil profissional.
- `settings.html`: preferências da conta.
- `design-system.html`: tokens, tipografia e componentes da marca.

O fluxo principal é `index → voice-flow → confirm-facts → progress/preview`. A navegação secundária conecta painel, vagas, perfil, configurações e manual da marca.

## Convenções para implementação

- Preserve a paleta, tipografia e espaçamento definidos em `css/luminous-theme.css` e no manual de marca em `docs/design/`.
- Reutilize classes de componentes (`btn-*`, `badge-*`, superfícies e estados) antes de criar estilos específicos.
- Mantenha HTML semântico: um `h1` por tela, landmarks (`header`, `nav`, `main`, `footer`), labels associados a campos e `alt` descritivo para imagens.
- Os links entre HTML representam rotas futuras. Botões e simulações mostram estados visuais, mas não são contratos de API.
- O JavaScript local (`js/theme-toggle.js` e scripts inline) serve apenas para apresentação e interação demonstrativa.
