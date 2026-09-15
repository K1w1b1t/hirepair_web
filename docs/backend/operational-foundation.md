# Fundação operacional da API

A API aplica uma camada operacional global antes dos módulos de negócio:

- `x-global-trace-id` é aceito ou gerado na entrada, devolvido na resposta e
  propagado para chamadas de IA e jobs BullMQ;
- Pino emite logs estruturados. Produção registra apenas metadados; em
  desenvolvimento, headers e payloads são limitados e campos sensíveis são
  ofuscados;
- filtros globais convertem falhas Prisma e erros inesperados em respostas
  seguras com `traceId`, sem expor detalhes internos;
- alertas opcionais do Discord cobrem erros HTTP 500 e jobs que esgotaram todas
  as tentativas, com deduplicação de cinco minutos;
- `RolesGuard`, `@Roles()` e `@CurrentUser()` formam a base de autorização. A
  autenticação concreta será ligada a essa estrutura quando o fluxo de login
  for implementado;
- Swagger fica em `/docs` fora de produção. Em produção exige
  `API_DOCS_ENABLED=true`;
- o limitador global começa em 10 requisições por minuto por consumidor.

## Variáveis

`CORS_ORIGIN` é um array JSON de origens exatas, por exemplo
`["https://hirepair.com.br"]`. `DISCORD_WEBHOOK_URL` e `API_DOCS_ENABLED` são
opcionais. Nunca registre nem envie ao Discord corpos de currículo, credenciais
ou cabeçalhos de autenticação.
