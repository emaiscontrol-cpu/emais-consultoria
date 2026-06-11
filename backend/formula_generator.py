"""
Gera TemplateFormula automaticamente a partir da estrutura do Plano de Contas.

Lógica de hierarquia:
  N1 = TT/RES com 1 dígito significativo (ex: 100000 → "1")
  N2 = TT/RES com 2+ dígitos significativos (ex: 110000 → "11")
  N3 = qualquer outro tipo (AN, CX, CB, etc.)

Relacionamento pai-filho:
  N3 → pertence ao último N2 que aparece antes dele (por ordem)
  N2 → pertence ao N1 cujo prefixo de dígitos significativos é início do N2
"""

import json
from sqlalchemy.orm import Session
from models import PlanoItem, TemplateFormula


def _nivel(conta: str, tipo: str) -> int:
    if (tipo or "").upper() not in ("TT", "RES"):
        return 3
    s = (conta or "").rstrip("0")
    return 1 if len(s) <= 1 else 2


def _n1_pai(n2_conta: str, n1s: list[tuple]) -> int | None:
    """Encontra o N1 cujo prefixo de dígitos sig. é início do código N2."""
    s2 = (n2_conta or "").rstrip("0")
    for item_id, conta in n1s:
        s1 = (conta or "").rstrip("0")
        if s1 and s2.startswith(s1):
            return item_id
    return n1s[0][0] if n1s else None


def gerar_formulas_do_plano(
    plano_id: int,
    db: Session,
    sobrescrever: bool = False,
) -> dict:
    """
    Gera (ou sobrescreve) TemplateFormula para todos os itens do plano.
    Retorna resumo com contagem e lista de N1s para revisão.
    """
    items = (
        db.query(PlanoItem)
        .filter(PlanoItem.plano_id == plano_id)
        .order_by(PlanoItem.ordem)
        .all()
    )
    if not items:
        return {"geradas": 0, "revisao_n1": []}

    # Calcular nível de cada item
    for it in items:
        it._nv = _nivel(it.conta or "", it.tipo or "")

    n1s = [(it.id, it.conta) for it in items if it._nv == 1]

    # N2 → N1 parent
    n2_pai: dict[int, int | None] = {}
    for it in items:
        if it._nv == 2:
            n2_pai[it.id] = _n1_pai(it.conta or "", n1s)

    # N3 → N2 parent (último N2 antes de cada N3 na sequência de ordem)
    n2_filhos: dict[int, list] = {}  # n2_id → [agrupamento de N3 filhos]
    n1_filhos: dict[int, list] = {}  # n1_id → [agrupamento de N2 filhos]

    last_n2: int | None = None
    last_n1: int | None = None
    for it in items:
        if it._nv == 1:
            last_n1 = it.id
            last_n2 = None
        elif it._nv == 2:
            last_n2 = it.id
            # Registrar este N2 como filho do seu N1
            pai_n1 = n2_pai.get(it.id) or last_n1
            if pai_n1 and (it.agrupamento or "").strip():
                n1_filhos.setdefault(pai_n1, []).append(it.agrupamento)
        else:
            # N3 → filho do N2 atual
            pai = last_n2 or last_n1
            if pai and (it.agrupamento or "").strip():
                n2_filhos.setdefault(pai, []).append(it.agrupamento)

    geradas = 0
    revisao_n1 = []

    for it in items:
        existe = (
            db.query(TemplateFormula)
            .filter(TemplateFormula.plano_item_id == it.id)
            .first()
        )
        if existe and not sobrescrever:
            continue

        nv = it._nv

        if nv == 3:
            tipo_f = "VALOR"
            componentes: list = []
        elif nv == 2:
            tipo_f = "FILHOS"
            filhos = n2_filhos.get(it.id, [])
            componentes = [{"agrupamento": agr, "sinal": 1} for agr in filhos]
        else:  # N1
            tipo_f = "AGRUPAMENTOS"
            filhos_n2 = n1_filhos.get(it.id, [])
            componentes = [{"agrupamento": agr, "sinal": 1} for agr in filhos_n2]
            revisao_n1.append({
                "item_id": it.id,
                "descricao": it.descricao,
                "n_filhos": len(filhos_n2),
                "filhos": filhos_n2,
            })

        comp_json = json.dumps(componentes, ensure_ascii=False)
        if existe:
            existe.tipo_formula = tipo_f
            existe.componentes = comp_json
            existe.auto_gerada = True
        else:
            db.add(TemplateFormula(
                plano_item_id=it.id,
                tipo_formula=tipo_f,
                componentes=comp_json,
                auto_gerada=True,
            ))
        geradas += 1

    db.commit()
    return {"geradas": geradas, "revisao_n1": revisao_n1}
