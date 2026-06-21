from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import AgrupadorFC
from auth import get_usuario_atual
from schemas import UsuarioOut
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

PERFIS = {"admin", "consultor", "ger_projeto"}

def check(u):
    if u.perfil not in PERFIS:
        raise HTTPException(403, "Acesso negado")


# ── Schemas ───────────────────────────────────────────────────────────────────

class AgrupadorIn(BaseModel):
    nome: str
    padrao: bool = False


# ── Agrupadores ───────────────────────────────────────────────────────────────

@router.get("/agrupadores")
def listar_agrupadores(db: Session = Depends(get_db),
                       u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    return [{"id": a.id, "nome": a.nome, "padrao": a.padrao}
            for a in db.query(AgrupadorFC).filter(AgrupadorFC.ativo == True).order_by(AgrupadorFC.nome).all()]

@router.post("/agrupadores", status_code=201)
def criar_agrupador(data: AgrupadorIn, db: Session = Depends(get_db),
                    u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    if db.query(AgrupadorFC).filter(AgrupadorFC.nome == data.nome, AgrupadorFC.ativo == True).first():
        raise HTTPException(400, "Agrupador já existe")
    a = AgrupadorFC(nome=data.nome, padrao=data.padrao)
    db.add(a); db.commit(); db.refresh(a)
    return {"id": a.id, "nome": a.nome, "padrao": a.padrao}

@router.delete("/agrupadores/{id}")
def deletar_agrupador(id: int, db: Session = Depends(get_db),
                      u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    a = db.get(AgrupadorFC, id)
    if not a: raise HTTPException(404, "Agrupador não encontrado")
    a.ativo = False; db.commit()
    return {"ok": True}


