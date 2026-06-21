"""
Endpoints do Motor de Fórmulas + Importação DE-PARA.

Prefixo: /api/dre
"""

import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import SessionLocal
from models import ImportLayout, ImportacaoLog, ImportacaoPendencia
from auth import get_usuario_atual
from xlsx_parser import preview_xlsx

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Schemas ───────────────────────────────────────────────────────────────────

class LayoutCreate(BaseModel):
    cliente_id: Optional[int] = None
    categoria: str = "REALIZADO"
    nome: str
    linha_inicio: int = 2
    coluna_conta: int = 0
    coluna_descricao: Optional[int] = None
    tipo_estrutura: str = "COLUNAS_MESES"
    mapa_colunas_meses: Optional[list] = None
    coluna_mes: Optional[int] = None
    coluna_valor: Optional[int] = None
    formato_mes: str = "MM/YYYY"
    prefixos_ignorar: Optional[list] = None
    linhas_ignorar: Optional[list] = None
    ativo: bool = True


class LayoutUpdate(LayoutCreate):
    nome: Optional[str] = None


# ── Import Layouts ─────────────────────────────────────────────────────────────

def _layout_dict(l: ImportLayout) -> dict:
    return {
        "id": l.id,
        "cliente_id": l.cliente_id,
        "categoria": getattr(l, 'categoria', 'REALIZADO'),
        "nome": l.nome,
        "linha_inicio": l.linha_inicio,
        "coluna_conta": l.coluna_conta,
        "coluna_descricao": l.coluna_descricao,
        "tipo_estrutura": l.tipo_estrutura,
        "mapa_colunas_meses": json.loads(l.mapa_colunas_meses or "[]"),
        "coluna_mes": l.coluna_mes,
        "coluna_valor": l.coluna_valor,
        "formato_mes": l.formato_mes,
        "prefixos_ignorar": json.loads(l.prefixos_ignorar or "[]"),
        "linhas_ignorar": json.loads(l.linhas_ignorar or "[]"),
        "ativo": l.ativo,
        "criado_em": l.criado_em,
    }


@router.get("/layouts")
def listar_layouts(
    cliente_id: Optional[int] = Query(None),
    categoria: Optional[str] = Query(None),  # REALIZADO | PLANO
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    q = db.query(ImportLayout).filter(ImportLayout.ativo == True)
    if cliente_id:
        q = q.filter(
            (ImportLayout.cliente_id == cliente_id) | (ImportLayout.cliente_id == None)
        )
    if categoria:
        q = q.filter(ImportLayout.categoria == categoria)
    return [_layout_dict(l) for l in q.order_by(ImportLayout.nome).all()]


@router.post("/layouts")
def criar_layout(
    data: LayoutCreate,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    l = ImportLayout(
        cliente_id=data.cliente_id,
        categoria=data.categoria,
        nome=data.nome,
        linha_inicio=data.linha_inicio,
        coluna_conta=data.coluna_conta,
        coluna_descricao=data.coluna_descricao,
        tipo_estrutura=data.tipo_estrutura,
        mapa_colunas_meses=json.dumps(data.mapa_colunas_meses or []),
        coluna_mes=data.coluna_mes,
        coluna_valor=data.coluna_valor,
        formato_mes=data.formato_mes,
        prefixos_ignorar=json.dumps(data.prefixos_ignorar or []),
        linhas_ignorar=json.dumps(data.linhas_ignorar or []),
        ativo=data.ativo,
    )
    db.add(l)
    db.commit()
    db.refresh(l)
    return _layout_dict(l)


@router.put("/layouts/{layout_id}")
def atualizar_layout(
    layout_id: int,
    data: LayoutUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    l = db.query(ImportLayout).filter(ImportLayout.id == layout_id).first()
    if not l:
        raise HTTPException(404, "Layout não encontrado")
    updates = data.model_dump(exclude_none=True)
    for k in ("mapa_colunas_meses", "prefixos_ignorar", "linhas_ignorar"):
        if k in updates and isinstance(updates[k], list):
            updates[k] = json.dumps(updates[k])
    for k, v in updates.items():
        setattr(l, k, v)
    db.commit()
    return _layout_dict(l)


@router.delete("/layouts/{layout_id}")
def excluir_layout(
    layout_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    l = db.query(ImportLayout).filter(ImportLayout.id == layout_id).first()
    if not l:
        raise HTTPException(404, "Layout não encontrado")
    l.ativo = False
    db.commit()
    return {"ok": True}


@router.post("/layouts/preview")
async def preview_layout(
    arquivo: UploadFile = File(...),
    _=Depends(get_usuario_atual),
):
    content = await arquivo.read()
    try:
        data = preview_xlsx(content)
    except Exception as e:
        raise HTTPException(400, f"Erro ao ler arquivo: {e}")
    return data


@router.post("/importar")
async def importar(
    arquivo: UploadFile = File(...),
    layout_id: int = Query(...),
    cliente_id: int = Query(...),
    unidade: str = Query("CONSOLIDADO"),
    ano: int = Query(...),
    mes: Optional[int] = Query(None),
    reprocessar: bool = Query(False),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    raise HTTPException(410, "Importação via plano de contas antigo foi removida. Use /api/ref/lancamentos/importar")


@router.get("/importar/logs")
def listar_logs(
    cliente_id: int = Query(...),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    logs = (
        db.query(ImportacaoLog)
        .filter(ImportacaoLog.cliente_id == cliente_id)
        .order_by(ImportacaoLog.criado_em.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": l.id,
            "layout_id": l.layout_id,
            "ano": l.ano,
            "mes": l.mes,
            "unidade": l.unidade,
            "total_linhas": l.total_linhas,
            "direto": l.direto,
            "via_depara": l.via_depara,
            "pendencias": l.pendencias,
            "criado_em": l.criado_em,
        }
        for l in logs
    ]


@router.get("/importar/logs/{log_id}/pendencias")
def pendencias_do_log(
    log_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    pends = (
        db.query(ImportacaoPendencia)
        .filter(ImportacaoPendencia.log_id == log_id)
        .order_by(ImportacaoPendencia.codigo_erp)
        .all()
    )
    return [
        {
            "id": p.id,
            "log_id": p.log_id,
            "codigo_erp": p.codigo_erp,
            "descricao": p.descricao,
            "valor": p.valor,
            "mes": p.mes,
            "resolvido": p.resolvido,
        }
        for p in pends
    ]


@router.post("/importar/pendencias/resolver")
def resolver_pendencia(db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    raise HTTPException(410, "Resolução de pendências via plano antigo foi removida. Use /api/ref/depara")
