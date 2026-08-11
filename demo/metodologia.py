"""A metodologia do sistema como código.

Cada bloco deste arquivo é a abstração de uma parte de
`business/methodology/metodologia-do-sistema.md`. A referência de seção (§) está no
comentário de cada bloco — quando o documento mudar, é aqui que se mexe.

Princípio: **regra dura é código, não prompt.** Ordem das seções, cálculo de gaps,
travas de fórmula de impacto, viés na classificação de requisitos e a proibição de
score são decididos em Python. O modelo de linguagem só aparece nos construtores de
prompt no fim do arquivo, sempre com escopo estreito (extrair, redigir, classificar).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date

# ---------------------------------------------------------------------------
# §3 — Objetivo pessoal: a pergunta que reordena tudo
# ---------------------------------------------------------------------------

OBJETIVOS: dict[str, dict[str, str]] = {
    "entrar_rapido": {
        "label": "Entrar rápido (urgência de renda)",
        "otimiza": "volume, trilha com mais vagas, faixa de entrada, duas frentes em paralelo",
    },
    "salario": {
        "label": "Maximizar salário",
        "otimiza": "seletividade, ênfase em impacto e senioridade, menos candidaturas e melhores",
    },
    "mudar_area": {
        "label": "Mudar de área",
        "otimiza": "habilidades transferíveis, resumo de transição, taxonomia do setor novo",
    },
    "remoto": {
        "label": "Trabalhar remoto",
        "otimiza": "ampliação geográfica do funil, ênfase em autonomia e ferramentas",
    },
    "conciliar": {
        "label": "Conciliar com estudo/família",
        "otimiza": "turno e carga horária como critério de filtro, não como detalhe",
    },
}


# ---------------------------------------------------------------------------
# §4.1 — Matriz de estrutura por arquétipo (a regra dura que muda por caso)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Arquetipo:
    codigo: str
    nome: str
    secoes: tuple[str, ...]          # ordem das seções — regra dura
    paginas: int
    nota_tamanho: str
    formula_padrao: str
    preenche_vazio: str
    corta: str
    canal: str


ARQUETIPOS: dict[str, Arquetipo] = {
    "A": Arquetipo(
        codigo="A",
        nome="Primeiro emprego / entrada",
        secoes=("objetivo", "formacao", "experiencia", "habilidades"),
        paginas=1,
        nota_tamanho="1 página, sem exceção",
        formula_padrao="CAR",
        preenche_vazio="trabalho escolar, voluntariado, negócio da família, gestão de rede social de comércio local",
        corta="micro-cursos irrelevantes, ensino médio detalhado, intercâmbio antigo",
        canal="agregadores + programas de aprendiz + indicação",
    ),
    "B": Arquetipo(
        codigo="B",
        nome="Transição de carreira",
        secoes=("resumo", "experiencia", "formacao", "habilidades"),
        paginas=1,
        nota_tamanho="1 página (2 só com carreira longa)",
        formula_padrao="CAR",
        preenche_vazio="habilidades transferíveis do setor antigo, com o vocabulário do novo",
        corta="ferramental e jargão do setor antigo que não traduz; títulos antigos como identidade",
        canal="agregadores/ATS + LinkedIn",
    ),
    "C": Arquetipo(
        codigo="C",
        nome="Operacional / blue-collar",
        secoes=("oficio", "certificacoes", "experiencia", "formacao"),
        paginas=1,
        nota_tamanho="1 página, blocos curtos",
        formula_padrao="ESCOPO",
        preenche_vazio="escala da operação, maquinário nominal, zero acidentes, assiduidade",
        corta="abstrações de liderança e métricas percentuais de lucro",
        canal="presencial, WhatsApp, SINE/CBO, indicação",
    ),
    "D": Arquetipo(
        codigo="D",
        nome="Recolocação na mesma área",
        secoes=("resumo", "experiencia", "habilidades", "formacao"),
        paginas=2,
        nota_tamanho="1–2 páginas",
        formula_padrao="XYZ",
        preenche_vazio="—",
        corta="experiências antigas irrelevantes (mais de 10–15 anos)",
        canal="agregadores/ATS + rede",
    ),
    "E": Arquetipo(
        codigo="E",
        nome="Especialista / técnico",
        secoes=("stack", "experiencia", "projetos", "formacao"),
        paginas=2,
        nota_tamanho="1–2 páginas",
        formula_padrao="XYZ",
        preenche_vazio="projetos próprios, open source, writeups",
        corta="resumo existencial longo, datas de formação",
        canal="plataformas globais, comunidade, referral",
    ),
}

TITULOS_SECAO = {
    "objetivo": "Objetivo",
    "resumo": "Resumo profissional",
    "oficio": None,  # renderiza como linha de chamada sob o nome, não como seção
    "stack": "Stack técnico",
    "formacao": "Formação",
    "experiencia": "Experiência",
    "habilidades": "Habilidades",
    "certificacoes": "Certificações e habilitações",
    "projetos": "Projetos",
}


def sugerir_arquetipo(experiencias: list[dict], area_alvo_e_a_da_experiencia: bool | None = None) -> str:
    """§4 — o arquétipo é derivado da linha do tempo, não escolhido pela biografia.

    Heurística deliberadamente simples: quem confirma é o usuário na Fase 3.
    """
    formais = [e for e in experiencias if not e.get("informal")]
    meses = sum(_duracao_meses(e) for e in formais)

    if not formais or meses < 12:
        return "A"
    if area_alvo_e_a_da_experiencia is False:
        return "B"
    if meses >= 60:
        return "D"
    return "D" if area_alvo_e_a_da_experiencia else "B"


# ---------------------------------------------------------------------------
# §8.1 — Tom de escrita (parâmetro mixável)
# ---------------------------------------------------------------------------

TONS: dict[str, dict[str, str]] = {
    "direto": {
        "label": "Direto e simples",
        "guia": "frases curtas, zero jargão, palavras do dia a dia",
        "padrao_de": ("A", "C"),
    },
    "neutro": {
        "label": "Profissional neutro",
        "guia": "padrão de mercado, sóbrio, sem adjetivo desnecessário",
        "padrao_de": ("D",),
    },
    "consultivo": {
        "label": "Consultivo",
        "guia": "vocabulário de negócio, foco em impacto e decisão",
        "padrao_de": ("B",),
    },
    "tecnico": {
        "label": "Técnico",
        "guia": "denso em ferramenta, stack e arquitetura; sem adjetivo de marketing",
        "padrao_de": ("E",),
    },
    "acolhedor": {
        "label": "Acolhedor",
        "guia": "ênfase em cuidado, atendimento e pessoas, sem infantilizar",
        "padrao_de": (),
    },
}


def tom_padrao(arquetipo: str) -> str:
    for chave, dados in TONS.items():
        if arquetipo in dados["padrao_de"]:
            return chave
    return "neutro"


# ---------------------------------------------------------------------------
# §8.2 — Fórmula de impacto e suas travas
# ---------------------------------------------------------------------------

FORMULAS: dict[str, dict[str, str]] = {
    "XYZ": {
        "label": "XYZ — realizou [X], medido por [Y], fazendo [Z]",
        "guia": (
            "Cada bullet começa pelo resultado, ancora numa métrica e fecha com a ação/ferramenta. "
            "Só use métrica que a pessoa forneceu."
        ),
    },
    "CAR": {
        "label": "CAR — desafio, ação, resultado",
        "guia": (
            "Cada bullet nomeia o problema enfrentado, o que a pessoa fez e o que mudou. "
            "Resultado pode ser qualitativo."
        ),
    },
    "ESCOPO": {
        "label": "Escopo + Conformidade — escala, norma cumprida, ausência de incidente",
        "guia": (
            "Cada bullet declara a escala da operação, o maquinário/sistema nominal, a norma seguida "
            "e a confiabilidade (zero acidentes, assiduidade). Sem percentual de lucro."
        ),
    },
}

# Arquétipos em que XYZ é contraproducente (§8.2, travas).
_XYZ_PROIBIDO_EM = {"A", "C"}


def resolver_formula(escolhida: str, arquetipo: str, tem_numero: bool, projeto_pessoal: bool) -> tuple[str, str | None]:
    """Aplica as travas de §8.2. Devolve (fórmula_final, motivo_do_rebaixamento)."""
    if escolhida == "XYZ" and arquetipo in _XYZ_PROIBIDO_EM:
        alvo = ARQUETIPOS[arquetipo].formula_padrao
        return alvo, (
            f"XYZ não se aplica ao arquétipo {arquetipo} ({ARQUETIPOS[arquetipo].nome}): "
            f"métrica percentual soa alienígena nesse mercado. Rebaixado para {alvo}."
        )
    if escolhida == "XYZ" and projeto_pessoal:
        return "CAR", (
            "XYZ em projeto pessoal ou trabalho escolar desconta credibilidade "
            "(achado do caso João Pedro). Rebaixado para CAR."
        )
    if escolhida == "XYZ" and not tem_numero:
        return "CAR", (
            "Nenhum número foi fornecido para esta experiência — XYZ sem métrica vira XYZ falso. "
            "Rebaixado para CAR."
        )
    return escolhida, None


# ---------------------------------------------------------------------------
# §6.2 — Achados que a interface é obrigada a mostrar
# ---------------------------------------------------------------------------

SEVERIDADES = {"crítica": 0, "alta": 1, "média": 2, "baixa": 3}


@dataclass
class Achado:
    codigo: str
    titulo: str
    detalhe: str
    severidade: str


def ordenar_achados(achados: list[Achado]) -> list[Achado]:
    return sorted(achados, key=lambda a: SEVERIDADES.get(a.severidade, 9))


# camelCase legítimo que não é defeito de parsing.
_CAMEL_LEGITIMO = {
    "javascript", "typescript", "postgresql", "mysql", "mongodb", "nodejs", "nestjs",
    "nextjs", "reactjs", "github", "gitlab", "linkedin", "youtube", "whatsapp",
    "powerbi", "powerpoint", "wordpress", "hubspot", "salesforce", "openai",
    "hackerone", "bugcrowd", "tryhackme", "hackthebox", "devops", "appsec",
    "docker", "kubernetes", "autocad", "totvs", "iphone", "macos", "ios",
}

_RE_CAMEL = re.compile(r"[A-Za-zÀ-ÿ]*[a-zà-ÿ]{2}[A-ZÀ-Þ][a-zà-ÿ][A-Za-zÀ-ÿ]*")
_RE_REPETIDO = re.compile(r"\b([A-Za-zÀ-ÿ]{2,})\s+\1\b", re.IGNORECASE)
_SUFIXOS_NOMINAIS = ("ção", "ções", "são", "mento", "mentos", "ência", "ância", "ura", "ista", "ário")
_PREPOSICOES = ("de", "da", "do", "dos", "das", "em", "no", "na", "com", "para")

# Palavra funcional grudada logo antes de uma maiúscula interna: o rastro típico de
# espaço perdido na extração ("TécnicoemVeterinária"). Sem isso, todo nome composto em
# camelCase ("CyberSecurity") seria acusado de defeito de parsing.
_RE_FUNCIONAL_COLADA = re.compile(
    r"(?:de|da|do|dos|das|em|no|na|com|para|e)[A-ZÀ-Þ]"
)


def _parece_colada(token: str) -> bool:
    if token.lower() in _CAMEL_LEGITIMO:
        return False
    if len(token) >= 16:
        return True
    return len(token) >= 12 and bool(_RE_FUNCIONAL_COLADA.search(token))


def achados_de_parsing(texto: str) -> list[Achado]:
    """Defeitos que quebram o parse do ATS — o que a máquina enxerga (§6.1)."""
    achados: list[Achado] = []

    colados = [m.group(0) for m in _RE_CAMEL.finditer(texto) if _parece_colada(m.group(0))]

    # "Realizaçãode", "Formaçãoem": preposição grudada num substantivo nominalizado.
    for token in re.findall(r"\b[A-Za-zÀ-ÿ]{8,}\b", texto):
        baixo = token.lower()
        for prep in _PREPOSICOES:
            if baixo.endswith(prep):
                radical = baixo[: -len(prep)]
                if len(radical) >= 7 and radical.endswith(_SUFIXOS_NOMINAIS):
                    colados.append(token)
                break

    colados = unicos(colados)
    if colados:
        achados.append(Achado(
            "parsing_colado",
            "Palavras coladas no texto extraído",
            "Em triagem manual passa como desleixo; em triagem automatizada quebra o parse. "
            f"Exemplos: {', '.join(colados[:6])}"
            + (f" (e outros {len(colados) - 6})" if len(colados) > 6 else ""),
            "crítica",
        ))

    repetidos = unicos(m.group(0) for m in _RE_REPETIDO.finditer(texto))
    if repetidos:
        achados.append(Achado(
            "token_repetido",
            "Termo repetido em sequência",
            f"Erro de digitação visível: {', '.join(repetidos[:5])}",
            "baixa",
        ))

    return achados


_SENSIVEIS = [
    (r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b", "CPF"),
    (r"\bRG\b|\bregistro geral\b", "RG"),
    (r"estado civil", "estado civil"),
    (r"data de nascimento|nascimento\s*:|\bnascid[oa]\b", "data de nascimento"),
    (r"filia[çc][ãa]o|nome do pai|nome da m[ãa]e", "filiação"),
]


def achados_de_dado_sensivel(texto: str) -> list[Achado]:
    """§6.2 — dado sensível ou discriminatório sai por padrão (LGPD + espaço semântico)."""
    encontrados = [nome for padrao, nome in _SENSIVEIS if re.search(padrao, texto, re.IGNORECASE)]
    if not encontrados:
        return []
    return [Achado(
        "dado_sensivel",
        "Dado sensível ou discriminatório no documento",
        f"Encontrado: {', '.join(unicos(encontrados))}. Não serve para aferir competência, "
        "ocupa espaço que deveria ir para palavra-chave e é exposição desnecessária (LGPD).",
        "alta",
    )]


def achado_de_imagem(qtd_imagens: int) -> list[Achado]:
    if qtd_imagens <= 0:
        return []
    return [Achado(
        "imagem_embutida",
        f"{qtd_imagens} imagem(ns) embutida(s) no PDF",
        "O parser não extrai texto de imagem. Foto, ícone com informação e gráfico de nível "
        "de habilidade são invisíveis para o ATS — e barra de habilidade some por completo.",
        "crítica",
    )]


def achado_de_tamanho(paginas: int, arquetipo: str) -> list[Achado]:
    arq = ARQUETIPOS[arquetipo]
    if paginas <= arq.paginas:
        return []
    return [Achado(
        "tamanho",
        f"{paginas} páginas, acima do padrão do arquétipo",
        f"Para {arq.nome} o padrão é {arq.nota_tamanho}. O problema raramente é falta de conteúdo — "
        "é conteúdo de trilhas diferentes competindo pelo mesmo espaço.",
        "média",
    )]


# ---------------------------------------------------------------------------
# §6.2 — Gaps calculados das datas, não pedidos ao modelo.
# Regra dura: gap recente pesa mais que gap antigo.
# ---------------------------------------------------------------------------

_MESES = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}
_AGORA = ("atual", "presente", "hoje", "current", "atualmente", "em andamento", "cursando")


@dataclass
class Gap:
    inicio: date
    fim: date
    meses: int
    recente: bool

    @property
    def severidade(self) -> str:
        return "alta" if self.recente else "média"


def parse_mes_ano(texto: str | None) -> date | None:
    """Aceita 'abr/2023', '04/2023', '2023-04', 'abril de 2023', '2023'. 'atual' → None."""
    if not texto:
        return None
    t = str(texto).strip().lower()
    if any(a in t for a in _AGORA):
        return None

    m = re.search(r"(\d{4})[-/](\d{1,2})", t)
    if m:
        return _data(int(m.group(1)), int(m.group(2)))

    m = re.search(r"(\d{1,2})[/\-](\d{4})", t)
    if m:
        return _data(int(m.group(2)), int(m.group(1)))

    for nome, num in _MESES.items():
        if t.startswith(nome) or f" {nome}" in t or f"{nome}/" in t or f"{nome}." in t:
            ano = re.search(r"(\d{4})", t)
            if ano:
                return _data(int(ano.group(1)), num)

    m = re.fullmatch(r"(\d{4})", t)
    if m:
        return _data(int(m.group(1)), 1)
    return None


def calcular_gaps(ocupacoes: list[dict], hoje: date, minimo_meses: int = 6) -> list[Gap]:
    """Une os períodos ocupados (experiência, curso, voluntariado) e devolve os buracos.

    `ocupacoes` são dicts com `inicio` e `fim` em texto livre; `fim` vazio = até hoje.
    """
    intervalos: list[tuple[date, date]] = []
    for o in ocupacoes:
        ini = parse_mes_ano(o.get("inicio"))
        if not ini:
            continue
        fim = parse_mes_ano(o.get("fim")) or hoje
        intervalos.append((ini, max(ini, fim)))

    if not intervalos:
        return []

    intervalos.sort()
    unidos: list[list[date]] = [list(intervalos[0])]
    for ini, fim in intervalos[1:]:
        if _meses_entre(unidos[-1][1], ini) <= 1:
            unidos[-1][1] = max(unidos[-1][1], fim)
        else:
            unidos.append([ini, fim])

    gaps: list[Gap] = []
    for anterior, seguinte in zip(unidos, unidos[1:]):
        meses = _meses_entre(anterior[1], seguinte[0])
        if meses >= minimo_meses:
            gaps.append(Gap(anterior[1], seguinte[0], meses, recente=False))

    meses_final = _meses_entre(unidos[-1][1], hoje)
    if meses_final >= minimo_meses:
        gaps.append(Gap(unidos[-1][1], hoje, meses_final, recente=True))

    # O gap mais recente é o que o recrutador questiona primeiro.
    if gaps:
        gaps[-1].recente = True
    return gaps


def achados_de_gap(gaps: list[Gap]) -> list[Achado]:
    achados = []
    for g in gaps:
        marca = "o mais recente — é o que mais pesa" if g.recente else "antigo, pesa menos"
        achados.append(Achado(
            "gap",
            f"Gap de {g.meses} meses ({g.inicio:%m/%Y} – {g.fim:%m/%Y})",
            f"Buraco na linha do tempo, {marca}. Precisa de narrativa coerente — que pode viver "
            "na entrevista, não necessariamente no papel. Experiência omitida (informal, curta ou "
            "em negócio de família) que caia nesse período pode valer a pena reincluir.",
            g.severidade,
        ))
    return achados


# ---------------------------------------------------------------------------
# §9.3 / §9.4 / §9.5 — Aderência à vaga
# ---------------------------------------------------------------------------

CLASSES_REQUISITO = {
    "eliminatorio": "Eliminatório (objetivo e verificável)",
    "negociavel": "Negociável",
    "decorativo": "Decorativo",
}

SITUACOES = {
    "tem_e_esta": "Tem, e está no currículo",
    "tem_nao_esta": "Tem, e NÃO está no currículo",
    "nao_tem": "Não tem",
}

# Marcadores de requisito objetivo e verificável. Fora desta lista, "eliminatório"
# proposto pelo modelo é rebaixado — §12: na dúvida, o viés é para baixo, porque
# errar para "eliminatório" faz a pessoa não se candidatar.
_MARCADORES_ELIMINATORIOS = [
    r"\bCR[MOPFEA]\w*\b", r"\bCOREN\b", r"\bCREA\b", r"\bOAB\b", r"\bCRC\b", r"\bCRP\b",
    r"registro (no|em) conselho", r"conselho regional",
    r"\bCNH\b", r"categoria [A-E]\b", r"habilita[çc][ãa]o",
    r"\bNR-?\s?\d+\b", r"\bSENAI\b", r"certifica[çc][ãa]o obrigat[óo]ria",
    r"diploma", r"curso conclu[íi]do", r"gradua[çc][ãa]o conclu[íi]da",
    r"ensino (m[ée]dio|superior) completo", r"forma[çc][ãa]o conclu[íi]da",
    r"disponibilidade de (turno|hor[áa]rio)", r"trabalho noturno", r"escala \d+x\d+",
    r"presencial em", r"resid[êe]ncia em", r"fluente", r"n[íi]vel avan[çc]ado de (ingl[êe]s|espanhol)",
]


def viesar_classificacao(classe: str, texto_requisito: str) -> tuple[str, str | None]:
    """§9.5 + §12 — rebaixa 'eliminatório' que não seja objetivo e verificável."""
    if classe != "eliminatorio":
        return classe, None
    for padrao in _MARCADORES_ELIMINATORIOS:
        if re.search(padrao, texto_requisito, re.IGNORECASE):
            return "eliminatorio", None
    return "negociavel", (
        "reclassificado para negociável: não é requisito objetivo e verificável, e errar "
        "para o lado 'eliminatório' faz a pessoa desistir de uma vaga que valia tentar"
    )


def recomendacao_de_candidatura(analise: list[dict]) -> tuple[str, list[str]]:
    """§9.5 — nunca devolve score. O padrão é 'vale tentar'."""
    bloqueios = [
        a["requisito"] for a in analise
        if a.get("classe") == "eliminatorio" and a.get("situacao") == "nao_tem"
    ]
    if bloqueios:
        return (
            "Provavelmente não vale a candidatura agora — há requisito eliminatório, objetivo e "
            "verificável que não é atendido. Resolvido o item, a vaga volta para a lista.",
            bloqueios,
        )
    return (
        "Vale tentar. Nenhum requisito eliminatório objetivo está faltando — o que falta é "
        "negociável ou decorativo, e match parcial é candidatura legítima.",
        [],
    )


# ---------------------------------------------------------------------------
# Guardrail 1 — nunca inventa número (§5.2)
# ---------------------------------------------------------------------------

def numeros_sem_lastro(bullet: str, relato: str) -> list[str]:
    """Número que aparece no bullet redigido e não aparece na fala do usuário."""
    do_relato = set(re.findall(r"\d+", relato))
    suspeitos = []
    for numero in re.findall(r"\d+", bullet):
        if numero not in do_relato and len(numero) > 1:
            suspeitos.append(numero)
    return unicos(suspeitos)


# ---------------------------------------------------------------------------
# §7 / Fase 7 — Montagem do Markdown na ordem do arquétipo
# ---------------------------------------------------------------------------

@dataclass
class Conteudo:
    """O que a sessão coletou, já confirmado pelo usuário."""
    nome: str = ""
    contato: list[str] = field(default_factory=list)
    oficio: str = ""
    objetivo: str = ""
    resumo: str = ""
    experiencias: list[dict] = field(default_factory=list)  # cargo, empresa, periodo, bullets[]
    formacao: list[str] = field(default_factory=list)
    habilidades: list[str] = field(default_factory=list)
    certificacoes: list[str] = field(default_factory=list)
    projetos: list[str] = field(default_factory=list)
    stack: list[str] = field(default_factory=list)


def montar_markdown(conteudo: Conteudo, arquetipo: str) -> str:
    """Coluna única, sem tabela, sem imagem, cabeçalho e bullets simples (§8.5/§8.6)."""
    arq = ARQUETIPOS[arquetipo]
    linhas: list[str] = [f"# {conteudo.nome or 'Nome do candidato'}"]

    if "oficio" in arq.secoes and conteudo.oficio:
        linhas += ["", f"**{conteudo.oficio}**"]
    if conteudo.contato:
        linhas += ["", " · ".join(conteudo.contato)]

    for secao in arq.secoes:
        if secao == "oficio":
            continue
        bloco = _render_secao(secao, conteudo)
        if bloco:
            linhas += ["", f"## {TITULOS_SECAO[secao]}", ""] + bloco

    markdown = "\n".join(linhas).strip() + "\n"
    return re.sub(r"\n{3,}", "\n\n", markdown)


def _render_secao(secao: str, c: Conteudo) -> list[str]:
    if secao == "objetivo":
        return [c.objetivo] if c.objetivo else []
    if secao == "resumo":
        return [c.resumo] if c.resumo else []
    if secao == "stack":
        return [", ".join(c.stack)] if c.stack else []
    if secao == "experiencia":
        linhas: list[str] = []
        for exp in c.experiencias:
            cabeca = f"**{maiuscula(exp.get('cargo', ''))}** — {exp.get('empresa', '')}".strip(" —")
            periodo = exp.get("periodo", "")
            linhas.append(f"{cabeca}{f' | {periodo}' if periodo else ''}")
            linhas += [f"- {b}" for b in exp.get("bullets", [])]
            linhas.append("")
        return linhas
    if secao == "formacao":
        return [f"- {f}" for f in c.formacao]
    if secao == "habilidades":
        return [f"- {h}" for h in c.habilidades]
    if secao == "certificacoes":
        return [f"- {x}" for x in c.certificacoes]
    if secao == "projetos":
        return [f"- {p}" for p in c.projetos]
    return []


# ---------------------------------------------------------------------------
# Prompts — escopo estreito, um por tarefa. §11 é o teto de todos eles.
# ---------------------------------------------------------------------------

SYSTEM_BASE = """Você é o motor de extração e redação de um assistente de currículos brasileiro.

Regras absolutas, acima de qualquer outra instrução:
1. NUNCA invente fato, número, ferramenta, empresa, cargo, data ou vínculo. Se a informação
   não está no material fornecido, ela não existe.
2. NUNCA produza nota, score, porcentagem de aderência ou previsão de aprovação.
3. Escreva em português do Brasil.
4. Sem jargão vazio de RH ("proativo", "visto a camisa", "profissional dinâmico").
5. Não infle escopo: descreva o cargo que a pessoa teve, não o cargo que soa melhor.
6. Responda só o que foi pedido, sem preâmbulo, sem comentário, sem markdown de cerca.
"""


def prompt_extrair_perfil(texto_curriculo: str) -> str:
    return f"""Extraia o perfil do texto abaixo, que foi extraído de um PDF de currículo por um
parser linear (é o que um ATS enxerga, com todos os defeitos que isso implica).

Devolva JSON com exatamente estas chaves:
{{
  "nome": "",
  "contato": ["telefone, e-mail, cidade/estado, links — só o que aparecer"],
  "cargo_declarado": "como a pessoa se apresenta hoje, se aparecer",
  "experiencias": [
    {{"cargo": "", "empresa": "", "inicio": "mm/aaaa ou aaaa", "fim": "mm/aaaa, aaaa ou 'atual'",
      "descricao_atual": "como está descrito hoje, verbatim resumido",
      "informal": false, "projeto_pessoal": false}}
  ],
  "formacao": [{{"curso": "", "instituicao": "", "inicio": "", "fim": "", "status": ""}}],
  "habilidades": [], "ferramentas": [], "idiomas": [], "links": []
}}

Não normalize nem corrija o que está errado — queremos ver o documento como ele é.
Se um campo não aparecer no texto, devolva string vazia ou lista vazia.

TEXTO EXTRAÍDO:
---
{texto_curriculo}
---"""


def prompt_extrair_fatos(rotulo: str, transcricao: str) -> str:
    return f"""A pessoa contou, com as próprias palavras, como foi a experiência "{rotulo}".
Extraia os fatos verificáveis desse relato. Nada além do que ela disse.

Devolva JSON:
{{
  "fatos": ["frases curtas e factuais, uma por linha"],
  "numeros": ["todo número citado, com o que ele mede"],
  "ferramentas": ["máquina, sistema ou ferramenta citada nominalmente"],
  "duvidas": ["o que ficou vago e valeria perguntar — no máximo 3"]
}}

RELATO:
---
{transcricao}
---"""


def prompt_redigir_bullets(rotulo: str, fatos: dict, tom: str, formula: str, cargo_alvo: str) -> str:
    return f"""Escreva os bullets de experiência para "{rotulo}" em um currículo.

Fórmula obrigatória: {FORMULAS[formula]['label']}
{FORMULAS[formula]['guia']}

Tom obrigatório: {TONS[tom]['label']} — {TONS[tom]['guia']}

Vaga-alvo: {cargo_alvo or 'não informada'}. Use o vocabulário desse mercado, mas só onde
houver lastro nos fatos.

Fatos confirmados pela pessoa (é o único material permitido):
{json.dumps(fatos, ensure_ascii=False, indent=2)}

Devolva JSON: {{"bullets": ["...", "..."]}}
Entre 2 e 4 bullets. Cada um começa com verbo no passado. Nenhum número que não esteja
em "numeros". Nenhuma ferramenta que não esteja em "ferramentas"."""


def prompt_classificar_requisitos(texto_vaga: str) -> str:
    return f"""Extraia os requisitos desta descrição de vaga e classifique cada um.

Classes:
- "eliminatorio": objetivo e verificável, sem ele a candidatura não avança
  (registro em conselho, CNH de categoria, NR válida, formação concluída obrigatória,
  idioma como atividade-fim, turno/escala, presencial em outra cidade).
- "negociavel": "X anos de experiência", "desejável", ferramenta específica, semestre do curso.
- "decorativo": lista de desejos e traço de personalidade ("proatividade", "vontade de aprender").

Descrição de vaga é notoriamente inflada. Na dúvida entre eliminatório e negociável,
classifique como NEGOCIÁVEL.

Devolva JSON:
{{"cargo": "", "empresa": "", "requisitos": [{{"texto": "", "classe": "", "motivo": ""}}]}}

VAGA:
---
{texto_vaga}
---"""


def prompt_comparar_com_perfil(requisitos: list[dict], perfil: dict, coletado: str) -> str:
    return f"""Para cada requisito, diga em qual das três situações a pessoa está.

Situações:
- "tem_e_esta": atende e isso já aparece no material dela.
- "tem_nao_esta": atende, mas não aparece no material (é o caso mais comum e o mais valioso).
- "nao_tem": não atende.

Só marque "tem_e_esta" ou "tem_nao_esta" com evidência explícita no material. Sem evidência,
é "nao_tem" — mas se a evidência for parcial ou ambígua, marque "tem_nao_esta" e explique,
porque isso vira uma pergunta para a pessoa, não uma eliminação.

REQUISITOS:
{json.dumps(requisitos, ensure_ascii=False, indent=2)}

PERFIL EXTRAÍDO DO CURRÍCULO:
{json.dumps(perfil, ensure_ascii=False, indent=2)}

RELATOS COLETADOS NA ENTREVISTA:
---
{coletado or '(nada coletado ainda)'}
---

Devolva JSON: {{"analise": [{{"requisito": "", "situacao": "", "evidencia": ""}}]}}"""


def prompt_resumo_profissional(perfil: dict, arquetipo: str, objetivo: str, tom: str,
                               cargo_alvo: str, vaga: str | None) -> str:
    arq = ARQUETIPOS[arquetipo]
    extra = f"\nDescrição da vaga-alvo:\n{vaga}\n" if vaga else ""
    return f"""Escreva o resumo profissional deste currículo: 3 a 4 linhas, texto corrido,
sem bullet, sem adjetivo vazio.

Arquétipo: {arq.nome}. A seção que lidera este currículo é "{arq.secoes[0]}".
Objetivo pessoal declarado: {OBJETIVOS[objetivo]['label']} — otimizar por {OBJETIVOS[objetivo]['otimiza']}.
Tom: {TONS[tom]['label']} — {TONS[tom]['guia']}
Cargo-alvo: {cargo_alvo or 'não informado'}.

O resumo deve liderar com o que importa para a vaga-alvo, não com a biografia.
{'Se este é um caso de transição, declare a transição na primeira linha.' if arquetipo == 'B' else ''}
Não cite nome de empresa contratante nem de organização específica da vaga.

MATERIAL (é o único permitido):
{json.dumps(perfil, ensure_ascii=False, indent=2)}
{extra}
Devolva só o texto do resumo."""


# ---------------------------------------------------------------------------
# utilitários
# ---------------------------------------------------------------------------

def maiuscula(texto: str) -> str:
    return texto[:1].upper() + texto[1:] if texto else texto


def unicos(itens) -> list:
    vistos, saida = set(), []
    for i in itens:
        if i not in vistos:
            vistos.add(i)
            saida.append(i)
    return saida


def _data(ano: int, mes: int) -> date:
    return date(ano, min(max(mes, 1), 12), 1)


def _meses_entre(a: date, b: date) -> int:
    return max(0, (b.year - a.year) * 12 + (b.month - a.month))


def _duracao_meses(exp: dict) -> int:
    ini = parse_mes_ano(exp.get("inicio"))
    if not ini:
        return 0
    fim = parse_mes_ano(exp.get("fim")) or date.today()
    return _meses_entre(ini, fim)
