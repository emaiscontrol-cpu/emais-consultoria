"""
Detecta nível hierárquico e tipo de uma conta a partir do seu código ERP.

Regras (por separadores de ponto no código externo):
  N1 → sem pontos, até 4 dígitos numéricos → TT
  N2 → 1 ou 2 pontos                       → TT
  N3 → 3 ou mais pontos                    → AN
  Alfanumérico sem pontos (ex: RECEITA)    → N2, TT
  Vazio                                    → ValueError
"""


def detectar_nivel_tipo(codigo: str) -> dict:
    """
    Retorna {"nivel": int, "tipo": str} para o código informado.
    Levanta ValueError se o código for vazio.
    """
    c = (codigo or "").strip()
    if not c:
        raise ValueError("Código vazio")

    partes = c.split(".")
    n_pontos = len(partes) - 1

    if n_pontos == 0:
        # Sem pontos: numérico curto → N1; caso contrário → N2
        if partes[0].isdigit() and len(partes[0]) <= 4:
            return {"nivel": 1, "tipo": "TT"}
        else:
            return {"nivel": 2, "tipo": "TT"}
    elif n_pontos <= 2:
        # 1 ou 2 pontos → N2
        return {"nivel": 2, "tipo": "TT"}
    else:
        # 3+ pontos → N3 analítico
        return {"nivel": 3, "tipo": "AN"}


def classificar_lote(codigos: list[str]) -> list[dict]:
    """
    Classifica uma lista de códigos.
    Retorna lista de {"codigo", "nivel", "tipo", "erro"}.
    """
    resultado = []
    for c in codigos:
        try:
            nt = detectar_nivel_tipo(c)
            resultado.append({"codigo": c, **nt, "erro": None})
        except ValueError as e:
            resultado.append({"codigo": c, "nivel": None, "tipo": None, "erro": str(e)})
    return resultado
