"""
Motor de recálculo server-side da DRE.

Ordem obrigatória: N3 (valor do banco) → N2 (soma filhos) → N1 (fórmula/agrupamentos).
Nunca recalcula N3: só lê do banco.
"""

import json
from typing import Optional
from sqlalchemy.orm import Session
from models import PlanoItem, TemplateFormula, OrcamentoUnidadeValor, ClientePlano


def _nivel(conta: str, tipo: str) -> int:
    if (tipo or "").upper() not in ("TT", "RES"):
        return 3
    s = (conta or "").rstrip("0")
    return 1 if len(s) <= 1 else 2


def recalcular_dre(
    cliente_id: int,
    ano: int,
    unidade: str,
    db: Session,
    mes: Optional[int] = None,
) -> dict[int, dict[int, float]]:
    """
    Retorna {item_id: {mes: valor}} somente para itens N2 e N1 recalculados.
    N3 não é retornado — seus valores vêm direto do banco na leitura da DRE.
    """
    vinculo = db.query(ClientePlano).filter(ClientePlano.cliente_id == cliente_id).first()
    if not vinculo:
        return {}

    plano_id = vinculo.plano_id
    items = (
        db.query(PlanoItem)
        .filter(PlanoItem.plano_id == plano_id)
        .order_by(PlanoItem.ordem)
        .all()
    )
    if not items:
        return {}

    meses = [mes] if mes else list(range(1, 13))
    item_ids = [i.id for i in items]

    # Fórmulas por item
    formulas = {
        f.plano_item_id: f
        for f in db.query(TemplateFormula)
        .filter(TemplateFormula.plano_item_id.in_(item_ids))
        .all()
    }

    # Valores N3 do banco
    valores_db = (
        db.query(OrcamentoUnidadeValor)
        .filter(
            OrcamentoUnidadeValor.cliente_id == cliente_id,
            OrcamentoUnidadeValor.ano == ano,
            OrcamentoUnidadeValor.unidade == unidade,
            OrcamentoUnidadeValor.plano_item_id.in_(item_ids),
            OrcamentoUnidadeValor.mes.in_(meses),
        )
        .all()
    )

    # idx[item_id][mes] = valor (dados do banco — N3)
    idx: dict[int, dict[int, float]] = {}
    for v in valores_db:
        idx.setdefault(v.plano_item_id, {})[v.mes] = v.valor

    # byToken: agrupamento/conta → {mes: valor}
    byToken: dict[str, dict[int, float]] = {}

    def _add_token(key: str, vals: dict[int, float]):
        if not key:
            return
        if key not in byToken:
            byToken[key] = {m: 0.0 for m in meses}
        for m, v in vals.items():
            byToken[key][m] = byToken[key].get(m, 0.0) + v

    # Indexar N3 em byToken
    for it in items:
        nv = _nivel(it.conta or "", it.tipo or "")
        if nv == 3:
            vals = idx.get(it.id, {})
            if it.agrupamento:
                _add_token(it.agrupamento, vals)
            if it.conta:
                _add_token(it.conta, vals)

    resultado: dict[int, dict[int, float]] = {}

    items_ordenados = sorted(items, key=lambda x: x.ordem or 0)

    def _processar_item(it):
        formula = formulas.get(it.id)
        vals: dict[int, float] = {}

        if formula:
            componentes = json.loads(formula.componentes or "[]")
            for m in meses:
                total = 0.0
                for c in componentes:
                    agr = c.get("agrupamento", "")
                    sinal = c.get("sinal", 1)
                    total += sinal * byToken.get(agr, {}).get(m, 0.0)
                vals[m] = total
        elif it.formula:
            tokens = it.formula.strip().replace("(", "").replace(")", "").split()
            for m in meses:
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
        else:
            # Sem fórmula: soma direta de filhos pelo agrupamento
            agr = it.agrupamento or ""
            if agr in byToken:
                vals = dict(byToken[agr])

        if vals:
            resultado[it.id] = vals
            if it.agrupamento:
                _add_token(it.agrupamento, vals)
            if it.conta:
                _add_token(it.conta, vals)

    # Dois passes: N2 primeiro (filhos), depois N1 (agrupamentos).
    # N1 pode referenciar agrupamentos de N2 em byToken — ordem importa.
    for nivel_alvo in (2, 1):
        for it in items_ordenados:
            if _nivel(it.conta or "", it.tipo or "") == nivel_alvo:
                _processar_item(it)

    return resultado


def persistir_recalculo(
    cliente_id: int,
    ano: int,
    unidade: str,
    resultado: dict[int, dict[int, float]],
    db: Session,
):
    """Grava os valores recalculados (N2/N1) no banco."""
    for item_id, vals in resultado.items():
        for m, valor in vals.items():
            reg = (
                db.query(OrcamentoUnidadeValor)
                .filter(
                    OrcamentoUnidadeValor.plano_item_id == item_id,
                    OrcamentoUnidadeValor.cliente_id == cliente_id,
                    OrcamentoUnidadeValor.ano == ano,
                    OrcamentoUnidadeValor.mes == m,
                    OrcamentoUnidadeValor.unidade == unidade,
                )
                .first()
            )
            if reg:
                reg.valor = valor
            else:
                db.add(OrcamentoUnidadeValor(
                    plano_item_id=item_id,
                    cliente_id=cliente_id,
                    ano=ano,
                    mes=m,
                    unidade=unidade,
                    valor=valor,
                ))
    db.commit()
