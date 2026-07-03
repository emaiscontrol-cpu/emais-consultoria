from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from auth import get_usuario_atual, requer_perfil
import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.ClienteOut])
def listar(
    modulo_analises_gerenciais: Optional[bool] = None,
    modulo_projetos: Optional[bool] = None,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual)
):
    q = db.query(models.Cliente).filter(models.Cliente.ativo == True)
    if modulo_analises_gerenciais is not None:
        q = q.filter(models.Cliente.modulo_analises_gerenciais == modulo_analises_gerenciais)
    if modulo_projetos is not None:
        q = q.filter(models.Cliente.modulo_projetos == modulo_projetos)
    return q.all()

@router.get("/{id}", response_model=schemas.ClienteOut)
def detalhe(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    c = db.query(models.Cliente).get(id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return c

@router.post("/", response_model=schemas.ClienteOut)
def criar(data: schemas.ClienteCreate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    cliente = models.Cliente(**data.model_dump())
    db.add(cliente); db.commit(); db.refresh(cliente)
    return cliente

@router.put("/{id}", response_model=schemas.ClienteOut)
def atualizar(id: int, data: schemas.ClienteCreate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    c = db.query(models.Cliente).get(id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit(); db.refresh(c)
    return c

@router.delete("/{id}")
def desativar(id: int, db: Session = Depends(get_db), _=Depends(requer_perfil("admin"))):
    c = db.query(models.Cliente).get(id)
    if not c:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    c.ativo = False
    db.commit()
    return {"ok": True}
