# Revisão operacional #41

Revalidação de código em 7 de outubro de 2026, sobre `1ee738f`, com alterações
nesta entrega. Os achados de `6dfc923` são históricos. A revisão **não está
encerrada**: testes locais não comprovam configuração dos ambientes publicados.

## Correções e evidências

| Achado                      | Implementação atual                                                                                                                               | Evidência / situação                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 segredo público        | Sem fallback; boot exige segredo >=32 bytes; tokens separados por finalidade e ambiente                                                           | `operational-env.spec.ts`, `guest-access.service.spec.ts`. Operação deve gerar/instalar valores distintos em Production/Staging                         |
| P0-2 abuso e orçamento      | Turnstile servidor com hostname/action; identidade UUID assinada; cota independente de rede; orçamento atômico global/modelo/ambiente/escopo      | `guest.controller.spec.ts`, `turnstile.service.spec.ts`, `test/operational.redis.integration.ts`. Configuração real de Turnstile/Redis/Discord pendente |
| P0-3 tentativas e fallback  | 3 tentativas/7 dias, falhas não devolvidas; 2 chamadas máximas; 20 mil caracteres totais e reserva <=6 mil tokens; 429 abre circuito sem fallback | `guest-quota.service.spec.ts`, `ai.service.spec.ts`, integração Redis real                                                                              |
| P0-4 throttle e origem      | Storage Redis; IPv4 individual e IPv6 /64; Vercel usa exclusivamente header sobrescrito pela plataforma; fora dela usa socket                     | `operational.spec.ts`, `core.module.spec.ts`, integração HTTP. Confirmar IP real e spoofing em staging                                                  |
| P0-5 ambientes              | Orçamento staging menor; chave/pool separados quando organizações distintas, ou Redis/pool compartilhados quando mesma organização                | Política no runbook; separação efetiva de credenciais e alertas dos provedores ainda requer acesso operacional                                          |
| P1 minimização              | Máscara no cliente e novamente no servidor antes do provedor; logs sem payload em qualquer ambiente                                               | `sanitize-material.spec.ts`, `guest-api.test.ts`, interceptor/Discord specs. Regex reduz dados, não garante anonimização                                |
| P1 consentimento e retenção | Versões no token e registro pseudônimo Redis 30 dias; consentimento explícito a cada análise; materiais e rascunho locais sem expiração           | `guest-access.service.spec.ts`, `guest-quota.service.spec.ts`, `journey-storage.test.ts`, página legal                                                  |
| P1 erros/URL/restauração    | Códigos seguros; vazio 400; body 413; hash dos insumos invalida apenas sugestões; editar vaga sincroniza URL                                      | `guest-analysis.service.spec.ts`, filter specs, testes da conversa e Playwright                                                                         |
| P1 infraestrutura           | Body 256 KB, CORS sem credentials, workers não importados pela aplicação                                                                          | `app.setup.spec.ts`, diff de `app.module.ts`                                                                                                            |
| P1 uso genérico da IA       | DTO sem prompt/model/tools; operação, prompts e modelos fixos; saída JSON schema estrito e validação local                                        | Teste DTO e integração HTTP rejeitam campos extras. Instruções em texto não são fronteira de segurança; cotas continuam obrigatórias                    |

## Decisões de produto e fronteiras

Por decisão do responsável pelo produto, a conversa, materiais e sugestões do
visitante permanecem no navegador até a limpeza dos dados do site. Não há
expiração automática nem botão de exclusão neste fluxo. A política informa
persistência e uso de aparelho compartilhado. O descarte na área autenticada,
persistência no backend, autenticação e direitos do titular nesse fluxo devem
ser entregues com #43/login; não são declarados implementados aqui.

A credencial operacional expira em 30 dias e o token de análise em uma hora;
isso não apaga materiais nem resultados. Não se vincula o token rigidamente a
IP: redes móveis mudam de endereço. IPv4 /24 foi descartado nesta entrega para
não agregar ainda mais redes compartilhadas. Turnstile e limites globais
continuam necessários contra limpeza de navegador e troca de rede.

#43 define identidade/posse/persistência e invalidação de derivados. O contrato
`AiExecutionContext` recebe principal, escopo, operação, idempotência e versão
dos insumos; hoje usa a identidade visitante, sem criar migrations ou estado do
motor. Integrar a sessão definitiva nesse contrato é responsabilidade de #43
com as proteções desta revisão. Objetivo inferido, arquétipo, `deriveChoices`,
mapa de fatos, entrevista, redação e métricas futuras permanecem com #43/#15/#18.
A segurança operacional não depende de corrigir esses itens metodológicos.

## Pendências com responsável

| Pendência                                                                                 | Responsável / encaminhamento                                                                                                                        |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Segredos/chaves por ambiente, organização e free tier Groq, ZDR real, alertas de console  | Operação do projeto; manter `AI_PUBLIC_ENABLED=false` até cumprir runbook                                                                           |
| IP real/spoofing, rede móvel/compartilhada, Redis gerenciado e alertas Discord em staging | Operação com responsável por #41; executar matriz abaixo antes de divulgação                                                                        |
| Qualidade dos modelos GPT-OSS em casos reais autorizados/sintéticos identificados         | #43/#23; não há alegação de qualidade validada por mocks                                                                                            |
| Área logada, descarte e exclusão de dados do titular                                      | Autenticação/#43; incluir atendimento de privacidade antes de persistir dados pessoais no backend                                                   |
| Guard padrão negar e rotas públicas explícitas                                            | Responsável por autenticação; aplicar quando login existir                                                                                          |
| Dependências ainda apontadas por `npm audit`                                              | Manutenção de dependências; triagem por alcance runtime, atualizações compatíveis e validação. Não usar `--force` para downgrade de Prisma/rupturas |

`npm audit fix` atualizou correções compatíveis, incluindo `proxy-addr` 2.0.8. O audit de produção (`npm audit --omit=dev --json`) apontou 16 entradas
(9 altas, 7 moderadas, nenhuma crítica). Persistem dependências transitivas
de tooling/SDKs e Next/PostCSS;
esta entrega não declara a árvore livre de vulnerabilidades. Registrar a saída
atual de `npm audit --omit=dev` na revisão antes de deploy e tratar achados
alcançáveis como bloqueios de sua própria natureza.

## Evidência visual

[Etapa da vaga, com divulgação do envio à IA e verificação de acesso](./evidence/41-vaga.png).
Captura Playwright com dados sintéticos e desafio simulado; não comprova Turnstile real.
A interface mantém labels, mensagens de status acessíveis e botão de análise desabilitado
antes da verificação/consentimento.

## Validação operacional obrigatória

1. Confirmar limites reais da organização Groq, ZDR, tier gratuito, segredos
   distintos e chave exclusiva de cada ambiente; conferir pool/Redis conjunto
   se compartilharem organização. Não configurar faturamento pago.
2. Com IA desligada, verificar boot sem segredo, segredo curto, Redis indisponível
   e configuração incompleta. Nenhuma dessas falhas deve liberar chamadas.
3. Validar Turnstile real: prova ausente, inválida, expirada, reutilizada,
   hostname/action incorretos e sucesso. Test keys não entram em staging/prod.
4. De dois clientes/redes, comparar identificadores pseudônimos dos contadores;
   forjar `x-forwarded-for` e `x-vercel-forwarded-for` e confirmar sobrescrita
   pela plataforma. Não registrar IP em claro. Não habilitar trust proxy amplo.
5. Disparar concorrência entre instâncias, mudar visitorId arbitrário e limpar
   navegador; verificar teto da rede e global. Testar rede compartilhada e
   mudança móvel sem invalidar assinatura por mudança de IP.
6. Simular falhas/timeouts, 429 e falha de escrita Redis após chamada. Conferir
   máximo de duas chamadas, reserva conservadora e ausência de conteúdo em
   logs, PostHog e Discord. Conferir alertas deduplicados 80%/100%.
7. Fechar/reabrir navegador e retornar à conversa; editar insumos e confirmar
   preservação do rascunho e invalidação de sugestões antigas. Não limpar
   materiais ao expirar credencial operacional.

## Referências verificadas

- [Groq: limites por organização](https://console.groq.com/docs/rate-limits)
- [Groq: dados e Zero Data Retention](https://console.groq.com/docs/your-data)
- [Groq: structured outputs](https://console.groq.com/docs/structured-outputs)
- [Gemini: termos de serviços gratuitos](https://ai.google.dev/gemini-api/terms)
- [Turnstile: validação servidor](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Vercel: headers de origem](https://vercel.com/docs/headers/request-headers)

### Triagem de dependências remanescentes

| Cadeia                                                                | Alcance observado / encaminhamento                                                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next → PostCSS                                                        | Build de CSS do repositório; não aceita CSS arbitrário do visitante. Atualização compatível precisa ser resolvida no lockfile e validada em tarefa de dependências antes de ampliar superfícies de CSS |
| Swagger → js-yaml                                                     | Geração de documentação do schema estático; Swagger desligado por padrão em produção. Atualizar Swagger/YAML em manutenção, mantendo o opt-in                                                          |
| PostHog CLI → axios, redirects, form-data, minimatch, brace-expansion | Tooling de build/source maps; não atende a rota de IA. Atualizar o bundle CLI com gate e proteger credenciais de build                                                                                 |
| Prisma config → deepmerge-ts, mysql2                                  | Tooling de configuração; runtime deste app usa adapter-pg. Atualizar Prisma sem downgrade nem trocar adapter; não aceitar configuração de conexão do usuário                                           |
| Mammoth → argparse → sprintf-js                                       | Importador usa o bundle browser de Mammoth; argparse é CLI. Atualizar cadeia upstream; acompanhar disponibilidade de correção de sprintf-js                                                            |

Esses encaminhamentos são triagem de exposição, não declaração de imunidade.
O audit geral ainda aponta 38 entradas (14 altas, 24 moderadas). Overrides
experimentais que o npm não aplicou às dependências fixadas foram removidos;
não se declara correção de PostCSS/YAML só por alterar package.json.

## Resultado da validação local

- `npm run lint` — API e web sem erros.
- `npm run format:check` — todos os arquivos formatados.
- `npm run typecheck` — API e web sem erros de tipos.
- `npm run test` — 38 suítes / 241 testes API e 27 suítes / 146 testes web.
- `npm run build` — Nest e Next compilados; oito páginas estáticas geradas.
- `npm run test:cov -w apps/api -- --runInBand` e `npm run test:cov -w apps/web -- --runInBand` — os 33 arquivos de produção novos/alterados presentes no
  relatório têm 100% de statements, branches, functions e lines. A cobertura
  geral mantém lacunas legadas em arquivos não alterados; nenhum threshold foi
  reduzido.
- `npm run test:operational -w apps/api` — Redis real descartável e HTTP real:
  concorrência por visitante, rede, reserva de tokens/minuto, último crédito
  mensal entre modelos, teto diário, escopo, idempotência, falhas cobradas,
  fallback, circuito 429 e DTO fechado. Provedor e Turnstile simulados.
- `npm run test:e2e` — seis cenários Chromium passaram, incluindo restauração,
  edição com URL correta e minimização antes do envio.
- `npm audit --omit=dev --json` — 16 entradas pendentes, sem críticas; triagem
  acima. Retorno diferente de zero é esperado enquanto persistirem achados.
- Staging — **não executado**: configuração de plataformas, chaves reais,
  limites da organização e ZDR não foram comprovados nesta execução.
