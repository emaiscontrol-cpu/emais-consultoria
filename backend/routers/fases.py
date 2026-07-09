from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from database import get_db
from security import get_usuario_atual, requer_perfil
import models, schemas

router = APIRouter()


def recalcular_fase(fase: models.Fase, db: Session):
    """Recalcula progresso da fase e decide se desbloqueia a próxima."""
    tarefas = fase.tarefas
    ativas = [t for t in tarefas if getattr(t, 'ativo', True)]
    if not ativas:
        fase.progresso = 0.0
        db.commit()
        return

    concluidas = [t for t in ativas if t.status == models.StatusTarefa.concluida]
    fase.progresso = round(len(concluidas) / len(ativas) * 100, 1)

    if fase.progresso >= 100:
        fase.status = models.StatusFase.concluida
    elif fase.progresso > 0:
        fase.status = models.StatusFase.em_andamento
    db.commit()

    # Desbloquear próxima fase se atingiu % mínima
    if fase.progresso >= fase.perc_desbloqueio:
        proxima = db.query(models.Fase).filter(
            models.Fase.projeto_id == fase.projeto_id,
            models.Fase.ordem == fase.ordem + 1
        ).first()
        # Só desbloqueia se a próxima depende da anterior
        if proxima and proxima.status == models.StatusFase.bloqueada and proxima.bloqueado_por_anterior:
            proxima.status = models.StatusFase.pendente
            db.commit()

    # Recalcular progresso do projeto
    projeto = fase.projeto
    fases = projeto.fases
    if fases:
        projeto.progresso = round(sum(f.progresso for f in fases) / len(fases), 1)
        if all(f.status == models.StatusFase.concluida for f in fases):
            projeto.status = models.StatusProjeto.concluido
        elif any(f.status == models.StatusFase.em_andamento for f in fases):
            projeto.status = models.StatusProjeto.em_andamento
        db.commit()


@router.get("/projeto/{projeto_id}", response_model=List[schemas.FaseDetalhe])
def listar_por_projeto(projeto_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.Fase).filter(
        models.Fase.projeto_id == projeto_id,
        models.Fase.ativo == True,
    ).order_by(models.Fase.ordem).all()


@router.get("/{id}", response_model=schemas.FaseDetalhe)
def detalhe(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    f = db.query(models.Fase).get(id)
    if not f:
        raise HTTPException(status_code=404, detail="Fase não encontrada")
    return f


@router.post("/", response_model=schemas.FaseOut)
def criar(data: schemas.FaseCreate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    # Fase livre (bloqueado_por_anterior=False) sempre começa como pendente
    # Primeira fase do projeto também começa como pendente
    eh_primeira = data.ordem == 1 or not db.query(models.Fase).filter(
        models.Fase.projeto_id == data.projeto_id
    ).first()
    livre = not data.bloqueado_por_anterior
    status_inicial = models.StatusFase.pendente if (eh_primeira or livre) else models.StatusFase.bloqueada
    fase = models.Fase(**data.model_dump(), status=status_inicial)
    db.add(fase); db.commit(); db.refresh(fase)
    return fase


@router.put("/{id}", response_model=schemas.FaseOut)
def atualizar(id: int, data: schemas.FaseUpdate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    f = db.query(models.Fase).get(id)
    if not f:
        raise HTTPException(status_code=404, detail="Fase não encontrada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    # Se foi alterado para livre, desbloquear se estava bloqueada
    if data.bloqueado_por_anterior is False and f.status == models.StatusFase.bloqueada:
        f.status = models.StatusFase.pendente
    db.commit(); db.refresh(f)
    return f


@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db), _=Depends(requer_perfil("admin"))):
    f = db.query(models.Fase).get(id)
    if not f:
        raise HTTPException(status_code=404, detail="Fase não encontrada")
    f.ativo = False
    db.commit()
    return {"ok": True}


class ReordenarBody(BaseModel):
    direcao: str  # "up" | "down"


@router.patch("/{fase_id}/ordem")
def reordenar(
    fase_id: int,
    body: ReordenarBody,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    """Troca a ordem de uma fase com sua vizinha (UX-6)."""
    if usuario.perfil not in ("admin", "consultor"):
        raise HTTPException(403, "Sem permissão")
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id, models.Fase.ativo == True).first()
    if not fase:
        raise HTTPException(404)
    fases = (
        db.query(models.Fase)
        .filter(models.Fase.projeto_id == fase.projeto_id, models.Fase.ativo == True)
        .order_by(models.Fase.ordem)
        .all()
    )
    idx = next((i for i, f in enumerate(fases) if f.id == fase_id), None)
    if idx is None:
        raise HTTPException(404)
    if body.direcao == "up" and idx > 0:
        viz = fases[idx - 1]
    elif body.direcao == "down" and idx < len(fases) - 1:
        viz = fases[idx + 1]
    else:
        return {"ok": False}
    fase.ordem, viz.ordem = viz.ordem, fase.ordem
    db.commit()
    return {"ok": True}


# ── Comentários de fase ───────────────────────────────

@router.get("/{id}/comentarios", response_model=List[schemas.ComentarioFaseOut])
def listar_comentarios(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    f = db.query(models.Fase).get(id)
    if not f:
        raise HTTPException(status_code=404, detail="Fase não encontrada")
    return f.comentarios_fase


@router.post("/{id}/comentarios", response_model=schemas.ComentarioFaseOut)
def comentar(id: int, data: schemas.ComentarioFaseCreate, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    f = db.query(models.Fase).get(id)
    if not f:
        raise HTTPException(status_code=404, detail="Fase não encontrada")
    c = models.ComentarioFase(fase_id=id, autor_id=usuario.id, texto=data.texto)
    db.add(c); db.commit(); db.refresh(c)
    return c
