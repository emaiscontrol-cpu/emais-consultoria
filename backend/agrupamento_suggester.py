"""
Sugere agrupamentos para linhas do template sem agrupamento,
comparando descrição com o Plano de Contas via difflib.
Sem dependências ML — apenas stdlib.
"""

import json
from difflib import SequenceMatcher
from sqlalchemy.orm import Session
from models import PlanoItem, ClientePlano


def _similarity(a: str, b: str) -> float:
    a = a.lower().strip()
    b = b.lower().strip()
    return SequenceMatcher(None, a, b).ratio()


def sugerir_agrupamentos(plano_id: int, db: Session) -> dict:
    """
    Para cada item TT/RES sem agrupamento no plano,
    sugere o agrupamento mais próximo dos itens TT/RES
    que já possuem agrupamento.

    Retorna { "sugestoes": [...] }
    """
    items = (
        db.query(PlanoItem)
        .filter(PlanoItem.plano_id == plano_id)
        .order_by(PlanoItem.ordem)
        .all()
    )

    # Candidatos: TT/RES com agrupamento definido
    candidatos = [
        {"agrupamento": it.agrupamento, "descricao": it.descricao, "nivel": it.nivel}
        for it in items
        if (it.tipo or "").upper() in ("TT", "RES") and (it.agrupamento or "").strip()
    ]

    if not candidatos:
        return {"sugestoes": []}

    # Alvos: TT/RES SEM agrupamento
    alvos = [
        it for it in items
        if (it.tipo or "").upper() in ("TT", "RES") and not (it.agrupamento or "").strip()
    ]

    sugestoes = []
    for it in alvos:
        scores = []
        for c in candidatos:
            score = _similarity(it.descricao or "", c["descricao"] or "")
            scores.append((score, c["agrupamento"], c["descricao"]))

        scores.sort(reverse=True)
        if not scores:
            continue

        melhor_score, melhor_agr, melhor_desc = scores[0]
        confianca = int(melhor_score * 100)

        alternativas = [agr for _, agr, _ in scores[1:4] if agr != melhor_agr]

        sugestoes.append({
            "linha_id": it.id,
            "descricao_linha": it.descricao,
            "agrupamento_sugerido": melhor_agr,
            "descricao_sugerida": melhor_desc,
            "confianca": confianca,
            "alternativas": alternativas,
        })

    # Ordenar por confiança decrescente
    sugestoes.sort(key=lambda s: s["confianca"], reverse=True)
    return {"sugestoes": sugestoes}
