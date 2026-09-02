#!/usr/bin/env python3
"""Protótipo de terminal para testar a metodologia com uma pessoa de verdade.

Lê os currículos que a pessoa já tem, diagnostica o artefato, conduz a entrevista
seguindo o pipeline de `business/methodology/metodologia-do-sistema.md` e escreve um
currículo estruturado em Markdown.

    python demo/demo.py caminho/do/curriculo.pdf [outro.pdf ...]
    python demo/demo.py --sessoes
    python demo/demo.py --resume <id-da-sessao>

Setup e chaves da API: ver README.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import secrets
import sys
import time
import unicodedata

# readline dá edição de linha ao input(): backspace/delete/setas param de travar a tela
# (achado das transcrições). Ausente em alguns Windows — a falta não é fatal.
try:
    import readline  # noqa: F401
except ImportError:
    pass
from dataclasses import dataclass, field, fields, asdict
from datetime import date, datetime
from pathlib import Path

import docs.demo.metodologia as M

RAIZ = Path(__file__).resolve().parent
SAIDA = RAIZ / "out"

# ---------------------------------------------------------------------------
# terminal
# ---------------------------------------------------------------------------

_COR = sys.stdout.isatty()
def _c(codigo: str, texto: str) -> str:
    return f"\033[{codigo}m{texto}\033[0m" if _COR else texto

def negrito(t: str) -> str: return _c("1", t)
def fraco(t: str) -> str: return _c("2", t)
def ciano(t: str) -> str: return _c("36", t)
def amarelo(t: str) -> str: return _c("33", t)
def vermelho(t: str) -> str: return _c("31", t)
def verde(t: str) -> str: return _c("32", t)

CORES_SEVERIDADE = {"crítica": vermelho, "alta": vermelho, "média": amarelo, "baixa": fraco}


def titulo(texto: str) -> None:
    print()
    print(negrito(ciano(f"── {texto} " + "─" * max(0, 62 - len(texto)))))


def aviso(texto: str) -> None:
    print(amarelo(f"  ! {texto}"))


def nota(texto: str) -> None:
    print(fraco(f"  {texto}"))


class Sair(Exception):
    """/sair — salva a sessão e encerra."""


class Voltar(Exception):
    """/voltar — retorna à pergunta anterior no fluxo de coleta."""


AJUDA = """
Comandos disponíveis em qualquer pergunta:
  /ajuda    mostra esta lista
  /estado   mostra o que a sessão já sabe
  /voltar   volta para a pergunta anterior (quando disponível)
  /pular    deixa a pergunta em branco e segue
  /sair     salva a sessão e encerra (retome com --resume <id>)
"""


def perguntar(texto: str, obrigatorio: bool = False, sessao: "Sessao | None" = None,
              confirmar: bool = False, permitir_voltar: bool = False) -> str:
    """Uma pergunta por vez, com os comandos de barra interceptados.

    `confirmar`: depois de uma resposta não vazia, mostra o que foi digitado e pede
    confirmação — evita que um Enter acidental envie sem revisão (achado das transcrições).
    `permitir_voltar`: habilita /voltar, que levanta `Voltar` para o loop de coleta tratar.
    """
    while True:
        try:
            resposta = input(negrito(f"\n{texto}\n> ")).strip()
        except (EOFError, KeyboardInterrupt):
            raise Sair()

        if resposta == "/sair":
            raise Sair()
        if resposta == "/ajuda":
            print(fraco(AJUDA))
            continue
        if resposta == "/estado":
            print(fraco(json.dumps(sessao.resumo_estado() if sessao else {}, ensure_ascii=False, indent=2)))
            continue
        if resposta == "/voltar":
            if permitir_voltar:
                raise Voltar()
            aviso("Não dá para voltar daqui.")
            continue
        if resposta == "/pular":
            return ""
        if not resposta and obrigatorio:
            aviso("Esta resposta é obrigatória para a metodologia seguir. Use /sair se quiser parar.")
            continue

        if confirmar and resposta:
            decisao = escolher(
                f'Você respondeu: "{_resumir(resposta)}"',
                [("s", "Confirmar e seguir"),
                 ("e", "Editar (escrever de novo)")],
                padrao="s", sessao=sessao,
            )
            if decisao == "e":
                continue
        return resposta


def _resumir(texto: str, limite: int = 160) -> str:
    texto = " ".join(texto.split())
    return texto if len(texto) <= limite else texto[:limite].rstrip() + "…"


def escolher(texto: str, opcoes: list[tuple[str, str]], padrao: str | None = None,
             sessao: "Sessao | None" = None) -> str:
    """Menu numerado. `opcoes` são pares (chave, rótulo)."""
    print()
    print(negrito(texto))
    for i, (chave, rotulo) in enumerate(opcoes, 1):
        marca = fraco("  (padrão)") if chave == padrao else ""
        print(f"  {i}. {rotulo}{marca}")

    while True:
        bruto = perguntar("Número da opção:" + (" [Enter = padrão]" if padrao else ""), sessao=sessao)
        if bruto.isdigit() and 1 <= int(bruto) <= len(opcoes):
            return opcoes[int(bruto) - 1][0]
        if not bruto:
            # Resposta vazia ou /pular nunca deixa o fluxo travado num menu.
            return padrao or opcoes[0][0]
        aviso("Escolha um número da lista.")


def ler_bloco(texto: str, sentinela: str = "FIM") -> str:
    """Colagem de texto longo (descrição de vaga, relato escrito)."""
    print()
    print(negrito(texto))
    print(fraco(f"  Cole o texto e termine com uma linha contendo só {sentinela}"))
    linhas: list[str] = []
    while True:
        try:
            linha = input()
        except (EOFError, KeyboardInterrupt):
            break
        if linha.strip() == sentinela:
            break
        linhas.append(linha)
    return "\n".join(linhas).strip()


def mostrar_achados(achados: list[M.Achado]) -> None:
    """§6.2 — o diagnóstico não é opcional nem escondido. Tom descritivo, sem culpa."""
    if not achados:
        print(verde("  Nenhum achado. O documento passa limpo nas verificações automáticas."))
        return
    for a in M.ordenar_achados(achados):
        cor = CORES_SEVERIDADE.get(a.severidade, str)
        print(f"\n  {cor('●')} {negrito(a.titulo)} {fraco(f'[{a.severidade}]')}")
        for linha in _quebrar(a.detalhe, 74):
            print(f"    {linha}")


def _quebrar(texto: str, largura: int) -> list[str]:
    palavras, linhas, atual = texto.split(), [], ""
    for p in palavras:
        if len(atual) + len(p) + 1 > largura:
            linhas.append(atual)
            atual = p
        else:
            atual = f"{atual} {p}".strip()
    if atual:
        linhas.append(atual)
    return linhas


# ---------------------------------------------------------------------------
# Gemini
# ---------------------------------------------------------------------------

# A cota da camada gratuita é por projeto/conta, então chave reserva só resolve se for
# de OUTRA conta Google. Ordem de uso: principal primeiro, reservas conforme a cota acaba.
CHAVES_ENV = [
    ("GEMINI_API_KEY", "principal"),
    ("GEMINI_API_KEY_2", "reserva 1"),
    ("GEMINI_API_KEY_3", "reserva 2"),
]

# Modelos aceitos na cota gratuita, do mais capaz ao mais leve. Fallback quando o modelo
# atual fica sobrecarregado (503) de forma persistente.
MODELOS_FALLBACK = ["gemini-2.5-flash", "gemini-flash-lite-latest"]

# Retry de 503 (servidor sobrecarregado): backoff exponencial com teto e jitter.
MAX_TENTATIVAS_503 = 10
BACKOFF_BASE = 1.0
BACKOFF_TETO = 60.0


def _erro_de_cota(erro: Exception) -> tuple[bool, bool]:
    """(é estouro de cota?, é o limite diário?) — lido da mensagem do SDK."""
    texto = f"{type(erro).__name__} {erro}".lower()
    cota = any(m in texto for m in
               ("resource_exhausted", "429", "quota", "rate limit", "ratelimit"))
    diario = any(m in texto for m in ("per day", "perday", "per_day", "daily", "diári"))
    return cota, diario


def _erro_de_sobrecarga(erro: Exception) -> bool:
    """503 / servidor indisponível — distinto de cota (429). Resolve-se esperando, não trocando conta."""
    texto = f"{type(erro).__name__} {erro}".lower()
    return any(m in texto for m in ("503", "overloaded", "unavailable", "service_unavailable"))


class Motor:
    def __init__(self, modelo: str | None = None):
        try:
            from google import genai
            from google.genai import types
        except ImportError:
            sys.exit(vermelho(
                "Falta o SDK do Gemini. Rode:  pip install -r demo/requirements.txt\n"
                "Instruções completas no README.md."
            ))

        self.chaves = [(rotulo, valor) for var, rotulo in CHAVES_ENV
                       if (valor := os.getenv(var, "").strip())]
        if not self.chaves:
            sys.exit(vermelho(
                "GEMINI_API_KEY não configurada.\n"
                "  1. Gere a chave em https://aistudio.google.com/apikey\n"
                "  2. cp demo/.env.example demo/.env\n"
                "  3. Cole a chave em GEMINI_API_KEY dentro de demo/.env\n"
                "Detalhes no README.md."
            ))

        self._genai = genai
        self._types = types
        self.indice = 0
        self.esgotadas: set[int] = set()
        self.cliente = genai.Client(api_key=self.chaves[0][1])
        self.modelo = modelo or os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
        self.chamadas = 0

    def descricao_chaves(self) -> str:
        reservas = len(self.chaves) - 1
        if not reservas:
            return "1 chave (sem reserva)"
        return f"{len(self.chaves)} chaves ({reservas} reserva{'s' if reservas > 1 else ''})"

    def _gerar(self, prompt: str, json_mode: bool) -> str:
        config = self._types.GenerateContentConfig(
            system_instruction=M.SYSTEM_BASE,
            temperature=0.3,
            response_mime_type="application/json" if json_mode else "text/plain",
        )
        tentativa_503 = 0
        while True:
            self.chamadas += 1
            try:
                resposta = self.cliente.models.generate_content(
                    model=self.modelo, contents=prompt, config=config
                )
                return (resposta.text or "").strip()
            except Exception as erro:  # rede, cota, sobrecarga, modelo inexistente
                cota, diario = _erro_de_cota(erro)
                if cota:
                    # Levanta Sair se a pessoa preferir parar; segue no loop para tentar de novo.
                    self._resolver_cota(diario)
                    tentativa_503 = 0
                    continue

                if _erro_de_sobrecarga(erro):
                    tentativa_503 += 1
                    if tentativa_503 < MAX_TENTATIVAS_503:
                        espera = min(BACKOFF_TETO, BACKOFF_BASE * 2 ** (tentativa_503 - 1))
                        espera += random.uniform(0.1, 0.5)
                        aviso(f"Gemini sobrecarregado (503). Tentativa {tentativa_503}/"
                              f"{MAX_TENTATIVAS_503} — aguardando {espera:.1f}s...")
                        time.sleep(espera)
                        continue
                    # Esgotou os retries: oferece trocar de modelo (ou de conta) e recomeça.
                    self._oferecer_troca_modelo_ou_chave()
                    tentativa_503 = 0
                    continue

                raise RuntimeError(
                    f"Falha ao chamar o modelo '{self.modelo}': {erro}\n"
                    "Se o modelo não existir mais, troque GEMINI_MODEL no demo/.env."
                ) from erro

    def _oferecer_troca_modelo_ou_chave(self) -> None:
        """503 persistente após os retries: trocar para um modelo mais leve da cota gratuita,
        ou rotacionar para uma chave reserva. /sair continua salvando tudo."""
        aviso(f"O modelo '{self.modelo}' segue indisponível após {MAX_TENTATIVAS_503} tentativas.")

        opcoes: list[tuple[str, str]] = [
            (f"modelo:{m}", f"Trocar para o modelo {m}")
            for m in MODELOS_FALLBACK if m != self.modelo
        ]
        disponiveis = [i for i in range(len(self.chaves)) if i not in self.esgotadas
                       and i != self.indice]
        opcoes += [(f"chave:{i}", f"Tentar com a conta {self.chaves[i][0]}") for i in disponiveis]
        opcoes.append(("esperar", "Esperar mais 60 segundos no modelo atual"))
        opcoes.append(("salvar", "Salvar a sessão e continuar depois"))

        escolha = escolher("O servidor está sobrecarregado. O que você quer fazer?",
                           opcoes, padrao=opcoes[0][0], sessao=None)

        if escolha == "salvar":
            raise Sair()
        if escolha == "esperar":
            nota("Esperando 60s...")
            time.sleep(60)
            return
        if escolha.startswith("modelo:"):
            self.modelo = escolha.split(":", 1)[1]
            nota(f"Agora usando o modelo {self.modelo}.")
            return
        self.indice = int(escolha.split(":")[1])
        self.cliente = self._genai.Client(api_key=self.chaves[self.indice][1])
        nota(f"Agora usando a conta {self.chaves[self.indice][0]}.")

    def _resolver_cota(self, diario: bool) -> None:
        """Cota estourada no meio da sessão: trocar de conta, esperar, ou parar e voltar depois.

        Nada do que já foi coletado se perde — quem escolhe parar cai no /sair, que salva.
        """
        rotulo = self.chaves[self.indice][0]
        self.esgotadas.add(self.indice)

        print()
        aviso(f"A cota da chave {rotulo} acabou "
              f"({'limite diário' if diario else 'limite por minuto'}).")

        disponiveis = [i for i in range(len(self.chaves)) if i not in self.esgotadas]
        opcoes: list[tuple[str, str]] = []
        if not diario:
            opcoes.append(("esperar", "Esperar 60 segundos e tentar de novo"))
        opcoes += [(f"chave:{i}", f"Trocar para a conta {self.chaves[i][0]}")
                   for i in disponiveis]
        opcoes.append(("salvar", "Salvar a sessão e continuar depois"))

        if not disponiveis and len(self.chaves) == 1:
            nota("Nenhuma chave reserva configurada. Para ter uma, preencha "
                 "GEMINI_API_KEY_2 (e _3) em demo/.env com chaves de OUTRA conta Google.")
        elif not disponiveis:
            nota("As chaves reserva também acabaram. A cota diária zera no dia seguinte — "
                 "salve agora e continue depois, nada do que você contou se perde.")

        escolha = escolher("O que você quer fazer?", opcoes, padrao=opcoes[0][0])

        if escolha == "salvar":
            raise Sair()
        if escolha == "esperar":
            self.esgotadas.discard(self.indice)
            nota("Esperando 60s antes de tentar de novo...")
            time.sleep(60)
            return

        self.indice = int(escolha.split(":")[1])
        self.cliente = self._genai.Client(api_key=self.chaves[self.indice][1])
        nota(f"Agora usando a conta {self.chaves[self.indice][0]}.")
        if diario:
            nota("Se esta chave for da mesma conta Google da anterior, a cota é a mesma "
                 "e vai acabar de novo na hora.")

    def texto(self, prompt: str) -> str:
        return self._gerar(prompt, json_mode=False)

    def json(self, prompt: str) -> dict:
        bruto = self._gerar(prompt, json_mode=True)
        return _parse_json(bruto)


def _parse_json(bruto: str) -> dict:
    bruto = re.sub(r"^```(?:json)?|```$", "", bruto.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(bruto)
    except json.JSONDecodeError:
        inicio, fim = bruto.find("{"), bruto.rfind("}")
        if inicio >= 0 and fim > inicio:
            try:
                return json.loads(bruto[inicio:fim + 1])
            except json.JSONDecodeError:
                pass
    aviso("O modelo devolveu algo que não é JSON válido. Seguindo com estrutura vazia.")
    return {}


# ---------------------------------------------------------------------------
# PDF — texto linear, que é o que o ATS enxerga (§6.1)
# ---------------------------------------------------------------------------

def ler_pdf(caminho: Path) -> dict:
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit(vermelho("Falta o pypdf. Rode:  pip install -r demo/requirements.txt"))

    leitor = PdfReader(str(caminho))
    partes, imagens = [], 0
    for pagina in leitor.pages:
        partes.append(pagina.extract_text() or "")
        try:
            imagens += len(pagina.images)
        except Exception:
            pass
    return {
        "arquivo": str(caminho),
        "paginas": len(leitor.pages),
        "imagens": imagens,
        "texto": "\n".join(partes).strip(),
    }


# ---------------------------------------------------------------------------
# sessão
# ---------------------------------------------------------------------------

# s.fase é quantas fases já fecharam, então o rótulo abaixo é o PRÓXIMO passo.
NOME_FASE = {
    0: "diagnóstico do currículo",
    1: "objetivo pessoal",
    2: "arquétipo e estrutura",
    3: "parâmetros de escrita",
    4: "contar as experiências",
    5: "a vaga",
    6: "gerar o currículo",
    7: "concluída",
}


@dataclass
class Sessao:
    id: str = ""
    criado_em: str = ""
    atualizado_em: str = ""
    slug: str = "sessao"
    arquivos: list[dict] = field(default_factory=list)
    base: int = 0                      # índice do currículo que está em uso hoje
    perfil: dict = field(default_factory=dict)
    achados: list[dict] = field(default_factory=list)
    objetivo: str = ""
    cargo_alvo: str = ""               # alvo primário — compat e material de coleta
    cargos_alvo: list[str] = field(default_factory=list)  # §4.3 — uma versão por alvo
    arquetipo: str = ""
    tom: str = ""
    formula: str = ""
    relatos: list[dict] = field(default_factory=list)
    habilidades_confirmadas: list[str] = field(default_factory=list)
    vaga: dict = field(default_factory=dict)              # última vaga analisada (compat)
    vagas: list[dict] = field(default_factory=list)       # §9 — vagas analisadas no loop
    fase: int = 0

    def alvos(self) -> list[str]:
        """Alvos a gerar: a lista multi-vaga, ou o alvo primário como lista de um."""
        return self.cargos_alvo or ([self.cargo_alvo] if self.cargo_alvo else [""])

    # Sessão carregada de um arquivo de layout antigo continua escrevendo no arquivo dela.
    # Atributo comum, não campo do dataclass — asdict() não o serializa.
    _arquivo = None

    def __post_init__(self) -> None:
        if not self.id:
            self.id = secrets.token_hex(3)
        if not self.criado_em:
            self.criado_em = datetime.now().isoformat(timespec="seconds")

    def caminho(self) -> Path:
        if self._arquivo:
            return self._arquivo
        return SAIDA / f"{self.slug}-{self.id}-sessao.json"

    def salvar(self) -> None:
        SAIDA.mkdir(parents=True, exist_ok=True)
        self.atualizado_em = datetime.now().isoformat(timespec="seconds")
        destino = self.caminho()
        destino.write_text(json.dumps(asdict(self), ensure_ascii=False, indent=2))
        # O slug só é conhecido depois da Fase 1; o arquivo criado antes disso é lixo.
        for antigo in SAIDA.glob(f"*-{self.id}-sessao.json"):
            if antigo != destino:
                antigo.unlink()

    @classmethod
    def carregar(cls, caminho: Path) -> "Sessao":
        caminho = Path(caminho)
        dados = json.loads(caminho.read_text())
        # Tolera arquivo de versão anterior do script: ignora chave que não existe mais.
        s = cls(**{k: v for k, v in dados.items() if k in {f.name for f in fields(cls)}})

        # Sessão gravada antes de existir id: deriva do nome do arquivo em vez de sortear,
        # senão o id mudaria a cada leitura e --resume nunca acharia a sessão.
        if not dados.get("id"):
            s.id = hashlib.sha1(caminho.name.encode()).hexdigest()[:6]
        if not s.atualizado_em:
            s.atualizado_em = datetime.fromtimestamp(
                caminho.stat().st_mtime).isoformat(timespec="seconds")
        if not caminho.name.endswith(f"-{s.id}-sessao.json"):
            s._arquivo = caminho
        return s

    @classmethod
    def listar(cls) -> list["Sessao"]:
        encontradas = []
        for arquivo in SAIDA.glob("*sessao.json"):
            try:
                encontradas.append(cls.carregar(arquivo))
            except Exception:
                continue  # arquivo corrompido não derruba a listagem
        return sorted(encontradas, key=lambda s: s.atualizado_em or "", reverse=True)

    @classmethod
    def resolver(cls, referencia: str) -> "Sessao":
        """Aceita id (inteiro ou prefixo) ou caminho do arquivo."""
        caminho = Path(referencia)
        if caminho.exists():
            return cls.carregar(caminho)

        candidatas = [s for s in cls.listar() if s.id == referencia]
        if not candidatas:
            candidatas = [s for s in cls.listar() if s.id.startswith(referencia)]
        if len(candidatas) == 1:
            return candidatas[0]
        if len(candidatas) > 1:
            sys.exit(vermelho(
                f"'{referencia}' casa com mais de uma sessão: "
                + ", ".join(s.id for s in candidatas) + "\nUse o id completo."
            ))
        sys.exit(vermelho(
            f"Sessão '{referencia}' não encontrada.\n"
            "Veja as disponíveis com:  python demo/demo.py --sessoes"
        ))

    def texto_base(self) -> str:
        return self.arquivos[self.base]["texto"] if self.arquivos else ""

    def relatos_como_texto(self) -> str:
        return "\n\n".join(
            f"[{r['rotulo']}]\n{r['transcricao']}" for r in self.relatos if r.get("transcricao")
        )

    def resumo_estado(self) -> dict:
        return {
            "fase": self.fase,
            "objetivo": self.objetivo,
            "cargo_alvo": self.cargo_alvo,
            "cargos_alvo": self.cargos_alvo,
            "arquetipo": self.arquetipo,
            "tom": self.tom,
            "formula": self.formula,
            "experiencias_coletadas": [r["rotulo"] for r in self.relatos],
            "vaga": self.vaga.get("cargo", ""),
            "achados": len(self.achados),
        }


def _slug(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-") or "sessao"


# ---------------------------------------------------------------------------
# Fase 1 — Diagnóstico do artefato (§6)
# ---------------------------------------------------------------------------

def fase_diagnostico(s: Sessao, motor: Motor) -> None:
    titulo("Fase 1 — Diagnóstico do currículo atual")

    if not s.arquivos:
        nota("Nenhum PDF informado. Seguindo sem diagnóstico de artefato — "
             "tudo vai ser coletado na conversa.")
        s.perfil = {"experiencias": [], "formacao": []}
        _garantir_identidade(s)
        return

    for i, arq in enumerate(s.arquivos):
        print(f"\n{negrito(Path(arq['arquivo']).name)} — {arq['paginas']} página(s), "
              f"{len(arq['texto'])} caracteres extraídos")
        achados = (
            M.achados_de_parsing(arq["texto"])
            + M.achados_de_dado_sensivel(arq["texto"])
            + M.achado_de_imagem(arq["imagens"])
        )
        mostrar_achados(achados)
        arq["achados"] = [asdict(a) for a in achados]

    # §6.1 — pergunta obrigatória: o documento analisado é o que roda no funil?
    if len(s.arquivos) > 1:
        s.base = int(escolher(
            "Qual desses é o currículo que você está enviando hoje nas candidaturas?",
            [(str(i), Path(a["arquivo"]).name) for i, a in enumerate(s.arquivos)],
            sessao=s,
        ))
    else:
        resposta = perguntar(
            "É este o currículo que você está enviando hoje nas candidaturas? (s/n)", sessao=s
        )
        if resposta.lower().startswith("n"):
            aviso("Então o diagnóstico acima vale para um documento que não está no funil. "
                  "O currículo em uso é o que precisa ser analisado — traga esse arquivo.")

    print()
    nota("Extraindo o perfil do texto do currículo...")
    s.perfil = motor.json(M.prompt_extrair_perfil(s.texto_base()))

    experiencias = s.perfil.get("experiencias") or []
    ocupacoes = list(experiencias) + [
        {"inicio": f.get("inicio"), "fim": f.get("fim")} for f in (s.perfil.get("formacao") or [])
    ]
    gaps = M.calcular_gaps(ocupacoes, date.today())

    achados_perfil = M.achados_de_gap(gaps)
    if achados_perfil:
        titulo("Linha do tempo")
        for e in experiencias:
            print(f"  {e.get('inicio', '?')} – {e.get('fim') or 'atual'}  "
                  f"{e.get('cargo', '')} @ {e.get('empresa', '')}")
        mostrar_achados(achados_perfil)

    s.achados = [asdict(a) for a in achados_perfil] + s.arquivos[s.base].get("achados", [])
    _garantir_identidade(s)


def _garantir_identidade(s: Sessao) -> None:
    """Sem nome e contato não existe currículo — e a extração pode não ter achado."""
    if not s.perfil.get("nome"):
        s.perfil["nome"] = perguntar("Seu nome completo:", obrigatorio=True, sessao=s)
    if not s.perfil.get("contato"):
        bruto = perguntar(
            "Cidade/estado, telefone e e-mail — o que deve aparecer no currículo "
            "(separado por vírgula):", sessao=s,
        )
        s.perfil["contato"] = [p.strip() for p in bruto.split(",") if p.strip()]


# ---------------------------------------------------------------------------
# Fase 2 — Objetivo pessoal (§3)
# ---------------------------------------------------------------------------

def fase_objetivo(s: Sessao) -> None:
    titulo("Fase 2 — Objetivo pessoal")
    nota("Regra dura: o sistema não escreve nada antes de saber o que você quer AGORA.")
    s.objetivo = escolher(
        "O que você quer neste momento?",
        [(k, v["label"]) for k, v in M.OBJETIVOS.items()],
        sessao=s,
    )
    print(verde(f"\n  Otimizando por: {M.OBJETIVOS[s.objetivo]['otimiza']}"))


# ---------------------------------------------------------------------------
# Fase 3 — Arquétipo e estrutura (§4)
# ---------------------------------------------------------------------------

def fase_arquetipo(s: Sessao, motor: "Motor | None" = None) -> None:
    titulo("Fase 3 — Arquétipo e estrutura do documento")

    s.cargo_alvo = perguntar(
        "Qual cargo/vaga você está buscando? (ex.: auxiliar veterinária, estágio em desenvolvimento)",
        obrigatorio=True, sessao=s, confirmar=True,
    )
    s.cargos_alvo = [s.cargo_alvo]
    # §4.3 — a pessoa pode mirar mais de um alvo; cada um vira uma versão enxuta (§7).
    while perguntar(
        "Quer mirar em outro cargo também? O sistema gera uma versão para cada um. (s/n)", sessao=s
    ).lower().startswith("s"):
        outro = perguntar("Qual o outro cargo/vaga?", sessao=s, confirmar=True)
        if outro and outro not in s.cargos_alvo:
            s.cargos_alvo.append(outro)

    # §4.3 — orientação proativa: se a formação recente supera o alvo, avisa e oferece a versão.
    if motor is not None and s.perfil.get("formacao"):
        _orientar_carreira(s, motor)

    mesma_area = perguntar(
        "Sua experiência anterior é na mesma área desse cargo? (s/n)", sessao=s
    ).lower().startswith("s")

    sugerido = M.sugerir_arquetipo(s.perfil.get("experiencias") or [], mesma_area)
    s.arquetipo = sugerido
    arq = M.ARQUETIPOS[s.arquetipo]
    nota(f"Estrutura definida pelo sistema com base na sua linha do tempo: {s.arquetipo} — {arq.nome}")

    titulo("Estrutura pré-definida (regra dura)")
    print(f"  Ordem das seções : {' → '.join(M.TITULOS_SECAO[x] or 'Ofício' for x in arq.secoes)}")
    print(f"  Tamanho          : {arq.nota_tamanho}")
    print(f"  Fórmula padrão   : {M.FORMULAS[arq.formula_padrao]['label']}")
    print(f"  Preenche o vazio : {arq.preenche_vazio}")
    print(f"  Sai por padrão   : {arq.corta}")
    print(f"  Canal típico     : {arq.canal}")

    # O limite de tamanho só existe em função do arquétipo — o achado nasce aqui, não na Fase 1.
    if s.arquivos:
        achados = M.achado_de_tamanho(s.arquivos[s.base]["paginas"], s.arquetipo)
        if achados:
            mostrar_achados(achados)
            s.achados += [asdict(a) for a in achados]


def _orientar_carreira(s: Sessao, motor: Motor) -> None:
    """§4.3 — orientador proativo, não formatador passivo. Sugere; nunca decide (§9.5)."""
    nota("Conferindo se sua formação abre uma vaga mais forte que a que você mirou...")
    parecer = motor.json(M.prompt_orientacao_carreira(
        {"formacao": s.perfil.get("formacao"), "habilidades": s.perfil.get("habilidades"),
         "experiencias": s.perfil.get("experiencias")},
        s.cargos_alvo,
    ))
    if not parecer.get("ha_descompasso"):
        return

    mensagem = parecer.get("mensagem", "").strip()
    cargo_forte = parecer.get("cargo_mais_forte", "").strip()
    if mensagem:
        print()
        print(amarelo(negrito("  " + "\n  ".join(_quebrar(mensagem, 74)))))
    if cargo_forte and cargo_forte not in s.cargos_alvo and perguntar(
        f"Quer adicionar uma versão para '{cargo_forte}' também? (s/n)", sessao=s
    ).lower().startswith("s"):
        s.cargos_alvo.append(cargo_forte)
        nota(f"Alvos agora: {', '.join(s.cargos_alvo)}")


# ---------------------------------------------------------------------------
# Fase 4 — Parâmetros mixáveis (§8)
# ---------------------------------------------------------------------------

def fase_parametros(s: Sessao) -> None:
    titulo("Fase 4 — Parâmetros de escrita")

    s.tom = escolher(
        "Tom de escrita:",
        [(k, f"{v['label']} — {v['guia']}") for k, v in M.TONS.items()],
        padrao=M.tom_padrao(s.arquetipo), sessao=s,
    )
    s.formula = M.ARQUETIPOS[s.arquetipo].formula_padrao
    nota(f"Fórmula de escrita resolvida automaticamente pelo arquétipo: {M.FORMULAS[s.formula]['label']}")


# ---------------------------------------------------------------------------
# Fase 5 — Coleta por experiência (§5)
# ---------------------------------------------------------------------------

PERGUNTAS = [
    "O que era o lugar e o que você fazia lá no dia a dia?",
    "Conta uma coisa difícil que aconteceu e o que você fez.",
    "Qual era a escala do seu trabalho? (Por exemplo: quantas pessoas atendia por dia, quantos clientes na carteira ou o volume de entregas)",
    "Deu certo? Como você sabe que deu certo?",
    "Você mexia com que máquina, sistema ou ferramenta?",
    "Por que você saiu?",
]


def fase_coleta(s: Sessao, motor: Motor) -> None:
    titulo("Fase 5 — Contando as experiências")
    print(fraco("  Fala do jeito que você fala. Não precisa ficar bonito nem organizado —"))
    print(fraco("  ninguém vai ler o que você escreveu aqui, só o resultado."))
    print(fraco("  Nada entra no currículo sem você confirmar antes. /pular passa a pergunta."))

    pendentes = [
        {"rotulo": f"{e.get('cargo', '')} @ {e.get('empresa', '')}".strip(" @"),
         "cargo": e.get("cargo", ""), "empresa": e.get("empresa", ""),
         "periodo": f"{e.get('inicio', '')} – {e.get('fim') or 'atual'}",
         "projeto_pessoal": bool(e.get("projeto_pessoal")),
         "vinculo_ativo": M.e_vinculo_ativo(e.get("fim"))}
        for e in (s.perfil.get("experiencias") or [])
    ]

    ja_feitas = {r["rotulo"] for r in s.relatos}
    for exp in pendentes:
        if exp["rotulo"] in ja_feitas:
            continue
        _coletar_uma(s, motor, exp)

    # §6.2 — experiência omitida que tape um gap pode valer a pena reincluir.
    while perguntar(
        "Quer acrescentar alguma experiência que não está no currículo? "
        "(voluntariado, bico, negócio da família, trabalho escolar) (s/n)", sessao=s
    ).lower().startswith("s"):
        cargo = perguntar("O que você fazia?", obrigatorio=True, sessao=s)
        empresa = perguntar("Onde? (se não tiver nome, descreva)", sessao=s)
        periodo = perguntar("Quando foi? (ex.: 03/2021 – 12/2021)", sessao=s)
        ativo = perguntar("Você ainda faz isso hoje? (s/n)", sessao=s).lower().startswith("s")
        _coletar_uma(s, motor, {
            "rotulo": f"{cargo} @ {empresa}".strip(" @"), "cargo": cargo, "empresa": empresa,
            "periodo": periodo, "projeto_pessoal": False, "vinculo_ativo": ativo,
        })

    _confirmar_habilidades(s)


def _coletar_uma(s: Sessao, motor: Motor, exp: dict) -> None:
    titulo(f"Experiência: {exp['rotulo'] or 'sem título'}")
    nota("Use /voltar para corrigir a pergunta anterior.")

    respostas: list[str] = [""] * len(PERGUNTAS)
    i = 0
    while i < len(PERGUNTAS):
        try:
            resposta = perguntar(PERGUNTAS[i], sessao=s, confirmar=True, permitir_voltar=(i > 0))
        except Voltar:
            i -= 1
            continue

        # §5.3.1 — resposta curta rende currículo pobre: uma réplica guiada pede o detalhe.
        if resposta and M.resposta_e_curta(resposta):
            replica = motor.texto(M.prompt_replica_guiada(exp["rotulo"], PERGUNTAS[i], resposta))
            extra = perguntar(replica, sessao=s, confirmar=True)
            if extra:
                resposta = f"{resposta} {extra}"

        respostas[i] = resposta
        i += 1

    transcricao = "\n\n".join(f"{PERGUNTAS[j]}\n{respostas[j]}"
                              for j in range(len(PERGUNTAS)) if respostas[j])

    if not transcricao:
        nota("Nada contado — experiência fica de fora por enquanto.")
        return

    fatos = _extrair_e_confirmar(s, motor, exp["rotulo"], transcricao)
    if fatos is None:
        return

    formula, motivo = M.resolver_formula(
        s.formula, s.arquetipo,
        tem_numero=bool(fatos.get("numeros")),
        projeto_pessoal=exp["projeto_pessoal"],
    )
    if motivo:
        aviso(motivo)

    bullets = _redigir(s, motor, exp, fatos, formula, transcricao)
    s.relatos.append({
        "rotulo": exp["rotulo"], "cargo": exp["cargo"], "empresa": exp["empresa"],
        "periodo": exp.get("periodo", ""), "vinculo_ativo": bool(exp.get("vinculo_ativo")),
        "transcricao": transcricao, "fatos": fatos, "formula": formula, "bullets": bullets,
    })
    s.salvar()


def _extrair_e_confirmar(s: Sessao, motor: Motor, rotulo: str, transcricao: str) -> dict | None:
    """§5.2 — a transcrição nunca vai crua; os fatos são confirmados antes de virar texto."""
    while True:
        nota("Separando os fatos do que você contou...")
        fatos = motor.json(M.prompt_extrair_fatos(rotulo, transcricao))

        print(negrito("\n  Entendi isto — confirma?"))
        for f in fatos.get("fatos", []):
            print(f"    • {f}")
        for n in fatos.get("numeros", []):
            print(f"    # {n}")
        for f in fatos.get("ferramentas", []):
            print(f"    ⚙ {f}")
        for d in fatos.get("duvidas", [])[:3]:
            print(fraco(f"    ? {d}"))

        escolha = escolher(
            "Está certo?",
            [("sim", "Sim, pode escrever"),
             ("corrigir", "Quero corrigir ou acrescentar algo"),
             ("descartar", "Deixa essa experiência de fora")],
            padrao="sim", sessao=s,
        )
        if escolha == "sim":
            return fatos
        if escolha == "descartar":
            return None
        extra = perguntar("O que está errado ou faltando?", sessao=s)
        if extra:
            transcricao += f"\n\nCorreção da pessoa:\n{extra}"


def _redigir(s: Sessao, motor: Motor, exp: dict, fatos: dict, formula: str,
             transcricao: str) -> list[str]:
    nota("Escrevendo os bullets...")
    saida = motor.json(M.prompt_redigir_bullets(
        exp["rotulo"], fatos, s.tom, formula, s.cargo_alvo,
        vinculo_ativo=bool(exp.get("vinculo_ativo")),
        projeto_pessoal=bool(exp.get("projeto_pessoal")),
    ))
    bullets = saida.get("bullets", []) or []

    # Guardrail 1 (§11) — número que não saiu da boca da pessoa não entra.
    limpos = []
    for b in bullets:
        suspeitos = M.numeros_sem_lastro(b, transcricao)
        if suspeitos:
            aviso(f"Número sem lastro no que você contou ({', '.join(suspeitos)}) neste bullet:")
            print(f"    {b}")
            if not perguntar("Esse número é verdadeiro? (s/n)", sessao=s).lower().startswith("s"):
                nota("Bullet descartado.")
                continue
        limpos.append(b)

    print(negrito("\n  Ficou assim:"))
    for b in limpos:
        print(f"    - {b}")
    return limpos


def _confirmar_habilidades(s: Sessao) -> None:
    """§6.2 — ferramenta que não se sustenta em entrevista é passivo, não ativo."""
    candidatas = M.unicos(
        (s.perfil.get("ferramentas") or []) + (s.perfil.get("habilidades") or [])
        + (s.perfil.get("idiomas") or [])
    )
    if not candidatas:
        return

    titulo("Habilidades e ferramentas")
    print(fraco("  O currículo atual lista o que está abaixo. Ferramenta que você não sustenta"))
    print(fraco("  numa entrevista conta contra você, não a favor."))
    for i, c in enumerate(candidatas, 1):
        print(f"  {i}. {c}")

    # §5.1 — rótulo afirmativo, sem ambiguidade: a pessoa marca o que MANTER, não o que remover
    # (nas transcrições, a usuária entendeu ao contrário e o currículo saiu com o item errado).
    bruto = perguntar(
        "Digite os NÚMEROS das habilidades que você QUER MANTER no currículo — as que você usa "
        "de verdade e sustenta se perguntarem (separados por vírgula, ou 'todas' para manter tudo)",
        sessao=s,
    )
    if bruto.lower().startswith("todas"):
        s.habilidades_confirmadas = candidatas
        nota("Mantendo todas as habilidades.")
        return
    indices = [int(x) for x in re.findall(r"\d+", bruto) if 1 <= int(x) <= len(candidatas)]
    s.habilidades_confirmadas = [candidatas[i - 1] for i in indices]

    if s.habilidades_confirmadas:
        nota(f"Mantidas no currículo: {', '.join(s.habilidades_confirmadas)}")
    cortadas = [c for c in candidatas if c not in s.habilidades_confirmadas]
    if cortadas:
        nota(f"Removidas do currículo: {', '.join(cortadas)}")


# ---------------------------------------------------------------------------
# Fase 6 — Aderência à vaga (§9)
# ---------------------------------------------------------------------------

def fase_vaga(s: Sessao, motor: Motor) -> None:
    titulo("Fase 6 — A vaga que você quer")

    texto = ler_bloco("Cole a descrição da vaga:")
    if not texto:
        nota("Sem vaga — seguindo para a geração do currículo base.")
        return

    nota("Lendo os requisitos...")
    extraido = motor.json(M.prompt_classificar_requisitos(texto))
    requisitos = extraido.get("requisitos") or []

    # §9.5 / §12 — o viés é para baixo: eliminatório só quando objetivo e verificável.
    for r in requisitos:
        classe, motivo = M.viesar_classificacao(r.get("classe", "negociavel"), r.get("texto", ""))
        r["classe"], r["motivo_vies"] = classe, motivo

    nota("Comparando com o seu material...")
    comparacao = motor.json(
        M.prompt_comparar_com_perfil(requisitos, s.perfil, s.relatos_como_texto())
    )
    por_requisito = {a.get("requisito", ""): a for a in comparacao.get("analise", [])}

    analise = []
    for r in requisitos:
        achado = por_requisito.get(r["texto"], {})
        analise.append({
            "requisito": r["texto"],
            "classe": r["classe"],
            "motivo_vies": r.get("motivo_vies"),
            "situacao": achado.get("situacao", "nao_tem"),
            "evidencia": achado.get("evidencia", ""),
        })

    _mostrar_analise_vaga(analise)

    frase, bloqueios = M.recomendacao_de_candidatura(analise)
    print()
    print(negrito(verde("  " + frase)) if not bloqueios else negrito(amarelo("  " + frase)))
    for b in bloqueios:
        print(vermelho(f"    ✗ {b}"))
    nota("Sem nota de aderência de propósito: a pontuação que decide é a do ATS, "
         "com pesos que ninguém de fora conhece.")

    s.vaga = {
        "texto": texto,
        "cargo": extraido.get("cargo", ""),
        "empresa": extraido.get("empresa", ""),
        "analise": analise,
    }
    s.vagas.append(s.vaga)  # §9 — histórico das vagas analisadas no loop
    s.salvar()

    _resolver_lacunas(s, motor, analise)


def _mostrar_analise_vaga(analise: list[dict]) -> None:
    grupos = {
        "tem_nao_esta": ("Você tem, mas não está no currículo — é o que dá mais resultado corrigir", amarelo),
        "nao_tem": ("Não atendido", vermelho),
        "tem_e_esta": ("Atendido e já visível", verde),
    }
    for situacao, (rotulo, cor) in grupos.items():
        itens = [a for a in analise if a["situacao"] == situacao]
        if not itens:
            continue
        print(f"\n  {cor(negrito(rotulo))}")
        for a in itens:
            print(f"    [{M.CLASSES_REQUISITO[a['classe']].split(' (')[0].lower()}] {a['requisito']}")
            if a.get("evidencia"):
                for linha in _quebrar(a["evidencia"], 68):
                    print(fraco(f"        {linha}"))
            if a.get("motivo_vies"):
                print(fraco(f"        ({a['motivo_vies']})"))


def _resolver_lacunas(s: Sessao, motor: Motor, analise: list[dict]) -> None:
    """§9.4, saída 2 — o achado de ouro vira pergunta, e a pergunta vira bullet."""
    lacunas = [a for a in analise if a["situacao"] == "tem_nao_esta"]
    if not lacunas or not s.relatos:
        return

    titulo("Fechando as lacunas")
    for a in lacunas:
        print(f"\n  A vaga pede: {negrito(a['requisito'])}")
        relato = perguntar(
            "Conta rapidamente onde você já fez isso (ou /pular se não fez):", sessao=s
        )
        if not relato:
            continue

        fatos = motor.json(M.prompt_extrair_fatos(a["requisito"], relato))
        alvo = escolher(
            "Em qual experiência isso entra?",
            [(str(i), r["rotulo"]) for i, r in enumerate(s.relatos)], sessao=s,
        )
        indice = int(alvo)
        formula, motivo = M.resolver_formula(
            s.formula, s.arquetipo, bool(fatos.get("numeros")), False
        )
        if motivo:
            aviso(motivo)

        saida = motor.json(M.prompt_redigir_bullets(
            s.relatos[indice]["rotulo"], fatos, s.tom, formula, s.cargo_alvo,
            vinculo_ativo=bool(s.relatos[indice].get("vinculo_ativo")),
        ))
        propostos = saida.get("bullets") or []
        novos = [b for b in propostos if not M.numeros_sem_lastro(b, relato)][:2]
        descartados = len(propostos) - len(novos)
        for b in novos:
            print(verde(f"    + {b}"))
        if descartados:
            nota(f"{descartados} bullet(s) descartado(s) por conter número que você não citou.")
        if not novos:
            nota("Nada aproveitável desta vez — a lacuna continua aberta.")
        s.relatos[indice]["bullets"] += novos
        s.relatos[indice]["transcricao"] += f"\n\nSobre '{a['requisito']}':\n{relato}"
        s.salvar()


# ---------------------------------------------------------------------------
# Fase 7 — Geração
# ---------------------------------------------------------------------------

def fase_gerar(s: Sessao, motor: Motor) -> Path:
    titulo("Fase 7 — Gerando o currículo")

    # §4.3 / §7 — uma versão enxuta por alvo, nunca uma completa e ambígua.
    alvos = s.alvos()
    if len(alvos) > 1:
        nota(f"Gerando {len(alvos)} versões, uma por alvo: {', '.join(alvos)}.")

    destino = None
    for cargo in alvos:
        destino = _gerar_para_alvo(s, motor, cargo, varias=len(alvos) > 1)
    return destino


def _gerar_para_alvo(s: Sessao, motor: Motor, cargo_alvo: str, varias: bool) -> Path:
    arq = M.ARQUETIPOS[s.arquetipo]
    conteudo = M.Conteudo(
        nome=s.perfil.get("nome", ""),
        contato=[c for c in (s.perfil.get("contato") or []) if c],
        experiencias=[
            {"cargo": r["cargo"], "empresa": r["empresa"], "periodo": r.get("periodo", ""),
             "bullets": r["bullets"]}
            for r in s.relatos if r.get("bullets")
        ],
        formacao=[
            " — ".join(x for x in [f.get("curso", ""), f.get("instituicao", ""),
                                   _periodo(f), f.get("status", "")] if x)
            for f in (s.perfil.get("formacao") or [])
        ],
        habilidades=s.habilidades_confirmadas,
    )

    alvo = M.maiuscula(cargo_alvo)
    if "objetivo" in arq.secoes:
        conteudo.objetivo = alvo
    if "oficio" in arq.secoes:
        conteudo.oficio = alvo
    if "stack" in arq.secoes:
        conteudo.stack = s.habilidades_confirmadas
    if "certificacoes" in arq.secoes:
        conteudo.certificacoes = s.habilidades_confirmadas
    if "resumo" in arq.secoes:
        nota(f"Escrevendo o resumo profissional para '{cargo_alvo or 'currículo base'}'...")
        conteudo.resumo = motor.texto(M.prompt_resumo_profissional(
            {**s.perfil, "relatos": [r["fatos"] for r in s.relatos]},
            s.arquetipo, s.objetivo, s.tom, cargo_alvo, s.vaga.get("texto"),
        ))

    markdown = M.montar_markdown(conteudo, s.arquetipo)

    SAIDA.mkdir(parents=True, exist_ok=True)
    marca_vaga = f"-vaga-{_slug(s.vaga.get('cargo', ''))}" if s.vaga.get("cargo") else ""
    marca_alvo = f"-{_slug(cargo_alvo)}" if (varias and cargo_alvo) else ""
    destino = SAIDA / f"{s.slug}-{s.arquetipo}{marca_alvo}{marca_vaga}-{datetime.now():%Y%m%d-%H%M}.md"
    destino.write_text(markdown, encoding="utf-8")

    print()
    if varias:
        print(negrito(ciano(f"  ▸ Versão para: {cargo_alvo or 'currículo base'}")))
    print(markdown)
    print(verde(negrito(f"\n  Currículo escrito em {destino}")))
    if marca_vaga:
        aviso("Esta é uma versão dirigida a UMA vaga. Não use como currículo padrão — "
              "currículo com a marca de outra vaga é descarte quase automático.")
    aviso("O arquivo contém dado pessoal real. Está em pasta ignorada pelo git; não commite.")
    return destino


def _periodo(f: dict) -> str:
    ini, fim = f.get("inicio", ""), f.get("fim", "")
    return f"{ini} – {fim}".strip(" –") if (ini or fim) else ""


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def listar_sessoes() -> None:
    sessoes = Sessao.listar()
    if not sessoes:
        print(fraco("Nenhuma sessão salva ainda."))
        return

    titulo("Sessões salvas")
    for s in sessoes:
        nome = s.perfil.get("nome") or s.slug
        quando = (s.atualizado_em or "").replace("T", " ")[:16]
        estado = ("concluída" if s.fase >= 7
                  else f"próximo passo: {NOME_FASE.get(s.fase, '?')}")
        print(f"\n  {negrito(s.id)}  {nome}")
        print(fraco(f"      {estado}  ·  {len(s.relatos)} experiência(s) coletada(s)"
                    f"{'  ·  vaga analisada' if s.vaga else ''}"))
        print(fraco(f"      mexida por último em {quando or 'data desconhecida'}"))
    print()
    print(fraco(f"Continue qualquer uma com:  python demo/demo.py --resume {sessoes[0].id}"))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Protótipo de terminal da metodologia de currículos.")
    parser.add_argument("pdfs", nargs="*", type=Path, help="currículos em PDF (0 ou mais)")
    parser.add_argument("--resume", "--retomar", dest="resume", metavar="ID",
                        help="id da sessão a continuar (ou caminho do -sessao.json)")
    parser.add_argument("--sessoes", action="store_true",
                        help="lista as sessões salvas e sai")
    parser.add_argument("--modelo", help="sobrescreve GEMINI_MODEL")
    args = parser.parse_args()

    try:
        from dotenv import load_dotenv
        load_dotenv(RAIZ / ".env")
    except ImportError:
        pass

    # Listar não fala com o modelo: funciona mesmo com a cota estourada ou sem chave.
    if args.sessoes:
        listar_sessoes()
        return

    motor = Motor(args.modelo)

    if args.resume:
        s = Sessao.resolver(args.resume)
        print(verde(f"Sessão {s.id} retomada — próximo passo: {NOME_FASE.get(s.fase, '?')}."))
        if s.relatos:
            nota(f"Já coletadas: {', '.join(r['rotulo'] for r in s.relatos)}")
    else:
        s = Sessao()
        for caminho in args.pdfs:
            if not caminho.exists():
                sys.exit(vermelho(f"Arquivo não encontrado: {caminho}"))
            nota(f"Lendo {caminho.name}...")
            s.arquivos.append(ler_pdf(caminho))
        s.salvar()

    print(negrito(ciano("\nProtótipo da metodologia de currículos")))
    nota(f"sessão: {negrito(s.id)}  ·  modelo: {motor.modelo}  ·  {motor.descricao_chaves()}")
    nota(f"pare quando quiser com /sair e continue com:  "
         f"python demo/demo.py --resume {s.id}")

    try:
        if s.fase < 1:
            fase_diagnostico(s, motor)
            s.slug = "-".join(_slug(s.perfil.get("nome", "") or "sessao").split("-")[:2])
            s.fase = 1; s.salvar()
        if s.fase < 2:
            fase_objetivo(s); s.fase = 2; s.salvar()
        if s.fase < 3:
            fase_arquetipo(s, motor); s.fase = 3; s.salvar()
        if s.fase < 4:
            fase_parametros(s); s.fase = 4; s.salvar()
        if s.fase < 5:
            fase_coleta(s, motor); s.fase = 5; s.salvar()
        if s.fase < 6:
            fase_vaga(s, motor); s.fase = 6; s.salvar()

        # Retomar uma sessão já concluída não regenera sozinho — chamada de modelo é
        # justamente o recurso escasso. Quem quiser um arquivo novo pede no menu.
        if s.fase < 7:
            fase_gerar(s, motor)
            s.fase = 7; s.salvar()
        else:
            nota("Sessão já concluída. Use o menu para gerar de novo ou analisar outra vaga.")

        while True:
            acao = escolher(
                "E agora?",
                [("sair", "Encerrar"),
                 ("vaga", "Analisar outra vaga e gerar uma versão dirigida"),
                 ("gerar", "Gerar o currículo de novo")],
                padrao="sair", sessao=s,
            )
            if acao == "sair":
                break
            if acao == "vaga":
                s.vaga = {}
                fase_vaga(s, motor)
            fase_gerar(s, motor)
            s.salvar()

    except Sair:
        s.salvar()
        print(fraco(f"\nSessão salva ({s.caminho().name}). Nada do que você contou se perdeu."))
        print(negrito(f"Continue de onde parou com:  python demo/demo.py --resume {s.id}"))
        return
    except RuntimeError as erro:
        s.salvar()
        sys.exit(vermelho(f"\n{erro}\n") +
                 f"Sessão salva. Continue com:  python demo/demo.py --resume {s.id}")

    print(fraco(f"\n{motor.chamadas} chamadas ao modelo. Sessão {s.id} em {s.caminho()}"))


if __name__ == "__main__":
    main()
