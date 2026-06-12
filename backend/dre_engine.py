"""
Motor de cálculo da DRE — SOMASE + fórmulas.

Lógica (como Excel):
  1. AN items  → valores individuais do banco (orcamento_unidade_valores)
  2. SOMASE    → agrupa AN por agrupamento, constrói byToken[agr][mes] = total
  3. TT N2     → usa byToken[agrupamento] (filhos AN já somados)
  4. TT N1     → aplica componentes da fórmula sobre byToken, ou texto formula,
                 ou byToken[agrupamento] direto se sem fórmula
  5. Resultado → valores calculados por mes (1-12) por item_id
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
    Retorna lista de linhas DRE com valores calculados server-side.
    AN  items: valores individuais do banco.
    TT/RES items: calculados via SOMASE + fórmulas de componentes.
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

    # 3. Fórmulas de componentes (template_formulas) — tolerante à ausência da tabela
    formula_map: dict[int, list] = {}
    try:
        for f in db.query(TemplateFormula).filter(
            TemplateFormula.plano_item_id.in_(item_ids)
        ).all():
            formula_map[f.plano_item_id] = json.loads(f.componentes or "[]")
    except Exception:
        pass

    # 4. Valores individuais do banco (todos os meses)
    idx: dict[int, dict[int, float]] = {}
    for v in db.query(OrcamentoUnidadeValor).filter(
        OrcamentoUnidadeValor.cliente_id == cliente_id,
        OrcamentoUnidadeValor.ano == ano,
        OrcamentoUnidadeValor.unidade == unidade,
        OrcamentoUnidadeValor.plano_item_id.in_(item_ids),
    ).all():
        idx.setdefault(v.plano_item_id, {})[v.mes] = v.valor

    # 5. SOMASE: agrupamento → {mes: soma} — apenas AN
    byToken: dict[str, dict[int, float]] = {}
    for item in dre_itens:
        if item.tipo != "AN" or not item.agrupamento:
            continue
        agr = item.agrupamento
        if agr not in byToken:
            byToken[agr] = {}
        for m, v in idx.get(item.id, {}).items():
            byToken[agr][m] = byToken[agr].get(m, 0.0) + v

    print(
        f"[ENGINE SOMASE] {{{', '.join(f'{k}: {sum(v.values()):.0f}' for k, v in byToken.items())}}}",
        flush=True,
    )

    # 6. Calcular TT/RES — N2 antes de N1
    calc: dict[int, dict[int, float]] = {}

    def _processar(item: PlanoItem) -> None:
        agr = item.agrupamento
        componentes = formula_map.get(item.id, [])

        if componentes:
            # Componentes JSON: somar N2/N3 pelo agrupamento com sinal +/-
            vals: dict[int, float] = {}
            for m in range(1, 13):
                vals[m] = sum(
                    c.get("sinal", 1) * byToken.get(c.get("agrupamento", ""), {}).get(m, 0.0)
                    for c in componentes
                )
            for c in componentes:
                print(
                    f"[ENGINE N1] {agr} += "
                    f"{c.get('agrupamento')}({sum(byToken.get(c.get('agrupamento',''),{}).values()):.0f})"
                    f" * {c.get('sinal', 1)}",
                    flush=True,
                )
            # Expor resultado em byToken para itens N1 posteriores que referenciem este agrupamento
            if agr:
                byToken[agr] = vals

        elif item.formula:
            # Fórmula texto: ex. "RECEITA - DEDUCOES"
            tokens = item.formula.strip().replace("(", "").replace(")", "").split()
            vals = {}
            for m in range(1, 13):
                total, sinal = 0.0, 1
                for tok in tokens:
                    if tok == "+":
                        sinal = 1
                    elif tok == "-":
                        sinal = -1
                    else:
                        total += sinal * byToken.get(tok, {}).get(m, 0.0)
                        sinal = 1
                vals[m] = total
            if agr:
                byToken[agr] = vals

        elif agr and agr in byToken:
            # Sem fórmula: usa SOMASE direto (byToken já contém valor dos AN filhos)
            vals = dict(byToken[agr])
            # Não re-expõe — byToken[agr] já está correto

        else:
            vals = {m: 0.0 for m in range(1, 13)}

        calc[item.id] = vals

    for nivel_alvo in (2, 1):
        for item in dre_itens:
            if item.tipo not in ("TT", "RES"):
                continue
            if _nivel_item(item) == nivel_alvo:
                _processar(item)

    print(
        f"[ENGINE N1 RESULT] {{{', '.join(f'{k}: {sum(v.values()):.0f}' for k, v in byToken.items() if sum(v.values()) != 0)}}}",
        flush=True,
    )

    # 7. Montar resposta
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
            "valores":     {m: (idx.get(item.id, {}) if item.tipo == "AN" else calc.get(item.id, {})).get(m, 0.0) for m in range(1, 13)},
        }
        for item in dre_itens
    ]
