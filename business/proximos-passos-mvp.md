# Próximos Passos — Definição do MVP

Este documento é o roteiro para sair de "sei que quero atacar **baixa renda** e
**transição de carreira**" até um MVP definido e pronto para construir. Está
organizado por perguntas que você mesmo levantou. Cada seção tem **o que decidir**,
**como chegar lá** e um **checklist**.

Ordem recomendada: 1 (pesquisa de público) → 2 (funcionalidades do MVP) →
3 (marca e linguagem) em paralelo → 4 (pagamento) e 5 (regulação) antes de publicar.

---

## 1. Como pesquisar melhor o público

Você já escolheu os dois segmentos; falta **conhecê-los a fundo** para não construir
no achismo. O objetivo desta fase é responder: qual é a dor exata, o que a pessoa já
tenta hoje, onde ela trava, e quanto (se algo) está disposta a pagar.

### 1.1 O que decidir
- Persona detalhada de cada segmento (contexto, celular que usa, plano de dados,
  nível de letramento digital, canal onde busca vaga).
- A **dor principal** de cada segmento (uma frase por persona).
- Disposição a pagar (quanto, por quê, em que formato — PIX único vs. assinatura).

### 1.2 Como chegar lá (métodos, do mais barato ao mais caro)
1. **Entrevistas qualitativas — 10 a 15 pessoas por segmento.** É o passo mais
   importante. Roteiro semiestruturado de ~30 min. Não pergunte "você usaria um
   app assim?" (todo mundo diz sim). Pergunte sobre o **último currículo que fez**:
   como fez, onde travou, quanto tempo levou, o que aconteceu depois.
   - Baixa renda: recrute em grupos de emprego no Facebook/WhatsApp, CRAS,
     cursos técnicos (SENAI/SENAC), agências do trabalhador.
   - Transição de carreira: grupos de LinkedIn, comunidades de bootcamp, mentores
     de carreira.
2. **Entrevistas com recrutadores/RH (5–8).** Descobrir o que de fato reprova
     currículo, uso de ATS, tempo de triagem — do outro lado do balcão.
3. **Análise de currículos reais.** Peça a recrutadores parceiros exemplos
     anonimizados de currículos que passaram e que foram descartados.
4. **Dados de busca (grátis).** Google Trends, Ubersuggest, "pesquisas relacionadas"
     do Google para "como fazer currículo", "modelo currículo ATS", "currículo Gupy".
     Mede tamanho e sazonalidade da demanda.
5. **Reviews de concorrentes (grátis).** Ler 1–2 estrelas de Resumee, Bolt Resume,
     Meu Currículo Perfeito na Google Play BR e Reclame Aqui — as reclamações são o
     mapa dos gaps (tradução ruim, template que quebra na Gupy, cobrança surpresa).

### 1.3 Como saber que já pesquisou o suficiente
Quando as entrevistas começam a **se repetir** (saturação) e você consegue escrever
a dor de cada persona em uma frase sem inventar. Regra prática: pare quando 3
entrevistas seguidas não trouxerem nada novo.

### Checklist
- [ ] Roteiro de entrevista escrito (candidatos + recrutadores).
- [ ] 10–15 entrevistas por segmento realizadas.
- [ ] 5–8 recrutadores entrevistados.
- [ ] Análise de 20+ currículos reais (aprovados vs. descartados).
- [ ] Levantamento de volume de busca dos termos-chave.
- [ ] Síntese: 1 documento de persona + dor + willingness-to-pay por segmento.

---

## 2. Como saber exatamente as funcionalidades do MVP

Regra de ouro do MVP: **o menor conjunto de funcionalidades que resolve UMA dor de
ponta a ponta**. Tudo que não for necessário para provar a hipótese central fica de
fora da v1.

### 2.1 Método para chegar ao escopo
1. Escreva a **jornada completa** do usuário para cada segmento (do "preciso de um
   currículo" até "enviei para a vaga").
2. Marque em que ponto está a **dor principal** (achada na pesquisa da seção 1).
3. O MVP é só o caminho que atravessa essa dor. Corte todo o resto.
4. Use **MoSCoW** (Must / Should / Could / Won't) para classificar cada
   funcionalidade candidata.

### 2.2 Escopo candidato (hipótese — refinar após seção 1)

**Must have (v1):**
- Formulário guiado que monta o currículo (estrutura pré-definida, à prova de erro).
- Geração de **PDF simples, ATS-friendly** (sem colunas/tabelas/imagens que quebram
  parser), **100% offline**.
- Compartilhamento por **WhatsApp** e e-mail.
- Modo gratuito funcionando local (ler arquivos locais, montar, exportar).

**Should have:**
- Login com Google + salvar currículos na conta (habilita premium).
- IA de otimização (reescrever experiências, gerar resumo, inserir palavras-chave
  de ATS) — **pago por currículo**.
- Anúncios (banner) quando online, no gratuito — via arquitetura híbrida
  (ver 2.3).

**Could have (depois do MVP):**
- Múltiplos templates visuais, análise de aderência a uma vaga específica,
  histórico de versões, score de ATS.

**Won't have (explicitamente fora da v1):**
- Multi-idioma, integração direta com ATS, web/desktop, marketplace de vagas.

### 2.3 Arquitetura híbrida (offline + monetização)
O gratuito precisa rodar offline **e** exibir anúncios — que exigem internet.
Resolver assim:
- Edição e geração de PDF: **sempre offline**.
- Anúncios (AdMob): **cache** de peças quando houver Wi-Fi; ou exigir conexão
  pontual só no momento do download gratuito do PDF (banner + 1 interstitial no
  export, sem travar o uso).
- IA e salvar-na-conta: **exigem online** por natureza (chamam o backend NestJS).

### 2.4 Métrica de sucesso do MVP
Definir antes de lançar. Ex.: % de usuários que geram **e baixam/compartilham** o
currículo; taxa de conversão gratuito → IA paga; retenção de 7 dias.

### Checklist
- [ ] Jornada do usuário desenhada por segmento.
- [ ] Funcionalidades classificadas por MoSCoW.
- [ ] Escopo v1 fechado e escrito (o que entra e o que **não** entra).
- [ ] Arquitetura híbrida (offline/online) definida.
- [ ] Métrica de sucesso do MVP definida.

---

## 3. Como definir marca e linguagem

Marca aqui é sobretudo **confiança e clareza** — o diferencial contra os
concorrentes é justamente não enganar. A linguagem muda por segmento.

### 3.1 O que decidir
- **Nome do produto** (distinto do nome técnico do repo `candidate_assistant_api`).
- **Posicionamento / promessa** (uma frase). Ex.: "o currículo que passa no robô
  da Gupy e cabe no seu WhatsApp — sem pagar assinatura".
- **Tom de voz por segmento:**
  - Baixa renda / operacional: linguagem **simples, direta, acolhedora**, sem
    jargão de RH. Passo a passo, evitar termos como "ATS" sem explicar.
  - Transição de carreira: linguagem mais **consultiva/profissional**, pode usar
    termos técnicos (ATS, palavras-chave, aderência).
- **Identidade visual** (cores, logo, tipografia) e **favicon/ícone do app**.
- **Canais de comunicação por segmento:** TikTok/Instagram/grupos de WhatsApp para
  baixa renda e jovem; LinkedIn para transição de carreira.

### 3.2 Como chegar lá
- Extrair o **vocabulário real** das entrevistas (seção 1): use as palavras que o
  público usou, não as suas.
- Testar 2–3 nomes e a promessa com o próprio público entrevistado.
- Checar disponibilidade de nome: domínio, @ nas redes, nome na Google Play,
  e **marca no INPI** (registro de marca — ver seção 5.4).

### Checklist
- [ ] Nome escolhido e disponível (domínio, redes, Play Store, INPI).
- [ ] Promessa/posicionamento em uma frase.
- [ ] Guia de tom de voz por segmento.
- [ ] Identidade visual mínima (logo, cores, ícone do app).
- [ ] Canais prioritários por segmento definidos.

---

## 4. Integração com gateway de pagamento

Você já tem **CNPJ**, o que facilita: gateways sérios exigem PJ (ou pelo menos
habilitam limites melhores). O premium usa preferencialmente **PIX** (menor fricção,
sem assinatura predatória), com pagamento por currículo otimizado.

### 4.1 O que decidir
- **Modelo de cobrança:** pay-per-use via PIX (recomendado) vs. assinatura vs.
  ambos. Ver referências de preço em `plano-de-negocio.md` §4.3.
- **Gateway.** Opções no Brasil (validar taxas e maturidade de SDK mobile):
  - **Mercado Pago** — ótimo suporte a PIX, SDK RN razoável, MDR competitivo.
  - **Stripe** — excelente DX/SDK, já suporta PIX no BR; bom se pensar em assinatura.
  - **Pagar.me / Stone** — foco BR, PIX + cartão.
  - **Asaas / Iugu** — bons para PIX recorrente e split; foco PME.
  - **Gerencianet/Efí** — PIX barato.
- **Onde o pagamento vive:** no **backend (NestJS)**, nunca só no app. O app pede
  ao backend para criar a cobrança; o backend fala com o gateway e libera a IA via
  **webhook** de confirmação (não confiar em callback do cliente).

### 4.2 Considerações técnicas / de compliance
- **In-app purchase das lojas:** ⚠️ ponto sensível. Google Play e Apple podem
  exigir que **conteúdo/serviço digital consumido dentro do app** use o
  billing da loja (comissão de até 15–30%), o que **proíbe PIX externo** para esse
  tipo de venda. PIX/gateway externo costuma ser aceito para bens/serviços do mundo
  real, não para desbloqueio digital dentro do app. **Validar as políticas atuais
  das duas lojas antes de fechar** — isso pode mudar radicalmente a margem do premium.
- **Antifraude e idempotência** no backend (evitar cobrança dupla).
- **PCI-DSS:** se usar o SDK/checkout do gateway (tokenização), você não trafega
  número de cartão pelos seus servidores — reduz muito o escopo de PCI. **Nunca
  armazenar dados de cartão.**
- **Emissão de nota fiscal** (obrigação da PJ — ver seção 5.3).

### Checklist
- [ ] Modelo de cobrança definido (PIX único recomendado).
- [ ] Política de in-app billing de Google Play e Apple verificada para o caso.
- [ ] Gateway escolhido (comparar MDR, taxa PIX, SDK RN, split, webhooks).
- [ ] Fluxo de pagamento no backend com webhook de confirmação desenhado.
- [ ] Estratégia antifraude/idempotência.
- [ ] Fluxo de emissão de nota fiscal definido.

---

## 5. Regulação e obrigações legais

Sim, há LGPD e outras obrigações. A boa notícia: a decisão de **armazenar dados
localmente** no gratuito reduz muito a exposição. Assim que entrar conta Google, IA
na nuvem e pagamento, o backend passa a tratar dado pessoal e as obrigações crescem.

> ⚠️ Isto é orientação de produto, **não** aconselhamento jurídico. Antes de lançar,
> passar por um advogado especializado em proteção de dados/consumidor.

### 5.1 LGPD (Lei 13.709/2018)
Currículo é recheado de **dado pessoal** (nome, contato, histórico) e pode conter
**dado sensível** (foto, eventual menção a saúde/PCD). Obrigações principais:
- **Base legal** para cada tratamento (consentimento e/ou execução de contrato).
- **Minimização:** só colete o necessário.
- **Local-first no gratuito:** enquanto o dado fica no aparelho, você não é
  "controlador" daquele dado na prática — grande vantagem de privacidade.
- **Ao subir para a nuvem** (premium/IA/conta): você vira controlador. Precisa de:
  - **Política de Privacidade** e **Termos de Uso** claros (exigidos também pelas
    lojas de app).
  - Consentimento explícito e granular.
  - Atendimento aos **direitos do titular** (acesso, correção, exclusão,
    portabilidade).
  - **Encarregado (DPO)** — pode ser você/PJ no começo, mas precisa existir e ter
    canal de contato publicado.
  - Contrato de tratamento com **operadores** (o provedor de LLM, o de nuvem, o
    gateway) — verificar onde os dados são processados.
- **IA + LLM:** se enviar o currículo a um LLM de terceiro para otimizar, isso é
  transferência de dado pessoal a um operador (e possivelmente **internacional**,
  se o provedor for fora do BR). Precisa estar no consentimento e nos contratos, e
  idealmente **anonimizar/minimizar** o que é enviado.

### 5.2 Regras das lojas de aplicativo (Google Play / Apple)
- Política de Privacidade obrigatória e **Data Safety / App Privacy** preenchidos.
- Regras de anúncios (AdMob) para conteúdo e para **público infantil** — se houver
  menores de idade entre "primeiro emprego", cuidado redobrado (COPPA/consentimento).
- Regras de billing/in-app purchase (ver §4.2).

### 5.3 Obrigações fiscais/societárias (PJ)
- Enquadramento tributário do CNPJ (Simples Nacional provavelmente) e o CNAE certo
  para "desenvolvimento/licenciamento de software" e/ou serviço.
- **Emissão de nota fiscal** de serviço para cada venda.
- Registro contábil de receita de anúncios (AdMob) e de vendas.

### 5.4 Marca (INPI)
- Registrar a **marca no INPI** antes de investir em divulgação, para não perder o
  nome. Fazer busca de anterioridade antes de fechar o nome (liga com a seção 3).

### 5.5 Direito do consumidor (CDC)
- Justamente o ponto fraco dos concorrentes: **transparência de cobrança**. Deixar
  claríssimo o que é grátis e o que é pago, sem dark patterns, sem renovação
  escondida. Direito de arrependimento (7 dias) em compras digitais quando aplicável.

### Checklist
- [ ] Política de Privacidade + Termos de Uso redigidos (revisão jurídica).
- [ ] Base legal mapeada por tipo de tratamento.
- [ ] Fluxo de consentimento e direitos do titular no app.
- [ ] Encarregado (DPO) + canal de contato definidos.
- [ ] Contratos com operadores (LLM, nuvem, gateway) revisados (transferência
      internacional, se houver).
- [ ] Data Safety (Play) / App Privacy (Apple) preenchidos.
- [ ] CNAE e enquadramento tributário conferidos; emissão de NF definida.
- [ ] Busca de anterioridade + pedido de registro de marca no INPI.
- [ ] Revisão de conformidade com o CDC (transparência de cobrança).

---

## 6. Ordem sugerida de execução

1. **Pesquisa de público** (seção 1) — destrava tudo.
2. **Escopo do MVP** (seção 2) — a partir do que a pesquisa revelar.
3. **Marca e linguagem** (seção 3) — em paralelo, alimentada pela pesquisa.
4. **Arquitetura técnica** — modelagem de domínio (candidato, currículo, versões,
   templates), definir onde entra o LLM, desenhar app RN offline + backend NestJS.
5. **Pagamento** (seção 4) e **regulação/LGPD** (seção 5) — resolver antes de
   publicar nas lojas.
6. **Build do MVP** → medir a métrica de sucesso → iterar.
