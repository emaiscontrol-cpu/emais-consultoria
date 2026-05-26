from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from database import get_db
from auth import get_usuario_atual, requer_perfil
from helpers import log
import models, schemas

router = APIRouter()

def recalcular_projeto(projeto: models.Projeto, db: Session):
    """Recalcula progresso geral do projeto com base nas fases."""
    fases = projeto.fases
    if not fases:
        projeto.progresso = 0.0
        return
    total = sum(f.progresso for f in fases)
    projeto.progresso = round(total / len(fases), 1)
    # status automático
    if all(f.status == models.StatusFase.concluida for f in fases):
        projeto.status = models.StatusProjeto.concluido
    elif any(f.status == models.StatusFase.em_andamento for f in fases):
        projeto.status = models.StatusProjeto.em_andamento
    db.commit()

@router.get("/", response_model=List[schemas.ProjetoOut])
def listar(
    cliente_id: Optional[int] = None,
    db: Session = Depends(get_db),
    usuario = Depends(get_usuario_atual)
):
    q = db.query(models.Projeto)
    # perfis restritos só veem projetos do seu cliente vinculado
    if usuario.perfil in ("cliente", "ger_projeto") and usuario.cliente_id:
        q = q.filter(models.Projeto.cliente_id == usuario.cliente_id)
    elif cliente_id:
        q = q.filter(models.Projeto.cliente_id == cliente_id)
    return q.all()

@router.get("/{id}", response_model=schemas.ProjetoDetalhe)
def detalhe(id: int, db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    p = db.query(models.Projeto).options(
        joinedload(models.Projeto.cliente),
        joinedload(models.Projeto.fases)
            .joinedload(models.Fase.tarefas)
            .joinedload(models.Tarefa.responsavel),
        joinedload(models.Projeto.fases)
            .joinedload(models.Fase.tarefas)
            .joinedload(models.Tarefa.subtarefas),
    ).filter(models.Projeto.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    if usuario.perfil == "cliente" and p.cliente_id != usuario.cliente_id:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return p

@router.post("/", response_model=schemas.ProjetoOut)
def criar(data: schemas.ProjetoCreate, db: Session = Depends(get_db), usuario=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    projeto = models.Projeto(**data.model_dump())
    db.add(projeto); db.commit(); db.refresh(projeto)
    log(db, usuario.id, "Projeto criado", f'"{projeto.nome}"', projeto_id=projeto.id)
    return projeto

@router.put("/{id}", response_model=schemas.ProjetoOut)
def atualizar(id: int, data: schemas.ProjetoCreate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    p = db.query(models.Projeto).get(id)
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p

@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db), _=Depends(requer_perfil("admin"))):
    p = db.query(models.Projeto).get(id)
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    db.delete(p); db.commit()
    return {"ok": True}
