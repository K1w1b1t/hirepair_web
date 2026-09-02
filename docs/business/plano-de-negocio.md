# Plano de Negócio — Assistente de Currículos

> Documento de trabalho. Mistura hipóteses, conhecimento geral e alguns dados de
> mercado levantados em pesquisa secundária (marcados como "validar" quando ainda
> precisam de fonte primária). Não tratar nada aqui como verdade fechada — é o
> ponto de partida para validação com pesquisa primária (entrevistas, dados de
> busca, dados de ATS).

---

## 1. Hipótese central

No Brasil, fazer um bom currículo é uma dificuldade real e disseminada, não um
conhecimento trivial nem bem difundido. Hipóteses associadas:

- Falta padronização/educação formal sobre currículo (não é ensinado na escola
  nem na faculdade de forma consistente).
- Muita gente aprende "olhando modelo de amigo" ou template genérico do
  Word/Canva, sem entender o "porquê" por trás da estrutura.
- Existe assimetria de informação entre quem já passou por processos seletivos
  estruturados (grandes empresas, tech) e quem não passou.
- O problema muda de forma conforme o público — não é um problema único, é uma
  família de problemas.

**Isso precisa ser validado**, não assumido. Antes de codar o MVP, validar com:
entrevistas qualitativas (10-15 pessoas por segmento), análise de currículos reais
recebidos por recrutadores parceiros, e dados de busca (Google Trends / Ubersuggest)
para termos como "como fazer currículo", "modelo de currículo ATS", etc.

---

## 2. Posicionamento estratégico

Produto **mobile-first (React Native)**, com foco em **funcionamento offline** para
atacar o maior gargalo de inclusão digital do Brasil: o custo da conectividade.

- O smartphone é o único meio de acesso à internet para ~83% dos usuários das
  classes D e E _(validar fonte)_.
- ~43% dos moradores de favelas e periferias têm acesso precário ou inexistente
  a sinal 3G/4G dentro de casa _(validar fonte)_.
- Processar informações e gerar o PDF **localmente**, sem consumir a franquia de
  dados pré-paga, resolve uma dor real e imediata do segmento de baixa renda.
- Armazenamento local também **mitiga risco de LGPD** — dados sensíveis ficam no
  aparelho do candidato (ver `proximos-passos-mvp.md` §5 — Regulação/LGPD).

**Vantagem competitiva** (ver seção 5 — fraquezas dos concorrentes): app offline,
que não gasta 4G, exporta PDF simples compatível com ATS, sem surpresas no cartão
de crédito, monetizando via anúncios quando há internet e via IA paga por uso.

---

## 3. Públicos-alvo escolhidos

Decisão tomada: focar em **dois** segmentos no início, com produtos/planos distintos.

### 3.1 Baixa renda / menor acesso digital (plano gratuito)
- Maior dor real e menor oferta de solução adequada (preço, linguagem, acesso a
  computador vs. celular).
- Baixa disposição a pagar → monetização via **anúncios** (banners discretos) e
  export de PDF gratuito.
- Currículos operacionais; canal primário de envio é o **WhatsApp**.

### 3.2 Transição de carreira (plano premium com IA)
- Maior dificuldade: reescrever o histórico profissional antigo para fazer sentido
  em uma nova área.
- IA gera resumos profissionais e adapta descrições de cargos com palavras-chave
  compatíveis com ATS (Gupy, Kenoby, etc.).
- Dor latente + maior poder aquisitivo → justifica **assinatura ou pagamento por
  currículo otimizado**.

> Outros segmentos mapeados, fora do foco inicial: primeiro emprego/estagiários,
> profissionais operacionais/administrativos, profissionais de tech/dados.

---

## 4. Modelo de monetização

### 4.1 Plano gratuito (baixa renda)
- Leitura de arquivos locais, montagem e export de PDF offline.
- Envio via e-mail e WhatsApp com regras/estruturas pré-definidas rodando local.
- **Anúncios** (banners) quando há internet.

> ⚠️ **Atrito técnico crítico:** app 100% offline e redes de anúncios (AdMob) são
> incompatíveis — anúncios exigem internet para buscar a peça e contabilizar
> impressões/cliques. Solução: **arquitetura híbrida** — edição/geração offline,
> mas aproveitar momentos de conexão (Wi-Fi) para fazer cache de anúncios, ou
> exigir conexão pontual no momento do download gratuito do PDF.

### 4.2 Plano premium (transição de carreira)
- Login com Google → salvar currículos na conta.
- IA para otimizar currículo, **pago por currículo** (pay-per-use via PIX) e/ou
  assinatura.

### 4.3 Referências de preço no mercado
- **Internacionais (Zety, Kickresume, Resume.io):** assinatura mensal US$ 10–29
  (~R$ 50–150). Muitos usam "isca" barata (ex: US$ 2 por 7 dias) que renova
  automaticamente para assinatura cara — muita fricção com baixa renda.
- **Nacionais (MeuCurriculoJa, Máquina de Currículo, CurrículoSuper, auditoria ATS):**
  forte tendência de **pagamento único via PIX**, R$ 2,99–9,90 por currículo gerado
  ou analisado, sem assinatura nem conta complexa.

**Direção recomendada:** pay-per-use via PIX (R$ 2,99–9,90) para o premium, evitando
o modelo de assinatura predatória. Validar willingness-to-pay em entrevistas.

---

## 5. Concorrência

### 5.1 Mapa inicial (validar e expandir)

| Categoria | Players | Observação |
|---|---|---|
| Builders internacionais genéricos | Canva, Kickresume, Enhancv, Novoresume, Zety | Fortes em design, fracos em contexto BR (formatação, expectativas de RH, LGPD, idioma) |
| Builders/serviços nacionais | Vagas.com (dicas), Curriculum (app BR), MeuCurriculoJa, Máquina de Currículo, CurrículoSuper, infoprodutos no Instagram/TikTok | Fragmentado, muito baseado em conteúdo, pouco em produto |
| Apps mobile de currículo | Resumee (CV & Resume Builder), Bolt Resume | Já têm templates ATS, offline e IA. Pecam em tradução PT-BR e em templates que quebram na Gupy |
| ATS / recrutamento BR | Gupy, Kenoby (Pandapé), Solides, Taqe, Vagas.com, Catho, LinkedIn | Não fazem currículo, mas definem as regras do jogo (parsing/pontuação) |
| Adjacentes | LinkedIn (perfil como "currículo vivo"), ChatGPT genérico | Concorrência indireta relevante — muita gente já usa IA genérica |

### 5.2 "Meu Currículo Perfeito" (BOLD LLC — dono de Zety e LiveCareer)
Presença digital massiva e domínio de busca paga. Deixa espaço enorme para competir
por causa do modelo predatório, não por falta de presença:

1. **Funil enganoso / dark patterns:** usuário preenche tudo achando ser grátis e
   esbarra em paywall no download. Versão "grátis" só entrega .txt; PDF é pago.
   Teste de US$ 1,45–2,95 por 14 dias que vira assinatura de US$ 23–25/mês.
2. **Bloqueio de print/gravação de tela** para forçar upgrade — mortal para o
   público operacional BR que manda print no WhatsApp.
3. **Foco no visual em vez do ATS brasileiro:** templates bonitos com colunas/fotos/
   gráficos que a IA da Gupy/Kenoby não lê e descarta.

**Leitura:** as pessoas não abandonam por desconhecer o produto — abandonam no
último passo por se sentirem enganadas pela cobrança.

**Ação:** validar preços, reviews reais (App Store, Reclame Aqui, Trustpilot,
Google Play) e gaps antes de fechar o diferencial.

---

## 6. Dinâmica de contratação no Brasil

### 6.1 Sistemas ATS (dados de pesquisa secundária — validar)
- >70% das médias e grandes empresas brasileiras já usam algum ATS. Vagas populares
  chegam a receber 200–3.000 currículos.
- **Gupy** — líder (~60% de mercado), atende Nubank, Ambev, iFood. Algoritmo "Gaia".
- **Kenoby** (~15%, forte em startups de tech), **Solides** (~10%, PMEs, testes
  comportamentais), **Taqe** (~8%, vagas operacionais/logística/varejo).

### 6.1.1 Como a Gaia (IA da Gupy) calcula match — material oficial
A Gupy publica em seu blog institucional (conteúdo de marketing, não paper técnico,
mas com detalhes de mecanismo úteis para o produto):

- **Fonte de dados do match:** currículo, respostas de formulário/perguntas da vaga,
  testes online e perfil profissional — cruzados com os critérios que o **recrutador**
  configurou para aquela vaga específica.
- **Motor:** processamento de linguagem natural (PLN) + machine learning, treinado
  em uma base de ~6 bilhões de frases/palavras. Ou seja, o match é **semântico**
  (entende sinônimos e contexto), não apenas correspondência literal de palavra-chave
  — mas usar as palavras-chave da vaga ainda ajuda, e muito.
- **Nota de afinidade:** cada candidato recebe uma nota de 0 a 100, combinando
  semelhança descrição-da-vaga ↔ currículo/respostas + "fit cultural" definido pela
  empresa. Gera uma **listagem ordenada por afinidade** — os mais aderentes aparecem
  no topo para o recrutador.
- **Não é eliminatório automático:** a Gaia prioriza e organiza, mas a decisão final
  de reprovar/aprovar é humana (posição oficial da Gupy). Na prática, em vagas com
  centenas/milhares de candidatos, ficar longe do topo da lista tem efeito
  equivalente a ser reprovado — poucos recrutadores rolam até o fim da lista.
- **Velocidade:** a Gupy processa/ordena ~100 currículos por segundo.

**Implicação para o produto:** reforça a tese do plano premium (transição de
carreira) — como o match é semântico e pontuado por vaga, **adaptar a redação do
currículo para os termos da vaga específica** tem embasamento real no mecanismo do
maior ATS do país, não é só prática comum sem fundamento.

Fontes: [Blog Gupy — Conheça a Gaia](https://www.gupy.io/blog/gaia-inteligencia-artificial-gupy),
[Blog do Emprego Gupy — O que a Gaia avalia](https://www.gupy.io/blog-do-emprego/o-que-a-gaia-avalia),
[Blog Gupy — Algoritmos de ordenação](https://www.gupy.io/blog/algoritmos-de-ordenacao),
[Blog do Emprego Gupy — Como funciona a ordenação](https://www.gupy.io/blog-do-emprego/como-funciona-a-ordenacao-da-gupy),
[Blog do Emprego Gupy — Agentes de IA](https://www.gupy.io/blog-do-emprego/gupy-ia).

### 6.1.2 Kenoby / Pandapé e Sólides — mesmo padrão de mecanismo

**Kenoby foi incorporada à Pandapé** (grupo InfoJobs/Adevinta) — hoje o produto
comercial é o **Pandapé ATS**, com a funcionalidade **AI-Match**:
- Analisa currículo + dados do candidato e usa **rede neural** para identificar os
  perfis mais adequados à vaga, considerando comportamento histórico dos
  recrutadores, perfil da empresa e critérios pré-definidos.
- Promete reduzir em até **75%** o tempo de filtragem manual do recrutador.
- Clientes: McDonald's, Renault, Leroy Merlin, Alelo, MDS Group.

**Sólides:**
- O RH cadastra a descrição do cargo e os critérios (técnicos e comportamentais) da
  vaga; a IA transforma isso em parâmetros e cruza com **palavras-chave + análise
  semântica** do currículo, atribuindo pontuação.
- Usa machine learning, redes neurais e PLN. Avalia **hard skills e soft skills**
  (a Sólides tem histórico forte em testes comportamentais/perfil).
- Promete reduzir o tempo do processo em até **70%**.

**Padrão comum entre os três (Gupy, Pandapé/Kenoby, Sólides):** todos usam
PLN + machine learning para gerar uma **pontuação de aderência** currículo↔vaga a
partir de critérios que o **recrutador** configura por vaga — não existe um
"currículo universal perfeito", o que muda de vaga para vaga são os critérios
cadastrados. Isso confirma a tese de que otimizar/adaptar o currículo **por vaga**
(e não ter um único currículo genérico) é o que realmente move a agulha nos três
principais ATS do país.

⚠️ **Nenhum dos três documenta pagamento de candidato como fator de pontuação** —
o scoring é 100% baseado em conteúdo do currículo/respostas vs. critérios da vaga,
configurados pela empresa contratante (que paga a Gupy/Pandapé/Sólides, não o
candidato). Isso é relevante para a comunicação do nosso produto (ver §7.5): a IA
paga melhora a **redação/aderência** do currículo, mas não "compra" posição no ATS
— é importante nunca comunicar isso como se fosse o caso.

Fontes: [Pandapé — IA no recrutamento](https://pandape.com/br/blog/inteligencia-artificial-no-recrutamento),
[Pandapé — Candidate Selection Software](https://www.pandape.com/en/candidate-selection-software/),
[Jornal Empresas & Negócios — 7 em cada 10 empresas decidem por IA](https://jornalempresasenegocios.com.br/carreira-e-mercado-de-trabalho/7-em-cada-10-empresas-ja-decide-contratacoes-por-ia-saiba-como-passar-pela-triagem/),
[Sólides — Análise de currículos](https://solides.com.br/blog/analise-de-curriculos/),
[RH Gestor — Triagem de currículo e IA](https://rhgestor.com.br/blog/triagem-de-curriculos-ia).

### 6.2 Tempo de triagem
- Quando o currículo chega à mão humana, o recrutador gasta em média ~7,4 segundos
  na triagem visual inicial → evitar blocos gigantes, destacar palavras-chave no topo.

### 6.3 Principais erros que reprovam (foco ATS/Gupy)
- **Formatação complexa ("efeito Canva"):** ATS não lê imagens, colunas, tabelas
  ou barras de "nível de habilidade". Currículo enfeitado fica ilegível para a IA.
- **Ausência de palavras-chave / currículo genérico:** o ATS compara palavra por
  palavra com a vaga. Mandar o mesmo currículo para tudo é o motivo nº 1 de
  reprovação silenciosa.
- **Exportar o PDF do LinkedIn:** a formatação confunde o parser.
- **Falta de resultados numéricos:** ATS pontua melhor quem quantifica
  ("reduzi custos em 30%", "gerenciei equipe de 5") em vez de só listar cargo/empresa.

### 6.4 Perguntas em aberto (pesquisa primária)
- % de vagas (por setor/porte) que passa por ATS vs. processo manual.
- Recrutadores leem completo ou triam em segundos? (tempo médio real) — o "7,4s"
  da §6.2 é dado de mercado geral, não específico de recrutador BR/Gupy; validar.
- Erros que mais reprovam, na visão do recrutador (entrevistas, não achismo) —
  o mecanismo do algoritmo (§6.1.1) já dá pistas técnicas, mas falta a visão humana
  de quem lê a lista ordenada (ex: até onde de fato rola a lista de afinidade).
- Como o candidato descobre que precisa mudar o currículo (feedback é raro).
- A Gupy não publica **o peso relativo** de cada fator na nota de afinidade (quanto
  pesa "fit cultural" vs. aderência textual, por exemplo) — isso é proprietário;
  só é possível inferir por teste empírico (enviar variações e comparar posição).

---

## 7. Estratégias de oferta do plano pago (sem parecer enganação)

Pesquisa sobre práticas de mercado (resume builders internacionais + guias gerais de
UX de paywall/SaaS) para desenhar a oferta do premium (IA) sem cair nos dark
patterns que definem justamente a fraqueza dos concorrentes (§5.2).

### 7.1 "Pagar aumenta a chance de passar na Gupy?" — não prometer isso
Como visto em §6.1.1–6.1.2, **nenhum ATS (Gupy, Pandapé/Kenoby, Sólides) pontua com
base em pagamento do candidato** — o scoring é sobre aderência textual/semântica ao
que o **recrutador** configurou. Então:
- **Nunca comunicar** "pague e passe na triagem" — seria falso e é exatamente o tipo
  de promessa vaga que gera desconfiança (e possível problema com CDC/publicidade
  enganosa).
- **Comunicar o mecanismo real, honestamente:** a IA paga reescreve e adapta o
  currículo para casar melhor com os termos/critérios de uma vaga específica —
  o que, dado o mecanismo real dos ATS (§6.1.1–6.1.2), **de fato tende a melhorar a
  posição na lista de afinidade**, mas isso é consequência de um currículo melhor
  escrito, não "compra" de aprovação. É uma diferença sutil mas importante: promessa
  de **processo** ("otimizamos seu currículo para a linguagem da vaga"), não de
  **resultado garantido** ("você vai passar").

### 7.2 Por que o modelo pay-per-use (PIX) é a aposta certa aqui
Confirma a direção já definida em §4:
- Dark pattern nº 1 do mercado (Zety, MyPerfectResume): isca de US$ 1,95–2,95 por
  14 dias que renova automaticamente para US$ 23–26/mês — gera reclamação em massa
  e é a exata razão de abandono do "Meu Currículo Perfeito" (§5.2).
- **Pagamento único e claro (PIX, sem renovação automática)** já elimina a maior
  fonte de desconfiança do setor, sem precisar de nenhum truque de design.

### 7.3 O que nunca fazer (dark patterns documentados no setor)
- **Deixar o usuário preencher tudo e só depois bloquear o download** (paywall no
  final da jornada, sem aviso prévio). Se o export de PDF for pago, **avisar antes**
  de o usuário investir tempo preenchendo.
- **Watermark como chantagem** ("Feito com [app]" que só sai se pagar) — aceitável
  como estratégia freemium **se avisado com antecedência**, não se for surpresa.
- **Trial que converte em assinatura automática** sem aviso claro de quando e quanto
  vai cobrar.
- **Esconder o preço** ou empurrar para "fale conosco" sem página de preço clara.
- **Dificultar cancelamento** (jornada de assinar em 1 clique, cancelar em 5 etapas).
- **Bloquear print/captura de tela** para forçar upgrade (caso real do concorrente,
  §5.2) — evitar qualquer fricção artificial que não seja sobre o valor entregue.

### 7.4 Boas práticas para a oferta (aplicáveis ao nosso caso)
- **Transparência total de preço antes de qualquer ação:** mostrar o valor da
  otimização por IA (ex: "R$ 4,90 por currículo otimizado, pagamento único via PIX")
  **antes** do usuário chegar no formulário — nunca como surpresa no fim.
- **Deixar claro o que é grátis para sempre:** montar currículo, gerar PDF simples,
  compartilhar por WhatsApp/e-mail — sem pegadinha, sem watermark, sem limite de uso
  no local-first. Isso é o oposto do funil enganoso dos concorrentes e é o principal
  argumento de confiança da marca.
- **Preço ancorado no valor, não em assinatura:** pay-per-use por currículo otimizado
  responde diretamente à dor (uma vaga específica) e evita compromisso recorrente.
- **Nenhuma feature essencial como isca (bait-and-switch):** a funcionalidade core
  gratuita (gerar e compartilhar currículo) tem que continuar completa; o pago é
  estritamente a "camada extra" de IA — nunca reduzir o que já era grátis.
- **Explicar o "porquê" da IA ser paga, não só o "quanto":** já que o LLM tem custo
  de inferência real por chamada, comunicar isso com uma frase honesta reforça a
  transparência (ex: "usamos IA de ponta para reescrever seu currículo — por isso
  cobramos por uso, sem mensalidade").
- **Facilitar a decisão com prova social/antes-depois:** mostrar exemplo de trecho
  reescrito (antes/depois) ajuda o usuário a decidir com informação, não pressão.
- **Cancelamento e reembolso claros** caso haja qualquer componente recorrente no
  futuro (ex: se evoluir para plano de "N currículos/mês").

Fontes: [ResuFit — Free vs Paid Resume Builders / Dark Patterns](https://resufit.com/blog/the-ultimate-guide-to-truly-free-resume-builders-no-hidden-costs-or-paywalls/),
[JobShinobi — How to Spot Paywalls](https://www.jobshinobi.com/blog/how-to-spot-paywalls-in-free-resume-builders),
[RevenueCat — What top apps get right about paywalls](https://www.revenuecat.com/blog/growth/how-top-apps-approach-paywalls/),
[FunnelFox — Engaging Paywall Screens Best Practices](https://blog.funnelfox.com/effective-paywall-screen-designs-mobile-apps/),
[SmartSaaS — Feature Paywalls Killing Margins](https://smartsaas.works/blog/post/saas-feature-paywalls-are-killing-your-margins/189).

---

## 8. Stack técnica (planejada)

- **App mobile:** React Native (offline-first, geração de PDF local).
- **Backend (este repo):** NestJS + PostgreSQL via Docker Compose — necessário
  para funcionalidades online: conta Google, IA de otimização, pagamentos, anúncios.
- **Status:** fase de pesquisa e planejamento; implementação técnica não iniciada.

Ver arquitetura híbrida (offline + online) detalhada em `proximos-passos-mvp.md`.
