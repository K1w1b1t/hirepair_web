# Avaliação da jornada — rubrica v1 (#23)

Esta rubrica foi fixada antes de comparar variantes. As fixtures não certificam
qualidade de um modelo. A jornada atual segue os ADRs 0015, 0018 e 0020:
seleção automática com lastro → redação → revisão/aprovação → PDF local.
Não se reintroduz confirmação humana obrigatória de fatos; DOCX e share ficam na #21.

## Corpus e referências

`journey-cases.v1.json` contém dez casos sintéticos e dois derivados anonimizados.
Os dois últimos usam como referência local os padrões dos currículos de estágio
em engenharia e de engenharia de software de `~/Documents/processos_seletivos`.
Nomes, empregadores, contatos, datas e números identificadores foram substituídos
ou removidos; os PDFs originais não são copiados nem enviados ao provedor.
As fichas de fatos e referências finais devem ser revisadas por uma pessoa antes
de servirem como gabarito aprovado. **Revisão humana inicial: pendente.**

Cada caso versiona entrada ruim/ausente, alvo, respostas, fatos permitidos,
referência, afirmações proibidas e desfecho completo/parcial esperado. A referência
não autoriza acrescentar ao candidato fatos que ele não relatou. Os casos cobrem
escrita com dificuldade, respostas curtas, vagas, negativas, desconhecimento,
desistência, correção temporal, currículo inflado e prompt injection.
O modo controlado é deliberadamente simples: devolve apenas dados das fontes,
sem tentar reproduzir a capacidade de um modelo. Não compara estilo profissional.

## Critérios de qualidade e bloqueio

Notas independentes de 0 a 4: **0** ausente/inaceitável; **1** falha grave;
**2** precisa de correção; **3** profissional e suficiente; **4** excelente.
Não existe média compensatória. Um caso completo exige ≥3 em cada dimensão:

| Dimensão               | Para receber 3 ou 4                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Relevância da pergunta | Pergunta clara e contextualizada na experiência, sem induzir realizações                   |
| Ganho de evidência     | Obtém ação individual, contexto ou resultado sustentado; aceita resposta curta suficiente  |
| Suficiência            | Encerra com material utilizável; respeita negativa, desconhecimento e pedido de parar      |
| Fidelidade             | Toda afirmação encontra suporte na ficha/relato; nenhuma inferência vira fato              |
| Proporcionalidade      | Autoria, senioridade, ferramentas e impacto proporcionais ao declarado                     |
| Clareza                | Português profissional, específico, legível, sem jargão vazio ou erros herdados da entrada |
| Estrutura das seções   | Seções relevantes, ordem apropriada ao perfil, experiências distinguíveis e sem repetição  |
| Apresentação           | Hierarquia, espaçamento e paginação legíveis; texto selecionável e nenhum corte no PDF     |

Custo/eficiência é uma dimensão operacional adicional: registrar chamadas, tokens,
latência e turnos. Respeitar 12 respostas, duas reformulações sem ganho, oito minutos
ativos e as reservas centrais existentes; não aprovar insistência infinita. Não
comparar custo estimado com tokens efetivamente informados como se fossem iguais.
Sem preço medido, `costUsd` é `null`.

**Bloqueios críticos:** invenção, uso de fato negado ou seleção obsoleta, inflação de
autoria, vazamento de dados/segredos, avanço indevido ou perda/ressurreição de dados.
Bloqueiam mesmo com notas altas. Afirmações proibidas detectadas em código são uma
rede adicional, incompleta: ausência dessas palavras não demonstra fidelidade.
Casos parciais são avaliados pelo encerramento seguro; não recebem aprovação de
currículo completo. Falha operacional e caso não executado nunca contam como aprovação.

A revisão humana registra revisor, data, hash do documento/relatório, notas por
dimensão, trechos que justificam as notas e falhas críticas. Um judge automático
não substitui esse registro nem avalia aparência sem ver o PDF. A rubrica e o
corpus mudam de versão quando se altera o critério, nunca para esconder regressão.

## Comandos e execução real

```sh
npm run eval:journey -w apps/api
npm run eval:journey -w apps/api -- --cases short-sufficient,long-vague
npm run test:journey:http -w apps/api
npm run test:e2e:integration -w apps/web
npm run eval:journey -w apps/api -- --live --cases reference-engineering,reference-software --agent --judge
```

O primeiro comando não usa rede, Redis nem IA. Os testes HTTP e Playwright usam
PostgreSQL `hirepair_eval` em 15434 e Redis descartável em 16379, ajustáveis por
`INTEGRATION_DATABASE_URL` e `INTEGRATION_REDIS_URL`. O stack recusa banco remoto
ou sem sufixo `_eval`; no modo controlado também recusa Redis fora do loopback. Apenas Groq e Turnstile externos
são controlados; os serviços, autorização, parsers, reservas, HTTP e IndexedDB são reais.
A CI não recebe chaves de IA. As janelas de 6.000 tokens/minuto são respeitadas
pelos testes de navegador, sem aumentar limites.

A estratégia é atualizada quando novos fatos chegam. Sem análise de arquétipo nem
estratégia anterior, usa a estrutura conservadora de entrada; isso não atribui
senioridade ou certificações à pessoa. Uma análise posterior substitui esse padrão.

Para preparar a infraestrutura local isolada (portas livres):

```sh
docker run --rm -d --name hirepair-eval-postgres -e POSTGRES_USER=hirepair -e POSTGRES_PASSWORD=hirepair_secret -e POSTGRES_DB=hirepair_eval -p 127.0.0.1:15434:5432 postgres:16-alpine
docker run --rm -d --name hirepair-eval-redis -p 127.0.0.1:16379:6379 redis:7-alpine
```

O modo real exige `GROQ_API_KEY`, `GROQ_ZDR_CONFIRMED=true`,
`GROQ_FREE_TIER_CONFIRMED=true`, `APP_ENV` e `AI_QUOTA_POOL` estáveis.
O Redis de quotas é o configurado pela aplicação (`REDIS_URL` ou fallback
`REDIS_HOST`/`REDIS_PORT`), preservado no modo real para compartilhar os limites
do pool. Apenas os testes controlados usam Redis isolado e namespace descartável. Consome as mesmas reservas
centrais, sem renovar a franquia do visitante: cinco chamadas/30.000 tokens antes
da redação e sexta chamada/36.000 tokens incluindo redação. Simulador e judge usam
uma identidade técnica estável separada, contando nos limites globais. A rodada
inteira possui teto adicional de 30.000 tokens reservados e dois casos, incluindo
a preparação, candidato e judge. A reserva é feita antes de cada chamada.
Respostas HTTP e respostas do candidato/judge são guardadas por etapa, com hash do
insumo. Ao retomar, etapas concluídas são reproduzidas sem cobrar novamente. Etapa
pendente ou hash diferente exige inspeção: nunca se repete uma chamada de resultado
incerto automaticamente. O checkpoint não permite renovar cotas.

Ao faltar capacidade, a execução termina com estado explícito e preserva os dados;
não espera automaticamente, aumenta cotas, troca chaves ou reinicia franquias.

`--agent` usa uma ficha fechada de fatos para simular o candidato; não recebe a
referência ou instruções de aprovação. `--judge` recebe evidências, conversa e
saída, sem identificar a variante de prompt/modelo. Saída inválida do judge falha.
O modelo efetivo, hashes de prompt/schema/instruções, consumo informado e latência
ficam no relatório. Hash de configuração não é transcrição do prompt.

Relatórios e credenciais de retomada ficam em `eval-runs/`, ignorado pelo Git,
com arquivos privados. Não publicar credenciais, transcrições pessoais nem os PDFs
originais. Relatórios determinísticos podem ser inspecionados localmente; evidências
versionadas devem ser sintetizadas e sanitizadas. A execução não envia alertas,
telemetria ou mensagens externas além da chamada Groq explicitamente solicitada.

Referências: [metodologia](../business/methodology/metodologia-do-sistema.md),
[fluxo web](../design/web/README.md), [operação](../backend/operational-foundation.md).
