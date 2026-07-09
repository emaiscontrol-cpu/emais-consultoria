from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload, selectinload
from typing import List, Optional
from database import get_db
from security import get_usuario_atual, requer_perfil, verificar_tenant
from helpers import log
import models, schemas

router = APIRouter()

def recalcular_projeto(projeto: models.Projeto, db: Session):
    """Recalcula progresso geral do projeto com base nas fases."""
    fases = [f for f in projeto.fases if getattr(f, 'ativo', True)]
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
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db),
    usuario = Depends(get_usuario_atual)
):
    q = db.query(models.Projeto).filter(models.Projeto.ativo == True)
    if usuario.perfil in ("analista", "ger_projeto", "ti"):
        q = q.filter(models.Projeto.cliente_id == usuario.cliente_id)
    elif cliente_id:
        q = q.filter(models.Projeto.cliente_id == cliente_id)
    return q.offset(skip).limit(limit).all()

@router.get("/{id}", response_model=schemas.ProjetoDetalhe)
def detalhe(id: int, db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    p = db.query(models.Projeto).options(
        joinedload(models.Projeto.cliente),
        selectinload(models.Projeto.fases)
            .selectinload(models.Fase.comentarios_fase)
            .joinedload(models.ComentarioFase.autor),
        selectinload(models.Projeto.fases)
            .selectinload(models.Fase.tarefas)
            .joinedload(models.Tarefa.responsavel),
        selectinload(models.Projeto.fases)
            .selectinload(models.Fase.tarefas)
            .selectinload(models.Tarefa.responsaveis),
        selectinload(models.Projeto.fases)
            .selectinload(models.Fase.tarefas)
            .selectinload(models.Tarefa.subtarefas)
            .joinedload(models.Subtarefa.responsavel),
    ).filter(models.Projeto.id == id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    verificar_tenant(usuario, p.cliente_id)
    return p

@router.post("/", response_model=schemas.ProjetoOut)
def criar(data: schemas.ProjetoCreate, db: Session = Depends(get_db), usuario=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    verificar_tenant(usuario, data.cliente_id)
    projeto = models.Projeto(**data.model_dump())
    db.add(projeto); db.commit(); db.refresh(projeto)
    log(db, usuario.id, "Projeto criado", f'"{projeto.nome}"', projeto_id=projeto.id)
    return projeto

@router.put("/{id}", response_model=schemas.ProjetoOut)
def atualizar(id: int, data: schemas.ProjetoCreate, db: Session = Depends(get_db), usuario=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    p = db.query(models.Projeto).get(id)
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    verificar_tenant(usuario, p.cliente_id)
    verificar_tenant(usuario, data.cliente_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return p

@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db), _=Depends(requer_perfil("admin"))):
    p = db.query(models.Projeto).get(id)
    if not p:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    p.ativo = False
    db.commit()
    return {"ok": True}
