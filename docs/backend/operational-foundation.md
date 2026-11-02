# Fundação operacional da API

## Fronteiras e configuração

`POST /guest/job-analysis` (compatibilidade) e `POST /guest/interview-preparation`
(preparação v1) consomem IA. Não aceitam prompt, modelo,
ferramentas ou operação genérica. O servidor escolhe análise profissional,
schema fechado e modelos Groq GPT-OSS 120B/20B. Gemini gratuito não recebe
currículos reais. A restrição de finalidade reduz utilidade para abuso; não
substitui verificação de acesso e orçamento.

`GUEST_ACCESS_SECRET` é obrigatório, sem fallback, com pelo menos 32 bytes.
Gere com `openssl rand -hex 32` e use valores distintos em cada ambiente.
`AI_PUBLIC_ENABLED=false` é o estado padrão até comprovar os controles em
staging. Para habilitar, configure `APP_ENV`, `AI_QUOTA_POOL`,
`TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY`, `GROQ_API_KEY`,
`GROQ_ZDR_CONFIRMED=true` e `GROQ_FREE_TIER_CONFIRMED=true`. As duas confirmações
são declarações operacionais: não ativam ZDR nem mudam o tier do provedor.
Staging/produção exigem ainda `REDIS_URL`, `DISCORD_WEBHOOK_URL` e chaves reais
de Turnstile. O sitekey chega ao navegador por `/guest/config`.

Use chaves distintas por ambiente. `AI_QUOTA_POOL` identifica a organização
Groq, não o ambiente. Se duas chaves compartilham organização, ambas DEVEM
usar o mesmo Redis e pool para evitar orçamento duplicado. Organizações
separadas podem usar pools/Redis separados. Os limites reais do console devem
ser iguais ou superiores aos limites locais; não habilitar tier pago.

`CORS_ORIGIN` é um array JSON de origens exatas. CORS não é proteção contra
clientes externos; `credentials=false` corresponde ao contrato Bearer sem
cookies. O body tem limite de 256 KB e os insumos 20 mil caracteres totais.
DTOs rejeitam campos desconhecidos e booleanos enviados como strings.

## Identidade e limites

O servidor emite UUID assinado; não aceita `visitorId` escolhido pelo cliente.
Token de acesso dura uma hora; credencial renovável, 30 dias. Consentimento
explícito com versões atuais é verificado antes de emitir acesso e registrado
pseudonimamente no Redis por 30 dias. Limpar dados do navegador pode renovar a
identidade; limites de rede e globais independem dela.

No Vercel, usa-se apenas `x-vercel-forwarded-for`, sobrescrito pela plataforma;
fora dele, `socket.remoteAddress`. Não há trust proxy amplo. IPv4 individual e
IPv6 /64 são normalizados e HMAC antes de armazenar. Não há vínculo rígido do
token ao IP. Validar o comportamento real de staging conforme a
[matriz da auditoria](./security-audit-41.md).

| Camada                          | Limite                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Throttle global Redis           | 10 requisições/minuto por rede, por rota                                          |
| `/guest/access`                 | 5/minuto e 30/hora por rede, com Turnstile hostname/action                        |
| `/guest/job-analysis`           | 3/minuto por rede; 3 tentativas/7 dias por visitante                              |
| Rede, independente de visitante | 30 tentativas/24 horas                                                            |
| Concorrência por visitante      | Uma análise; lease 60 segundos                                                    |
| Por análise                     | Até 2 chamadas, reserva máxima de 6.000 tokens/chamada                            |
| Escopo visitante atual          | 6 chamadas / 36.000 tokens em 7 dias                                              |
| Groq compartilhado por modelo   | 6.000 tokens em janela móvel de minuto, 800 chamadas / 160.000 tokens por dia UTC |
| Produção por modelo/dia         | 720 chamadas / 144.000 tokens                                                     |
| Staging por modelo/dia          | 80 chamadas / 16.000 tokens                                                       |
| Produção por mês UTC            | 2.400 chamadas / 14.400.000 tokens                                                |
| Staging por mês UTC             | 240 chamadas / 1.440.000 tokens                                                   |

Tetos são simultâneos; o primeiro atingido impede novas chamadas. O teto mensal
não promete disponibilidade ou consumo de toda a franquia. Os valores deixam
margem frente aos limites gratuitos publicados (confirmar no console). A janela
de minuto conserva a reserva mesmo após informar uso menor. Sem Redis, o
consumo de IA falha fechado; a telemetria continua fail-open.

## Accounting e falhas

Lua reserva atomicamente tentativas, chamadas e tokens antes do provedor. Não
há devolução de tentativa em falhas. `Idempotency-Key` é obrigatório e ligado ao
hash dos insumos: repetição não inicia trabalho, alteração com a mesma chave
retorna conflito. Metadados de idempotência duram 30 dias; não guardam resposta
nem texto. O cliente reutiliza a chave quando o resultado da rede é incerto.

O tokenizer `o200k_harmony` estima insumos/schema com margem de 20% e overhead,
mais até 1.200 tokens de saída (incluindo raciocínio). Usage válido ajusta o
registro; usage ausente, timeout ou falha ao finalizar mantém a reserva inteira.
Cada tentativa registra IDs HMAC, modelo, operação, versão HMAC, duração,
resultado e tokens; nunca texto/prompt, cabeçalhos ou resposta. Registros duram
30 dias. Preço monetário não é estimado: esta configuração autoriza apenas o
tier gratuito, com consumo auditado em chamadas/tokens.

Fallback ocorre uma única vez em falha de rede ou 5xx, com timeout de 15s por
chamada e prazo de 30s para a operação. 429 abre circuito conjunto da
organização pelo Retry-After (padrão 60s, teto 24h), sem tentar outro modelo.
401/403 são configuração, outros 4xx rejeição de conteúdo; JSON inválido e
saída truncada não são retentados. Respostas de erro do provedor não são lidas
nem registradas. Alertas Discord de 80%/100% são deduplicados por modelo/dia;
falha do alerta não autoriza consumo adicional.

## Dados e infraestrutura

Regex no navegador e no servidor mascara CPF, RG identificado, nascimento,
filiação, contato, endereço identificado e URLs. Minimização não significa
anonimização; revisar texto livre continua necessário. A política informa o
envio ao Groq com ZDR verificado. Materiais, rascunho e sugestões persistem
localmente sem expiração; mudar insumos invalida sugestões, preservando textos.
Não há botão de exclusão no fluxo visitante, conforme decisão do produto.
Persistência autenticada e descarte ficam com #43/login.

Pino registra apenas metadados em todos os ambientes. Discord nunca recebe
corpo, erro livre ou stack. `x-global-trace-id` é validado/gerado e propagado;
filtros devolvem códigos seguros. Workers BullMQ não são importados pela API:
ativá-los requer jobs reais e processo próprio. `RolesGuard`/`CurrentUser`
aguardam autenticação; guard padrão negar deve entrar junto ao login.
Swagger em produção exige `API_DOCS_ENABLED=true`.

## Validação local

Os cinco gates do AGENTS.md continuam obrigatórios. Além dos testes unitários,
suba Redis **descartável** em `127.0.0.1:16379` e execute
`npm run test:operational -w apps/api`. O teste usa pool único e limpa apenas
suas próprias chaves; não faz flush. Usa HTTP real, Redis/Lua real e provedor
externo simulado, sem gastar IA. `npm run test:e2e` valida a jornada no navegador.
Configuração real e evidências de staging continuam obrigatórias antes de
habilitar IA pública. Consulte [pendências e responsáveis](./security-audit-41.md).

## Fundação do motor (#43)

A preparação recebe objetivo explícito/provisório e IDs locais de sessão/funil.
Extração e critérios são duas operações fechadas, `resume-extraction` e
`criteria-analysis`, com schemas e validação de origem/referências separados.
Compartilham prazo de 30 segundos e até duas chamadas, sem retry/fallback nesta
operação. A rota antiga conserva seu comportamento de compatibilidade.

A cota de 6 chamadas/36.000 tokens em 7 dias vale simultaneamente por sessão e
por visitante, além de rede/modelo/pool/ambiente. Criar outra sessão não renova
cota do visitante. A reserva Redis continua anterior ao provedor e indisponibilidade
falha fechada. A integração descartável verifica também esse limite entre sessões.

Conteúdo e estado do motor são locais; Redis guarda somente metadados operacionais.
Confirmação/redação/compartilhamento continuam nas issues responsáveis, sem eventos
artificiais nesta fundação. Falhas conhecidas registram interrupção local com motivo;
resposta perdida não é refeita silenciosamente. A versão de consentimento passou a
`2026-10-28`, refletindo preparação, descarte e retenção de relatos. Credencial assinada
pode ser renovada preservando visitante; acesso exige consentimento vigente.

Ver [ADR 0043](../architecture/adr-0043-evidence-interview.md) e
[roteiro de entregas](../architecture/product-delivery-roadmap.md). O pacote de domínio
é compilado no postinstall e antes dos builds/testes/typecheck; instalações devem
executar os scripts normais do npm, incluindo a geração do Prisma já exigida.

## Entrevista incremental (#15)

`POST /guest/interview-block` usa Bearer visitante, consentimento vigente obtido na
emissão de acesso, `Idempotency-Key`, throttle de seis requisições/minuto e contrato
v1 fechado compartilhado. Recebe contexto mínimo, alvo, turnos e tópicos; não
aceita prompt nem operação enviados pelo cliente. O servidor escolhe
`interview-extraction`, schema e instruções, minimiza identificadores reconhecidos,
estima tokens e reserva capacidade antes de chamar o provedor. O limite HTTP é
20.000 caracteres do JSON; cada resposta tem limite adicional de 10.000 caracteres.
A operação usa uma tentativa, até 1.200 tokens de saída e prazo de 15 segundos.

Blocos compartilham lock por visitante, idempotência por identidade/insumos e teto
de rede das análises legadas. O contador de tentativas de blocos é separado do
limite de três análises legadas; isso não abre nova franquia de IA. Todas as
chamadas anteriores à redação usam os mesmos contadores centrais com teto de cinco
chamadas/30.000 tokens por sessão e visitante em sete dias, reservando uma chamada
e 6.000 tokens para #18 dentro do total de seis/36.000. Limites globais, por
ambiente, modelo, rede e minuto continuam simultâneos. A concorrência é validada
contra Redis isolado por `npm run test:operational -w @hirepair/api`.

O cliente preserva a chave do bloco se o resultado fica incerto. Uma repetição
já processada não refaz a chamada nem recupera conteúdo pessoal do servidor.
Falha de Redis bloqueia IA; indisponibilidade mantém os relatos locais e informa
um encerramento parcial. Logs, Redis e telemetria não recebem relatos, fatos ou perfil.
Não há migração Prisma, nova variável obrigatória ou ativação automática da IA.
O rollback é reverter a entrega; os campos adicionais da sessão v1 são opcionais.

### Seleção automática e avaliações

A #15 usa referências sintéticas locais versionadas em `resume-knowledge.ts`
para orientar a extração e a relevância, sem transmitir currículos de terceiros.
Os exemplos nunca constituem evidência do candidato. O contrato continua fechado
e a operação permanece escolhida no servidor. Ver [ADR 0015](../architecture/adr-0015-guided-interview.md).

`npm run eval:interview -w @hirepair/api` executa oito fixtures sintéticas com
assertivas determinísticas, sem Redis nem provedor; roda na CI. Testes unitários
da avaliação real usam um provedor simulado, o prompt de produção e o parser
compartilhado. Não demonstram qualidade semântica do modelo real.

Avaliação manual opcional com a infraestrutura de IA já configurada:

```sh
npm run eval:interview -w @hirepair/api -- --live
npm run eval:interview -w @hirepair/api -- --live --cases negative,contradiction --judge
```

O modo real executa no máximo dois casos sequenciais e um julgamento opcional
(até três chamadas, uma tentativa por chamada e reserva total de até 30.000
tokens). Reutiliza `AiService`, reservas centrais, identidade técnica estável
`hirepair-guided-eval` e escopo `guided-v1`; repetir o comando não abre franquia.
Os limites globais/rede/modelo continuam vigentes. O relatório distingue modo,
versão da base, chamadas, tokens reservados, modelo e resultado. Falha de schema,
infraestrutura ou orçamento retorna erro; falha de qualidade retorna exit code 1.
Não há job automático com IA real nem novo endpoint de prompt/judge. Só fixtures
sintéticas são usadas. Execução real requer as mesmas condições operacionais
da IA pública e não foi realizada como evidência desta entrega.
