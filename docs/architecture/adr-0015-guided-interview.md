# ADR 0015 — Entrevista guiada com seleção automática

Status: aceito por decisão de produto na #15. Data: 01/11/2026.

## Problema e decisão

A entrevista com muitos controles e uma lista de conferência exigia que a pessoa
decidisse o que valorizar no currículo. A jornada passa a conduzir uma pergunta
concreta por vez, narrada, e organizar as respostas automaticamente. Não exige
uma confirmação humana dos fatos. Esta decisão substitui esse requisito da #15,
do [ADR 0043](adr-0043-evidence-interview.md) e da
[metodologia](../business/methodology/metodologia-do-sistema.md) para a jornada guiada.

O caminho com currículo e o caminho sem documento usam o mesmo agregado v1,
IndexedDB, controle de revisão e idempotência. Sem documento, a sessão começa com
fontes vazias; não chama preparação com documentos vazios. Não existe conta
implícita nem persistência de conteúdo pessoal no backend.

## Interação

A preparação abre diretamente a entrevista. O mobile prioriza um microfone grande
e o botão Escrever; o desktop abre o campo de texto. No modo escrito, há Enviar
resposta e Falar. Não há voltar, pular, escolher arquétipo, analisar bloco ou
conferir fatos nesta tela. A pessoa pode declarar desconhecimento, esquecimento
ou ausência por texto/voz, recusar um tópico ou pedir para parar; essas saídas não viram habilidades positivas.

O navegador narra cada pergunta; políticas de autoplay podem exigir ativar o
microfone. A captura só começa depois da narração. Ditado final aguarda três
segundos de silêncio e dois segundos de prévia antes de enviar. Escrever cancela
o envio e mantém o texto corrigível. Falha de áudio não produz evidência.
Não são gravados nem armazenados arquivos de áudio.

Toda pergunta esclarece uma experiência identificada ou um achado associado a
ela. Não há convite aberto para escolher uma atividade. Sem experiências no
currículo, a primeira pergunta identifica a primeira experiência profissional,
incluindo trabalho informal; a conversa percorre as seguintes até a atual ou
mais recente. A ausência de trabalho é válida e permite identificar a primeira
experiência em projeto, escola ou ajuda a alguém, sem inventar vínculo formal.

Com currículo, as experiências conhecidas são percorridas pela data de início
(incluindo ano, ano/mês e mês/ano). Título, lugar e período declarados distinguem
empregos com o mesmo cargo; data desconhecida não é inventada. Achados pendentes
da #17 têm prioridade no contexto da experiência: habilidade sem exemplo, escopo,
datas e intervalo entre experiências. Achado de outra experiência/documento não
é atribuído silenciosamente ao trabalho atual. Associação incerta é perguntada
como dúvida. A pergunta original, experiência, critério e motivo acompanham o
bloco enviado ao provedor.

Dimensões respondidas e evidências ficam isoladas por experiência. Fatos rejeitados
ou inutilizáveis não preenchem lacunas; revogá-los reabre o que dependia deles.
Um ano na versão de um programa não define o período de trabalho: datas narradas
exigem contexto temporal ou intervalo declarado.

Uma ausência em resposta a um achado/critério contesta os fatos pertinentes da
experiência imediatamente: eles ficam inutilizáveis, derivados são invalidados e
a divergência é registrada como pendência bloqueante. A negativa entra no bloco
com seu tipo explícito. Uma avaliação suficiente do provedor não reativa o fato
antigo; correção ou remoção explícita usa as regras compartilhadas. Novos fatos
e experiências extraídos da própria negativa são recusados. Encerrar a linha do
tempo (“essa foi a última”) não nega o trabalho anterior.

Detalhar um
relato ou corrigir transcrição não cria outra experiência. A extração incremental
vincula o relato à experiência sem trocar os IDs das perguntas já respondidas.
A retomada preserva esse avanço; a IA pode pedir esclarecimentos contextualizados
com o schema incremental. Cada turno
registra tópico, experiência, critério e motivo curto. Resposta curta concreta
pode bastar; negativa e resposta longa vaga não criam fatos suficientes.

Progresso mostra três etapas e respostas recebidas. A interface informa que vai
da primeira experiência à atual ou mais recente. Não promete um total fixo: o conteúdo pode encurtar a conversa ou exigir
esclarecimento. Defaults guiados: duas reformulações sem ganho por tópico, doze
respostas, oito minutos ativos e dez mil caracteres por resposta. Espera pelo
provedor e aba oculta não contam no relógio. Limites do servidor continuam menores
quando aplicáveis. O foco acompanha o título sem deslocar a página. A entrada na entrevista volta
ao topo para manter o progresso visível; estados/erros são acessíveis.

## Evidências e base local

`resume-knowledge.ts` contém seis referências sintéticas próprias: geral,
primeiro emprego, informal, operacional, transição e especialista. A seleção
lexical fornece no máximo duas referências ao prompt de extração. Elas descrevem
boa evidência e perguntas; não constituem um acervo de currículos reais nem
autorizam copiar ferramentas, métricas, cargos ou realizações para a pessoa.

A IA extrai evidências com trechos literais e relaciona fatos à vaga. O domínio
seleciona até dez fatos utilizáveis, priorizando vínculos à vaga e desempate
estável. Negativas, fatos rejeitados, sem origem utilizável ou conflitantes ficam
fora. Enriquecimento organiza e esclarece o declarado; não inventa experiência.

O campo opcional `selection` contém `kind: engine`, IDs, revisões e versões das
origens, hashes dos insumos, versão da base, versão das regras e motivos curtos
de seleção/exclusão. Fatos continuam `candidate` e `externallyVerified: false`.
O campo `confirmation` legado conserva seu significado humano.

`canWrite` aceita uma seleção atual utilizável ou o contrato humano legado.
Mudança de insumos, revisão/origem, regra/base ou conflito invalida a liberação.
Uma conclusão automática obsoleta reabre o processamento. A futura #18 deve usar
essa validação compartilhada e exatamente os IDs selecionados; não deve exigir
`confirmation` humana nem aceitar qualquer fato fora do snapshot. O contrato
local não é uma fronteira de autenticação do backend.

Concluir com seleção persistida elimina texto bruto de relatos/turnos, preservando
origens mínimas. Expiração em 30 dias na próxima abertura permanece. Falha de IA
ou falta de evidência resulta em estado parcial e preserva o relato salvo; não
anuncia sucesso nem libera redação. A tela de sucesso não gera currículo.

## Custo, analytics e validação

Análise é automática em blocos de até três respostas, antecipada quando o JSON
completo não cabe ou há uma negativa factual. O tamanho inclui vaga, contexto,
metadados e escaping JSON; o teto de 20.000 caracteres é compartilhado com a API.
Uma resposta pode ocupar vários trechos, sem cortar pares Unicode. Cada trecho
persiste o deslocamento no mesmo turno; ele só fica analisado ao terminar todo o
texto. Origem e citações permanecem ligadas ao turno; trechos não viram mensagens
locais adicionais. A suficiência do tópico espera o trecho final. O encerramento
aguarda os turnos pendentes, preservando o relato em falhas.

Se o preflight de tokens recusar o pedido antes de reservar IA, o cliente reduz
o bloco em até duas subdivisões adicionais. A restrição aprendida vale para os
próximos blocos da montagem, sem reutilizar o mesmo desafio de acesso. Falhas de
rede/provedor não são repetidas assim. Um contexto que não comporta nem um
caractere ou a falta de orçamento mantém material parcial, com motivo explícito.
Não aumenta franquias nem substitui a reserva central. Oito respostas não encerram a conversa automaticamente: é necessário
percorrer o histórico até a experiência atual/última. Atingir o limite sem isso
preserva material parcial e bloqueia a conclusão utilizável. Preparação e entrevista compartilham cinco chamadas/30.000 tokens;
a sexta chamada/6.000 tokens permanece para a futura redação, sob os mesmos
contadores e limites globais da #41. Não há chamada por mensagem nem endpoint de
prompt livre. Sem capacidade, mantém o material parcial.

`interview_completed` ocorre somente após persistir uma conclusão utilizável, com
consentimento de analytics e o mesmo `funnel_session_id`. Renderizar/retomar sucesso
não emite o evento. Seleção automática nunca emite `facts_confirmed`. O aceite
operacional de IA permanece explícito, com recibo local versionado por até 30 dias;
troca de termos/política exige novo aceite, sem confirmação silenciosa.

A CI roda fixtures e Playwright com provedor simulado. Avaliações reais e judge
são manuais, opcionais e limitados, conforme
[operação](../backend/operational-foundation.md). Fixtures e mocks não certificam
qualidade semântica do modelo em produção. Não há migração nem nova variável
obrigatória. Rollback deve reverter UI, domínio e quotas juntos, preservando dados
locais; snapshots automáticos não devem ser promovidos a confirmação humana.

Ver [validação e telas](../backend/evidence/15-validation.md).
