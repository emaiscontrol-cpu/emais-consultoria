"""
Motor de carregamento da DRE.

Retorna todos os itens DRE com valores brutos do banco (orcamento_unidade_valores),
nivel calculado e componentes (template_formulas).

O cálculo de TT/RES é feito pelo frontend via computeValsCalc.
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


def calcular_dre(
    cliente_id: int,
    ano: int,
    unidade: str,
    db: Session,
) -> list[dict]:
    """
    Retorna lista de linhas DRE com valores brutos do banco.
    O cálculo de TT/RES é delegado ao frontend (computeValsCalc).
    """

    # 1. Plano do cliente
    vinculo = db.query(ClientePlano).filter(
        ClientePlano.cliente_id == cliente_id
    ).first()
    if not vinculo:
        return []

    # 2. Itens DRE (modulo contém 'D')
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

    # 3. Componentes de fórmula (template_formulas) — tolerante à ausência da tabela
    formula_map: dict[int, list] = {}
    try:
        for f in db.query(TemplateFormula).filter(
            TemplateFormula.plano_item_id.in_(item_ids)
        ).all():
            formula_map[f.plano_item_id] = json.loads(f.componentes or "[]")
    except Exception:
        pass

    # 4. Valores do banco — todos os itens (AN e TT)
    idx: dict[int, dict[int, float]] = {}
    for v in db.query(OrcamentoUnidadeValor).filter(
        OrcamentoUnidadeValor.cliente_id == cliente_id,
        OrcamentoUnidadeValor.ano == ano,
        OrcamentoUnidadeValor.unidade == unidade,
        OrcamentoUnidadeValor.plano_item_id.in_(item_ids),
    ).all():
        idx.setdefault(v.plano_item_id, {})[v.mes] = v.valor

    # 5. Montar resposta
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
