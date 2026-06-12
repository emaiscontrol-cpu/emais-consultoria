from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional
from database import get_db
from auth import get_usuario_atual
import models

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class ValorUpsert(BaseModel):
    valor: float

class ValorDreUpsert(BaseModel):
    valor: float
    unidade: str


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_plano_cliente(cliente_id: int, db: Session):
    vinculo = db.query(models.ClientePlano).filter(
        models.ClientePlano.cliente_id == cliente_id
    ).first()
    if not vinculo:
        return None
    return vinculo.plano


def _itens_orcamento(plano: models.Plano):
    return [
        i for i in plano.itens
        if i.modulo and "O" in [m.strip().upper() for m in i.modulo.split(",")]
    ]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/cliente/{cliente_id}/ano/{ano}")
def obter_orcamento(
    cliente_id: int,
    ano: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    # Clientes só acessam seu próprio orçamento
    if usuario.perfil == "analista" and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")

    plano = _get_plano_cliente(cliente_id, db)
    if not plano:
        return {"plano": None, "linhas": []}

    itens = _itens_orcamento(plano)

    # Carrega todos os valores do cliente/ano de uma vez
    valores_db = db.query(models.OrcamentoValor).filter(
        models.OrcamentoValor.cliente_id == cliente_id,
        models.OrcamentoValor.ano == ano,
        models.OrcamentoValor.plano_item_id.in_([i.id for i in itens]),
    ).all()

    # Indexa: {item_id: {mes: valor}}
    idx: dict = {}
    for v in valores_db:
        idx.setdefault(v.plano_item_id, {})[v.mes] = v.valor

    linhas = []
    for item in itens:
        vals = idx.get(item.id, {})
        linhas.append({
            "item_id":     item.id,
            "conta":       item.conta,
            "descricao":   item.descricao,
            "agrupamento": item.agrupamento,
            "tipo":        item.tipo,        # None | TT | GRP | RES
            "movimento":   item.movimento,
            "ordem":       item.ordem,
            "valores":     {m: vals.get(m, 0.0) for m in range(1, 13)},
        })

    return {
        "plano":  {"id": plano.id, "nome": plano.nome},
        "linhas": linhas,
    }


@router.put("/cliente/{cliente_id}/ano/{ano}/item/{item_id}/mes/{mes}")
def salvar_valor(
    cliente_id: int,
    ano: int,
    item_id: int,
    mes: int,
    body: ValorUpsert,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    if usuario.perfil == "analista" and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")

    if not 1 <= mes <= 12:
        raise HTTPException(400, "Mês inválido (1–12)")

    # Confirma que o item pertence ao plano do cliente
    plano = _get_plano_cliente(cliente_id, db)
    if not plano:
        raise HTTPException(404, "Cliente sem plano vinculado")

    item = db.query(models.PlanoItem).filter(
        models.PlanoItem.id == item_id,
        models.PlanoItem.plano_id == plano.id,
    ).first()
    if not item:
        raise HTTPException(404, "Item não encontrado no plano do cliente")

    # Upsert
    reg = db.query(models.OrcamentoValor).filter(
        models.OrcamentoValor.plano_item_id == item_id,
        models.OrcamentoValor.cliente_id    == cliente_id,
        models.OrcamentoValor.ano           == ano,
        models.OrcamentoValor.mes           == mes,
    ).first()

    if reg:
        reg.valor = body.valor
    else:
        reg = models.OrcamentoValor(
            plano_item_id=item_id,
            cliente_id=cliente_id,
            ano=ano,
            mes=mes,
            valor=body.valor,
        )
        db.add(reg)

    db.commit()
    return {"ok": True, "valor": reg.valor}


@router.put("/dre/cliente/{cliente_id}/ano/{ano}/item/{item_id}/mes/{mes}")
def salvar_valor_dre(
    cliente_id: int,
    ano: int,
    item_id: int,
    mes: int,
    body: ValorDreUpsert,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    if usuario.perfil == "analista" and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")
    if not 1 <= mes <= 12:
        raise HTTPException(400, "Mês inválido (1–12)")

    plano = _get_plano_cliente(cliente_id, db)
    if not plano:
        raise HTTPException(404, "Cliente sem plano vinculado")

    item = db.query(models.PlanoItem).filter(
        models.PlanoItem.id == item_id,
        models.PlanoItem.plano_id == plano.id,
    ).first()
    if not item:
        raise HTTPException(404, "Item não encontrado no plano do cliente")

    reg = db.query(models.OrcamentoUnidadeValor).filter(
        models.OrcamentoUnidadeValor.plano_item_id == item_id,
        models.OrcamentoUnidadeValor.cliente_id    == cliente_id,
        models.OrcamentoUnidadeValor.ano           == ano,
        models.OrcamentoUnidadeValor.mes           == mes,
        models.OrcamentoUnidadeValor.unidade       == body.unidade,
    ).first()

    if reg:
        reg.valor = body.valor
    else:
        reg = models.OrcamentoUnidadeValor(
            plano_item_id=item_id,
            cliente_id=cliente_id,
            ano=ano,
            mes=mes,
            unidade=body.unidade,
            valor=body.valor,
        )
        db.add(reg)

    db.commit()
    return {"ok": True, "valor": reg.valor}


@router.get("/cliente/{cliente_id}/ano/{ano}/unidades")
def listar_unidades(
    cliente_id: int,
    ano: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    """Retorna as unidades disponíveis para o DRE do cliente/ano."""
    if usuario.perfil == "analista" and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")

    rows = db.execute(
        text("""
            SELECT DISTINCT unidade FROM orcamento_unidade_valores
            WHERE cliente_id = :cid AND ano = :ano
            ORDER BY CASE WHEN unidade = 'CONSOLIDADO' THEN '0' ELSE unidade END
        """),
        {"cid": cliente_id, "ano": ano}
    ).fetchall()

    return [r[0] for r in rows]


@router.get("/cliente/{cliente_id}/ano/{ano}/dre")
def obter_dre(
    cliente_id: int,
    ano: int,
    unidade: str = Query("CONSOLIDADO"),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    """Retorna o DRE histórico por unidade (dados importados do Excel)."""
    if usuario.perfil == "analista" and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")

    plano = _get_plano_cliente(cliente_id, db)
    if not plano:
        return {"plano": None, "linhas": [], "unidade": unidade}

    # Itens DRE: modulo contém 'D'
    itens = [
        i for i in plano.itens
        if i.modulo and "D" in [m.strip().upper() for m in i.modulo.split(",")]
    ]

    if not itens:
        return {"plano": {"id": plano.id, "nome": plano.nome}, "linhas": [], "unidade": unidade}

    # Carregar valores da unidade selecionada
    item_ids = [i.id for i in itens]
    valores_db = db.query(models.OrcamentoUnidadeValor).filter(
        models.OrcamentoUnidadeValor.cliente_id    == cliente_id,
        models.OrcamentoUnidadeValor.ano           == ano,
        models.OrcamentoUnidadeValor.unidade       == unidade,
        models.OrcamentoUnidadeValor.plano_item_id.in_(item_ids),
    ).all()

    idx: dict = {}
    for row in valores_db:
        idx.setdefault(row.plano_item_id, {})[row.mes] = row.valor

    # Fórmulas JSON configuradas no Template
    import json as _json
    formula_map: dict = {}
    for f in db.query(models.TemplateFormula).filter(models.TemplateFormula.plano_item_id.in_(item_ids)).all():
        formula_map[f.plano_item_id] = _json.loads(f.componentes or "[]")

    linhas = []
    for item in itens:
        vals = idx.get(item.id, {})
        linhas.append({
            "item_id":     item.id,
            "conta":       item.conta,
            "descricao":   item.descricao,
            "agrupamento": item.agrupamento,
            "tipo":        item.tipo,
            "nivel":       item.nivel,
            "movimento":   item.movimento,
            "ordem":       item.ordem,
            "formula":     item.formula,
            "componentes": formula_map.get(item.id),
            "valores":     {m: vals.get(m, 0.0) for m in range(1, 13)},
        })

    return {
        "plano":   {"id": plano.id, "nome": plano.nome},
        "unidade": unidade,
        "linhas":  linhas,
    }


@router.get("/clientes")
def listar_clientes_com_plano(
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    """Retorna clientes que têm plano vinculado com módulo O."""
    vinculos = db.query(models.ClientePlano).all()
    resultado = []
    for v in vinculos:
        plano = v.plano
        tem_orcamento = any(
            "O" in [m.strip().upper() for m in (i.modulo or "").split(",")]
            for i in plano.itens
        )
        if tem_orcamento:
            resultado.append({
                "id":           v.cliente_id,
                "razao_social": v.cliente.razao_social,
                "plano_nome":   plano.nome,
            })
    return resultado
