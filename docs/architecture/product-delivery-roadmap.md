# Estratégia de execução até a entrega ao candidato

Plano de produto e interfaces para as issues abertas em 28/10/2026. Este documento
registra decisões e trabalho futuro; não declara funcionalidades futuras prontas.
O agente deve ler o AGENTS.md, a issue, o ADR 0043 e o código da branch de destino
antes de implementar. O diff final prevalece sobre exemplos deste roteiro.

## Jornada que vamos entregar

1. Importar materiais ou começar sem currículo; declarar o objetivo pessoal.
2. Informar vaga ou cargo. Preparar evidências candidatas e plano de investigação.
3. Contar experiências em linguagem cotidiana, por texto ou ditado opcional.
4. Rever, corrigir, manter ou retirar fatos. Confirmar explicitamente o conjunto.
5. Gerar conteúdo profissional sustentado pelos fatos confirmados, ajustando tom.
6. Aprovar a versão exportável. Gerar PDF e DOCX localmente a partir dessa versão.
7. Baixar ou compartilhar o arquivo pelo recurso disponível no aparelho.

A primeira entrega completa ao cliente é #43 → #15 → #18 → #20 → #21, com #17 em
paralelo depois dos contratos. #22 acompanha a dívida de cobertura e #23 integra a
prova da jornada. #19 amplia orientação depois do primeiro fluxo completo.

Não fazem parte dessa jornada automática: conta obrigatória, cobrança, pesquisa de
vagas na internet, publicação pública de currículos, garantia de aprovação em ATS,
WhatsApp Business API ou equipes de agentes autônomos. Caso sejam desejados, abrir
entregas próprias com decisões de produto, privacidade e contratos explícitos.

## Decisões transversais que os próximos agentes devem preservar

- Domínio compartilhado em `packages/interview-engine`; a API valida saídas do
  provedor e a interface consome contratos. Não duplicar máquina de estados.
- O ADR [0043](./adr-0043-evidence-interview.md) define posse local, hashes, transições,
  suficiência, retenção, idempotência e fronteiras operacionais.
- Sessão visitante local no IndexedDB, sem conta nem Prisma adicional por padrão.
  Exclusão explícita e retomada no mesmo perfil do navegador. Não prometer acesso
  entre dispositivos. Migração para conta/backend exigirá ADR e atendimento de
  exclusão, exportação e posse antes de persistir conteúdo pessoal no servidor.
- Documentos e relatos são fontes, não currículo final. Texto bruto de conversa é descartado na confirmação ou após 30 dias na próxima abertura; IDs e trechos mínimos de origem permanecem. Confirmação do usuário não
  é verificação externa. Negativa não vira habilidade e silêncio não vira ausência.
- Hashes identificam os insumos efetivos; derivados antigos nunca autorizam avançar
  com documento, vaga, objetivo ou fatos diferentes. Mudança de alvo preserva a
  história, mas exige vínculos, plano e confirmação pertinentes ao novo alvo.
- Repetições usam a mesma chave de idempotência quando a rede deixa o resultado
  incerto. Conflito não autoriza trocar a chave silenciosamente e cobrar novamente.
- Todas as operações do provedor entram no orçamento central da #41. Hoje há
  6 chamadas/36.000 tokens por sessão e por visitante em 7 dias, além de limites
  globais simultâneos. A preparação pode consumir duas chamadas. Mensagem local
  não é necessariamente chamada ao provedor. Não prometer 30 turnos online sob
  essa franquia nem aumentar limites silenciosamente em uma feature.
- Mudança de orçamento exige medição, teste concorrente Redis e atualização do
  runbook #41. Sem capacidade, preservar história, explicar pendências e permitir
  revisão/encerramento parcial; não simular geração bem-sucedida.
- Conteúdo não entra em logs, métricas ou Discord. Eventos do funil usam o mesmo
  `funnel_session_id`, consentimento explícito e o helper existente. #15 emite
  facts_confirmed; #18 resume_generated; #21 whatsapp_shared na confirmação real.
- Cada entrega aplica TDD e 100% de cobertura unitária do código novo/alterado;
  não transfere seus próprios testes à #22. E2E testa fronteiras e jornadas.
- Fixtures sintéticas são rotuladas como sintéticas. Caso real só entra com origem,
  autorização e anonimização documentadas; quantidade de casos não é alegada sem prova.

## #15 — Entrevista, entrada sem currículo e confirmação

**Entrada:** sessão v1 e plano da #43; sem documento, criar a mesma sessão com fontes
vazias, objetivo explícito e alvo, coletando experiências progressivamente. Não
chamar o endpoint de preparação com documentos vazios nem criar sessão paralela.

**Implementação:** reutilizar `nextAction`, `recordTurn`, `decideFact`, `replan`, `confirm` e `transition` do pacote. Envolver comandos em `applyCommand` e gravar com revisão esperada via `saveEngine`; `readEngine` aplica a expiração de texto bruto. Estender a política de próxima ação no domínio com uma união
fechada de perguntar, aprofundar, esclarecer, revisar, confirmar e encerrar. Cada
ação traz IDs de tópico/critério/experiência e motivo curto. A interface renderiza
uma pergunta por vez, sem raciocínio interno do modelo. Depois de uma resposta,
registrar Turn/Story, validar extração incremental, criar candidatos com origem e
replanejar. Campos ausentes tornam-se pendências, nunca valores inventados. Não duplicar transcrições em `sources`: para relatos, preservar somente o trecho mínimo de origem dos fatos depois da confirmação/expiração.

Separar quantidade de mensagens locais de chamadas ao provedor. Usar perguntas
concretas do plano e estado de evidência para as decisões locais; reservar chamadas
incrementais para transformar blocos de relatos em fatos e esclarecer incerteza
semântica. A operação é escolhida no servidor, com schema e reserva central antes
da chamada. Não adicionar endpoint genérico de prompt ou confiar em saldo do cliente.

Defaults de interação: até duas reformulações por tópico sem ganho de evidência,
até 100 turnos locais e até 10.000 caracteres por resposta, respeitando o limite
menor de payload/token do servidor. Limites não exigem gastar toda a franquia.
Resposta curta pode ser suficiente; resposta longa pode ser vaga. Pular, não saber,
não lembrar, declarar ausência e parar são ações explícitas distintas.

**Confirmação:** usar a mesma revisão para fatos importados e narrados. Nome e contatos opcionais do cabeçalho ficam em um perfil local separado, editável e confirmado pela pessoa; não enviá-los ao provedor nem criar conta. Editar cria
nova versão candidata, manter confirma, remover rejeita. A confirmação consolidada
lista exatamente os IDs selecionados e hashes atuais, descarta relatos brutos e
permite pronto para redação só pelas regras compartilhadas. Contradição pede
esclarecimento ou remoção. Nunca escolher silenciosamente a versão da IA.

**Aceite adicional:** teste unitário de cada próxima ação e limite; integração de
posse/idempotência/budget; Playwright com e sem currículo, correção de transcrição,
retomada, exclusão, confirmação obsoleta e áudio indisponível. Não chamar redação
ou emitir facts_confirmed quando o usuário apenas abre a tela de revisão.

## #17 — Diagnóstico do documento

**Entrada:** documento original/texto extraído com ID/hash, metadados disponíveis e
alvo. **Saída:** DiagnosticFinding versionado com código, severidade, natureza
observada/hipótese, localização/trecho, explicação, ação e destino do bloqueio.

Evoluir o diagnóstico determinístico existente em vez de criar outra entrevista.
Separar achados do arquivo antigo de restrições do futuro artefato. Sem evidência
de layout/páginas não afirmar erro de colunas ou excesso de páginas. Datas ausentes
pedem investigação; não provam desemprego. Inflação é hipótese que aponta escopo
para #15, não acusação de falsidade. Invalidação por hash remove achados obsoletos.

**Aceite adicional:** sem documento retorna ausência de diagnóstico e deixa seguir;
fixtures de parsing observado, referência a outra empresa, dados desnecessários,
gap conhecido/desconhecido e descrição inflada; blocos críticos precisam apontar
uma correção concreta sem impedir coleta ou confirmação.

## #18 — Redação com lastro e aprovação do conteúdo

**Entrada:** estado ready, confirmação válida, fatos selecionados, objetivo/alvo e
estratégia vigente. Provedor recebe apenas o mínimo de fatos confirmados e regras.
**Cabeçalho:** nome/contatos opcionais são compostos localmente a partir do perfil confirmado na #15, fora do prompt e da redação do provedor. A aprovação registra também a versão do perfil local; alteração de contato não exige inventar/reextrair a história.

**Saída:** GroundedContent versionado com seções e referências aos fatos de cada
unidade factual, inclusive resumos e competências; justificativa fica fora do texto
exportável. Acrescentar contrato de aprovação explícita de conteúdo por versão/hash.

Implementar serviço de escrita com schema fechado e operação server-side no mesmo
budget. Primeiro validar permissão de escrever; depois reservar orçamento. Validar
IDs, densidade, cronologia, senioridade, autoria e uso de números/ferramentas. Schema
não prova suporte semântico: rubrica da #23 avalia fidelidade e proporcionalidade.
Número candidato ou métrica inventada é falha crítica, mesmo com ID válido.

CAR é fallback seguro sem métrica confirmada; operacional usa escopo/conformidade;
XYZ só quando o fato confirmado contém medida e contexto adequados. Projeto escolar
não vira produção. Vínculo ativo usa presente; encerrado usa passado. Termos da vaga
só entram em contexto de experiência real. Não copiar frases da vaga como realização.

Permitir revisão de tom e seleção, mantendo rastreabilidade. Texto factual editado
pelo usuário precisa voltar a fato candidato/confirmação antes de entrar na versão
aprovada. Lacuna essencial retorna pendência à #15; o redator não entrevista.

**Aceite adicional:** sem confirmação, hash antigo, fato removido, palavra-chave sem
lastro e conteúdo inflado são recusados; dois tons mantêm os mesmos fatos. Emitir
resume_generated uma vez no sucesso validado, preservando funnel_session_id.

## #20 — Artefatos PDF/DOCX e aprovação visual

**Entrada:** conteúdo aprovado e hash, estratégia/layout fechado e destino.
**Saída:** ExportArtifact local contendo Blob, MIME, nome legível, formato, hash do
conteúdo, hash do arquivo e versão de renderizador; aprovação visual referencia
essa mesma versão e o hash do perfil local de contato. O cabeçalho usa somente os dados opcionais explicitamente selecionados pela pessoa; nunca CPF, nascimento, estado civil ou fotografia. Não persistir Object URLs como arquivos retomáveis.

Escolher bibliotecas locais mantidas para gerar PDF textual e DOCX, após verificar
compatibilidade com Next/browser, licenças e tamanho do bundle na implementação.
Carregar renderizadores sob demanda; sem serviço remoto de conversão. Preset inicial
em coluna única, sem foto/tabelas/gráficos informativos; cabeçalhos e listas semânticos,
acentos preservados e paginação sem corte. Respeitar limites do arquétipo; excesso
vira pendência de seleção à #18, não truncamento silencioso.

A prévia mostra exatamente o conteúdo/arquivo exportável, com alternativa textual
acessível. Bloqueios verificam o artefato novo e o destino, não herdam automaticamente
erros corrigidos do documento importado. Corrigir fato invalida aprovação e artefatos.

**Aceite adicional:** extrair texto de ambos os arquivos com parsers independentes,
comparar palavras/ordem/acentos e testar 1–2 páginas, nomes longos e quebra de seção.
Isso comprova integridade local, não compatibilidade universal com ATS.

## #21 — Download e compartilhamento

**Entrada:** ExportArtifact aprovado e ainda vigente. Download usa o mesmo Blob e
nome/MIME, sem regerar. Web Share API recebe File quando canShare({files}) permitir.
Fallback é download com instrução simples para anexar no WhatsApp, sem URL pública.

Distinguir compartilhamento aberto, conclusão da ação do sistema, cancelamento,
falha e confirmação específica do usuário sobre WhatsApp. Resolução de navigator.share
não prova destinatário ou aplicativo. AbortError é cancelamento. Não registrar
conteúdo, contatos nem nome de arquivo na telemetria. Revogar Object URLs após uso
sem interromper o download. Arquivo obsoleto precisa nova aprovação antes de sair.

**Aceite adicional:** bytes baixados iguais ao artefato aprovado, MIME/nome corretos,
canShare ausente/false/true, rejeição e cancelamento. Validar mobile real com matriz
browser/SO documentada. Emitir whatsapp_shared só na confirmação pertinente; download
não emite resume_generated nem whatsapp_shared.

## #19 — Outros alvos depois da jornada principal

Usar fatos confirmados e objetivo explícito para propor alternativas como hipóteses
com IDs de evidência e trade-offs. Não fazer pesquisa de mercado automática nem
prometer salário/habilitação. Recusar não muda o alvo. Aceitar cria um contexto de
alvo/versionamento separado, preserva história e reentra na preparação/entrevista
existente. Novos critérios implícitos continuam hipóteses, sem competência automática.

**Aceite adicional:** aceitar/ignorar, certificação sem registro legal, fatos
insuficientes, dois alvos coexistindo e orçamento compartilhado. Cada versão final
identifica seu alvo e não substitui um currículo padrão silenciosamente.

## #22 — Auditoria de cobertura legada

Registrar baseline real de statements/branches/functions/lines por arquivo usando
Jest e coverage-final.json; cruzar com regras de negócio e risco. Priorizar estado,
evidência, confirmação/invalidação, ownership, cotas e redação. Corrigir testes
faltantes por comportamento, exercitando código real e mocks nas fronteiras externas.

Manter o threshold de 100% do pacote de domínio. Não reduzir thresholds nem excluir
arquivos executáveis para esconder lacunas. Threshold global só após eliminar a dívida
em todo o escopo medido. Publicar antes/depois com comandos e justificativa das
fronteiras; cobertura não substitui avaliação semântica nem validação de infraestrutura.

## #23 — Jornada integrada e avaliação de IA

Criar harness versionado de entradas, saídas esperadas e rubricas antes de comparar
prompts/modelos. Dimensões: relevância da pergunta, ganho de evidência, fidelidade,
proporcionalidade, clareza, suficiência e custo. Falha crítica (fato inventado, uso
não confirmado, segredo/conteúdo pessoal em logs ou avanço indevido) bloqueia,
independentemente da média das demais dimensões.

CI usa provider controlado, HTTP real e infraestrutura descartável; nunca chama IA
real automaticamente nem usa Supabase publicado. Avaliação real é comando explícito,
com orçamento global, conjunto autorizado e relatório sanitizado com versão de
prompt/modelo/schema/configuração, latência, chamadas/tokens e revisão humana.

Jornadas: documento e vaga → entrevista → revisão/correção → confirmação → redação
aprovada → PDF/DOCX → download/share; também sem currículo e com áudio indisponível.
Fronteiras essenciais: hash obsoleto, repetição concorrente, orçamento esgotado,
provedor inválido/429, negativa, resposta vaga, contradição, documento inflado,
instruções maliciosas e retomada/exclusão sem ressuscitar dados.

## Condição de entrega ao cliente

A jornada principal é utilizável em celular e teclado, com erros compreensíveis e
retomada local; nenhuma etapa promete sucesso sem lastro ou capacidade disponível.
Arquivos aprovados correspondem aos fatos confirmados e podem ser efetivamente
baixados. Compartilhamento e fallback são honestos sobre a plataforma. Gate completo,
jornadas e rubrica sem falhas críticas aprovados. A ativação pública da IA ainda exige
as verificações operacionais de staging da #41; merge de código não comprova ZDR,
Turnstile real ou configuração dos provedores. Registrar riscos e rollback por entrega.
