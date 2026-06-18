import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from database import get_db
from auth import get_usuario_atual, requer_perfil
from routers.fases import recalcular_fase
from helpers import log, notificar_mencoes
import models, schemas

router = APIRouter()


def _registrar_historico(db, tarefa, usuario_id: int, update: dict):
    """Cria LogTarefa para cada campo alterado."""
    CAMPOS = {
        "nome": "Nome",
        "status": "Status",
        "percentual": "Percentual (%)",
        "responsavel_id": "Responsável",
        "data_prazo": "Prazo",
        "requer_validacao": "Requer validação",
    }
    for campo, label in CAMPOS.items():
        if campo not in update:
            continue
        antes = getattr(tarefa, campo, None)
        depois = update[campo]
        if str(antes) == str(depois):
            continue
        db.add(models.LogTarefa(
            tarefa_id=tarefa.id,
            usuario_id=usuario_id,
            campo=label,
            valor_antes=str(antes) if antes is not None else None,
            valor_depois=str(depois) if depois is not None else None,
        ))


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
def criar(data: schemas.TarefaCreate, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    if usuario.perfil not in ("admin", "consultor", "ger_projeto"):
        fase = db.query(models.Fase).get(data.fase_id)
        if not fase:
            raise HTTPException(status_code=404, detail="Fase não encontrada")
        resp = fase.responsavel
        autorizado = (
            usuario.cliente_id == fase.projeto.cliente_id and
            resp is not None and
            resp.perfil == models.PerfilEnum.ger_projeto
        )
        if not autorizado:
            raise HTTPException(status_code=403, detail="Sem permissão para adicionar tarefas nesta fase")
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
            t.status = models.StatusTarefa.aguard_validacao
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
        if usuario.perfil == "analista":
            raise HTTPException(status_code=403, detail="Analista não pode concluir diretamente. Use confirmar.")
        t.data_conclusao = datetime.now(timezone.utc)
        t.percentual = 100.0

    if "status" in update and update["status"] == models.StatusTarefa.em_andamento:
        if not t.data_inicio:
            t.data_inicio = datetime.now(timezone.utc)

    _registrar_historico(db, t, usuario.id, update)

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


@router.patch("/{tarefa_id}/ordem")
def reordenar(
    tarefa_id: int,
    body: dict,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    """Troca a ordem de uma tarefa com sua vizinha dentro da fase (UX-6)."""
    if usuario.perfil not in ("admin", "consultor", "ger_projeto"):
        raise HTTPException(403, "Sem permissão")
    tarefa = db.query(models.Tarefa).filter(
        models.Tarefa.id == tarefa_id, models.Tarefa.ativo == True
    ).first()
    if not tarefa:
        raise HTTPException(404)
    tarefas = (
        db.query(models.Tarefa)
        .filter(models.Tarefa.fase_id == tarefa.fase_id, models.Tarefa.ativo == True)
        .order_by(models.Tarefa.ordem)
        .all()
    )
    idx = next((i for i, t in enumerate(tarefas) if t.id == tarefa_id), None)
    if idx is None:
        raise HTTPException(404)
    direcao = body.get("direcao")
    if direcao == "up" and idx > 0:
        viz = tarefas[idx - 1]
    elif direcao == "down" and idx < len(tarefas) - 1:
        viz = tarefas[idx + 1]
    else:
        return {"ok": False}
    tarefa.ordem, viz.ordem = viz.ordem, tarefa.ordem
    db.commit()
    return {"ok": True}


@router.post("/{id}/comentarios", response_model=schemas.ComentarioOut)
def comentar(id: int, data: schemas.ComentarioCreate, db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    t = db.query(models.Tarefa).get(id)
    if not t:
        raise HTTPException(status_code=404, detail="Tarefa não encontrada")
    c = models.Comentario(tarefa_id=id, autor_id=usuario.id, texto=data.texto)
    db.add(c); db.commit(); db.refresh(c)

    if '@' in data.texto:
        notificar_mencoes(db, data.texto, usuario,
            f'{usuario.nome} mencionou você no comentário da tarefa "{t.nome}"',
            projeto_id=t.fase.projeto_id if t.fase else None)

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
