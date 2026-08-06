# Candidate Assistant

Aplicativo **mobile-first (React Native)**, **offline-first**, para ajudar
brasileiros a montar currículos que passem na triagem automática (ATS) e caibam no
WhatsApp — sem cobrança predatória.

## A ideia

No Brasil, fazer um bom currículo é uma dificuldade real e disseminada. Os apps que
existem ou são caros e cheios de "pegadinhas" de cobrança, ou geram currículos
bonitos que a IA dos ATS (Gupy, Kenoby, etc.) não consegue ler. Este produto ataca
os dois pontos:

- **Funciona offline:** monta e gera o PDF localmente, sem gastar a franquia de
  dados — pensado para quem tem acesso precário à internet.
- **PDF compatível com ATS:** estrutura limpa, sem colunas/tabelas/imagens que
  quebram o parser dos robôs de recrutamento.
- **Sem cobrança enganosa:** claro sobre o que é grátis e o que é pago.

### Dois públicos

- **Baixa renda / operacional** — plano **gratuito**: monta, exporta PDF e envia por
  WhatsApp/e-mail rodando local. Monetização via anúncios discretos (quando online).
- **Transição de carreira** — plano **premium**: login com Google, currículos salvos
  na conta e **IA para otimizar** o currículo (reescrever experiências, inserir
  palavras-chave de ATS), pago por currículo.

## Este repositório

Backend do produto (**NestJS** + **PostgreSQL** via **Docker Compose**), responsável
pelas funcionalidades online: conta Google, IA de otimização, pagamentos e anúncios.
O app React Native é um projeto separado.

**Status:** fase de pesquisa e planejamento — implementação técnica ainda não iniciada.

## Documentação de negócio

O plano de negócio e o planejamento do MVP estão em [`business/`](./business/):

- [`business/plano-de-negocio.md`](./business/plano-de-negocio.md) — hipótese,
  públicos, concorrência, monetização e dinâmica de ATS no Brasil.
- [`business/proximos-passos-mvp.md`](./business/proximos-passos-mvp.md) — roteiro
  para definir o MVP: pesquisa de público, funcionalidades, marca/linguagem,
  gateway de pagamento, LGPD e demais regulações.
