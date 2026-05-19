from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_usuario_atual
import models, schemas

router = APIRouter()


@router.get("/tarefa/{tarefa_id}", response_model=List[schemas.SubtarefaOut])
def listar(tarefa_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.Subtarefa).filter(
        models.Subtarefa.tarefa_id == tarefa_id
    ).order_by(models.Subtarefa.ordem).all()


@router.post("/", response_model=schemas.SubtarefaOut)
def criar(data: schemas.SubtarefaCreate, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    s = models.Subtarefa(**data.model_dump())
    db.add(s); db.commit(); db.refresh(s)
    return s


@router.put("/{id}", response_model=schemas.SubtarefaOut)
def atualizar(id: int, data: schemas.SubtarefaUpdate, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    s = db.query(models.Subtarefa).get(id)
    if not s:
        raise HTTPException(status_code=404, detail="Subtarefa não encontrada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit(); db.refresh(s)
    return s


@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    s = db.query(models.Subtarefa).get(id)
    if not s:
        raise HTTPException(status_code=404, detail="Subtarefa não encontrada")
    db.delete(s); db.commit()
    return {"ok": True}
