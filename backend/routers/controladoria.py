from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from database import get_db
from models import CategoriaFinanceira, Lancamento, OrcamentoLinha, Projeto, Cliente
from security import get_usuario_atual
from schemas import UsuarioOut
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter()

PERFIS_CONTROLADORIA = {"admin", "consultor", "ger_projeto"}

def check_acesso(usuario: UsuarioOut):
    if usuario.perfil not in PERFIS_CONTROLADORIA:
        raise HTTPException(status_code=403, detail="Acesso restrito à Controladoria")


# ── Schemas ───────────────────────────────────────────────────────────────────

class CategoriaIn(BaseModel):
    nome: str
    tipo: str          # 'receita' | 'despesa'
    pai_id: Optional[int] = None

class LancamentoIn(BaseModel):
    tipo: str          # 'receita' | 'despesa'
    descricao: str
    valor: float
    data: date
    categoria_id: Optional[int] = None
    projeto_id: Optional[int] = None
    cliente_id: Optional[int] = None
    observacao: Optional[str] = None

class OrcamentoIn(BaseModel):
    categoria_id: int
    ano: int
    mes: Optional[int] = None
    valor_previsto: float
    cliente_id: Optional[int] = None
    projeto_id: Optional[int] = None


# ── Resumo (dashboard da Controladoria) ──────────────────────────────────────

@router.get("/resumo")
def resumo(mes: Optional[int] = None, ano: Optional[int] = None,
           db: Session = Depends(get_db),
           usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    from datetime import date as dt
    ano  = ano  or dt.today().year
    mes  = mes  or dt.today().month

    q = db.query(Lancamento).filter(
        extract('year', Lancamento.data) == ano,
        extract('month', Lancamento.data) == mes,
    )
    receitas  = sum(float(l.valor) for l in q.filter(Lancamento.tipo == 'receita').all())
    despesas  = sum(float(l.valor) for l in q.filter(Lancamento.tipo == 'despesa').all())
    resultado = receitas - despesas

    total_lancamentos = db.query(func.count(Lancamento.id)).scalar()

    return {
        "mes": mes, "ano": ano,
        "receitas": receitas,
        "despesas": despesas,
        "resultado": resultado,
        "total_lancamentos": total_lancamentos,
    }


# ── Categorias ────────────────────────────────────────────────────────────────

@router.get("/categorias")
def listar_categorias(db: Session = Depends(get_db),
                      usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    cats = db.query(CategoriaFinanceira).filter(CategoriaFinanceira.ativo == True).all()
    return [{"id": c.id, "nome": c.nome, "tipo": c.tipo, "pai_id": c.pai_id} for c in cats]

@router.post("/categorias", status_code=201)
def criar_categoria(data: CategoriaIn, db: Session = Depends(get_db),
                    usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    if data.tipo not in ("receita", "despesa"):
        raise HTTPException(400, "tipo deve ser 'receita' ou 'despesa'")
    cat = CategoriaFinanceira(**data.model_dump())
    db.add(cat); db.commit(); db.refresh(cat)
    return {"id": cat.id, "nome": cat.nome, "tipo": cat.tipo}

@router.delete("/categorias/{id}")
def deletar_categoria(id: int, db: Session = Depends(get_db),
                      usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    cat = db.get(CategoriaFinanceira, id)
    if not cat:
        raise HTTPException(404, "Categoria não encontrada")
    cat.ativo = False
    db.commit()
    return {"ok": True}


# ── Lançamentos ───────────────────────────────────────────────────────────────

@router.get("/lancamentos")
def listar_lancamentos(
    mes: Optional[int] = None, ano: Optional[int] = None,
    tipo: Optional[str] = None, cliente_id: Optional[int] = None,
    projeto_id: Optional[int] = None,
    db: Session = Depends(get_db),
    usuario: UsuarioOut = Depends(get_usuario_atual)
):
    check_acesso(usuario)
    q = db.query(Lancamento)
    if ano:        q = q.filter(extract('year',  Lancamento.data) == ano)
    if mes:        q = q.filter(extract('month', Lancamento.data) == mes)
    if tipo:       q = q.filter(Lancamento.tipo == tipo)
    if cliente_id: q = q.filter(Lancamento.cliente_id == cliente_id)
    if projeto_id: q = q.filter(Lancamento.projeto_id == projeto_id)
    items = q.order_by(Lancamento.data.desc()).all()
    return [
        {
            "id": l.id, "tipo": l.tipo, "descricao": l.descricao,
            "valor": float(l.valor) if l.valor is not None else 0.0, "data": str(l.data),
            "categoria": l.categoria.nome if l.categoria else None,
            "categoria_id": l.categoria_id,
            "projeto": l.projeto.nome if l.projeto else None,
            "projeto_id": l.projeto_id,
            "cliente": l.cliente.razao_social if l.cliente else None,
            "cliente_id": l.cliente_id,
            "observacao": l.observacao,
            "criado_em": l.criado_em,
        }
        for l in items
    ]

@router.post("/lancamentos", status_code=201)
def criar_lancamento(data: LancamentoIn, db: Session = Depends(get_db),
                     usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    if data.tipo not in ("receita", "despesa"):
        raise HTTPException(400, "tipo deve ser 'receita' ou 'despesa'")
    lanc = Lancamento(**data.model_dump(), usuario_id=usuario.id)
    db.add(lanc); db.commit(); db.refresh(lanc)
    return {"id": lanc.id}

@router.put("/lancamentos/{id}")
def atualizar_lancamento(id: int, data: LancamentoIn,
                          db: Session = Depends(get_db),
                          usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    lanc = db.get(Lancamento, id)
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado")
    for k, v in data.model_dump().items():
        setattr(lanc, k, v)
    db.commit()
    return {"ok": True}

@router.delete("/lancamentos/{id}")
def deletar_lancamento(id: int, db: Session = Depends(get_db),
                        usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    lanc = db.get(Lancamento, id)
    if not lanc:
        raise HTTPException(404, "Lançamento não encontrado")
    db.delete(lanc); db.commit()
    return {"ok": True}


# ── Orçamento ─────────────────────────────────────────────────────────────────

@router.get("/orcamento")
def listar_orcamento(ano: int, cliente_id: Optional[int] = None,
                     db: Session = Depends(get_db),
                     usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    q = db.query(OrcamentoLinha).filter(OrcamentoLinha.ano == ano)
    if cliente_id:
        q = q.filter(OrcamentoLinha.cliente_id == cliente_id)
    items = q.all()
    return [
        {
            "id": o.id, "ano": o.ano, "mes": o.mes,
            "valor_previsto": float(o.valor_previsto) if o.valor_previsto is not None else 0.0,
            "categoria_id": o.categoria_id,
            "categoria": o.categoria.nome if o.categoria else None,
            "tipo": o.categoria.tipo if o.categoria else None,
            "cliente_id": o.cliente_id, "projeto_id": o.projeto_id,
        }
        for o in items
    ]

@router.post("/orcamento", status_code=201)
def criar_orcamento(data: OrcamentoIn, db: Session = Depends(get_db),
                    usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    linha = OrcamentoLinha(**data.model_dump())
    db.add(linha); db.commit(); db.refresh(linha)
    return {"id": linha.id}

@router.delete("/orcamento/{id}")
def deletar_orcamento(id: int, db: Session = Depends(get_db),
                      usuario: UsuarioOut = Depends(get_usuario_atual)):
    check_acesso(usuario)
    linha = db.get(OrcamentoLinha, id)
    if not linha:
        raise HTTPException(404, "Linha não encontrada")
    db.delete(linha); db.commit()
    return {"ok": True}
