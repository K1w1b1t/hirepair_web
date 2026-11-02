# ADR 0018 — Redação única e revisão final

Status: implementação da #18. Referências: ADR 0015, ADR 0043 e metodologia §§4–6, 8–9 e 11.

A redação usa a seleção automática vigente da entrevista guiada, ou confirmação
humana legada. Não exige nova confirmação humana antes de escrever. Nome,
título profissional e contatos são locais e não entram no prompt.

`POST /guest/resume-writing` executa uma tentativa, sem retry/fallback, depois de
validar liberação, estratégia e preflight. A operação `resume-writing` pode usar
a sexta chamada nos mesmos contadores; nenhuma franquia nova é criada. A saída
pode reservar até 3.000 tokens, mantendo o máximo total de 6.000 por chamada.

A resposta estruturada contém seções e unidades com IDs de fatos e critérios.
As validações rejeitam referências fora do snapshot, inconsistência de experiência,
excesso de densidade e números ou termos protegidos ausentes do suporte. Essas
verificações são conservadoras e incompletas semanticamente: um ID existente e
um schema correto não provam a verdade ou a proporcionalidade do texto. A rubrica
semântica continua exigindo avaliação humana de fidelidade, relevância, clareza e
proporcionalidade, integrada à #23.

O visitante persiste o pedido antes da chamada e o documento antes de anunciar
sucesso. Retomada de pedido pendente não faz nova chamada: o servidor não armazena
respostas pessoais. Falhas preservam história e motivo explícito. A geração aceita
emite `resume_generated` pelo helper existente, respeitando consentimento e funil.

A revisão apresenta um documento linear. Clicar numa seção abre seu editor;
salvar retorna à conferência sem confirmar fatos. Seções podem ser adicionadas
vazias e removidas. Não há escolha de tom ou regeneração nesta etapa.

A aprovação geral confirma declarações manuais e grava versão/hash do documento
e hash do perfil local. O original gerado e seu lastro permanecem separados das
alterações do usuário. Alterações posteriores retiram a aprovação. O contrato
`writing` é adicional ao agregado v1 e permanece local, sem Prisma ou conta.
Exportação e compartilhamento continuam em #20/#21.

Validação reproduzível do harness: `npm run eval:writing -w @hirepair/api`.
O relatório identifica fixtures sintéticas, resultado estrutural e revisão humana
pendente. Não gasta IA e não representa avaliação de modelo real. Antes de declarar
qualidade semântica, registrar revisor, exemplos, falhas e notas da rubrica.
