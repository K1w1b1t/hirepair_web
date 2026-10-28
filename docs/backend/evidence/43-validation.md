# Validação da fundação #43

Execução local em 28/10/2026. Dados de teste sintéticos; nenhum provedor real
foi chamado. As fixtures do domínio distinguem entrada, operação, transição,
recolocação e especialista, incluindo relato vago e documento inflado.

| Comando                                          | Resultado                                                                                                                           |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                   | API, web e pacote compartilhado sem erros                                                                                           |
| `npm run format:check`                           | Todos os arquivos formatados                                                                                                        |
| `npm run typecheck`                              | API, web e pacote compartilhado sem erros                                                                                           |
| `npm run test`                                   | 72 suítes / 512 testes: API 249, web 233, domínio 30                                                                                |
| `npm run build`                                  | Nest, Next e pacote compilados; oito páginas estáticas                                                                              |
| `npm run test:cov -w apps/api -- --runInBand`    | Arquivos executáveis novos/alterados com 100% nas quatro métricas                                                                   |
| `npm run test:cov -w apps/web -- --runInBand`    | Arquivos executáveis novos/alterados com 100% nas quatro métricas                                                                   |
| `npm run test:cov -w @hirepair/interview-engine` | Pacote inteiro com 100% de statements, branches, functions e lines; threshold obrigatório                                           |
| `npm run test:operational -w apps/api`           | HTTP e Redis/Lua reais descartáveis; identidade, idempotência, limites entre sessões, concorrência, fallback/circuito e DTO fechado |
| `npm run test:e2e`                               | 11 cenários Chromium passaram, incluindo preparação, retomada, edição, exclusão, ditado e fallback para texto                       |

A cobertura geral de API/web ainda contém dívida em arquivos legados não tocados;
nenhum limiar foi reduzido. A #22 acompanha essa auditoria. Build requer acesso às
fontes do Google já usadas no projeto; testes HTTP e navegador requerem portas locais.

Capturas de fluxo com provedor e Turnstile simulados:
[objetivo explícito](./43-objetivo.png) e [plano inicial](./43-plano.png).
Não são evidência de Turnstile real, qualidade semântica de um modelo ou configuração
publicada. Ativação pública da IA permanece condicionada à validação de staging da #41.

Sem alteração de Prisma ou migrations. Roteiros das nove issues abertas foram
atualizados no GitHub, preservando as descrições existentes e sem encerrá-las.
Decisões e limites: [ADR](../../architecture/adr-0043-evidence-interview.md) e
[estratégia até a entrega](../../architecture/product-delivery-roadmap.md).
