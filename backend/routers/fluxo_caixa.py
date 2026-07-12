from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Agrupamento
from security import get_usuario_atual
from schemas import UsuarioOut
from pydantic import BaseModel
import json

router = APIRouter()

PERFIS = {"admin", "consultor", "ger_projeto"}

def check(u):
    if u.perfil not in PERFIS:
        raise HTTPException(403, "Acesso negado")


# ── Schemas ───────────────────────────────────────────────────────────────────

class AgrupamentoIn(BaseModel):
    nome: str
    padrao: bool = False


# ── Agrupamentos ──────────────────────────────────────────────────────────────

@router.get("/agrupadores")
def listar_agrupadores(db: Session = Depends(get_db),
                       u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    return [
        {
            "id": a.id,
            "nome": a.nome,
            "slug": a.slug,
            "padrao": a.padrao,
            "demonstrativos": json.loads(a.demonstrativos or '["fluxo_caixa"]'),
            "dimensao": a.dimensao,
        }
        for a in db.query(Agrupamento).filter(Agrupamento.ativo == True).order_by(Agrupamento.nome).all()
    ]

@router.post("/agrupadores", status_code=201)
def criar_agrupador(data: AgrupamentoIn, db: Session = Depends(get_db),
                    u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    if db.query(Agrupamento).filter(Agrupamento.nome == data.nome, Agrupamento.ativo == True).first():
        raise HTTPException(400, "Agrupamento já existe")
    a = Agrupamento(nome=data.nome, padrao=data.padrao)
    db.add(a); db.commit(); db.refresh(a)
    return {"id": a.id, "nome": a.nome, "padrao": a.padrao}

@router.delete("/agrupadores/{id}")
def deletar_agrupador(id: int, db: Session = Depends(get_db),
                      u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    a = db.get(Agrupamento, id)
    if not a: raise HTTPException(404, "Agrupamento não encontrado")
    a.ativo = False; db.commit()
    return {"ok": True}
