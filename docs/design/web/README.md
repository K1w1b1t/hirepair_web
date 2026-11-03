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

## Jornada implementada da entrevista (#15)

O protótipo acima é histórico. A implementação atual segue
`materiais e vaga → entrevista guiada → conclusão`, sem `confirm-facts`.
A entrevista começa assim que a preparação termina, com ou sem currículo.
Há uma pergunta por vez, narrada pelo navegador, e progresso em três etapas.
As perguntas esclarecem experiências e achados específicos do currículo. Sem
histórico identificado, começam pela primeira experiência profissional e seguem
até a atual/última. Não há pergunta aberta para escolher uma atividade. No mobile, o microfone ocupa o foco
principal; escrever é a alternativa. No desktop, a área de texto fica aberta.
Cada modo tem no máximo dois botões; não há voltar, pular ou análise manual.

O ditado final entra em uma janela de correção após três segundos de silêncio;
dois segundos depois, a resposta é enviada automaticamente. Escrever interrompe
o envio e permite corrigir o texto. Permissão negada ou navegador sem ditado
permitem continuar por texto. O navegador pode exigir interação para narrar: o
mesmo microfone retoma leitura e resposta. Não há promessa de áudio antes dessa
permissão. O foco acompanha o título da próxima pergunta, com labels e estados
anunciados. Conclusão exige seleção utilizável persistida; falha mantém os relatos
e mostra encerramento parcial. A redação pertence à #18.

[Evidências e validação](../../backend/evidence/15-validation.md).

## Redação e revisão final (#18)

Após concluir a entrevista, a pessoa prepara uma única versão do currículo e
confere um documento simples de uma coluna. Cada seção abre um editor dedicado;
salvar retorna à conferência, cancelar descarta a edição e adicionar seção abre
campos vazios. Nome, título profissional e contatos ficam no aparelho. A aprovação
geral confirma o documento inteiro e encerra a jornada. Depois da aprovação,
o currículo é somente leitura, sem ações de edição ou inclusão de seções. Não há seletor de tom,
regeneração, exportação ou compartilhamento nesta etapa. Ver ADR 0018.

## PDF e Meus currículos (#20)

A revisão existente passa a mostrar o PDF exato, com versão textual acessível.
Aprovar salva o documento e seu arquivo localmente e encerra a jornada. A tela
aprovada oferece **Baixar PDF**, **Meus currículos** e **Voltar para home**.
A home abre `/meus-curriculos`; cada item retorna à sua tela aprovada. A lista
vazia oferece a mesma criação em `/conversa`. Nome, contatos e arquivo de cada
currículo são independentes das próximas jornadas.

Um fluxo incompleto é retomado automaticamente ao abrir o site. Recarregar ou
fechar a aba preserva o progresso; **Voltar para home** abre confirmação para
descartar somente a criação atual. O modal mantém foco, aceita Escape para
cancelar e não anuncia exclusão se o armazenamento falhar. Currículos aprovados
permanecem na biblioteca deste navegador. DOCX e compartilhamento não fazem parte
desta entrega. Ver [ADR 0020](../../architecture/adr-0020-local-pdf-library.md).
