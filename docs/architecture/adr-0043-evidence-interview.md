# ADR 0043 — Motor de entrevista orientado por evidências

Status: aceito para a fundação da #43. Data: 28/10/2026.

## Contexto e fronteiras

A metodologia §§3–6, 8–9 e 11 distingue intenção, história, inferência e redação.
A #43 prepara a investigação. A #15 executa conversa, entrada sem currículo e
confirmação na interface; #17 diagnostica o documento; #18 escreve. Não há agentes
autônomos, pesquisa externa, exportação ou promessa de aprovação nesta entrega.

Referências: [metodologia](../business/methodology/metodologia-do-sistema.md),
[modelo de dados](../database/README.md), [fluxo visual](../design/web/README.md),
[MVP](../business/proximos-passos-mvp.md) e
[limites operacionais](../backend/operational-foundation.md).

## Responsabilidades e contratos v1

`@hirepair/interview-engine` é o domínio puro compartilhado, independente de React,
NestJS e provedor. Seus contratos versionam sessão, origens, experiências, relatos,
fatos, critérios, vínculos, turnos, pendências, plano, confirmação, estratégia e
conteúdo final com lastro. IDs ligam experiência → relato → fato → critério; cada
turno identifica pergunta, resposta e fatos relacionados.

A extração e a análise da vaga usam schemas fechados distintos. O código verifica
forma, limites, duplicatas, IDs e trechos de origem. Dados importados nunca viram
instruções de sistema. Validação estrutural não comprova a verdade de uma afirmação;
origem, confirmação pelo candidato e verificação externa são conceitos separados.
Um currículo inflado continua candidato até revisão. O modelo não confirma fatos.

Critério explícito exige citação literal. Implícito é hipótese fundamentada no
texto disponível, nunca preenchimento por estereótipo do cargo. Eliminatório exige
base objetiva e origem explícita; a dúvida rebaixa para negociável. Silêncio é
desconhecido. Ausência e contradição exigem referência a uma declaração identificada.

O mapa identifica evidência candidata, confirmada, desconhecida, ausência declarada
ou contradição. A política ordena tópicos por impacto, incerteza e relevância, com
desempate estável pelo ID. Cada tópico informa critério, experiência candidata ou
`null`, evidência faltante e razão. Não há score público de aderência. Replanejamento
é função pura, acionada pela execução da #15 após incorporar respostas.

## Estados e suficiência

`preparation → interview → confirmation → ready → writing`.
Confirmação pode retornar à entrevista; ready/writing também podem retornar para
corrigir a história. Saltos são rejeitados. Pausa, orçamento esgotado e conclusão
parcial preservam fase de retomada e motivo explícito. Encerramento parcial não
significa material suficiente.

Pronto para redação exige objetivo declarado, confirmação vigente, ao menos um
fato confirmado utilizável e nenhum bloqueio ou contradição pendente. Fatos não
selecionados não entram no conteúdo. A validação de conteúdo rejeita seções sem
lastro ou com referências fora da confirmação. A redação real pertence à #18.

Confirmar descarta relatos brutos e texto de respostas; IDs e relações são mantidos. Mesmo sem confirmação, o texto bruto expira em 30 dias e é removido na próxima abertura da sessão. Documentos e fatos não têm expiração automática. A política conserva fatos e
citações mínimas de origem. Áudio não é armazenado pelo motor. A #15 usa esse
mesmo contrato; não cria um segundo entrevistador nem um segundo confirmador.

## Visitante, persistência, retomada e exclusão

A sessão pertence ao perfil do navegador, sem conta implícita nem isolamento entre
pessoas que compartilham o aparelho. O IndexedDB guarda o agregado local, com revisão
comparada dentro de transação. Gravação só é considerada concluída no commit.
Indisponibilidade local causa erro explícito; não se promete retomada em memória.

Materiais não expiram automaticamente, conforme decisão de produto. A exclusão
remove documentos, arquivos originais, agregado, histórico, derivados e pedidos
pendentes. Credenciais e contadores operacionais não são apagados para renovar cota.
Requisições são canceladas e respostas tardias não podem restaurar o agregado.
Preferências de analytics são independentes. A credencial visitante expira em
30 dias e acesso em uma hora; isso não apaga a história local. Não há Prisma novo.

Currículos legados são materiais, nunca fatos confirmados. O original fica separado
da futura redação; o arquivo selecionado é preservado localmente quando disponível.
O backend recebe somente texto minimizado, sem persistir conteúdo em banco ou Redis.

## Versões, invalidação e repetição

Plano, estratégia, confirmação e conteúdo referenciam hashes de currículos, vaga,
objetivo e fatos. Alteração relevante torna inválidos os derivados dependentes.
Troca de vaga preserva história confirmada e recalcula critérios, vínculos e plano.
Alterar fato invalida a confirmação e o conteúdo dependente; preserva os demais
registros de história. Os hashes não são enviados em claro à telemetria operacional.

Comandos locais usam ID, hash e revisão esperada. A repetição idêntica é inócua;
mesmo ID com conteúdo diferente ou revisão antiga gera conflito. No servidor,
`Idempotency-Key` vincula identidade e insumos por 30 dias. Repetições não chamam
novamente o provedor. O servidor não guarda respostas pessoais: perda de resposta
antes da gravação local exige informar indisponibilidade, sem repetir cobrança
silenciosamente. Não há promessa de exactly-once entre navegador, Redis e provedor.

## Orçamento e falhas

`POST /guest/interview-preparation` recebe v1, sessão, funnelSessionId, objetivo
explícito/provisório, documentos e vaga ou cargo. Bearer, Turnstile via emissão de
acesso, consentimento, throttle e idempotência reutilizam a #41. Prompts, schemas e
operações são escolhidos pelo servidor. A rota anterior permanece compatível.

A preparação usa até duas chamadas, uma por etapa, sem retry/fallback automático,
com prazo conjunto de 30 segundos, limite individual de 15 segundos e reserva máxima
existente de 6.000 tokens por chamada. Quotas de sessão e visitante somam todas as
operações; trocar sessão não cria nova franquia do visitante. Limites globais, de
modelo, ambiente, rede e circuito 429 continuam simultâneos. O primeiro limite
atingido bloqueia a chamada seguinte, inclusive o limite móvel de tokens/minuto.
Sem Redis, IA falha fechada. Erro de saída não avança a preparação. Os materiais
locais permanecem disponíveis para retomada, mas uma resposta não persistida não é
recuperável do servidor. Logs não recebem prompts, currículos, relatos ou respostas.

## Decisões metodológicas explícitas

- Objetivo é declarado e revisável; indecisão admite escolha provisória confirmada.
  Vaga remota não implica objetivo remoto.
- Arquétipo considera história e alvo. Ajustar tom não aumenta senioridade.
- CAR é a fórmula segura enquanto não existem métricas confirmadas; operacional
  usa escopo/conformidade. Não inventar XYZ com números candidatos.
- Diagnóstico não é requisito de entrada quando não existe currículo (#15).
- Fixtures são sintéticas e rotuladas. Testes com provedor simulado comprovam
  contratos e regras; não demonstram qualidade semântica dos modelos em produção.
- IA pública mantém o opt-in operacional da #41; testes locais não autorizam
  ativação nem comprovam Turnstile, ZDR ou quotas dos ambientes publicados.
