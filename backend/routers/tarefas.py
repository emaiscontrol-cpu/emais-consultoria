from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from database import get_db
from auth import get_usuario_atual, requer_perfil
from routers.fases import recalcular_fase
from helpers import log
import models, schemas

router = APIRouter()

@router.get("/fase/{fase_id}", response_model=List[schemas.TarefaOut])
def listar_por_fase(fase_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.Tarefa).filter(
        models.Tarefa.fase_id == fase_id
    ).order_by(models.Tarefa.ordem).all()

@router.get("/{id}", response_model=schemas.TarefaOut)
def detalhe(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    t = db.query(models.Tarefa).get(id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    return t

@router.post("/", response_model=schemas.TarefaOut)
def criar(data: schemas.TarefaCreate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    tarefa = models.Tarefa(**data.model_dump())
    db.add(tarefa); db.commit(); db.refresh(tarefa)
    return tarefa

@router.put("/{id}", response_model=schemas.TarefaOut)
def atualizar(id: int, data: schemas.TarefaUpdate, db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    t = db.query(models.Tarefa).get(id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")

    update = data.model_dump(exclude_none=True)

    # FLUXO DE VALIDAÇÃO:
    # Cliente confirma → se requer validação: vai para aguard_validacao
    #                  → se não requer: fecha direto
    if "confirmado_cliente" in update and update["confirmado_cliente"]:
        t.confirmado_cliente = True
        if t.requer_validacao:
            t.status = models.StatusTarefa.aguard_valid
        else:
            t.status = models.StatusTarefa.concluida
            t.data_conclusao = datetime.now(timezone.utc)
            t.percentual = 100.0
        db.commit()
        recalcular_fase(t.fase, db)
        db.refresh(t)
        return t

    # Consultor/Admin valida (muda de aguard_validacao → concluida)
    if "status" in update and update["status"] == models.StatusTarefa.concluida:
        if usuario.perfil == "cliente":
            raise HTTPException(status_code=403, detail="Cliente não pode concluir diretamente. Use confirmar.")
        t.data_conclusao = datetime.now(timezone.utc)
        t.percentual = 100.0

    if "status" in update and update["status"] == models.StatusTarefa.em_andamento:
        if not t.data_inicio:
            t.data_inicio = datetime.now(timezone.utc)

    for k, v in update.items():
        setattr(t, k, v)

    db.commit()
    recalcular_fase(t.fase, db)
    db.refresh(t)
    status_novo = update.get("status", t.status)
    log(db, usuario.id, "Tarefa atualizada",
        f'"{t.nome}" → {status_novo}', projeto_id=t.fase.projeto_id)
    return t

@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "ger_projeto"))):
    t = db.query(models.Tarefa).get(id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    fase = t.fase
    db.delete(t); db.commit()
    recalcular_fase(fase, db)
    return {"ok": True}

@router.post("/{id}/comentarios", response_model=schemas.ComentarioOut)
def comentar(id: int, data: schemas.ComentarioCreate, db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    t = db.query(models.Tarefa).get(id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    c = models.Comentario(tarefa_id=id, autor_id=usuario.id, texto=data.texto)
    db.add(c); db.commit(); db.refresh(c)
    return c

@router.get("/{id}/comentarios", response_model=List[schemas.ComentarioOut])
def listar_comentarios(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.Comentario).filter(
        models.Comentario.tarefa_id == id
    ).order_by(models.Comentario.criado_em).all()

@router.get("/{id}/responsaveis", response_model=List[schemas.ResponsavelTarefaOut])
def listar_responsaveis(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.ResponsavelTarefa).filter(
        models.ResponsavelTarefa.tarefa_id == id
    ).order_by(models.ResponsavelTarefa.id).all()

@router.post("/{id}/responsaveis", response_model=schemas.ResponsavelTarefaOut)
def adicionar_responsavel(id: int, data: schemas.ResponsavelTarefaCreate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    t = db.query(models.Tarefa).get(id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    resp = models.ResponsavelTarefa(tarefa_id=id, **data.model_dump())
    db.add(resp); db.commit(); db.refresh(resp)
    return resp

@router.delete("/{id}/responsaveis/{resp_id}")
def remover_responsavel(id: int, resp_id: int, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    resp = db.query(models.ResponsavelTarefa).filter(
        models.ResponsavelTarefa.id == resp_id,
        models.ResponsavelTarefa.tarefa_id == id
    ).first()
    if not resp:
        raise HTTPException(status_code=404, detail="Responsável não encontrado")
    db.delete(resp); db.commit()
    return {"ok": True}
