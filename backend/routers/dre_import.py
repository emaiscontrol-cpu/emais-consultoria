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
from models import (
    PlanoItem, TemplateFormula, ImportLayout, ContaDePara,
    ImportacaoLog, ImportacaoPendencia, ClientePlano,
)
from auth import get_usuario_atual
from formula_generator import gerar_formulas_do_plano
from agrupamento_suggester import sugerir_agrupamentos
from importacao_service import importar_realizado
from xlsx_parser import preview_xlsx

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Schemas ───────────────────────────────────────────────────────────────────

class FormulaUpdate(BaseModel):
    tipo_formula: Optional[str] = None
    componentes: Optional[list] = None
    auto_gerada: Optional[bool] = None


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


class DeParaCreate(BaseModel):
    cliente_id: int
    layout_id: Optional[int] = None
    codigo_erp: str
    plano_item_id: int
    ativo: bool = True


class DeParaBulk(BaseModel):
    cliente_id: int
    layout_id: Optional[int] = None
    mapeamentos: list  # [{"codigo_erp": str, "plano_item_id": int}]


class ResolverPendencia(BaseModel):
    pendencia_id: int
    plano_item_id: int
    salvar_depara: bool = True


# ── Fórmulas ──────────────────────────────────────────────────────────────────

@router.post("/formulas/gerar/{plano_id}")
def gerar_formulas(
    plano_id: int,
    sobrescrever: bool = Query(False),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    resultado = gerar_formulas_do_plano(plano_id, db, sobrescrever=sobrescrever)
    return resultado


@router.get("/formulas/{plano_id}")
def listar_formulas(
    plano_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    items = (
        db.query(PlanoItem)
        .filter(PlanoItem.plano_id == plano_id)
        .order_by(PlanoItem.ordem)
        .all()
    )
    formulas = {
        f.plano_item_id: f
        for f in db.query(TemplateFormula)
        .filter(TemplateFormula.plano_item_id.in_([i.id for i in items]))
        .all()
    }
    result = []
    for it in items:
        f = formulas.get(it.id)
        result.append({
            "item_id": it.id,
            "descricao": it.descricao,
            "conta": it.conta,
            "tipo": it.tipo,
            "nivel": it.nivel,
            "agrupamento": it.agrupamento,
            "formula_id": f.id if f else None,
            "tipo_formula": f.tipo_formula if f else None,
            "componentes": json.loads(f.componentes or "[]") if f else [],
            "auto_gerada": f.auto_gerada if f else None,
        })
    return result


@router.put("/formulas/item/{plano_item_id}")
def upsert_formula(
    plano_item_id: int,
    data: FormulaUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    """Cria ou atualiza a fórmula de um item do plano (upsert)."""
    f = db.query(TemplateFormula).filter(TemplateFormula.plano_item_id == plano_item_id).first()
    if not f:
        f = TemplateFormula(
            plano_item_id=plano_item_id,
            tipo_formula=data.tipo_formula or "FILHOS",
            componentes=json.dumps(data.componentes or [], ensure_ascii=False),
            auto_gerada=False,
        )
        db.add(f)
    else:
        if data.tipo_formula is not None:
            f.tipo_formula = data.tipo_formula
        if data.componentes is not None:
            f.componentes = json.dumps(data.componentes, ensure_ascii=False)
        if data.auto_gerada is not None:
            f.auto_gerada = data.auto_gerada
    db.commit()
    return {
        "id": f.id,
        "plano_item_id": f.plano_item_id,
        "tipo_formula": f.tipo_formula,
        "componentes": json.loads(f.componentes or "[]"),
        "auto_gerada": f.auto_gerada,
    }


@router.put("/formulas/{formula_id}")
def atualizar_formula(
    formula_id: int,
    data: FormulaUpdate,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    f = db.query(TemplateFormula).filter(TemplateFormula.id == formula_id).first()
    if not f:
        raise HTTPException(404, "Fórmula não encontrada")
    if data.tipo_formula is not None:
        f.tipo_formula = data.tipo_formula
    if data.componentes is not None:
        f.componentes = json.dumps(data.componentes, ensure_ascii=False)
    if data.auto_gerada is not None:
        f.auto_gerada = data.auto_gerada
    db.commit()
    return {
        "id": f.id,
        "plano_item_id": f.plano_item_id,
        "tipo_formula": f.tipo_formula,
        "componentes": json.loads(f.componentes or "[]"),
        "auto_gerada": f.auto_gerada,
    }


# ── Sugestão de Agrupamentos por IA ──────────────────────────────────────────

@router.post("/sugerir-agrupamentos/{plano_id}")
def sugerir_agrup(
    plano_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    return sugerir_agrupamentos(plano_id, db)



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


# ── DE-PARA ────────────────────────────────────────────────────────────────────

def _dp_dict(dp: ContaDePara) -> dict:
    return {
        "id": dp.id,
        "cliente_id": dp.cliente_id,
        "layout_id": dp.layout_id,
        "codigo_erp": dp.codigo_erp,
        "plano_item_id": dp.plano_item_id,
        "descricao_item": dp.item.descricao if dp.item else None,
        "ativo": dp.ativo,
    }


@router.get("/de-para")
def listar_depara(
    cliente_id: int = Query(...),
    layout_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    q = db.query(ContaDePara).filter(ContaDePara.cliente_id == cliente_id)
    if layout_id is not None:
        q = q.filter(ContaDePara.layout_id == layout_id)
    return [_dp_dict(dp) for dp in q.order_by(ContaDePara.codigo_erp).all()]


@router.post("/de-para")
def criar_depara(
    data: DeParaCreate,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    existe = (
        db.query(ContaDePara)
        .filter(
            ContaDePara.cliente_id == data.cliente_id,
            ContaDePara.layout_id == data.layout_id,
            ContaDePara.codigo_erp == data.codigo_erp,
        )
        .first()
    )
    if existe:
        existe.plano_item_id = data.plano_item_id
        existe.ativo = True
        db.commit()
        return _dp_dict(existe)
    dp = ContaDePara(**data.model_dump())
    db.add(dp)
    db.commit()
    db.refresh(dp)
    return _dp_dict(dp)


@router.post("/de-para/bulk")
def criar_depara_bulk(
    data: DeParaBulk,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    criados = 0
    for m in data.mapeamentos:
        codigo = m.get("codigo_erp", "")
        item_id = m.get("plano_item_id")
        if not codigo or not item_id:
            continue
        existe = (
            db.query(ContaDePara)
            .filter(
                ContaDePara.cliente_id == data.cliente_id,
                ContaDePara.layout_id == data.layout_id,
                ContaDePara.codigo_erp == codigo,
            )
            .first()
        )
        if existe:
            existe.plano_item_id = item_id
            existe.ativo = True
        else:
            db.add(ContaDePara(
                cliente_id=data.cliente_id,
                layout_id=data.layout_id,
                codigo_erp=codigo,
                plano_item_id=item_id,
            ))
        criados += 1
    db.commit()
    return {"criados": criados}


@router.put("/de-para/{dp_id}")
def atualizar_depara(
    dp_id: int,
    data: DeParaCreate,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    dp = db.query(ContaDePara).filter(ContaDePara.id == dp_id).first()
    if not dp:
        raise HTTPException(404, "DE-PARA não encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(dp, k, v)
    db.commit()
    return _dp_dict(dp)


@router.delete("/de-para/{dp_id}")
def excluir_depara(
    dp_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    dp = db.query(ContaDePara).filter(ContaDePara.id == dp_id).first()
    if not dp:
        raise HTTPException(404, "DE-PARA não encontrado")
    db.delete(dp)
    db.commit()
    return {"ok": True}


# ── Importação ─────────────────────────────────────────────────────────────────

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
    content = await arquivo.read()
    try:
        resultado = importar_realizado(
            content=content,
            layout_id=layout_id,
            cliente_id=cliente_id,
            unidade=unidade,
            ano=ano,
            mes_filtro=mes,
            reprocessar=reprocessar,
            usuario_id=usuario.id,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return resultado


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
def resolver_pendencia(
    data: ResolverPendencia,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    pend = db.query(ImportacaoPendencia).filter(ImportacaoPendencia.id == data.pendencia_id).first()
    if not pend:
        raise HTTPException(404, "Pendência não encontrada")
    log = db.query(ImportacaoLog).filter(ImportacaoLog.id == pend.log_id).first()

    # Salvar DE-PARA se solicitado
    if data.salvar_depara:
        existe = (
            db.query(ContaDePara)
            .filter(
                ContaDePara.cliente_id == log.cliente_id,
                ContaDePara.layout_id == log.layout_id,
                ContaDePara.codigo_erp == pend.codigo_erp,
            )
            .first()
        )
        if existe:
            existe.plano_item_id = data.plano_item_id
            existe.ativo = True
        else:
            db.add(ContaDePara(
                cliente_id=log.cliente_id,
                layout_id=log.layout_id,
                codigo_erp=pend.codigo_erp,
                plano_item_id=data.plano_item_id,
            ))

    # Upsert valor
    from models import OrcamentoUnidadeValor
    reg = (
        db.query(OrcamentoUnidadeValor)
        .filter(
            OrcamentoUnidadeValor.plano_item_id == data.plano_item_id,
            OrcamentoUnidadeValor.cliente_id == log.cliente_id,
            OrcamentoUnidadeValor.ano == log.ano,
            OrcamentoUnidadeValor.mes == pend.mes,
            OrcamentoUnidadeValor.unidade == log.unidade,
        )
        .first()
    )
    if reg:
        reg.valor = (reg.valor or 0.0) + pend.valor
    else:
        db.add(OrcamentoUnidadeValor(
            plano_item_id=data.plano_item_id,
            cliente_id=log.cliente_id,
            ano=log.ano,
            mes=pend.mes,
            unidade=log.unidade,
            valor=pend.valor,
        ))

    pend.resolvido = True
    db.commit()

    return {"ok": True}
