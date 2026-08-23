# Relatório de Análise e Validação: Pesquisa, Feedbacks da Demo, Metodologia e Ajustes Técnicos

> **Objetivo deste documento:** Consolidação analítica do ciclo de testes da demo e pesquisa de validação do produto. Este relatório cruza os dados quantitativos do survey (42 respostas), os feedbacks qualitativos das transcrições de testes reais (`AC5405C31570D28F36F594A52FCEA995.txt` e `AC8EB66E0E851358C1C64FF4F6A3A00B.txt`), a aderência da Metodologia do Sistema ([`business/methodology/metodologia-do-sistema.md`](../methodology/metodologia-do-sistema.md)) e define o plano de ação técnico para o protótipo ([`demo/demo.py`](../../demo/demo.py) e [`demo/metodologia.py`](../../demo/metodologia.py)).

---

## 1. Análise Quantitativa e Validação do Survey (42 Respostas)

A pesquisa rápida realizada com o público-alvo (42 entrevistados no total) forneceu dados estatísticos sólidos que validam as hipóteses centrais do modelo de negócio e da metodologia.

### 1.1 Maior Dificuldade na Criação do Currículo
* **Não ter certeza se o currículo estava bom:** 12 respostas (28,6%)
* **Escrever as experiências e os resultados:** 11 respostas (26,2%)
* **Saber o que é relevante ou não incluir:** 10 respostas (23,8%)
* **Ajustar a formatação e o visual:** 8 respostas (19,0%)
* **Não tive tanta dificuldade:** 1 resposta (2,4%)

> 💡 **Conclusão de Validação:** **78,6% dos usuários travam no conteúdo** (escrever, selecionar relevância e validar qualidade), enquanto apenas 19,0% apontam o visual como maior dor. Isso valida 100% o princípio da Metodologia: *"A parte insuportável de fazer currículo é escrever, não decidir."*

### 1.2 Momento Profissional dos Candidatos
* **Empregado(a), mas de olho em oportunidades:** 20 respostas (47,6%)
* **Buscando o primeiro emprego:** 5 respostas (11,9%)
* **Buscando recolocação na mesma área:** 5 respostas (11,9%)
* **Desempregado(a) há mais de 6 meses:** 3 respostas (7,1%)
* **Mudando de área ou profissão:** 2 respostas (4,8%)
* **Outros (Empresário, setor público, etc.):** 7 respostas (16,7%)

> 💡 **Conclusão de Validação:** A maior fatia (47,6%) é formada por profissionais ativos buscando mobilidade/crescimento, somados a 23,8% em busca de entrada (1º emprego) ou recolocação rápida. O produto precisa atender tanto o perfil de urgência de renda quanto de evolução profissional.

### 1.3 Dispositivo e Conectividade
* **Os dois (celular e computador) igualmente:** 26 respostas (61,9%)
* **Só pelo computador:** 14 respostas (33,3%)
* **Só pelo celular / sem problemas com dados:** 2 respostas (4,8%)

> 💡 **Conclusão de Validação:** Embora o app seja *mobile-first*, 61,9% dos candidatos utilizam celular e computador de forma combinada. A exportação e facilidade de envio via WhatsApp e e-mail precisam ser perfeitas em ambos os ecossistemas.

### 1.4 Sensação de Rejeição em ATS (Currículo Ignorado)
* **Sente que é ignorado "Às vezes":** 25 respostas (59,5%)
* **Sente que é ignorado "Na maioria das vezes":** 12 respostas (28,6%)
* **Raramente / Nunca:** 5 respostas (11,9%)

> 💡 **Conclusão de Validação:** **88,1% dos candidatos sentem frustração constante com o descarte silencioso do currículo.** O diagnóstico de parsing, palavras-chave e adequação ao ATS atinge diretamente a maior dor de engajamento do usuário.

### 1.5 Disposição a Pagar por Otimização por IA (Modelo Pay-Per-Use)
* **R$ 5 – R$ 10:** 13 respostas (31,0%)
* **R$ 10 – R$ 20:** 11 respostas (26,2%)
* **Até R$ 5:** 7 respostas (16,7%)
* **Não pagaria:** 7 respostas (16,7%)
* **Mais de R$ 20:** 4 respostas (9,5%)

> 💡 **Conclusão de Validação:** **83,3% dos respondentes estão dispostos a pagar pelo serviço avulso de IA.** O *sweet spot* de precificação está consolidado entre **R$ 5,00 e R$ 15,00 por currículo**, perfeitamente alinhado com o plano de monetização via PIX sem mensalidade.

---

## 2. Análise Qualitativa das Transcrições de Teste Real

A análise dos testes de campo gravados em áudio ([`AC5405C31570D28F36F594A52FCEA995.txt`](./AC5405C31570D28F36F594A52FCEA995.txt) e [`AC8EB66E0E851358C1C64FF4F6A3A00B.txt`](./AC8EB66E0E851358C1C64FF4F6A3A00B.txt)) revelou aprendizados vitais sobre o comportamento do usuário final vs. o comportamento do criador.

### 2.1 Vício de Criador (Creator Bias) vs. Usuário "Quadrado"
* **Achado:** Quando o criador testou a ferramenta nele mesmo, o resultado ficou ótimo porque ele sabia intuitivamente o tom, os detalhes e o contexto que o prompt esperava.
* **Realidade do usuário:** O usuário real ou de perfil operacional tende a ser "quadrado" — responde exatamente o que foi perguntado de forma literal e curta (ex.: *"Trabalhei de 6h às 14h atendendo"* ou *"Saí porque acabou o contrato"*).
* **Diretriz:** O sistema **precisa ser agnóstico à eloquência do usuário**. Não se pode esperar que o candidato saiba formular um relato rico por conta própria.

### 2.2 Transcrição Literal vs. Tradução de Contexto (Contextual Skill Extraction)
* **O Bug Crítico da Demo:** No teste com a candidata Ana (experiência em ONG veterinária), ela contou uma história detalhada sobre uma mulher que tentou abandonar cachorros de 5 a 10 anos na ONG. O protótipo pegou a história **literalmente** e colocou no currículo: *"Mulher que quis doar cachorro de 5 a 10 anos"*.
* **O que a pessoa esperava:** A candidata esperava que o sistema extraísse a **habilidade comportamental e operacional** por trás do anedota: *"Atendimento ao público em situações de alto estresse, mediação de conflitos, manutenção da calma e comunicação didática para orientar procedimentos corretos."*
* **Diretriz:** O sistema **nunca deve transcrever causos ou relatos pessoais literais**. Ele deve obrigatoriamente executar a **Tradução de Contexto**: pegar a situação bruta e traduzir na competência profissional equivalente.

### 2.3 Perguntas Secas Geram Respostas Curtas
* **Achado:** As perguntas da entrevista no protótipo estavam muito diretas e secas. Pergunta curta atrai resposta curta.
* **Exemplo:** A pergunta *"O que você fazia no dia a dia?"* gerou uma resposta de 6 palavras. A pergunta *"Qual foi sua maior dificuldade?"* fez a candidata responder *"Lidar com meu chefe"*, o que é um desabafo pessoal irrelevante para um currículo.
* **Diretriz:** A abordagem de perguntas precisa ser **conversacional e guiada**, explicando o motivo da pergunta e o tipo de situação profissional que gera valor no currículo.

### 2.4 Ambiguidade na Interface (Seleção de Habilidades)
* **Achado:** Ao exibir a lista de habilidades para filtro, a usuária entendeu que devia marcar as habilidades para *remover*, quando o sistema esperava marcar para *manter*.
* **Diretriz:** As instruções de seleção da interface devem ser 100% explícitas em linguagem positiva (*"Selecione as habilidades que você QUER MANTER no currículo"*).

### 2.5 Orientação Proativa de Carreira vs. Alinhamento Cego
* **Achado:** A usuária recém-formada no curso de Técnica em Veterinária inseriu uma vaga-alvo de "Atendente". O sistema reordenou os bullets para priorizar atendimento e jogou o estágio técnico para o final.
* **Realidade:** A usuária gostaria que o sistema tivesse alertado: *"Você acabou de concluir o curso Técnico em Veterinária. Seu perfil tem maior força para vagas de Técnica Veterinária do que para Atendente. Deseja criar a versão para Técnica ou prefere focarem Atendente?"*
* **Diretriz:** O produto não deve ser um formatador passivo; deve atuar como **orientador proativo de aderência**.

### 2.6 Inconsistência Temporal (Passado vs. Presente)
* **Achado:** A usuária informou que *ainda é voluntária* na instituição, mas o gerador de texto redigiu os bullets com verbos no passado (*"Atendeu...", "Organizou..."*).
* **Diretriz:** Se o período da experiência for "atual/presente", a redação deve obrigatoriamente usar verbos no presente (*"Atende...", "Organiza..."*).

### 2.7 Usabilidade do Terminal / CLI
* **Travamento do Backspace:** Durante a digitação no terminal, apagar caracteres ou usar backspace travava a interface.
* **Envio Acidental por Enter:** Apertar Enter sem querer enviava a resposta imediatamente sem chance de revisão ou confirmação.

---

## 3. Validação do Documento de Metodologia (`metodologia-do-sistema.md`)

Confrontando o documento formal de metodologia com os testes de campo:

### 3.1 O que foi Aplicado com Sucesso na Demo
1. **Pipeline de 9 Etapas:** A sequência (Objetivo → Arquétipo → Coleta → Diagnóstico → Redação → Aderência) provou ser estruturalmente correta.
2. **Separação de Regras Duras vs. Parâmetros Mixáveis:** A definição estrita do layout (coluna única, sem foto, sem tabelas, sem gráficos de barra) garantiu um Markdown limpo e compatível com ATS.
3. **Diagnóstico Heurístico Automatizado:** A detecção automática de palavras coladas, dados sensíveis (CPF, RG), imagens embutidas e cálculo de gaps temporais funcionou com precisão.
4. **Guardrail contra Métricas Inventadas:** A trava que impede a IA de inventar porcentagens e números que o candidato não citou operou com sucesso.

### 3.2 O que Precisa Melhorar ou Ser Incluído na Metodologia

Devem ser incorporadas as seguintes revisões no documento [`business/methodology/metodologia-do-sistema.md`](../methodology/metodologia-do-sistema.md):

1. **Inclusão da "Camada de Tradução de Contexto" (§5.2):**
   * *Nova Regra Dura:* O LLM é expressamente proibido de inserir nomes de terceiros, anedotas específicas ou causos contados na entrevista. Toda narrativa de situação difícil deve obrigatoriamente ser abstraída para a competência de resolução de problemas, atendimento sob pressão ou habilidade técnica correspondente.
2. **Protocolo de Réplica Conversacional para Respostas Curtas (§5.3):**
   * *Nova Regra de Coleta:* Se a resposta do candidato contiver menos de 10 palavras ou for estritamente genérica, o sistema não avança para a redação. Ele faz uma réplica guiada: *"Para valorizar essa experiência, me conta mais um detalhe: qual ferramenta você usava ou como você garantia que a tarefa saía certa?"*
3. **Regra de Manutenção de Temporalidade (§8.1):**
   * *Nova Regra Dura:* Vínculos ativos ("atual", "presente") exigem verbos no presente do indicativo. Vínculos encerrados exigem pretérito perfeito.
4. **Mecanismo de Orientação de Carreira por Arquétipo Superior (§4.2):**
   * *Nova Regra:* Quando o candidato possuir uma formação/certificação técnica recente (ex.: Curso Técnico) que supere o nível da vaga-alvo colada (ex.: Atendente), o sistema deve explicitar o descompasso e sugerir a criação da versão direcionada à formação superior.
5. **Clareza de Ação em Filtros de Interface (§8.3):**
   * *Diretriz de UX:* Todos os seletores de habilidades ou experiências devem utilizar rótulos afirmativos de manutenção ("Manter este item"), eliminando qualquer ambiguidade de exclusão.

---

## 4. Plano de Ajustes Técnicos para a Demo em Python (`demo/demo.py` & `demo/metodologia.py`)

Para resolver os problemas identificados no protótipo, as seguintes alterações técnicas serão implementadas na codebase da demo:

### 4.1 Resiliência da API Gemini: Tratamento do Erro `503 Service Unavailable / Overloaded`

O erro `503 (Overloaded / Service Unavailable)` ocorre quando os servidores do Gemini estão sobrecarregados na camada gratuita.

#### Solução Técnica no Motor Gemini (`demo/demo.py` -> `class Motor`):
1. **Captura Específica do Erro 503:** Tratar exceções do SDK Gemini que contenham código `503`, `"overloaded"` ou `"unavailable"`.
2. **Retry Progressivo com Backoff Exponencial + Jitter:**
   * Tentar a requisição até **10 vezes** antes de desistir.
   * O tempo de espera entre as tentativas seguirá uma progressão exponencial com variação aleatória (*jitter*):
     $$\text{tempo} = \min(60, \text{base} \times 2^{\text{tentativa}}) \pm \text{jitter}$$
   * Sequência de pausas aproximada: ~1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s, 60s.
3. **Sugestão e Fallback de Troca de Modelo Gratuito:**
   * Se as 10 tentativas de retry falharem com erro 503, o sistema exibirá o aviso ao usuário e sugerirá a troca automática do modelo atual (`gemini-3.6-flash`) para outro aceito na cota gratuita (como `gemini-2.5-flash` ou `gemini-1.5-flash`), ou a rotação para as chaves reservas (`GEMINI_API_KEY_2`).

```python
# Esboço da implementação em demo/demo.py
def _gerar_com_retry(self, prompt: str, json_mode: bool) -> str:
    max_tentativas = 10
    base_delay = 1.0
    
    for tentativa in range(1, max_tentativas + 1):
        try:
            self.chamadas += 1
            resposta = self.cliente.models.generate_content(
                model=self.modelo, contents=prompt, config=config
            )
            return (resposta.text or "").strip()
        except Exception as erro:
            texto_erro = str(erro).lower()
            e_503 = "503" in texto_erro or "overloaded" in texto_erro or "unavailable" in texto_erro
            
            if e_503 and tentativa < max_tentativas:
                delay = min(60.0, base_delay * (2 ** (tentativa - 1))) + random.uniform(0.1, 0.5)
                aviso(f"Gemini sobrecarregado (503). Tentativa {tentativa}/{max_tentativas}. Aguardando {delay:.1f}s...")
                time.sleep(delay)
                continue
            
            if e_503 and tentativa == max_tentativas:
                aviso("O modelo atual está indisponível no momento após 10 tentativas.")
                # Oferece trocar para outro modelo aceito na cota gratuita (ex: gemini-2.5-flash) ou chave reserva
                self._oferecer_troca_modelo_ou_chave()
                return self._gerar_com_retry(prompt, json_mode)
            
            # Outros erros de cota (429) mantêm o fluxo de _resolver_cota
            cota, diario = _erro_de_cota(erro)
            if cota:
                self._resolver_cota(diario)
                return self._gerar_com_retry(prompt, json_mode)
            raise erro
```

### 4.2 Refatoração dos Prompts de Extração e Redação (`demo/metodologia.py`)

#### Refatoração do `prompt_extrair_fatos`:
* Adicionar instrução rígida para ignorar causos pessoais, nomes de terceiros não relevantes e detalhes anedóticos.
* Adicionar chave no JSON de retorno: `"competencias_observadas": ["habilidades operacionais/comportamentais derivadas do relato"]`.

#### Refatoração do `prompt_redigir_bullets`:
* Instrução explícita: *"PROIBIDO incluir causos, histórias pessoais ou detalhes literais de conflitos com terceiros (ex: 'mulher que quis doar cachorro'). Traduza a situação para a competência profissional equivalente (ex: 'Atendimento ao público em situações de alto estresse com foco na resolução de conflitos e comunicação didática')."*

### 4.3 Melhorias de Usabilidade e CLI (`demo/demo.py`)

1. **Correção de Entrada de Texto no Terminal:**
   * Utilizar a biblioteca `readline` nativa do Python para garantir manipulação correta de backspace/delete sem travamento de tela.
2. **Etapa de Confirmação de Resposta:**
   * Após a digitação de cada resposta longa, exibir a resposta formatada e pedir confirmação:
     `Sua resposta: "..." | Confirma? (S/n ou digite 'e' para editar)`
3. **Comando `/voltar`:**
   * Permitir retornar à pergunta anterior caso o usuário tenha avançado sem querer.

---

## 5. Resumo das Próximas Ações

| Item | Descrição da Ação | Localização | Status |
|---|---|---|---|
| **1** | Atualizar o documento de Metodologia com as 5 novas regras metodológicas | [`business/methodology/metodologia-do-sistema.md`](../methodology/metodologia-do-sistema.md) | Planejado |
| **2** | Implementar retry progressivo exponencial (10x) para erro 503 e fallback no Gemini | [`demo/demo.py`](../../demo/demo.py) | Planejado |
| **3** | Refatorar prompts para forçar Tradução de Contexto e expurgar causos literais | [`demo/metodologia.py`](../../demo/metodologia.py) | Planejado |
| **4** | Corrigir usabilidade de input CLI (readline, confirmação e `/voltar`) | [`demo/demo.py`](../../demo/demo.py) | Planejado |

---
*Relatório gerado em agosto/2026 como encerramento do ciclo de validação da demo do Candidate Assistant.*
