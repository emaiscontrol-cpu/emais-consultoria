"""
Motor de cálculo da DRE — cálculo server-side.

Pass 1: TT sem componentes → soma filhos AN posicionais → popula byToken[agrupamento]
Pass 2: TT com componentes → lê byToken → resultado final

Frontend usa os valores diretamente (valsById), sem computeValsCalc.
"""

import json
from sqlalchemy.orm import Session
from models import PlanoItem, TemplateFormula, OrcamentoUnidadeValor, ClientePlano


def _nivel_item(item: PlanoItem) -> int:
    if item.nivel is not None:
        return int(item.nivel)
    if (item.tipo or "").upper() not in ("TT", "RES"):
        return 3
    s = (item.conta or "").rstrip("0")
    return 1 if len(s) <= 1 else 2


def calcular_dre(cliente_id: int, ano: int, unidade: str, db: Session) -> list[dict]:

    # 1. Plano do cliente
    vinculo = db.query(ClientePlano).filter(ClientePlano.cliente_id == cliente_id).first()
    if not vinculo:
        return []

    # 2. Itens DRE ordenados por ordem
    dre_itens = [
        i for i in db.query(PlanoItem)
        .filter(PlanoItem.plano_id == vinculo.plano_id)
        .order_by(PlanoItem.ordem)
        .all()
        if i.modulo and "D" in [m.strip().upper() for m in i.modulo.split(",")]
    ]
    if not dre_itens:
        return []

    item_ids = [i.id for i in dre_itens]

    # 3. Componentes de fórmula (template_formulas) — apenas entradas não-vazias
    formula_map: dict[int, list] = {}
    try:
        for f in db.query(TemplateFormula).filter(
            TemplateFormula.plano_item_id.in_(item_ids)
        ).all():
            comps = json.loads(f.componentes or "[]")
            if comps:
                formula_map[f.plano_item_id] = comps
    except Exception:
        pass

    # 4. Valores brutos do banco
    idx: dict[int, dict[int, float]] = {}
    for v in db.query(OrcamentoUnidadeValor).filter(
        OrcamentoUnidadeValor.cliente_id == cliente_id,
        OrcamentoUnidadeValor.ano == ano,
        OrcamentoUnidadeValor.unidade == unidade,
        OrcamentoUnidadeValor.plano_item_id.in_(item_ids),
    ).all():
        idx.setdefault(v.plano_item_id, {})[v.mes] = v.valor

    # 5. Hierarquia posicional: último TT/RES visto é pai dos ANs seguintes
    filhos_an: dict[int, list[int]] = {}
    current_tt = None
    for item in dre_itens:
        t = (item.tipo or "").upper()
        if t in ("TT", "RES"):
            current_tt = item.id
            filhos_an[item.id] = []
        elif t == "AN" and current_tt is not None:
            filhos_an[current_tt].append(item.id)

    # 6. Pass 1: TT sem componentes → soma filhos AN → registra em byToken
    byToken: dict[str, dict[int, float]] = {}
    for item in dre_itens:
        if (item.tipo or "").upper() not in ("TT", "RES"):
            continue
        if formula_map.get(item.id):
            continue  # tem componentes → tratar no pass 2
        filhos = filhos_an.get(item.id, [])
        if not filhos:
            continue
        vals: dict[int, float] = {m: 0.0 for m in range(1, 13)}
        for child_id in filhos:
            child_vals = idx.get(child_id, {})
            for m in range(1, 13):
                vals[m] += child_vals.get(m, 0.0)
        idx[item.id] = vals
        if item.agrupamento:
            byToken[item.agrupamento] = dict(vals)

    # 7. Pass 2: TT com componentes → lê byToken populado no pass 1
    for item in dre_itens:
        if (item.tipo or "").upper() not in ("TT", "RES"):
            continue
        componentes = formula_map.get(item.id)
        if not componentes:
            continue
        vals = {m: 0.0 for m in range(1, 13)}
        for comp in componentes:
            agr = comp.get("agrupamento", "")
            sinal = comp.get("sinal", 1)
            agr_vals = byToken.get(agr, {})
            for m in range(1, 13):
                vals[m] += sinal * agr_vals.get(m, 0.0)
        idx[item.id] = vals
        if item.agrupamento:
            byToken[item.agrupamento] = dict(vals)

    # 8. Montar resposta
    return [
        {
            "item_id":     item.id,
            "conta":       item.conta,
            "descricao":   item.descricao,
            "agrupamento": item.agrupamento,
            "tipo":        item.tipo,
            "nivel":       _nivel_item(item),
            "movimento":   item.movimento,
            "ordem":       item.ordem,
            "formula":     item.formula,
            "componentes": formula_map.get(item.id),
            "valores":     {m: idx.get(item.id, {}).get(m, 0.0) for m in range(1, 13)},
        }
        for item in dre_itens
    ]
