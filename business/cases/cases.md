# Processo de criação de metodologias a partir de casos reais

Este documento descreve o processo usado para transformar o currículo de um candidato real em uma metodologia de busca de emprego (ver `ana_julia/metodologia.md` e `joao_pedro/metodologia.md`).

> **Lição do caso Ana Julia:** a primeira versão da metodologia dela foi escrita a partir do briefing verbal, sem que o conteúdo do PDF tivesse sido efetivamente lido. Quatro premissas centrais estavam erradas e o documento precisou ser reescrito. As etapas 1 e 2 abaixo existem por causa disso e não são opcionais.

## 1. Estrutura de pastas e proteção do dado pessoal

```
business/cases/
  <nome_do_candidato>/
    curriculo.pdf       # nunca sobe ao git
    .gitignore          # ignora curriculo.pdf
    metodologia.md      # entregável final
```

- Nome da subpasta: primeiro + segundo nome em snake_case (`ana_julia`, `joao_pedro`).
- Ao receber um novo currículo: criar a subpasta, mover o PDF para dentro dela, criar o `.gitignore` **dentro da subpasta** com `curriculo.pdf`, e confirmar com `git status` que o PDF não aparece.
- **O `.gitignore` protege o PDF, mas não o `metodologia.md`**, que vai para o git contendo nome real, histórico profissional e análise crítica da pessoa. Verificar a visibilidade do repositório antes (hoje: privado). Se o repositório se tornar público, ou se o caso for usado como material de divulgação, anonimizar antes.
- Não copiar telefone, e-mail nem endereço para dentro do `metodologia.md` — não são necessários para a análise.
- Confirmar que o candidato consentiu com o uso do caso.

## 2. Leitura efetiva do currículo (nunca pular)

1. Ler o PDF pela ferramenta de leitura **e confirmar que o conteúdo realmente entrou em contexto** — não presumir que a leitura funcionou só porque a chamada não deu erro.
2. Extrair o texto também por `pdftotext -layout` e conferir o número de páginas com `pdfinfo`. Isso serve a dois propósitos: garantir a leitura e **simular o que um ATS enxerga**.
3. Sinais de problema de parsing a procurar no texto extraído: palavras coladas, ordem embaralhada, seções fora de lugar, bullets soltos, caracteres corrompidos, colunas fundidas.
4. **Comparar o briefing com o documento.** Divergências entre o que foi contado sobre o candidato e o que o currículo mostra são achado de primeira ordem — costumam apontar exatamente onde está o problema. Registrar as divergências no documento final.

## 3. Levantamento do perfil

Do currículo e do contexto:

- Idade, cidade/região de residência **e** região onde busca a vaga — são coisas diferentes e a distância entre elas importa (ver item de logística abaixo).
- Formação, status atual (cursando/formado, qual período, previsão de conclusão).
- Linha do tempo completa: experiências, duração real de cada uma, gaps e onde exatamente eles caem.
- Área/vaga-alvo e nível pretendido.
- Habilidades, certificações, idiomas e ferramentas — e se apontam para mais de uma trilha profissional.

## 4. Dados que só o candidato tem (levantar antes de concluir)

Sem isso o diagnóstico é hipótese, não conclusão:

- **Baseline do funil:** quantas candidaturas, desde quando, em quais canais, para quais cargos, quantos retornos (inclusive negativos). É o dado mais importante e o mais frequentemente ausente.
- **Qual currículo exatamente está sendo enviado** — pode não ser o arquivo que recebemos, ou pode ser uma versão dirigida a uma vaga específica sendo usada para todas.
- **Logística:** onde mora, tempo e custo de deslocamento até a região-alvo, transporte próprio/CNH. Para vagas de faixa salarial de entrada, proximidade é critério real de triagem.
- **Disponibilidade:** turno livre, carga horária possível, urgência de renda.
- **Pretensão salarial mínima viável** e se ela é compatível com a faixa da vaga-alvo.
- **Modalidade:** presencial, híbrido ou remoto é opção? Em áreas remota-friendly, não perguntar isso restringe o funil sem motivo.
- **Firmeza da escolha de trilha**, quando o perfil comporta mais de uma.
- **Objetivo pessoal do candidato** — é o fator que reordena todas as recomendações. Não presumir "a vaga ideal": perguntar o que ele realmente quer *agora*. Entrar num emprego rápido, maximizar salário, mudar de área, trabalhar remoto e conciliar com estudos são metas diferentes que levam a estratégias diferentes. Nos dois primeiros casos (Ana Julia e João Pedro) o objetivo é **entrar rápido**, não a vaga dos sonhos — o que significa priorizar a trilha com mais vagas (mesmo que não seja a de maior afinidade), aceitar faixa de entrada, e privilegiar volume/velocidade sobre seletividade. A metodologia deve dizer explicitamente qual objetivo está otimizando.

## 5. Auditoria dos ativos digitais

Tudo que o currículo linka faz parte do funil e será aberto pelo recrutador. Auditar antes de recomendar qualquer coisa sobre eles:

- LinkedIn: coerência com o currículo, foto, headline, se está ativo.
- GitHub/portfólio (perfis técnicos): os projetos citados no currículo existem publicamente? Têm README? O histórico sustenta a descrição? Descrição inflada de projeto inexistente é risco de credibilidade, não diferencial.
- Qualquer outro material de estudo ou repositório disponível que permita avaliar a profundidade técnica real.

## 6. Diagnóstico do currículo como artefato

- **Tamanho**: 1 página é o padrão para perfil de entrada; 2 páginas só com carreira longa e relevante.
- **Objetivo/resumo**: genérico demais, ou — pior — **dirigido a uma vaga/organização específica e sendo reutilizado para outras**. Nome de outra empresa na primeira linha é descarte quase automático.
- **Coerência entre o perfil vendido e a vaga pretendida**: currículo que exibe ferramental e senioridade acima da vaga gera leitura de "superqualificada, vai sair rápido" e derruba a candidatura. Ativo em uma trilha pode ser passivo em outra.
- **Tom e credibilidade**: linguagem inflada para o nível real de experiência (métricas de produção em projetos pessoais, STAR forçado) desconta credibilidade.
- **Ordem das seções**: o que é mais relevante para a vaga-alvo tem que vir primeiro.
- **Gaps**: com ou sem narrativa coerente na linha do tempo.
- **Experiência transferível**: comunicada como ativo ou omitida.
- **Erros de digitação e formatação** que sinalizam desleixo ou quebram parsing.
- **Uma versão por trilha**: quando o perfil comporta duas áreas, duas versões enxutas funcionam melhor que uma completa e ambígua. Versões dirigidas a uma vaga específica ficam em arquivo separado, nunca como currículo padrão.

## 7. Pesquisa do mercado específico

Sempre via pesquisa real, nunca por suposição:

- **Região**: densidade de vagas, polos relevantes, plataformas regionais próprias além dos agregadores nacionais.
- **Porte e estilo das empresas contratantes**: pequenos negócios locais (triagem manual, indicação, presencial) vs. médias vs. grandes corporações (ATS, processos sazonais estruturados).
- **Modalidade**: o quanto a área admite remoto — muda o tamanho do funil.
- **Características das vagas**: cargos de entrada existentes, quais filtros de experiência são reais, se o mercado trata as trilhas do candidato como categorias separadas, e quais níveis de contratação existem além do pretendido (ex.: júnior CLT além de estágio).
- **Canais efetivamente usados**: agregadores, plataformas de nicho, redes sociais, indicação, eventos e comunidades.
- **Como currículos desse perfil são avaliados** no setor.
- **Benchmark de cadência**, mesmo que qualitativo.
- **Estratégias de destaque do nicho**.

Distinguir sempre **fonte confirmada** de **inferência razoável**, e levar essa distinção até o documento final — a primeira versão das duas metodologias não fez isso, embora o processo já mandasse.

## 8. Redes já existentes do candidato

Verificar antes de recomendar canais frios. Ex-empregadores, supervisor de estágio, ONGs, faculdade, comunidades técnicas. Em mercados de contratação informal, indicação supera qualquer agregador — e costuma ser o canal mais forte e menos explorado.

## 9. Estrutura do `metodologia.md`

1. **Perfil real** — extraído do currículo, não do briefing.
2. **Objetivo pessoal** — o que ele quer agora (entrar rápido, salário, mudar de área, remoto…); é o que define a priorização de tudo que vem depois.
3. **Correções sobre o briefing** — quando houver divergência.
4. **Diagnóstico** — hipóteses ordenadas por probabilidade, separando o que é conclusão do que é hipótese não validada.
5. **Decisão de trilha** — quando o perfil comporta mais de uma, com o trade-off explícito (inclusive salarial), priorizada segundo o objetivo pessoal (ex.: se a meta é entrar rápido, a trilha com mais vagas vem primeiro mesmo que não seja a de maior afinidade); a decisão final é do candidato.
6. **Como o mercado contrata nesse segmento**.
7. **Estrutura ideal do currículo** — ajustes concretos, por versão quando aplicável.
8. **Que tipo de vaga procurar**.
9. **Canais e cadência** — sempre com a ordem certa: **corrigir o currículo antes de escalar volume**; quando o objetivo é entrar rápido, combinar uma frente local de alta conversão com uma frente online de alto volume.
10. **Dados que ainda faltam levantar**.
11. **Métrica de sucesso** — com baseline registrado antes das mudanças, atrelada ao objetivo pessoal (ex.: "entrar rápido" = primeira oferta boa, não a vaga ideal), e qual a próxima hipótese a testar se o resultado não vier.

## 10. Encerramento

- `git status` não deve listar o PDF.
- Datar o documento — mercado e canais mudam.
- Registrar qual eixo de segmentação o caso cobre (ver issue de metodologias por segmento de mercado), para mapear lacunas de cobertura entre os casos.
- Uma metodologia é hipótese priorizada até que o funil real do candidato a confirme. Revisar o documento quando os primeiros retornos chegarem.
