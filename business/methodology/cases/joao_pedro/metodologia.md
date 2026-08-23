# Metodologia de busca de estágio/emprego — Caso João Pedro

> **Análise completa (ago/2026):** esta versão foi fechada após auditar o GitHub público, o LinkedIn e o material de estudo interno do time.

## Objetivo pessoal (define a estratégia)

**A meta dele é entrar num emprego rápido, não conseguir a vaga dos sonhos.** Isso é decisivo e define a priorização de trilhas abaixo: **dev é a trilha principal** porque São José dos Campos tem muito mais vaga de dev do que de segurança — é o caminho mais curto para o primeiro emprego. Segurança entra como **trilha paralela secundária**, aproveitando o portfólio forte que ele já tem, mas sem atrasar a entrada. Não faz sentido priorizar a área "dos sonhos" (segurança) se ela tem menos vagas e ele precisa entrar logo.

## Perfil

- João Pedro Ataliba Galvão. São José dos Campos (SP). 20 e poucos anos.
- Cursando Bacharelado em Ciência da Computação (UNIP), previsão de conclusão julho/2027 — no meio do curso.
- Currículo se apresenta como **dev backend/automação** (Python, Bash, Linux, PostgreSQL, APIs REST), com segurança/redes como tema secundário (certificações Cisco Network Defense e CyberSecurity Analyst C3SA, projeto de Wireshark/TCP-IP).
- Buscando primeiro estágio em desenvolvimento de software.

## Achado: portfólio forte em segurança que não conversa com a trilha principal

O currículo se vende como "dev backend genérico". O GitHub público (`github.com/ReaperKoji`, 17 repositórios, ativo) mostra outra coisa — ele é um **entusiasta de segurança ofensiva** com trabalho prático real e consistente:

- Ferramentas próprias de segurança: `bughunter` (framework de bug bounty em Docker/Redis), `TraverseScope` (scanner de path traversal), `black-reaper` (suíte CLI de recon/enum/pós-exploração), `Findkoji`, `spyware-detector-local`, `soc-ai-defense`.
- Writeups de CTF documentados (`Smol-CTF-THM`, `Mr-Robot-CTF-THM` — TryHackMe).
- Bio de perfil na persona de segurança ("Reaping vulnerabilities from the shadows", caveira).

Isso cria uma tensão a resolver: um recrutador de **dev** (a trilha principal, por decisão estratégica) que abra esse GitHub vê um portfólio quase todo ofensivo que não conversa com a vaga de dev. **O currículo dev e o portfólio atual estão desalinhados.**

**Encaminhamento (sem inverter a prioridade):** a trilha **dev continua principal** — é onde estão as vagas em SJC e o caminho mais rápido para o primeiro emprego. Para isso funcionar, o GitHub precisa passar a **também** exibir projetos dev apresentáveis (hoje quase inexistentes), para não parecer só um perfil de segurança candidatando-se a vaga de dev. A força em segurança **não se joga fora**: vira a trilha paralela secundária e o diferencial que faz ele se destacar entre outros devs júnior ("dev com base sólida de segurança") — um ativo, desde que o currículo dev lidere com dev e trate segurança como reforço, não como identidade principal.

## Risco a resolver antes de divulgar o GitHub (importante)

O repositório **`uaf-exploit`** está público e descrito como exploit/pentest do **sistema de urnas eletrônicas brasileiro**, com scripts de coleta via USB. Mesmo que a descrição afirme autorização ("authorized for the public tests in 2025"), isso é uma **mina terrestre reputacional e possivelmente jurídica** num perfil linkado direto do currículo:

- Um recrutador (de dev ou de segurança) que veja "exploit de urna eletrônica" pode descartar por medo de risco legal, independentemente de mérito técnico.
- Se a autorização (TPS/TSE) não for documentável e verificável, o repositório deveria ficar **privado** até que a comprovação exista.
- Vale revisar todo o perfil sob a ótica de "isso passa em due diligence de RH?": nomes/bios com estética de "black hat" ("from the shadows", caveira) leem bem em comunidade de segurança e mal em triagem corporativa formal. Não precisa apagar a persona, mas convém ter um LinkedIn e um GitHub "profissionais" apresentáveis, separados da vibe de comunidade.

**Ação prioritária:** curadoria do GitHub antes de qualquer campanha de candidatura — deixar em destaque 3-4 repositórios com README bom (bughunter, TraverseScope, black-reaper já têm READMEs decentes), tornar privado ou documentar a autorização do `uaf-exploit`, e limpar repositórios vazios/sem README (`soc-ai-defense`, `Findkoji` estão praticamente vazios e depõem contra).

## Profundidade técnica real (do material de estudo do time)

A trilha de formação interna que ele segue (`.github-private/profile/docs/formacao`) confirma base sólida e cobre exatamente o que dá lastro ao currículo — e mais do que ele lista:

- Redes/HTTP/TLS, lógica e estrutura de dados (LeetCode **sem IA** como regra), Node puro, Git/PR, NestJS, TypeScript, PostgreSQL/ORM, autenticação (JWT, hashing Argon2/Bcrypt).
- Segurança aplicada em cada etapa: supply chain (`postinstall` malicioso), SQL injection, XSS, keylogger de front, e o módulo final de AppSec/bug bounty (Burp, OWASP Top 10, IDOR/BOLA, transição para HackerOne/Bugcrowd).

Isso significa que a base dev do currículo é **verdadeira** — ele não está inflando conhecimento que não tem. O problema é de posicionamento e de tom, não de substância. Dá para descrever os projetos com honestidade porque o conhecimento por trás existe de fato.

## Avaliação do currículo como artefato

**Forma:** boa — 1 página, contato completo, GitHub/LinkedIn, seções claras. O PDF parseia limpo (verificado): **sem problema de ATS de formatação**, diferente do caso Ana Julia.

**Problemas de conteúdo:**

1. **Portfólio dev fraco vs. portfólio de segurança forte** (achado acima) — o currículo dev precisa de projetos dev apresentáveis no GitHub para sustentar a candidatura.
2. **Metodologia STAR inflada em projetos pessoais.** "Automatizou 100% do fluxo... milhares de registros em tempo real com alta confiabilidade e baixa latência" para scripts de estudo soa artificial e desconta credibilidade com quem faz triagem técnica. Trocar por descrição direta: o que faz, com que stack, o que aprendeu. O conhecimento real (comprovado acima) sustenta uma descrição honesta — não precisa inflar.
3. **Não indica o período/semestre atual do curso** — só a previsão de conclusão. Estágio filtra por semestre; deixar explícito.
4. **Certificações Cisco enterradas no rodapé** — numa versão focada em segurança, elas são filtro de entrada e deveriam estar no topo.

## Como o mercado contrata (dev/segurança, SJC + remoto)

- **Grandes empresas (Embraer e afins):** programas de estágio sazonais, com janelas fixas de inscrição e processo automatizado (testes de perfil/lógica online, ATS tipo Gupy) antes de qualquer contato humano. A primeira barreira é algorítmica.
- **Empresas médias do Aquarius/Parque Tecnológico (ex.: Quero Educação):** vagas em LinkedIn/Indeed e na plataforma própria do Parque (pqtec.burh.com.br), com processo mais direto e manual — favorece candidatura espontânea e indicação.
- **Vagas de segurança:** existem vagas reais de **SOC júnior N1** e **estágio em segurança da informação** no Brasil que aceitam quem ainda está cursando e valorizam certificações. Muitas são **remotas**.
- **Dev júnior CLT:** empresas médias de tecnologia contratam júnior sem exigir diploma concluído, com remuneração acima de bolsa de estágio — trilha paralela que amplia o funil.
- **Remoto:** tanto dev quanto segurança são áreas fortemente remota-friendly no Brasil. Restringir a busca a SJC reduz o funil sem necessidade — abrir para remoto multiplica as vagas acessíveis.

## Estratégia por tipo de empresa

**Grandes (processo automatizado):** otimizar currículo para ATS (palavras-chave da vaga, sem inventar), cumprir requisitos formais literalmente (semestre, disponibilidade, carga horária), preparar-se para os testes de lógica/perfil, e monitorar janelas de inscrição.

**Médias/locais (processo manual):** candidatura espontânea na plataforma do Parque, contato direto por LinkedIn com recrutadores/tech leads, e presença em eventos/comunidades técnicas do Vale do Paraíba (GitTogether SJC, Innovation Week, hackathons no Parque) — indicação pesa mais que currículo frio nesse tipo de empresa.

**Vagas de segurança (muitas remotas):** aplicar amplamente fora de SJC; aqui o GitHub curado + certificações + writeups de CTF são o diferencial que faz a diferença.

## Que tipo de vaga procurar

- **Trilha principal: dev backend júnior/estágio** — Python/Node/NestJS/PostgreSQL, tom honesto, apoiada no material de formação. É a trilha com mais vagas em SJC e o caminho mais rápido para o primeiro emprego. Currículo dev-first, com a base de segurança aparecendo como **diferencial** ("dev com fundamentos sólidos de segurança/AppSec"), não como identidade principal. Prioridade imediata: construir 1-2 projetos dev apresentáveis (com README bom) para o portfólio não ser só segurança.
- **Trilha paralela secundária: segurança** — SOC júnior N1, estágio em segurança da informação, pentest júnior. Currículo com ênfase em segurança (certificações Cisco no topo, ferramentas do GitHub e writeups de CTF em destaque). Explorar em paralelo, sem deixar atrasar a entrada por dev — é onde ele tem portfólio real, e muitas vagas são remotas (amplia além de SJC).
- Manter **duas versões enxutas** do currículo (dev-first como principal, segurança-first como secundária), nunca uma versão única ambígua.

## Canais e cadência

- **Estágio:** CIEE e Nube (exigem convênio com a faculdade — confirmar se a UNIP tem; sem limite de candidaturas).
- **Agregadores/ATS:** Gupy, LinkedIn, Indeed (dev e segurança, incluindo remoto).
- **Local:** plataforma do Parque Tecnológico de SJC (Burh) — canal regional pouco usado por quem é de fora.
- **Segurança/comunidade:** LinkedIn seguindo empresas de segurança, plataformas de CTF (TryHackMe/HackTheBox como vitrine), e — quando maduro — programas de bug bounty (HackerOne/Bugcrowd), que são portfólio vivo.
- **Volume:** taxa de conversão de estágio no Brasil é baixa (poucos por cento) — manter múltiplas candidaturas por semana, somando as duas trilhas e vagas remotas para maximizar retorno.
- **Networking presencial:** eventos técnicos do Vale do Paraíba — maior retorno para as empresas médias/locais.

## Ordem de execução recomendada

1. **Curar o GitHub** (destacar repos com README bom; resolver o `uaf-exploit`; limpar repos vazios) **e criar 1-2 projetos dev apresentáveis**, para o portfólio sustentar a candidatura dev. Pré-requisito, não passo final — o portfólio já está público e sendo visto.
2. **Criar as duas versões do currículo** (dev-first como principal, segurança-first como secundária).
3. **Levantar o baseline** (ver abaixo) e escalar volume de candidaturas de dev, com segurança em paralelo.

## Dados que ainda faltam levantar com ele

- Período/semestre atual do curso e turno das aulas (define quais estágios são viáveis).
- Disponibilidade de horas/dia e pretensão de bolsa/salário.
- Se a UNIP tem convênio com CIEE/Nube.
- Se aceita/prefere remoto.
- A prioridade dev está definida pela meta de entrar rápido (mais vagas em SJC). Segurança é a área de maior afinidade/portfólio — vale confirmar que ele está de acordo em tratá-la como paralela secundária por ora, retomando o foco em segurança depois de já empregado, se quiser.
- Comprovação de autorização do `uaf-exploit`.
- Baseline do funil: quantas candidaturas, desde quando, em quais canais, quantos retornos.

## Métrica de sucesso

Registrar o **baseline** (candidaturas e retornos até aqui, com o currículo atual) antes de mudar qualquer coisa. Depois, semanalmente, separado por trilha (dev principal vs. segurança paralela):

- Nº de candidaturas por canal (CIEE/Nube, Gupy/LinkedIn/Indeed, Burh, vagas remotas).
- Nº de retornos (mesmo "não" — indica que passou na triagem).
- Nº de testes/etapas automatizadas alcançadas (grandes empresas).
- Nº de entrevistas/contatos humanos (médias/locais).

O critério de sucesso é **entrar rápido** — a primeira oferta boa de dev (estágio ou júnior CLT) atende o objetivo pessoal, mesmo que não seja a vaga dos sonhos. A trilha de segurança segue em paralelo como aposta de médio prazo, sem virar gargalo para a entrada.
