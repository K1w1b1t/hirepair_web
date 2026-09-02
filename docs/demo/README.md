# Demo da metodologia

Protótipo de terminal para testar a metodologia com uma pessoa de verdade. Ele lê
currículos, apresenta o diagnóstico, conduz a entrevista, analisa uma vaga e gera
um currículo estruturado em Markdown. É descartável para validação: não é o backend
do produto.

As regras ficam em `metodologia.py`; o fluxo interativo, em `demo.py`.

## Ambiente e chaves

Requer Python 3.10 ou superior e uma chave da Gemini API.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r docs/demo/requirements.txt
cp docs/demo/.env.example docs/demo/.env
```

Preencha `GEMINI_API_KEY` em `docs/demo/.env`. As chaves `_2` e `_3` são opcionais:
servem como reserva em outra conta Google quando a cota gratuita acabar. Nunca
versione esse arquivo nem `docs/demo/out/`, pois podem conter chaves e currículos
de pessoas reais.

## Executar e retomar

Execute a partir da raiz do repositório:

```bash
python docs/demo/demo.py docs/business/methodology/cases/joao_pedro/curriculo.pdf
python docs/demo/demo.py --sessoes
python docs/demo/demo.py --resume ea8e67
```

Também é possível iniciar sem PDF. A sessão é salva a cada etapa; `/sair`, Ctrl-C,
falha de rede ou cota esgotada não apagam o progresso. Quando a cota acaba, o fluxo
permite aguardar, trocar para uma chave reserva ou retomar depois.

## Limitações

- A coleta é apenas por texto; a metodologia final é áudio-first.
- Não gera PDF, não tem preset visual nem pesquisa de mercado.
- O diagnóstico automático é heurístico e não substitui revisão humana.
