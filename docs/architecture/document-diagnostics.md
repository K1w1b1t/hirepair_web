# Diagnóstico de documentos — #17

Implementação determinística e local, exclusivamente interna. Por decisão de produto revisada, não há tela, relatório ou lista de achados para o candidato: os dados servem à preparação das perguntas da entrevista. Referências: [ADR 0043](./adr-0043-evidence-interview.md),
[roteiro de entregas](./product-delivery-roadmap.md),
[metodologia §§4, 6, 7 e 11](../business/methodology/metodologia-do-sistema.md),
[fluxo visual](../design/web/README.md) e [modelo de dados](../database/README.md).

## Contrato v1

`diagnoseDocument` em `@hirepair/interview-engine` recebe documento identificado,
hash SHA-256 do texto local, confirmação de uso, metadados realmente disponíveis,
alvo, estrutura opcional e mês de referência explícito. Sem documento retorna
`status: absent`, sem achados. Relatos importados classificados como tais não
recebem diagnóstico documental. Isso não implementa a entrevista sem currículo da #15.

O contrato v1 é preservado; `rulesVersion=2` invalida caches do catálogo anterior após simplificação das regras. Cada `DiagnosticFinding` contém código, severidade, natureza, documento/hash,
citação e offsets UTF-16 no texto local (fim exclusivo), explicação, ação,
investigação opcional e restrição de exportação opcional. A regra de páginas usa
uma evidência textual vazia e a contagem preservada no documento do relatório;
não inventa uma citação. `rulesVersion` identifica este catálogo de regras.

O adaptador web calcula hashes separados para texto original, bytes do arquivo
quando disponíveis e texto sanitizado. `contextVersion` inclui alvo, metadados,
estrutura, confirmação de uso, experiências vinculáveis e mês de referência. Não
se presume equivalência de offsets entre texto sanitizado e original. Experiências
extraídas só contribuem com esclarecimentos quando origem/versão correspondem e o
trecho aparece literalmente no original. Isso não confirma fatos.

## Regras e limites

- Campos pessoais e formatos reconhecidos geram ação de remoção; onze dígitos
  sem rótulo ou formatação são hipótese, pois podem ser contato útil. O catálogo
  não é detector geral de PII nem substitui a sanitização independente da #41.
- Palavras possivelmente coladas são hipóteses; termos técnicos conhecidos têm
  exceções. Repetições literais e caracteres nulos/de substituição são observados
  no texto extraído. Esses sinais não comprovam layout, colunas, foto ou falha universal de ATS.
- A destinação explícita em objetivo/candidatura a empresa, hospital, clínica,
  instituto, organização, universidade ou escola restringe reutilização como padrão.
  Menção de empregador na história não gera esse achado. O catálogo lexical não
  reconhece todos os nomes próprios nem faz pesquisa externa.
- Datas são períodos presentes no documento, não prova de vínculo ou desemprego.
  Datas parciais usam limites conservadores; períodos sobrepostos são unidos.
  Um mês completo sem período registrado gera esclarecimento. Intervalo encerrado
  nos últimos 12 meses tem prioridade alta; os demais, média. Datas inválidas,
  futuras ou faltantes na estrutura disponível pedem esclarecimento. Não se infere
  automaticamente um intervalo entre a última experiência e hoje.
- Escopo absoluto, liderança abrangente, percentuais e expressões de escala são
  hipóteses de sustentação em entrevista. Habilidades em listas sem repetição literal
  fora da lista pedem exemplo; sinônimos e experiência omitida são limitações
  explícitas. Nenhuma dessas hipóteses acusa falsidade ou bloqueia exportação.
- Somente PDF fornece contagem e limites de páginas neste extrator. A/C admitem
  uma página; D/E duas; B uma se carreira curta estiver estabelecida e duas quando
  longa. Sem resolver essa exceção, só se alerta acima de duas e se informa a limitação.
  DOCX, TXT e texto colado não recebem estimativa de páginas.

## Persistência e integrações futuras

O IndexedDB conserva documentos e relatórios por versão. Achados legados sem hash
não são reaproveitados: a preparação recalcula. A revisão local é comparada em uma
transação; alterações concorrentes geram erro explícito. Corrigir texto invalida a paginação antiga e exige nova confirmação de uso; o arquivo
original permanece local até exclusão explícita e não é vinculado como arquivo da nova versão textual. Exclusão invalida
processamentos pendentes e não renova franquias de IA.

`attachDiagnostics` é aplicado à sessão preparada antes de `saveEngine`, na mesma revisão da preparação. A preparação preserva resoluções diagnósticas vigentes e cria somente
pendências não bloqueantes. `replan` incorpora tópicos com `criterionId: null` e
`diagnosticFindingId`; não cria critérios de vaga fictícios. A #15 decide perguntas,
insistência, coleta e confirmação; chama `resolveDiagnosticFinding` ao resolver a
investigação. Resolver o tópico não confirma fatos nem apaga o achado observado.
Reaplicar o mesmo contexto não reabre tópicos resolvidos. Mudanças de insumos
invalidam relatórios e pendências dependentes, preservando outras pendências e fatos.

`exportRestrictions` recebe relatório, hash e destino (`standard` ou `ats`). A #20
precisa validar o novo artefato, cujo hash não herda os achados do antigo. Restrições
trazem correção concreta, nunca impedem entrevista ou confirmação e não são um
bloqueio genérico de `canWrite`. Nenhum exportador é implementado aqui.

Os comandos locais futuros de revisão usam `applyCommand` e revisão esperada. O candidato não recebe os achados, limitações ou tópicos internos. A execução da conversa e a entrada na primeira pergunta pertencem à #15; não há entrevistador provisório nesta entrega.

Não há endpoint novo, chamada adicional ao provedor, alteração de cota, modelo Prisma, migration,
conta implícita ou evento de funil novo. Documentos importados mantêm a política de
retenção do ADR; texto de turnos da entrevista continua sob `purgeRaw`/confirmação.
Todos os testes usam fixtures sintéticas. Testes locais não comprovam qualidade
semântica geral, compatibilidade com todos os ATS nem ativação operacional de IA.
