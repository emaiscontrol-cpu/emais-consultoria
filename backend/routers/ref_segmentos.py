from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from security import requer_perfil, get_usuario_atual
import models, schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.SegmentoOut])
def listar(db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.Segmento).filter(models.Segmento.ativo == True).order_by(models.Segmento.nome).all()


@router.post("/", response_model=schemas.SegmentoOut)
def criar(data: schemas.SegmentoCreate, db: Session = Depends(get_db),
          _=Depends(requer_perfil("admin", "consultor"))):
    if db.query(models.Segmento).filter(models.Segmento.nome == data.nome).first():
        raise HTTPException(400, "Segmento já existe")
    s = models.Segmento(nome=data.nome)
    db.add(s); db.commit(); db.refresh(s)
    return s


@router.put("/{id}", response_model=schemas.SegmentoOut)
def atualizar(id: int, data: schemas.SegmentoCreate, db: Session = Depends(get_db),
              _=Depends(requer_perfil("admin", "consultor"))):
    s = db.get(models.Segmento, id)
    if not s:
        raise HTTPException(404, "Segmento não encontrado")
    s.nome = data.nome
    db.commit(); db.refresh(s)
    return s


@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db),
            _=Depends(requer_perfil("admin"))):
    s = db.get(models.Segmento, id)
    if not s:
        raise HTTPException(404, "Segmento não encontrado")
    s.ativo = False
    db.commit()
    return {"ok": True}
