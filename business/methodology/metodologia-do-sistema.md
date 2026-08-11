# Metodologia do Sistema

> **O que é este documento.** É a definição da metodologia que o produto executa: o que
> é **regra dura** (o sistema decide e não negocia), o que é **parâmetro mixável** (o
> usuário escolhe dentro de opções válidas) e **como a informação entra** (o usuário
> conta, o sistema escreve).
>
> **O que não é.** Não é especificação técnica nem de interface. Aqui não se define se
> existe uma tela, um botão de gravar ou um wizard — só *o que precisa acontecer* e *em
> que ordem*. A forma de entregar isso no design é decisão posterior.
>
> **De onde vem.** Da pesquisa em [`../Metodologias Avançadas.txt`](../Metodologias%20Avançadas.txt),
> da dinâmica de ATS documentada em [`../plano-de-negocio.md`](../plano-de-negocio.md) §6,
> e principalmente dos casos reais em [`cases/`](./cases) — que é onde a teoria já
> apanhou da realidade duas vezes.
>
> Datado: agosto/2026. Mercado, canais e ATS mudam; este documento é revisável.

---

## 1. Princípio central: não existe currículo universal, existe currículo parametrizado

A pesquisa e os dois casos convergem no mesmo ponto: o erro não é estético nem de
esforço, é de **calibragem**. O mesmo texto que aprova um dev sênior reprova um
mecânico, e a mesma métrica que impressiona em vendas destrói a credibilidade de um
estudante descrevendo projeto pessoal.

Então o sistema não tem "um método". Ele tem **três camadas**:

| Camada | Quem decide | Exemplo |
|---|---|---|
| **1. Regras duras** | O sistema, a partir do arquétipo e do diagnóstico | Estrutura macro das seções, tamanho, o que nunca entra, o que a interface é obrigada a alertar |
| **2. Parâmetros mixáveis** | O usuário, dentro de opções pré-validadas | Tom de escrita, fórmula de impacto, profundidade de pesquisa, preset visual, idioma |
| **3. Entradas** | O usuário conta (de preferência falando), o sistema estrutura | Áudio contando como foi a experiência → fatos extraídos → texto redigido |

Camada 1 é o que protege o usuário de si mesmo. Camada 2 é o que faz o produto parecer
dele. Camada 3 é o que remove a parte chata — **escrever**.

---

## 2. O pipeline

Nenhuma etapa é opcional; algumas são automáticas e invisíveis.

1. **Objetivo pessoal** — o que a pessoa quer *agora*.
2. **Arquétipo** — qual regra dura de estrutura se aplica.
3. **Coleta** — a pessoa conta a história; o sistema transcreve, extrai e confirma.
4. **Diagnóstico** — o que está errado no material que ela *realmente* usa hoje.
5. **Decisão de trilha e de versões** — quantos currículos, para quais alvos.
6. **Redação** — fórmula de impacto + tom + taxonomia do setor.
7. **Empacotamento** — formato, preset visual, canal de entrega.
8. **Aderência à vaga** — o que a vaga pede vs. o que a pessoa tem. **Loop:** repete a
   cada candidatura e reentra nas etapas 6 e 7.
9. **Medição** — baseline do funil e revisão.

As etapas 1 a 7 acontecem uma vez (e são revisitadas quando algo muda). A etapa 8 é o
ciclo de uso recorrente: é ela que roda toda vez que a pessoa vê uma vaga que quer.

A ordem importa: **corrigir antes de escalar volume**. Nos dois casos reais essa foi a
recomendação central, e ela vale como regra do sistema — enquanto houver alerta grave
aberto no diagnóstico, o produto não deve incentivar disparo em massa.

---

## 3. Etapa 1 — Objetivo pessoal (a pergunta que reordena tudo)

**Regra dura: o sistema não começa a escrever sem um objetivo declarado.** Foi o achado
mais forte dos dois casos — em ambos a meta era **entrar rápido**, não conseguir a vaga
dos sonhos, e isso invertia recomendações que pareciam óbvias (priorizar a trilha com
mais vagas em vez da de maior afinidade, aceitar faixa de entrada, privilegiar volume).

Objetivos que o sistema precisa distinguir, porque levam a saídas diferentes:

| Objetivo | O que ele otimiza |
|---|---|
| **Entrar rápido** (urgência de renda) | Volume, trilha com mais vagas, faixa de entrada, duas frentes em paralelo |
| **Maximizar salário** | Seletividade, ênfase em impacto e senioridade, menos candidaturas e melhores |
| **Mudar de área** | Tradução de habilidades transferíveis, resumo de transição, taxonomia do setor novo |
| **Trabalhar remoto** | Ampliação geográfica do funil, ênfase em autonomia e ferramentas |
| **Conciliar com estudo/família** | Filtro de turno e carga horária como critério, não como detalhe |

O documento gerado deve **dizer explicitamente qual objetivo está otimizando**. Isso
também é o que permite medir sucesso depois (§10).

---

## 4. Etapa 2 — Arquétipo: a regra dura que muda por caso

O arquétipo é **derivado**, não escolhido livremente: sai da linha do tempo (existe
vínculo formal? há quanto tempo? na área-alvo?) mais a vaga-alvo declarada. Ele define a
estrutura macro — e essa estrutura é **regra dura**.

### 4.1 Matriz de estrutura por arquétipo

| | **A. Primeiro emprego / entrada** | **B. Transição de carreira** | **C. Operacional / blue-collar** | **D. Recolocação na mesma área** | **E. Especialista / técnico** |
|---|---|---|---|---|---|
| **Seção que lidera** | Objetivo + Formação | Resumo de transição (declara a mudança) | Cargo/ofício + certificações e habilitações | Resumo de senioridade | Stack + links vivos |
| **Ordem das seções** | Objetivo → Formação → Experiências para-profissionais → Habilidades | Resumo → Experiência retraduzida → Formação/Curso da área nova → Habilidades | Ofício → Certificações (NRs, CNH, SENAI) → Experiência (escopo e maquinário) → Formação | Resumo → Experiência (cronológico reverso) → Habilidades → Formação | Stack → Experiência com impacto → Projetos/links → Formação (pode ir ao fim) |
| **Tamanho** | 1 página, sem exceção | 1 página (2 só com carreira longa) | 1 página, blocos curtos | 1–2 páginas | 1–2 páginas |
| **Fórmula de impacto padrão** | CAR | CAR | Escopo + Conformidade | XYZ | XYZ |
| **O que preenche o vazio** | Trabalho escolar, voluntariado, negócio da família, gestão de rede social de comércio local | Habilidades transferíveis do setor antigo, com o vocabulário do novo | Escala da operação, maquinário nominal, zero acidentes, assiduidade | — | Projetos próprios, open source, writeups |
| **O que o sistema corta por padrão** | Micro-cursos irrelevantes, ensino médio detalhado, intercâmbio antigo | Ferramental e jargão do setor antigo que não traduz; títulos antigos como identidade | Abstrações de liderança e métricas percentuais de lucro | Experiências antigas irrelevantes (>10–15 anos) | Resumo existencial longo, datas de formação |
| **Canal típico** | Agregadores + programas de aprendiz + indicação | Agregadores/ATS + LinkedIn | Presencial, WhatsApp, SINE/CBO, indicação | Agregadores/ATS + rede | Plataformas globais, comunidade, referral |

### 4.2 Quando dois arquétipos se sobrepõem

Acontece e é o caso mais comum de verdade (Ana Julia é entrada **e** transição; João
Pedro é entrada **e** especialista). **Regra dura: o arquétipo é definido pela vaga-alvo,
nunca pela biografia.** E a consequência: se a pessoa quer perseguir dois alvos, ela
recebe **duas versões enxutas**, não uma versão completa e ambígua (§7).

---

## 5. Etapa 3 — Coleta: a pessoa fala, o sistema escreve

Esta é a aposta central de experiência do produto. **A parte insuportável de fazer
currículo é escrever**, não decidir. Digitar bem, em tom profissional, sob a pressão de
"isso vai me representar", é exatamente o que trava as pessoas — e é justamente o que um
modelo de linguagem faz melhor que a maioria dos candidatos.

### 5.1 O contrato com o usuário

Antes de qualquer captura, o sistema avisa, em linguagem simples:

- **Fala do jeito que você fala.** Pode ser desorganizado, pode ter "aí", pode voltar
  atrás. Ninguém vai ler o que você falou — só o resultado.
- **Não precisa saber o nome bonito das coisas.** É isso que o sistema faz.
- **O que você falar vai virar texto do currículo**, e você vai poder revisar tudo antes
  de qualquer coisa sair.
- **Onde a informação fica** e por quanto tempo (o áudio pode ser descartado depois da
  transcrição — decisão de LGPD a fechar, ver §12).

Esse aviso é **regra dura**: o usuário sempre sabe que está alimentando o currículo, e
sempre revisa antes de exportar.

### 5.2 O ciclo de cada relato

```
pergunta curta e concreta
      ↓
relato livre (falado, escrito, ou os dois)
      ↓
transcrição  ──→  extração de fatos estruturados
      ↓
confirmação dos fatos com o usuário ("foi isso?")
      ↓
redação no tom e na fórmula escolhidos
```

Duas regras duras dentro desse ciclo:

1. **A transcrição nunca vai crua para o currículo.** Ela é matéria-prima. O que vai é
   o texto redigido a partir dos fatos confirmados.
2. **O sistema não completa lacuna com invenção.** Se a pessoa não deu número, não
   aparece número. Se não deu ferramenta, não aparece ferramenta. Quando falta um dado
   que faria diferença, o sistema **pergunta** — e aceita "não sei" como resposta final,
   caindo para a formulação sem métrica.

### 5.3 O que o sistema pergunta (roteiro por relato de experiência)

Perguntas curtas, concretas, sem jargão de RH. Uma por vez.

- O que era o lugar e o que você fazia lá no dia a dia?
- Conta uma coisa difícil que aconteceu e o que você fez.
- Tinha quanta gente / quantos clientes / quanto movimento? (escala, quando existir)
- Deu certo? Como você sabe que deu certo?
- Você mexia com que máquina, sistema ou ferramenta?
- Por que você saiu?

A última pergunta não vai para o currículo — alimenta a narrativa de gap (§6.2) e a
preparação de entrevista.

**Perguntas de arquétipo** substituem ou complementam as acima: para primeiro emprego, o
roteiro cava escola, voluntariado, negócio de família, bico e rede social de comércio
local — porque é ali que está a matéria-prima. Para transição, cava as situações onde a
habilidade transferível apareceu (pressão, conflito, tradução de assunto técnico para
leigo, gestão de recurso).

### 5.4 Entradas aceitas

Áudio é o caminho preferencial, não o único: **áudio, texto digitado, e currículo antigo
importado** são as três portas de entrada, e as três desembocam no mesmo ciclo de
extração e confirmação. O currículo antigo importado tem um papel extra: é o insumo do
diagnóstico (§6).

---

## 6. Etapa 4 — Diagnóstico

### 6.1 A regra que nasceu de um erro nosso

No caso Ana Julia a primeira análise foi escrita a partir do que foi *contado* sobre o
currículo, sem ler o documento — e quatro premissas centrais estavam erradas. Depois
descobriu-se um segundo problema: o PDF analisado não era o que ela usava no funil, era
uma versão feita para uma única vaga.

Daí duas regras duras:

1. **O sistema diagnostica o artefato, não o relato.** Se há um currículo antigo, ele é
   lido de fato — inclusive pelo texto extraído, que é o que o ATS enxerga.
2. **O sistema pergunta se é *esse* o currículo que está sendo enviado.** Currículo
   dirigido a uma vaga sendo reusado para todas é uma das falhas mais caras e mais
   invisíveis que existem.

### 6.2 Achados que a interface é obrigada a mostrar

Isto é regra dura de produto: o diagnóstico não é opcional nem escondido atrás de
paywall. O usuário **vê** o que está errado; a correção assistida é que pode ser o valor
pago.

| Achado | Como o sistema trata | Severidade |
|---|---|---|
| **Gap na linha do tempo** | Aponta o período, e destaca que **gap recente pesa mais que gap antigo**. Pede a narrativa (que pode viver na entrevista, não no papel). Oferece resgatar experiência omitida que tape o buraco — inclusive informal ou curta | Alta se recente |
| **Descrição inflada** | Sinaliza escopo declarado acima do cargo real e explica o risco: não é ética, é **sustentabilidade em entrevista** | Alta |
| **Ferramenta/habilidade que não se sustenta** | Marca como passivo, não ativo, e propõe cortar | Alta |
| **Nome de outra empresa/vaga no documento** | Descarte quase automático; bloqueia exportação como "currículo padrão" | Crítica |
| **Quebra de parsing** (colunas, tabela, gráfico de nível, imagem, palavras coladas) | Mostra o texto como a máquina lê e corrige na origem | Crítica em modo ATS |
| **Dado sensível ou discriminatório** (CPF, RG, estado civil, nascimento, filiação, foto) | Remove por padrão e explica o porquê (LGPD + espaço semântico) | Alta |
| **Tamanho acima do arquétipo** | Aponta o que está competindo por espaço, não só "está grande" | Média |
| **Perfil acima da vaga** ("superqualificado, vai sair rápido") | Sinaliza que ativo numa trilha é passivo em outra | Média |
| **Erro de digitação / repetição** | Corrige | Baixa, mas cumulativa |
| **Currículo genérico sem palavras-chave da vaga** | Oferece a adaptação por vaga | Alta |

**Linguagem dos alertas:** descritiva e sem culpa. "Isso costuma derrubar candidatura
porque…", não "você errou". O público de maior dor é justamente o que mais desiste
diante de tom de reprovação.

### 6.3 Conclusão vs. hipótese

**Regra dura: o sistema separa o que é fato do que é suposição.** Nos dois casos essa
distinção foi decisiva — sem o baseline do funil, todo diagnóstico é hipótese
priorizada. O produto deve dizer isso, não fingir certeza. Um diagnóstico que soa
absoluto e erra queima a confiança inteira; um que se declara hipótese e acerta ganha
duas vezes.

---

## 7. Etapa 5 — Trilhas e versões

- **Uma versão por alvo.** Duas trilhas = duas versões enxutas. Nunca uma versão
  completa e ambígua, que é o que gera a leitura de incoerência.
- **Versão dirigida a uma vaga específica fica marcada como tal** e nunca vira o
  currículo padrão. Isso é regra dura, e nasceu direto do caso Ana Julia.
- **Versão presencial e versão ATS são artefatos diferentes** do mesmo conteúdo: a
  presencial pode ser mais acolhedora e visualmente respirada; a de ATS é linear e
  limpa. Se o mesmo arquivo tiver de servir aos dois usos, **manda a regra do ATS**.
- **A escolha da trilha é do usuário.** O sistema explicita o trade-off (inclusive
  salarial) e recomenda segundo o objetivo declarado — não decide por ele.

---

## 8. Etapa 6 e 7 — Parâmetros mixáveis

Aqui é onde o usuário mexe. Todas as opções são **pré-validadas**: não existe combinação
possível que quebre uma regra dura. A liberdade é real, mas dentro do corredor seguro.

### 8.1 Tom de escrita

| Tom | Como soa | Padrão para |
|---|---|---|
| **Direto e simples** | Frases curtas, zero jargão | Operacional, primeiro emprego |
| **Profissional neutro** | Padrão de mercado, sóbrio | Recolocação, uso geral |
| **Consultivo** | Vocabulário de negócio, foco em impacto | Transição, gestão, comercial |
| **Técnico** | Denso em ferramenta e arquitetura | Especialista, tech, dados |
| **Acolhedor** | Ênfase em cuidado, atendimento e pessoas | Saúde, educação, atendimento, ONG |

**Trava:** o tom altera a redação, nunca os fatos, e nunca o nível de senioridade
declarado. Tom técnico não transforma script de estudo em sistema de produção.

### 8.2 Fórmula de impacto

- **XYZ** — *realizou [X], medido por [Y], fazendo [Z]*. Para métrica rígida: tech,
  vendas, finanças, gestão.
- **CAR** — *desafio → ação → resultado*. Para qualitativo: transição, primeiro emprego,
  atendimento, saúde, RH, design.
- **Escopo + Conformidade** — *escala da operação + norma cumprida + ausência de
  incidente*. Para operacional, indústria, logística, saúde primária.

**Travas (combinações proibidas):**

- XYZ com número que o usuário não forneceu → cai para CAR.
- XYZ em projeto pessoal ou trabalho escolar → cai para CAR. ("Automatizou 100% do
  fluxo… alta confiabilidade e baixa latência" em script de estudo desconta
  credibilidade — achado do caso João Pedro.)
- Percentual de lucro em vaga operacional → cai para Escopo + Conformidade.

### 8.3 Palavras-chave e taxonomia do setor

- Densidade **baixa / média / alta**, e idioma **PT / EN** conforme a vaga descreve.
- Regra dura: palavras-chave **diluídas na narrativa**, nunca em lista solta — lista
  descontextualizada é lida como fraude de keyword stuffing.
- Regra dura: só entra termo com **lastro real**. Renomear "cuidava do estoque" para
  "gestão de cadeia de suprimentos" é legítimo se for verdade e a vaga usar esse termo;
  inserir ferramenta que a pessoa não usa não é.
- A base de taxonomia por setor é conhecimento do produto e cresce com o uso.

### 8.4 Profundidade da pesquisa

Camada opcional (e candidata natural a monetização, ver `plano-de-negocio.md` §7).

| Nível | O que entrega |
|---|---|
| **Nenhuma** | Só estrutura e redação a partir do que o usuário contou |
| **Aderência à vaga** | Lê a descrição da vaga e adapta termos, ordem e resumo — é o loop de §9 |
| **Aprofundamento do caso** | Cruza objetivo, região, trilha e nível: que vagas existem de fato, quais filtros são reais, quais canais funcionam ali, benchmark de cadência |
| **Aprofundamento de mercado** | Porte e estilo das empresas contratantes, plataformas regionais, quanto a área admite remoto, como currículos desse perfil são avaliados no setor |

Regra dura em qualquer nível: **distinguir fonte confirmada de inferência razoável**, e
levar essa distinção até a saída. Foi a instrução que o processo manual já tinha e que
nós mesmos descumprimos na primeira rodada dos dois casos.

### 8.5 Preset visual

Design é escolha do usuário **dentro de presets fechados**, todos aprovados em parsing:
coluna única, sem tabela estrutural, sem gráfico de nível, sem ícone que carregue
informação, fonte legível, hierarquia por peso e espaço.

O que varia: paleta (conjunto pequeno e nomeado), densidade do espaçamento, família
tipográfica, e presença ou não de uma faixa/detalhe de cor no cabeçalho.

O que não varia (regra dura): **duas colunas, foto, barra de habilidade e ícone
informativo não existem como opção.** Não é limitação de escopo — é o principal motivo
de eliminação silenciosa documentado na pesquisa ("efeito Canva": ~57% de sucesso de
parsing contra ~92% de um PDF limpo).

Se algum dia existir um preset visualmente livre para entrega em mão, ele nasce
**marcado como não-ATS** e o sistema recusa oferecê-lo como arquivo de submissão em
portal.

### 8.6 Formato e canal de entrega

- **PDF de texto** (gerado de processador de texto, não rasterizado) como padrão.
- **DOCX** quando o portal ou o recrutador preferir — é o formato de melhor parsing.
- **Imagem nunca.** Zero por cento de leitura; eliminação sumária.
- **WhatsApp** é canal de primeira classe para o público operacional e de baixa renda —
  o arquivo tem de ser leve e o nome do arquivo, legível e profissional.
- **Teste de integridade** antes de liberar: o sistema mostra o texto extraído do que vai
  ser enviado. É a versão automatizada do "copiar e colar no bloco de notas".

---

## 9. Etapa 8 — Aderência à vaga (o loop por candidatura)

O usuário informa a vaga em que quer se inscrever, e o sistema compara o que a vaga pede
com o que ele tem. É a etapa de maior alavanca do produto e a única recorrente.

### 9.1 Por que é a etapa de maior alavanca

Os três principais ATS do país (Gupy/Gaia, Pandapé, Sólides) pontuam aderência contra
critérios que o **recrutador configura por vaga** — não existe critério universal. Sem o
texto da vaga, o sistema está otimizando para um alvo imaginado; com o texto, está
otimizando para o alvo real. E o erro nº 1 documentado é justamente a pulverização:
disparar o mesmo PDF para 100 vagas distintas.

É também a unidade natural de cobrança: uma vaga, uma análise, uma versão — que casa
exatamente com o modelo pay-per-use via PIX escolhido em `plano-de-negocio.md` §4.

### 9.2 O que entra

O texto da vaga, informado pelo usuário: colado, importado de um link ou capturado de
print. **Regra dura: o sistema trabalha só com o texto que o usuário forneceu.** Não
infere requisito a partir do nome da empresa, nem completa a descrição com "o que
normalmente se pede nesse cargo" — isso levaria a otimizar para uma vaga que não existe.

### 9.3 Classificação dos requisitos

O valor não está em contar quantos requisitos batem; está em separar **quais requisitos
importam**. Descrição de vaga é notoriamente inflada — parte dela é lista de desejos do
gestor, não filtro real.

| Classe | Exemplos | Tratamento |
|---|---|---|
| **Eliminatório** (objetivo e verificável) | Registro em conselho (CRMV, CREA, COREN), CNH de categoria específica, NR válida, formação concluída obrigatória, idioma como atividade-fim, turno/disponibilidade, presencial em outra cidade | Se falta, o sistema **avisa com clareza** e diz o que resolveria (curso, certificação, habilitação) |
| **Negociável** | "X anos de experiência", "desejável", ferramenta específica próxima de outra que a pessoa domina, semestre do curso | Não impede candidatura. Vira argumento a construir no currículo |
| **Decorativo** | Wishlist de 15 tecnologias, "proatividade", "vontade de aprender", "perfil dinâmico" | Alimenta taxonomia e tom; não entra na decisão de aplicar ou não |

A fronteira entre negociável e eliminatório é **heurística**, e o sistema deve admitir
isso em vez de fingir precisão. "Quais filtros de experiência são reais" é pergunta de
pesquisa de mercado (§8.4), não de leitura literal do anúncio.

### 9.4 As três saídas — e nenhuma delas é um número

Para cada requisito relevante, uma de três conclusões:

1. **Tem, e está no currículo.** Nada a fazer, além de conferir se o **termo e o idioma**
   usados são os da vaga — que é o que o match semântico premia.
2. **Tem, e não está no currículo.** É o achado de ouro, e o mais frequente. Vira
   pergunta → o usuário conta (áudio, §5) → novo bullet com lastro real. Foi exatamente
   o que aconteceu no caso Ana Julia: ela **atendia** ao requisito de experiência prática
   (estágio clínico + um ano de voluntariado) e se autoexcluía das vagas.
3. **Não tem.** Aí a classificação de §9.3 decide: se é eliminatório, o sistema diz isso
   honestamente e aponta o caminho; se não é, a recomendação padrão é **tentar**.

### 9.5 Regra dura: o sistema não desencoraja candidatura

Duas travas, e as duas são decisões de produto, não detalhes:

- **Nunca exibir score numérico de aderência.** É falsa precisão — a nota que decide é a
  do ATS, calculada com pesos proprietários que ninguém de fora conhece. Um número nosso
  ao lado da palavra "aderência" seria lido como previsão de aprovação, o que §11 proíbe.
- **O padrão é "vale tentar".** O sistema só sinaliza "provavelmente não vale" quando há
  requisito **eliminatório, objetivo e verificável** faltando — e sempre dizendo qual e
  por quê. Quando o objetivo declarado é *entrar rápido* (§3), candidatar-se a match
  parcial é estratégia correta, não desperdício. Uma tela que devolve "45%" transforma um
  produto de destravar candidatura em produto de travar candidatura.

### 9.6 O que este loop não autoriza

Ver a lista de requisitos é a maior tentação de inflar que vai existir no produto. Os
guardrails ficam mais importantes aqui, não menos:

- **Termo só entra com lastro.** O sistema pergunta "você já fez isso?" e aceita **não**
  como resposta final. Requisito não atendido não vira habilidade declarada.
- **Não copiar frase da descrição da vaga para dentro do currículo.** Espelhamento
  literal soa artificial na leitura humana e não se sustenta em entrevista. O que se
  espelha é o **vocabulário**, aplicado à experiência real.
- **A versão dirigida a esta vaga nasce marcada como tal** e nunca vira o currículo
  padrão (§7). Regra que veio de erro real: um currículo com o nome de outra organização
  na primeira linha é descarte quase automático.

### 9.7 Subprodutos do loop

Três coisas caem no colo por consequência, e todas valem mais que a análise em si:

- **Taxonomia real do mercado-alvo.** Vagas coletadas ensinam o vocabulário que de fato
  circula, por cargo e por região — base viva para §8.3, melhor que qualquer lista
  estática de palavras-chave.
- **Baseline do funil quase de graça.** Cada análise de vaga é um registro de candidatura:
  quando, qual cargo, qual canal. Resolve o dado que §10 chama de mais valioso e mais
  frequentemente ausente, sem pedir ao usuário que preencha planilha.
- **Preparação de entrevista.** O requisito da saída 2 — o que a pessoa tem mas não sabia
  que contava — é precisamente o que ela precisa estar pronta para contar em voz alta.

## 10. Etapa 9 — Medição

**Regra dura: registrar o baseline antes de mudar qualquer coisa.** Quantas candidaturas,
desde quando, em quais canais, para quais cargos, quantos retornos — inclusive os
negativos, que são sinal de que passou da triagem.

Sem baseline não há como saber se o produto funcionou, nem para o usuário, nem para nós.
É também o dado mais frequentemente ausente e o mais valioso que o sistema pode acumular:
é o que transforma a metodologia de conjunto de boas práticas em algo mensurado.

Depois: candidaturas por canal, retornos, etapas automatizadas alcançadas, entrevistas.
E a **próxima hipótese a testar** se o resultado não vier — nos dois casos, as hipóteses
seguintes eram pretensão salarial incompatível ou saturação real do mercado local, não
mais o currículo.

Sucesso é medido contra o objetivo declarado (§3): quem quer entrar rápido tem sucesso na
primeira oferta boa, não na vaga ideal.

---

## 11. Guardrails — o que o sistema nunca faz

1. **Nunca inventa fato, número, ferramenta ou vínculo.** Sem exceção, em nenhum tom, em
   nenhuma fórmula.
2. **Nunca promete aprovação em triagem.** O mecanismo real dos ATS brasileiros é
   pontuação de aderência configurada pelo recrutador; nenhum deles pontua por pagamento
   do candidato. A promessa é de **processo** ("adaptamos seu currículo à linguagem da
   vaga"), nunca de **resultado**.
3. **Nunca exporta com dado sensível** que não sirva à avaliação de competência.
4. **Nunca oferece um artefato que quebra parsing** como arquivo de submissão.
5. **Nunca esconde diagnóstico atrás de paywall**, nem deixa o usuário preencher tudo
   para só então revelar cobrança.
6. **Nunca publica a transcrição crua** nem usa o relato falado sem confirmação.
7. **Nunca decide a trilha pelo usuário** — explicita o trade-off e recomenda.
8. **Nunca trata omissão legítima como esconder.** Currículo é seleção, não confissão;
   mas o sistema deve preparar a resposta honesta para o que ficou fora.
9. **Nunca exibe score de aderência nem desencoraja candidatura** sem requisito
   eliminatório objetivo (§9.5). O produto existe para destravar candidatura, não para
   travá-la.

---

## 12. Decisões ainda abertas

Registradas explicitamente para não virarem premissa silenciosa:

- **Retenção do áudio.** Descartar após a transcrição é o caminho mais seguro em LGPD e
  o mais barato; guardar permite reprocessar e melhorar. A decisão muda o texto do
  consentimento (§5.1) e o desenho de armazenamento.
- **Transcrição local vs. remota.** Toca direto a tese offline-first do plano de negócio
  (§2 de `plano-de-negocio.md`): se a transcrição exigir rede, o áudio deixa de ser
  gratuito por natureza e passa a ser feature online. Isso precisa ser resolvido antes de
  o áudio ser vendido como diferencial do plano gratuito.
- **Quais arquétipos entram na v1.** O plano de negócio escolheu dois segmentos (baixa
  renda e transição de carreira); a matriz de §4.1 tem cinco arquétipos. Provavelmente a
  v1 implementa **C + A** (operacional e primeiro emprego, o gratuito) e **B**
  (transição, o premium), deixando D e E para depois.
- **Onde o diagnóstico termina e o produto pago começa.** A regra 5 de §11 fixa que ver o
  problema é grátis; falta definir exatamente o que é a camada paga — reescrita? pesquisa
  de aprofundamento? adaptação por vaga? Provavelmente as três, em níveis. Aplica-se
  também ao loop de vaga (§9): ver a lista de requisitos que faltam pode ser grátis e a
  reescrita paga, ou a análise inteira pode ser a unidade de cobrança.
- **Como a vaga entra.** Colar texto sempre funciona. Importar por link é mais confortável
  e é o que o usuário vai querer, mas ler página de Gupy/LinkedIn/Catho automaticamente
  provavelmente colide com os termos de uso dessas plataformas — verificar antes de
  prometer. Captura por print exige OCR, o que reabre a questão local vs. remoto.
- **Precisão da classificação de requisitos** (§9.3). A fronteira entre eliminatório e
  negociável é hoje heurística. Errar para o lado "eliminatório" é o erro caro: faz a
  pessoa não se candidatar. Enquanto não houver dado de funil suficiente, o viés do
  sistema deve ser **para baixo** — classificar como negociável na dúvida.
- **Cobertura de casos.** Dois casos, ambos jovens, ambos em São Paulo, ambos com
  objetivo "entrar rápido". Faltam casos de: transição de carreira madura, operacional
  puro, recolocação sênior, e alguém cujo objetivo **não** seja velocidade. A matriz de
  §4.1 nas colunas C, D e E está mais apoiada em pesquisa que em caso real — e a lição
  dos dois primeiros casos é justamente que pesquisa sem caso real erra premissa.

---

## 13. Como este documento evolui

Cada caso real novo roda o processo manual de [`cases/cases.md`](./cases/cases.md) e
depois responde a uma pergunta: **que regra deste documento o caso confirmou, contradisse
ou revelou como ausente?** A resposta vem para cá.

Uma metodologia é hipótese priorizada até o funil real confirmar. Vale para o candidato e
vale para nós.
