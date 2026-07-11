from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import get_usuario_atual, verificar_tenant
import models, schemas

router = APIRouter()


@router.get("/tarefa/{tarefa_id}", response_model=List[schemas.SubtarefaOut])
def listar(tarefa_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.Subtarefa).filter(
        models.Subtarefa.tarefa_id == tarefa_id
    ).order_by(models.Subtarefa.ordem).all()


@router.post("/", response_model=schemas.SubtarefaOut)
def criar(data: schemas.SubtarefaCreate, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    tarefa = db.query(models.Tarefa).get(data.tarefa_id)
    if not tarefa:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    fase = tarefa.fase
    verificar_tenant(usuario, fase.projeto.cliente_id)

    if usuario.perfil not in ("admin", "consultor", "ger_projeto"):
        resp = fase.responsavel
        autorizado = (
            resp is not None and
            resp.perfil == models.PerfilEnum.ger_projeto
        )
        if not autorizado:
            raise HTTPException(status_code=403, detail="Sem permissão para adicionar atividades nesta tarefa")
    s = models.Subtarefa(**data.model_dump())
    db.add(s); db.commit(); db.refresh(s)
    return s


@router.put("/{id}", response_model=schemas.SubtarefaOut)
def atualizar(id: int, data: schemas.SubtarefaUpdate, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    s = db.query(models.Subtarefa).get(id)
    if not s:
        raise HTTPException(status_code=404, detail="Subtarefa não encontrada")
    verificar_tenant(usuario, s.tarefa.fase.projeto.cliente_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit(); db.refresh(s)
    return s


@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    s = db.query(models.Subtarefa).get(id)
    if not s:
        raise HTTPException(status_code=404, detail="Subtarefa não encontrada")
    verificar_tenant(usuario, s.tarefa.fase.projeto.cliente_id)
    db.delete(s); db.commit()
    return {"ok": True}
