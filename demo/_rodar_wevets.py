#!/usr/bin/env python3
"""Roda as fases 6 (vaga) e 7 (geração) da demo para a vaga da WeVets,
reaproveitando a sessão já concluída da Ana (79507d) e respondendo as
lacunas com base na metodologia do caso e nos currículos/relatos dela.

Não é interativo: monkeypatcha as funções de entrada da demo para
alimentar as respostas criadas a partir da análise de metodologia.
"""
import sys, builtins
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
sys.path.insert(0, str(RAIZ))

from dotenv import load_dotenv
load_dotenv(RAIZ / ".env")

import demo as D

VAGA_WEVETS = """Analista Júnior de Triagem - Laboratório
WeVets — São Paulo, SP (Pinheiros)
Benefícios: Assistência médica, Vale-transporte, Vale-refeição, Vale-alimentação

Descrição da vaga
A WeVets é o maior grupo de saúde veterinária do Brasil, com hospitais veterinários 24h,
plano de saúde pet e um modelo que combina tecnologia, excelência clínica e experiência
para tutores, pets e médicos-veterinários. Nova oportunidade para Analista Júnior de
Triagem - Laboratório, para atuar em Pinheiros - SP.

Responsabilidades e atribuições
- Receber e conferir as amostras encaminhadas pelos nossos hospitais;
- Realizar o recebimento das amostras no sistema;
- Organizar e direcionar as amostras para os setores responsáveis;
- Manter comunicação com os hospitais por meio das plataformas da empresa, esclarecendo
  dúvidas e acompanhando pendências quando necessário;
- Garantir que o fluxo de recebimento ocorra de forma organizada e dentro dos padrões
  estabelecidos.

Requisitos e qualificações
- Boa comunicação verbal e escrita;
- Agilidade e organização;
- Conhecimento básico em informática;
- Facilidade para trabalhar em equipe;
- Comprometimento e responsabilidade;
- Atenção aos detalhes.

Será um diferencial
- Experiência prévia em laboratório, clínica veterinária ou área da saúde.

Informações adicionais
- Modelo de contratação: CLT
- Remuneração + Benefícios: VT/VR/VA
- Horário/Escala: 12x36: 07h às 19h ou 10h às 22h
- Modelo de trabalho: Presencial
- Local: Pinheiros - SP.
"""

# Índices dos relatos na sessão: 0 AMPARA, 1 Provet (laboratório), 2 Atacadão.
PROVET, ATACADAO, AMPARA = 1, 2, 0

# Respostas às lacunas, criadas a partir da metodologia (caso Ana) + relatos reais.
# Cada uma: (palavras-chave do requisito, texto da resposta, índice da experiência).
RESPOSTAS = [
    (["amostra", "triagem", "recebimento", "receb", "conferir", "conferência",
      "direcionar", "organizar as amostras", "setor"],
     "No estágio na Provet eu recebia as amostras de sangue e urina vindas do "
     "atendimento, conferia a identificação e a integridade de cada material, "
     "fazia a triagem e encaminhava para o setor responsável ou para o lote de "
     "envio, sempre sob supervisão técnica e seguindo as normas de biossegurança.",
     PROVET),
    (["laboratório", "clínica veterinária", "saúde", "diferencial", "experiência prévia"],
     "Fui estagiária de laboratório clínico na Provet Medicina Diagnóstica "
     "Veterinária, onde trabalhei direto com contenção de cães e gatos para coleta "
     "e com a triagem e o transporte das amostras. Também sou técnica em veterinária "
     "recém-formada pela FAMESP.",
     PROVET),
    (["informática", "sistema", "computador", "plataforma"],
     "No Atacadão eu operava o sistema de PDV para registro de vendas e conferência "
     "de produtos o dia todo, e na Provet registrava as amostras. Tenho facilidade "
     "com computador e uso Excel no dia a dia.",
     ATACADAO),
    (["comunicação", "verbal", "escrita", "hospitais", "esclarec"],
     "No Atacadão eu atendia o público em alto fluxo, orientando e mediando dúvidas "
     "com clareza; na Provet eu mantinha comunicação com os tutores durante os "
     "exames para deixar o atendimento fluido.",
     ATACADAO),
    (["agilidade", "organização", "fluxo", "padr", "prazo"],
     "Na Provet eu organizava os insumos e as amostras e mantinha o fluxo do "
     "laboratório em ritmo constante, mesmo com vários exames chegando ao mesmo "
     "tempo, mantendo tudo dentro do padrão de biossegurança.",
     PROVET),
    (["equipe", "trabalhar em equipe"],
     "Na AMPARA a gente trabalha em rotação de funções sob coordenação: eu me "
     "alterno entre atender o público, manejar os animais e encaminhar adoções, "
     "sempre em equipe e apoiando as outras voluntárias.",
     AMPARA),
    (["atenção aos detalhes", "detalhe", "comprometimento", "responsabilidade"],
     "Tanto na conferência das amostras na Provet quanto na conferência item a item "
     "e de cédulas no caixa do Atacadão eu checava cada detalhe para não deixar "
     "passar erro. Levo prazo e responsabilidade a sério.",
     PROVET),
]

RESPOSTA_PADRAO = (
    "Isso aparece na minha experiência de laboratório na Provet, onde eu recebia, "
    "conferia e organizava as amostras sob supervisão técnica.",
    PROVET,
)

_ultimo_requisito = {"txt": ""}

def _casar(requisito: str):
    req = requisito.lower()
    for chaves, texto, idx in RESPOSTAS:
        if any(c in req for c in chaves):
            return texto, idx
    return RESPOSTA_PADRAO

# --- monkeypatch das entradas -------------------------------------------------
_print_orig = builtins.print
def _print(*a, **k):
    linha = " ".join(str(x) for x in a)
    if "A vaga pede:" in linha:
        _ultimo_requisito["txt"] = linha.split("A vaga pede:")[-1].strip()
    _print_orig(*a, **k)
builtins.print = _print

def _ler_bloco(texto, sentinela="FIM"):
    _print_orig("\n[auto] colando a descrição da vaga da WeVets\n")
    return VAGA_WEVETS.strip()

def _perguntar(texto, obrigatorio=False, sessao=None, confirmar=False, permitir_voltar=False):
    if "Conta rapidamente" in texto:
        resp, _ = _casar(_ultimo_requisito["txt"])
        _print_orig(f"> [auto] {resp}\n")
        return resp
    _print_orig(f"> [auto] (pulado)\n")
    return ""

def _escolher(texto, opcoes, padrao=None, sessao=None):
    if "Em qual experiência" in texto:
        _, idx = _casar(_ultimo_requisito["txt"])
        chave = str(idx)
        if any(c == chave for c, _ in opcoes):
            _print_orig(f"> [auto] experiência #{idx}\n")
            return chave
    return padrao or opcoes[0][0]

D.ler_bloco = _ler_bloco
D.perguntar = _perguntar
D.escolher = _escolher

# --- rodar --------------------------------------------------------------------
motor = D.Motor()
s = D.Sessao.resolver("79507d")

# nova sessão para não sobrescrever a original da Ana
s.id = "wevets1"
s._arquivo = None
s.vaga = {}
# alvo neutro para esta vaga, conforme a metodologia (trilha de laboratório/triagem)
s.cargo_alvo = "Analista/Auxiliar de Triagem de Laboratório (área veterinária)"
s.cargos_alvo = [s.cargo_alvo]
s.fase = 5
s.salvar()

_print_orig(f"\n=== Rodando fases 6 e 7 para a vaga WeVets | sessão {s.id} ===")
D.fase_vaga(s, motor)
s.fase = 6; s.salvar()
destino = D.fase_gerar(s, motor)
s.fase = 7; s.salvar()
_print_orig(f"\n=== FEITO. {motor.chamadas} chamadas ao modelo. Currículo: {destino} ===")
