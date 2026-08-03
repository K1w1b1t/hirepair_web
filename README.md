# Candidate Assistant API

Backend do produto de currículos B2C (SaaS). Construído em **NestJS** + **PostgreSQL** (subido localmente via **Docker Compose**).

Este README documenta a pesquisa de produto/mercado que precisa ser validada e aprofundada antes de entrarmos na fase de design técnico. Nada aqui deve ser tratado como dado de mercado confirmado — é o ponto de partida (hipóteses + conhecimento geral) que precisa ser validado com pesquisa primária (entrevistas, dados de busca, dados de ATS).

---

## 1. Hipótese central

No Brasil, fazer um bom currículo é uma dificuldade real e disseminada, não um conhecimento trivial nem bem difundido. Hipóteses associadas:

- Falta padronização/educação formal sobre currículo (não é ensinado na escola nem na faculdade de forma consistente).
- Muita gente aprende "olhando modelo de amigo" ou template genérico do Word/Canva, sem entender o "porquê" por trás da estrutura.
- Existe assimetria de informação entre quem já passou por processos seletivos estruturados (grandes empresas, tech) e quem não passou.
- O problema muda de forma conforme o público (ver seção 3) — não é um problema único, é uma família de problemas.

**Isso precisa ser validado**, não assumido. Antes de codar o MVP, validar com: entrevistas qualitativas (10-15 pessoas por segmento), análise de currículos reais recebidos por recrutadores parceiros, e dados de busca (Google Trends / Ubersuggest) para termos como "como fazer currículo", "modelo de currículo ATS", etc.

## 2. Concorrência conhecida (mapa inicial — validar e expandir)

| Categoria | Players | Observação |
|---|---|---|
| Builders internacionais genéricos | Canva, Kickresume, Enhancv, Novoresume, Zety | Fortes em design, fracos em contexto/mercado brasileiro (formatação, expectativas de RH BR, LGPD, idioma) |
| Builders/serviços nacionais | Vagas.com (dicas + parte de currículo), Curriculum (app BR), diversos infoprodutos/mentores individuais no Instagram/TikTok | Fragmentado, muito baseado em conteúdo (blog/vídeo) e pouco em produto |
| ATS / recrutamento BR | Gupy, Kenoby (Pandapé), Solides, Vagas.com, Catho, LinkedIn | Não fazem currículo, mas definem as regras do jogo (como o currículo é parseado/pontuado) — relevante entender a dinâmica de parsing de ATS |
| Adjacentes | LinkedIn (perfil como "currículo vivo"), ChatGPT/genérico (uso crescente para "reescrever meu currículo") | Concorrência indireta relevante — muita gente já usa IA genérica pra isso |

**Ação:** validar preços, posicionamento e reviews reais desses concorrentes (App Store, Reclame Aqui, G2, redes sociais) antes de definir diferencial.

## 3. Públicos-alvo candidatos (segmentar antes de escolher)

Não dá para atacar "todo mundo que procura emprego" no MVP. Segmentos candidatos, cada um com um problema de currículo diferente:

1. **Primeiro emprego / estagiários / recém-formados** — não têm experiência para preencher, não sabem o que valorizar (projetos, cursos, soft skills).
2. **Transição de carreira** — precisam reposicionar experiência antiga para uma área nova, currículo tradicional "não conta a história certa".
3. **Profissionais operacionais/administrativos** — alto volume de candidaturas, currículos concorrendo em processos com triagem automática (ATS) e/ou triagem manual de RH generalista.
4. **Profissionais de tech/dados** — já mais "letrados" em currículo (comunidade LinkedIn forte), diferencial teria que ser outro (ex: adaptar para vaga específica rápido).
5. **Público de baixa renda / menor acesso digital** — provavelmente o segmento com maior dor real e menor oferta de solução adequada (preço, linguagem, acesso a computador vs. celular).

**Decisão necessária antes do MVP:** escolher 1 (no máximo 2) segmentos iniciais. Cada segmento muda: canal de aquisição, preço, tom de comunicação, e até o formato do produto (mobile-first vs desktop, PDF vs perfil online).

## 4. Dinâmica de contratação no Brasil — o que sabemos e o que falta validar

**Conhecimento geral (validar com dados atualizados):**
- Empresas médias/grandes majoritariamente usam **ATS** (Gupy, Kenoby/Pandapé, Solides, Vagas.com, LinkedIn Recruiter) para triagem inicial — currículo é parseado automaticamente, e formatação/estrutura importa para "passar" no parser (colunas, tabelas e imagens quebram parsing).
- Pequenas empresas e vagas informais ainda dependem muito de **processo manual**: WhatsApp, e-mail, indicação, grupos de emprego (Facebook/Telegram), RH generalista sem estrutura de triagem.
- Vagas operacionais/varejo/logística tendem a ter processo mais manual ou via plataformas mais simples (Catho, Vagas.com, indicação).
- Crescimento de uso de IA generativa por candidatos para reescrever currículo — ainda não sabemos a % real no Brasil, precisa pesquisa.

**Perguntas em aberto para responder com pesquisa primária:**
- Qual % de vagas no Brasil (por setor/porte de empresa) passa por ATS vs. processo manual?
- Recrutadores de fato leem currículo por completo ou fazem triagem em segundos (tempo médio de leitura)?
- Quais erros de currículo mais reprovam candidatos na visão do recrutador (fonte: entrevistas com recrutadores, não achismo)?
- Como o candidato descobre que precisa mudar o currículo (feedback do recrutador é raro; geralmente é silêncio/rejeição sem explicação)?

## 5. Etapas antes de projetar o produto

### 5.1 Pesquisa e validação de problema
- [ ] Entrevistas com candidatos (por segmento) — dor, tentativas atuais, disposição a pagar.
- [ ] Entrevistas com recrutadores/RH (BR) — o que reprova currículo, uso de ATS, tempo de triagem.
- [ ] Análise de concorrentes (preço, posicionamento, reviews, gaps).
- [ ] Pesquisa de demanda (volume de busca, redes sociais, comunidades de emprego).

### 5.2 Planejamento de negócio
- [ ] Definir modelo de receita (assinatura, pay-per-use, freemium, B2B2C via parceria com cursos/faculdades).
- [ ] Estimar TAM/SAM/SOM por segmento escolhido.
- [ ] Definir canal de aquisição principal (SEO, redes sociais, parcerias com influenciadores de carreira, parcerias com faculdades/cursos técnicos).
- [ ] Definir estrutura de custos (infra, IA/LLM, suporte) vs. precificação.

### 5.3 Marca e comunicação
- [ ] Definir posicionamento (ex: "o currículo que passa no ATS e impressiona o recrutador" vs. "o mentor de carreira acessível").
- [ ] Definir tom de voz por segmento (linguagem simples para primeiro emprego ≠ linguagem para transição de carreira sênior).
- [ ] Nome e identidade visual do produto (distinto do nome técnico do repo).
- [ ] Canais de comunicação prioritários por segmento (TikTok/Instagram para público jovem, LinkedIn para profissionais).

### 5.4 Definição de MVP
- [ ] Escolher 1 segmento e 1 dor principal a resolver primeiro.
- [ ] Definir o menor conjunto de funcionalidades que resolve essa dor de ponta a ponta (ex: gerar currículo compatível com ATS a partir de um formulário guiado).
- [ ] Definir métrica de sucesso do MVP (ex: % de usuários que geram e baixam o currículo, taxa de resposta em candidaturas — se mensurável).
- [ ] Definir o que **não** entra no MVP (multi-idioma, múltiplos templates visuais, integração direta com ATS, etc.).

### 5.5 Só então: arquitetura técnica
- [ ] Modelagem de domínio (candidato, currículo, versões, templates, vagas-alvo).
- [ ] Stack: NestJS (API), PostgreSQL (dados), Docker Compose (ambiente local).
- [ ] Definir se geração de conteúdo usa LLM (ex: reescrita de experiências) e onde entra no fluxo.

---

## 6. Stack técnica (planejada)

- **Backend:** NestJS
- **Banco de dados:** PostgreSQL, rodando localmente via Docker Compose
- **Status:** repositório criado para organizar a pesquisa e o planejamento inicial; implementação técnica ainda não iniciada.

---

## 7. Status atual

📍 Fase: **pesquisa e descoberta de problema**, antes de qualquer definição de escopo técnico.
