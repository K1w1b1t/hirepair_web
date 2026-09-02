ago. 23, 2026

## **Reunião em 23 de ago. de 2026 às 15:28 GMT-03:00**

### **Resumo**

O projeto estabeleceu requisitos para o produto mínimo viável focado na otimização de currículos via Applicant Tracking System.

**Definições do produto mínimo**  
Foram estruturados os recursos fundamentais, como importação de PDF, diagnóstico técnico e entrevista guiada por áudio. O foco do sistema reside na adequação funcional para sistemas de rastreamento de candidatos.

**Arquitetura e modelo operacional**  
A infraestrutura utilizará Vercel, Supabase e modelos de linguagem integrados para processamento de dados. A monetização adotará um modelo freemium para garantir acessibilidade e sustentabilidade dos custos operacionais.

**Escolha da marca final**  
A equipe definiu o nome H Pair como marca oficial para transmitir simplicidade e parceria. Essa escolha consolida a identidade do projeto para o mercado brasileiro.

### **Decisões**

## Alinhada

* **Design de currículo focado em ATS** O design dos currículos priorizará funcionalidade e simplicidade técnica para garantir a compatibilidade com sistemas ATS, rejeitando gráficos e layouts elaborados.

* **Modelo freemium para geração de currículos** O modelo de monetização será baseado no limite de um currículo gratuito por mês, exigindo pagamento para gerar versões adicionais.

* **Escopo funcional e técnico do MVP** O MVP será desenvolvido como uma aplicação web responsiva, incluindo importação de PDF, entrevista via áudio, motor de redação calibrado, gerador de PDF e compartilhamento via WhatsApp.

* **Isenção de login para a versão MVP** O acesso inicial à versão MVP do produto não exigirá login do usuário, armazenando o estado localmente para reduzir a fricção no primeiro uso.

* **Implementação da ferramenta PostHog** A ferramenta PostHog será integrada ao produto para monitorar o comportamento do usuário e validar o uso das funcionalidades implementadas.

* **Estratégia de lançamento em duas fases** O lançamento do produto ocorrerá em fases, iniciando com um MVP gratuito sem login, seguido por uma versão 1.1 com login obrigatório e introdução de monetização.

* **Exclusão do recurso de simulação** A funcionalidade de simulação de entrevistas foi excluída do escopo atual para evitar concorrência direta com ferramentas de mercado já consolidadas.

* **Nome da marca definido como H Pair** O nome da marca foi definido como "H Pair", escolhido pela simplicidade e facilidade de pronúncia.

* **Repositório do GitHub definido como privado** A equipe decidiu manter o repositório do projeto privado, em vez de torná-lo público.

* **Definição da arquitetura tecnológica** A arquitetura técnica foi estabelecida utilizando Vercel para hospedagem, Supabase para banco de dados e Grock Model para o processamento.

* **Uso do Stitch para design** O uso do Stitch foi definido como ferramenta oficial para a criação da identidade visual, optando-se por um padrão totalmente novo e pela geração da base de HTML do projeto.

## Arquivada

* **Funcionalidade extra removida do escopo** A funcionalidade extra mencionada anteriormente foi removida do escopo atual e colocada de lado por enquanto.

**Atualizamos a seção "Decisões"** com base no seu feedback.

Dê sua opinião: [Sim](https://google.qualtrics.com/jfe/form/SV_5bXzKQfylMIhSXc?isHelpful=True&entryPoint=decisions&confid=n93L6vurV4sF0_vwSPYoDxIROBEBMgUIigIgABgFCA&isGoogler=False) ou [Não é útil](https://google.qualtrics.com/jfe/form/SV_5bXzKQfylMIhSXc?isHelpful=False&entryPoint=decisions&confid=n93L6vurV4sF0_vwSPYoDxIROBEBMgUIigIgABgFCA&isGoogler=False)

### **Próximas etapas**

- [ ] \[Unassigned\] Pesquisar áudio econômico: Identificar soluções baratas para integrar gravação e narração de voz na entrevista guiada do aplicativo.

- [ ] \[ReaperKoji\] Justificar currículo simples: Pesquisar formas de explicar ao usuário que o modelo de currículo simples é o mais eficaz para passar em sistemas de triagem ATS.

- [ ] \[Gustavo Rodrigues\] Criar tarefas GitHub: Cadastrar todas as pendências do projeto no GitHub Projects para iniciar o desenvolvimento do MVP.

- [ ] \[ReaperKoji\] Pesquisar iframe mobile: Verificar a viabilidade técnica de utilizar iframe dentro do React Native para exibir a versão web do aplicativo em dispositivos móveis.

- [ ] \[Gustavo Rodrigues\] Registrar domínio: Registrar o endereço da web para a marca H-Pair.

- [ ] \[Gustavo Rodrigues\] Criar repositório: Criar e configurar o projeto no GitHub como um repositório privado.

- [ ] \[O grupo\] Definir arquitetura: Implementar a interface, backend, API, banco de dados Supabase e hospedagem na Vercel conforme planejado.

- [ ] \[Gustavo Rodrigues\] Criar repositório: Inicializar o repositório do projeto no GitHub conforme o escopo do MVP. Utilizar a conta compartilhada para gerenciar o acesso dos colaboradores.

- [ ] \[Gustavo Rodrigues\] Configurar Supabase: Configurar o Supabase como banco de dados da aplicação. Realizar as integrações iniciais necessárias para o funcionamento dos serviços.

- [ ] \[Gustavo Rodrigues\] Enviar credenciais: Enviar a senha e os detalhes de acesso da conta de e-mail ao colaborador. Garantir que as credenciais permitam o gerenciamento correto das ferramentas.

- [ ] \[ReaperKoji\] Criar identidade visual: Definir a identidade visual do projeto. Utilizar como base outros modelos de currículos para garantir simplicidade e eficiência.

- [ ] \[ReaperKoji\] Desenvolver protótipos: Construir telas de exemplo no Stitch para servir como referência de layout. Gerar os arquivos HTML que serão utilizados na base do aplicativo.

- [ ] \[Gustavo Rodrigues\] Salvar transcrição: Salvar o texto da transcrição desta reunião na pasta de business do projeto. Documentar as decisões e o escopo acordados para consulta posterior.

### **Detalhes**

* **Funcionalidades de Extração e Diagnóstico ATS**: Gustavo Rodrigues e ReaperKoji discutiram a implementação de importação e diagnóstico de currículos em formato PDF, com foco em sistemas de rastreamento de candidatos, conhecidos como ATS (Applicant Tracking System). O sistema deve realizar a extração linear de texto, identificar erros de formatação como palavras coladas, e detectar dados sensíveis ou discriminatórios. Além disso, definiram a classificação automática de metas pessoais — como mudança de área ou busca por trabalho remoto — e a atribuição automática de arquétipos profissionais para otimizar a estrutura e o teto de páginas do currículo.

* **Orientação de Carreira e Coleta Conversacional**: Foi abordada a criação de um orientador proativo de carreira que alerta sobre qualificações recentes ou discrepâncias entre a formação do candidato e a vaga almejada. Os participantes também propuseram a implementação de uma coleta conversacional de experiências através de uma entrevista guiada, visando obter dados mais precisos e personalizados para o currículo.

* **Motor de Redação e Loop de Aderência**: Gustavo Rodrigues detalhou a necessidade de um motor de redação com calibração anti-inflação, evitando que as experiências sejam descritas de forma exagerada ou insuficiente. Discutiram o loop de aderência à vaga, que envolve a leitura dos requisitos da vaga e a renderização de um arquivo em Markdown otimizado especificamente para passar nos sistemas de triagem das empresas.

* **Necessidade de Interface Mobile e Entrada de Áudio**: Identificou-se a necessidade de um aplicativo com foco em acessibilidade para o público de baixa renda, que acessa vagas predominantemente via dispositivos móveis. Gustavo Rodrigues e ReaperKoji concluíram que a entrada de áudio, com perguntas narradas e respostas gravadas, seria um diferencial estratégico para melhorar a experiência do usuário.

* **Design Funcional vs. Design Elaborado**: Houve um debate sobre o design do currículo gerado. Gustavo Rodrigues enfatizou que o design tradicional, com colunas múltiplas, gráficos e elementos visuais do Canva, é frequentemente rejeitado por sistemas ATS. A estratégia definida é promover um design funcional, limpo, com hierarquia clara e tipografia legível, educando o usuário sobre por que esse formato aumenta as chances de sucesso.

* **Estratégia de Opções de Design**: Discutiram se o aplicativo deveria oferecer múltiplas opções de design para o usuário. Embora ReaperKoji tenha sugerido a variedade, Gustavo Rodrigues ponderou que oferecer muitas escolhas pode diluir a proposta de valor, sugerindo um foco em uma opção otimizada para ATS, possivelmente permitindo ajustes mínimos para manter a identidade profissional.

* **Limites de API e Integração de Compartilhamento**: Gustavo Rodrigues levantou preocupações sobre as limitações de chamadas diárias das APIs de modelos de inteligência artificial, citando os limites do Gemini 1.5 e do Grock. Foi decidido implementar uma estratégia para gerenciar essas chamadas e incluir um botão simples para compartilhamento via WhatsApp, facilitando a distribuição do currículo pelo usuário.

* **Modelo de Monetização e Freemium**: Os participantes discutiram a implementação de um modelo freemium, permitindo a geração de um currículo gratuito por mês. Gustavo Rodrigues argumentou que isso mantém o produto acessível, enquanto o plano pago seria acionado caso o usuário precisasse de mais funcionalidades ou ultrapassasse as cotas de uso, garantindo a sustentabilidade da operação.

* **Priorização do MVP (Must Haves)**: O grupo definiu os requisitos obrigatórios para o MVP (Produto Mínimo Viável): interface mobile amigável, importação de PDF, diagnóstico básico, entrevista guiada por voz, motor de redação calibrado, gerador de PDF simples, compartilhamento por WhatsApp e orientação de carreira.

* **Operação e Custos do MVP**: Gustavo Rodrigues propôs hospedar a aplicação na Vercel para minimizar custos e utilizar uma estratégia de chaveamento entre APIs gratuitas e pagas dos modelos de linguagem. O plano inicial inclui banners de anúncios na versão gratuita para cobrir custos, sem a necessidade imediata de um gateway de pagamento complexo.

* **Logística de Transcrição e Login**: O grupo descartou a ideia de transcrição 100% offline devido à complexidade técnica e aos requisitos de hardware dos dispositivos dos usuários. Gustavo Rodrigues reforçou a importância do login com Google Auth, abandonando a ideia de manter o estado apenas localmente, para permitir que o usuário acesse seu currículo de diferentes aparelhos.

* **Roadmap de Desenvolvimento e Analytics**: Foi delineado o cronograma de lançamento, começando com o MVP funcional baseado na web. Planejam integrar o PostHog para monitoramento de comportamento dos usuários e métricas de uso. Uma segunda fase, o MVP 1.1, introduzirá a monetização, o sistema de login e o loop de aderência à vaga.

* **Funcionalidades Descartadas**: Decidiram excluir funcionalidades como simuladores de entrevista (devido à concorrência direta com a GUP) e a criação de um marketplace de vagas, mantendo o foco do produto estritamente na geração e otimização de currículos para garantir a qualidade da entrega principal.

* **Implementação Técnica e Infraestrutura**: Gustavo Rodrigues definiu a criação de um projeto no GitHub para organizar as tarefas. A estratégia técnica envolverá a construção de uma aplicação web responsiva que pode ser encapsulada em um iframe para funcionar como um aplicativo mobile, utilizando uma sequência otimizada de chamadas de API entre Gemini e Grock.

* **Identidade do Projeto**: O encerramento da discussão focou no nome do projeto. Gustavo Rodrigues e ReaperKoji buscaram um nome simples, foneticamente curto e que transmitisse a ideia de parceria e descomplicada, explorando sugestões como "Par" ou "Prosa", evitando siglas como "CV" para conferir uma identidade de marca mais humana e acessível.

* **Brainstorming de Nomes para o Aplicativo**: Gustavo Rodrigues e ReaperKoji discutem potenciais nomes para o projeto, focando em palavras de fácil pronúncia que sigam a tendência de marcas brasileiras que utilizam termos em inglês, como LinkedIn ou Glassdoor. A equipe avalia o uso da palavra "Job" e conclui que o termo está saturado no mercado, devendo ser evitado.

* **Influência da Equipe na Tomada de Decisão**: O grupo reflete sobre a influência de Pedro na escolha de nomes anteriores, citando o exemplo de "Kwi". É discutido como as decisões de nomenclatura são tomadas pela equipe, incluindo uma breve digressão sobre a personalidade e a eficiência de Pedro ao realizar tarefas, descrita por ReaperKoji como notável.

* **Avaliação da Marca "H Talk"**: Após considerar diversas opções, o nome "H Talk" é identificado como um forte candidato por sua simplicidade. A equipe realiza uma pesquisa e descobre a existência de uma empresa na Carolina do Norte com esse nome, o que gera um debate técnico sobre propriedade intelectual e a viabilidade de registro da marca no Brasil, considerando que a atuação das empresas ocorre em contextos e mercados diferentes.

* **Definição e Registro de "H Pair"**: A equipe opta pelo nome "H Pair" (ou Hi Repair), justificando a escolha pela facilidade de pronúncia e a alusão a um sistema de auxílio profissional. Gustavo Rodrigues confirma a intenção de registrar o domínio e prosseguir com esta identidade.

* **Dados Administrativos e CNPJ**: Gustavo Rodrigues e ReaperKoji alinham os detalhes administrativos da conta, confirmando o número do CNPJ (68.049.018/0001-42) para o licenciamento e enquadramento necessário do projeto.

* **Escopo e Funcionalidades do MVP**: São definidos os requisitos para o Produto Mínimo Viável (MVP), incluindo a criação de interface responsiva, telas de objetivos pessoais, sistemas de transcrição e réplica guiada, além da implementação de um botão de compartilhamento direto via WhatsApp.

* **Arquitetura Técnica do Projeto**: A estrutura técnica do aplicativo utilizará o Supabase para o banco de dados e API, e a Vercel para hospedagem e deploy com suporte a testes automatizados. O motor de inteligência artificial será composto por Gemini 1.5 e Grock, focados em processamento e diagnóstico.

* **Configuração e Segurança do Repositório**: Gustavo Rodrigues decide que o projeto deve ser mantido em um repositório privado para garantir o controle sobre o código e a estratégia de interface. A equipe reforça a importância de implementar testes unitários e de integração para validar as sessões de entrevista conversacional e a redação final.

* **Detalhes do Projeto e Escopo do MVP**: Gustavo Rodrigues apresenta a visão geral do projeto, incluindo o descritivo de todas as funcionalidades planejadas e a estrutura do Produto Mínimo Viável (MVP). Gustavo Rodrigues solicita que ReaperKoji analise as especificações registradas na seção de "project details" da plataforma de gerenciamento, que define a arquitetura do front-end e as cadeias de desenvolvimento.

* **Gestão de Acesso e Configuração Técnica**: A dupla discute a logística de acessos para a infraestrutura do projeto, especificamente sobre a criação de repositórios e a configuração do banco de dados Supabase. Gustavo Rodrigues orienta o uso da conta "Bit" para essas integrações e se compromete a fornecer a senha necessária para que ReaperKoji possa realizar as configurações, observando que a criação do repositório pode ser feita sem e-mail, mas o Supabase pode exigir uma conta dedicada.

* **Planejamento de Design e Identidade Visual**: O projeto terá uma identidade visual totalmente nova, distinta dos padrões anteriores utilizados pela equipe na CBIT. Para o desenvolvimento visual, utilizam a ferramenta Stitch, visando criar protótipos em HTML que servirão como base sólida para a construção real do aplicativo. Gustavo Rodrigues orienta que não devem "inventar a roda" e sugere que ReaperKoji utilize referências existentes de currículos para nortear o design.

* **Atribuição da Tarefa de Identidade Visual**: ReaperKoji assume formalmente a responsabilidade pela tarefa de criar a identidade visual, confirmando que o item já foi atribuído dentro do sistema de gestão de projetos. ReaperKoji inicia a criação dos protótipos de tela para que Gustavo Rodrigues possa avaliar posteriormente.

* **Feedback sobre a Estrutura do Projeto**: ReaperKoji manifesta aprovação em relação ao nome, à estrutura e às decisões tomadas sobre o simulador e as etapas do desenvolvimento. Ambos concordam que o foco deve ser o lançamento do MVP com as funcionalidades base, priorizando a qualidade da feature de entrevista, e reconhecem que o projeto será refinado com o tempo, seguindo a dinâmica de desenvolvimento utilizada em projetos anteriores, como o blog.

* **Encerramento e Próximos Passos**: Após uma pausa para alimentação, Gustavo Rodrigues planeja retomar a criação do projeto e manter contato com ReaperKoji. A transcrição da reunião será armazenada na pasta de "business" do projeto, e ambos reafirmam o compromisso de continuar as atividades de desenvolvimento ainda no mesmo dia.

*Revise as anotações do Gemini para checar se estão corretas. [Confira dicas e saiba como o Gemini faz anotações](https://support.google.com/meet/answer/14754931)*

*Como está a qualidade de **destas observações?** [Responda a uma breve pesquisa](https://google.qualtrics.com/jfe/form/SV_5bXzKQfylMIhSXc?confid=n93L6vurV4sF0_vwSPYoDxIROBEBMgUIigIgABgFCA&detailLevel=standard&hasImages=False&entryPoint=footerMain&isGoogler=False) para nos dar seu feedback, incluindo o quanto as observações foram úteis para o que você precisa.*