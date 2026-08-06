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
- Recrutadores leem completo ou triam em segundos? (tempo médio real)
- Erros que mais reprovam, na visão do recrutador (entrevistas, não achismo).
- Como o candidato descobre que precisa mudar o currículo (feedback é raro).

---

## 7. Stack técnica (planejada)

- **App mobile:** React Native (offline-first, geração de PDF local).
- **Backend (este repo):** NestJS + PostgreSQL via Docker Compose — necessário
  para funcionalidades online: conta Google, IA de otimização, pagamentos, anúncios.
- **Status:** fase de pesquisa e planejamento; implementação técnica não iniciada.

Ver arquitetura híbrida (offline + online) detalhada em `proximos-passos-mvp.md`.
