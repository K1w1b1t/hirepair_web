# ADR 0020 — PDF aprovado, biblioteca e jornada local

Status: implementado para a entrega web da #20. O escopo acordado nesta entrega
é PDF; DOCX permanece pendente na #20 e compartilhamento permanece na #21.

Referências: [ADR 0043](adr-0043-evidence-interview.md),
[ADR 0018](adr-0018-grounded-writing.md),
[metodologia §4.1](../business/methodology/metodologia-do-sistema.md),
[fluxo web](../design/web/README.md) e
[prioridades do MVP](../business/proximos-passos-mvp.md).

## Exportação e aprovação

`@react-pdf/renderer` 4.9.0 (MIT) gera o Blob no navegador, sem IA ou serviço de
conversão. O módulo é importado sob demanda. Public Sans regular/negrito é servida
pelo próprio app e incorporada ao documento; sua licença acompanha os arquivos.
A fonte bloqueia caracteres sem glifo, em vez de substituir informação silenciosamente.

O preset `single-column-v1` usa A4, margem de 42 pontos, corpo de 10 pontos e
entrelinha de 1,45. Preserva a ordem das seções e unidades, acentos, datas e URLs,
sem reescrever fatos, truncar conteúdo ou renderizar screenshots do texto. Títulos
reservam espaço para conteúdo seguinte e parágrafos protegem linhas órfãs/viúvas.
Primeiro emprego, operacional e transição de carreira admitem uma página;
recolocação e especialista admitem duas. A exceção de carreira longa em transição
não é inferida nesta versão, pois não há um sinal explícito no contrato atual.
Excesso pede ajuste na revisão; não diminui indefinidamente o corpo da fonte.

A revisão exibe os bytes reais pelo PDF.js e mantém o documento HTML como
alternativa textual. A aprovação referencia os hashes do conteúdo e dos contatos,
bem como hash dos bytes, renderizador e preset no registro local. Somente após o
commit do registro o currículo é anunciado como salvo. O download reutiliza esse
Blob; reabertura não chama IA nem troca o PDF por uma nova renderização.
Object URLs existem apenas durante a apresentação e são revogadas na saída.

Uma aprovação anterior à exportação pode ser aberta em `/conversa`: a pessoa
precisa aprovar o PDF para incluí-lo na biblioteca. Não há conversão automática
que atribua aprovação visual a um arquivo ainda não exibido.

## Persistência e retomada

O object store `session` do IndexedDB existente mantém chaves separadas para
`active`, `journey`, `drafts`, `header-profile` e `resume:<id>`. Não há mudança de
schema Prisma, conta implícita ou envio de contatos à API. As entradas antigas
continuam legíveis e materiais importados não são listados como currículos gerados.

A transação de conclusão verifica a revisão ativa, grava o currículo aprovado,
seus contatos, snapshot de origem, materiais e PDF, e libera a jornada ativa.
Um marcador permite repetir a limpeza de caches/materiais ativos caso ela seja
interrompida; a biblioteca já gravada permanece preservada. Revisão antiga e
aprovação incompatível são rejeitadas, sem duplicar documentos.

A etapa, o caminho sem currículo, o contexto da vaga e os rascunhos de entrevista
e edição ficam locais. O snapshot do contexto também permanece compatível com o
armazenamento legado; o IndexedDB guarda uma cópia para retomada. Respostas brutas
não enviadas expiram em 30 dias na próxima leitura. Documentos aprovados e seus
materiais de origem não expiram automaticamente. Limpar os dados do navegador
remove a biblioteca; não há sincronização entre aparelhos.

Web Locks e BroadcastChannel transferem a edição para a aba mais recentemente
aberta, desmontando a anterior e cancelando suas requisições. Navegadores sem
esses recursos usam o mesmo registro ativo e a comparação de revisão existente.
Fechar/recarregar preserva o progresso. Sair explicitamente para a home exige
confirmação e exclui somente a jornada ativa. Contadores operacionais, credenciais
e consentimento não são renovados por essa exclusão.

Nenhum evento novo é emitido. Listagem, reabertura e download não repetem
`resume_generated` nem antecipam `whatsapp_shared`.

## Validação e limites

As fixtures são sintéticas. PDF.js, independente do renderizador, extrai o arquivo
baixado para conferir palavras, ordem, acentos e páginas. Isso demonstra integridade
nos exemplos testados; não garante compatibilidade universal com ATS. A alternativa
HTML permanece necessária: não se afirma que o PDF tenha certificação PDF/UA.

Evidências e comandos: [validação da #20](../backend/evidence/20/validation.md).
