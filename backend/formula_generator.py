"""
Gera TemplateFormula automaticamente a partir da estrutura do Plano de Contas.

Critério único: agrupamento.
  TT/RES com ponto no agrupamento ("GRUPO.SUBGRUPO") → N2
  TT/RES sem ponto no agrupamento                    → N1
  AN (analítica)                                     → N3

Fórmulas geradas:
  N3 → VALOR       (sem componentes; valor lido direto do banco)
  N2 → FILHOS      (agrupamentos dos AN que aparecem abaixo deste N2 na ordem)
  N1 → AGRUPAMENTOS (agrupamentos dos N2 cujo prefixo antes do "." == agrupamento N1)
"""

import json
from sqlalchemy.orm import Session
from models import PlanoItem, TemplateFormula


def _nivel_item(it) -> int:
    tipo = (it.tipo or "").upper()
    if tipo not in ("TT", "RES"):
        return 3
    agr = it.agrupamento or ""
    return 2 if "." in agr else 1


def gerar_formulas_do_plano(
    plano_id: int,
    db: Session,
    sobrescrever: bool = False,
) -> dict:
    items = (
        db.query(PlanoItem)
        .filter(PlanoItem.plano_id == plano_id)
        .order_by(PlanoItem.ordem)
        .all()
    )
    if not items:
        return {"geradas": 0}

    for it in items:
        it._nv = _nivel_item(it)

    # Índice N1: agrupamento → id  (para lookup rápido pelo prefixo do N2)
    n1_por_agr: dict[str, int] = {
        it.agrupamento.strip(): it.id
        for it in items
        if it._nv == 1 and (it.agrupamento or "").strip()
    }

    n2_filhos: dict[int, list] = {}  # n2_id  → [agrupamento de AN filhos, sem duplicatas]
    n1_filhos: dict[int, list] = {}  # n1_id  → [agrupamento de N2 filhos, sem duplicatas]

    last_n2: int | None = None
    last_n1: int | None = None

    for it in items:
        if it._nv == 1:
            last_n1 = it.id
            last_n2 = None

        elif it._nv == 2:
            last_n2 = it.id
            agr = (it.agrupamento or "").strip()
            # Pai N1: prefixo antes do ponto, senão último N1 visto
            pai_n1 = None
            if "." in agr:
                prefix = agr.split(".")[0]
                pai_n1 = n1_por_agr.get(prefix)
            if pai_n1 is None:
                pai_n1 = last_n1
            if pai_n1 and agr:
                lst = n1_filhos.setdefault(pai_n1, [])
                if agr not in lst:
                    lst.append(agr)

        else:  # N3 (AN)
            pai = last_n2 or last_n1
            key = (it.agrupamento or "").strip()
            if pai and key:
                lst = n2_filhos.setdefault(pai, [])
                if key not in lst:
                    lst.append(key)

    geradas = 0
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
            componentes = [{"agrupamento": agr, "sinal": 1} for agr in n2_filhos.get(it.id, [])]
        else:
            tipo_f = "AGRUPAMENTOS"
            componentes = [{"agrupamento": agr, "sinal": 1} for agr in n1_filhos.get(it.id, [])]

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
    return {"geradas": geradas}
