"""
Motor de cálculo da DRE.

Regras (confirmadas pelo usuário):
- AN pertence ao último TT antes dele na ordem (hierarquia posicional)
- Valores importados do ERP gravam em AMBOS AN e TT (TT = soma das folhas AN)
- Fórmulas (componentes) são somas livres de variáveis = agrupamentos de TTs

Estratégia:
  Pass 1: TT sem fórmula → usa valor armazenado se não-zero,
          senão soma ANs posicionais → popula byToken[agrupamento]
  Pass 2: TT com fórmula → soma byToken via componentes → popula byToken
"""

import json
from sqlalchemy.orm import Session
from models import PlanoItem, TemplateFormula, OrcamentoUnidadeValor, ClientePlano


def _parse_formula(formula_text: str, byToken: dict) -> dict[int, float]:
    """Parseia 'VDA_VISTA + VDA_PRAZO - DEDUCOES' usando byToken."""
    tokens = formula_text.replace('-', ' - ').replace('+', ' + ').split()
    vals = {m: 0.0 for m in range(1, 13)}
    sinal = 1
    for tok in tokens:
        if tok == '+':
            sinal = 1
        elif tok == '-':
            sinal = -1
        else:
            agr_vals = byToken.get(tok.strip(), {})
            for m in range(1, 13):
                vals[m] += sinal * agr_vals.get(m, 0.0)
            sinal = 1
    return vals


def _nivel_item(item: PlanoItem) -> int:
    if item.nivel is not None:
        return int(item.nivel)
    if (item.tipo or "").upper() not in ("TT", "RES"):
        return 3
    s = (item.conta or "").rstrip("0")
    return 1 if len(s) <= 1 else 2


def calcular_dre(cliente_id: int, ano: int, unidade: str, db: Session) -> list[dict]:

    # 1. Plano do cliente
    vinculo = db.query(ClientePlano).filter(
        ClientePlano.cliente_id == cliente_id
    ).first()
    if not vinculo:
        return []

    # 2. Itens DRE ordenados
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

    # 3. Componentes (template_formulas) — só entradas não-vazias
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

    # 4. Valores brutos do banco (AN e TT importados)
    idx: dict[int, dict[int, float]] = {}
    for v in db.query(OrcamentoUnidadeValor).filter(
        OrcamentoUnidadeValor.cliente_id == cliente_id,
        OrcamentoUnidadeValor.ano == ano,
        OrcamentoUnidadeValor.unidade == unidade,
        OrcamentoUnidadeValor.plano_item_id.in_(item_ids),
    ).all():
        idx.setdefault(v.plano_item_id, {})[v.mes] = v.valor

    # 5. Hierarquia posicional: último TT visto = pai dos ANs seguintes
    filhos_an: dict[int, list[int]] = {}
    current_tt: int | None = None
    for item in dre_itens:
        t = (item.tipo or "").upper()
        if t in ("TT", "RES"):
            current_tt = item.id
            filhos_an[item.id] = []
        elif t == "AN" and current_tt is not None:
            filhos_an[current_tt].append(item.id)

    def _sum_meses(item_id_list: list[int]) -> dict[int, float]:
        result = {m: 0.0 for m in range(1, 13)}
        for cid in item_id_list:
            for m, v in idx.get(cid, {}).items():
                result[m] = result.get(m, 0.0) + v
        return result

    # 6. Pass 1: TT sem fórmula → valor armazenado OU soma de ANs filhos → byToken
    byToken: dict[str, dict[int, float]] = {}
    for item in dre_itens:
        if (item.tipo or "").upper() not in ("TT", "RES"):
            continue
        if formula_map.get(item.id) or (item.formula or "").strip():
            continue  # tem fórmula → pass 2
        if not item.agrupamento:
            continue  # sem agrupamento não contribui para byToken

        stored = idx.get(item.id, {})
        stored_total = sum(stored.values())

        if stored_total != 0:
            # Valor já importado do ERP — usa diretamente
            vals = {m: stored.get(m, 0.0) for m in range(1, 13)}
        else:
            # Não importado — calcula da soma dos ANs posicionais
            filhos = filhos_an.get(item.id, [])
            vals = _sum_meses(filhos)
            if any(v != 0 for v in vals.values()):
                idx[item.id] = vals

        byToken[item.agrupamento] = vals

    # 7. Pass 2: TT com fórmula → lê byToken → resultado
    for item in dre_itens:
        if (item.tipo or "").upper() not in ("TT", "RES"):
            continue

        formula_text = (item.formula or "").strip()
        componentes = formula_map.get(item.id)

        if not formula_text and not componentes:
            continue

        if formula_text:
            # Usa o campo formula (texto): "VDA_VISTA + VDA_PRAZO"
            vals = _parse_formula(formula_text, byToken)
        else:
            # Usa componentes JSON (agrupamentos individuais)
            vals = {m: 0.0 for m in range(1, 13)}
            for comp in componentes:
                agr = comp.get("agrupamento", "")
                sinal = comp.get("sinal", 1)
                agr_vals = byToken.get(agr, {})
                for m in range(1, 13):
                    vals[m] += sinal * agr_vals.get(m, 0.0)

        idx[item.id] = vals
        if item.agrupamento:
            byToken[item.agrupamento] = vals

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
