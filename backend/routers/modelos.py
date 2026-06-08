from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone, timedelta
from database import get_db
from auth import get_usuario_atual, requer_perfil
import models, schemas

router = APIRouter()


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _to_detalhe(m: models.ModeloProjeto) -> schemas.ModeloDetalhe:
    return schemas.ModeloDetalhe(
        id=m.id, nome=m.nome, descricao=m.descricao,
        total_fases=len(m.fases),
        total_tarefas=sum(len(f.tarefas) for f in m.fases),
        fases=[
            schemas.ModeloFaseOut(
                id=f.id, modelo_id=f.modelo_id, nome=f.nome,
                ordem=f.ordem, perc_desbloqueio=f.perc_desbloqueio,
                duracao_dias=f.duracao_dias,
                tarefas=[
                    schemas.ModeloTarefaOut(
                        id=t.id, fase_id=t.fase_id, nome=t.nome,
                        descricao=t.descricao, ordem=t.ordem,
                        requer_validacao=t.requer_validacao,
                        duracao_dias=t.duracao_dias,
                    )
                    for t in sorted(f.tarefas, key=lambda x: x.ordem)
                ]
            )
            for f in sorted(m.fases, key=lambda x: x.ordem)
        ]
    )


# ── MODELOS (CRUD) ────────────────────────────────────────────────────────────

@router.get("/", response_model=List[schemas.ModeloOut])
def listar(db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    modelos = db.query(models.ModeloProjeto).all()
    return [
        schemas.ModeloOut(
            id=m.id, nome=m.nome, descricao=m.descricao,
            total_fases=len(m.fases),
            total_tarefas=sum(len(f.tarefas) for f in m.fases),
        )
        for m in modelos
    ]

@router.post("/", response_model=schemas.ModeloDetalhe)
def criar(data: schemas.ModeloCreate, db: Session = Depends(get_db),
          _=Depends(requer_perfil("admin", "consultor"))):
    m = models.ModeloProjeto(**data.model_dump())
    db.add(m); db.commit(); db.refresh(m)
    return _to_detalhe(m)

@router.get("/{modelo_id}", response_model=schemas.ModeloDetalhe)
def detalhe(modelo_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    m = db.query(models.ModeloProjeto).get(modelo_id)
    if not m:
        raise HTTPException(404, "Modelo não encontrado")
    return _to_detalhe(m)

@router.put("/{modelo_id}", response_model=schemas.ModeloDetalhe)
def atualizar(modelo_id: int, data: schemas.ModeloCreate, db: Session = Depends(get_db),
              _=Depends(requer_perfil("admin", "consultor"))):
    m = db.query(models.ModeloProjeto).get(modelo_id)
    if not m:
        raise HTTPException(404, "Modelo não encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return _to_detalhe(m)

@router.delete("/{modelo_id}")
def deletar(modelo_id: int, db: Session = Depends(get_db),
            _=Depends(requer_perfil("admin"))):
    m = db.query(models.ModeloProjeto).get(modelo_id)
    if not m:
        raise HTTPException(404, "Modelo não encontrado")
    db.delete(m); db.commit()
    return {"ok": True}


# ── FASES DO MODELO ───────────────────────────────────────────────────────────

@router.post("/{modelo_id}/fases", response_model=schemas.ModeloDetalhe)
def criar_fase(modelo_id: int, data: schemas.ModeloFaseCreate, db: Session = Depends(get_db),
               _=Depends(requer_perfil("admin", "consultor"))):
    m = db.query(models.ModeloProjeto).get(modelo_id)
    if not m:
        raise HTTPException(404, "Modelo não encontrado")
    f = models.ModeloFase(modelo_id=modelo_id, **data.model_dump())
    db.add(f); db.commit(); db.refresh(m)
    return _to_detalhe(m)

@router.put("/{modelo_id}/fases/{fase_id}", response_model=schemas.ModeloDetalhe)
def atualizar_fase(modelo_id: int, fase_id: int, data: schemas.ModeloFaseCreate,
                   db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    f = db.query(models.ModeloFase).filter(
        models.ModeloFase.id == fase_id,
        models.ModeloFase.modelo_id == modelo_id
    ).first()
    if not f:
        raise HTTPException(404, "Fase não encontrada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    db.commit()
    return _to_detalhe(db.query(models.ModeloProjeto).get(modelo_id))

@router.delete("/{modelo_id}/fases/{fase_id}", response_model=schemas.ModeloDetalhe)
def deletar_fase(modelo_id: int, fase_id: int, db: Session = Depends(get_db),
                 _=Depends(requer_perfil("admin", "consultor"))):
    f = db.query(models.ModeloFase).filter(
        models.ModeloFase.id == fase_id,
        models.ModeloFase.modelo_id == modelo_id
    ).first()
    if not f:
        raise HTTPException(404, "Fase não encontrada")
    db.delete(f); db.commit()
    return _to_detalhe(db.query(models.ModeloProjeto).get(modelo_id))


# ── TAREFAS DA FASE ───────────────────────────────────────────────────────────

@router.post("/{modelo_id}/fases/{fase_id}/tarefas", response_model=schemas.ModeloDetalhe)
def criar_tarefa(modelo_id: int, fase_id: int, data: schemas.ModeloTarefaCreate,
                 db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    f = db.query(models.ModeloFase).filter(
        models.ModeloFase.id == fase_id,
        models.ModeloFase.modelo_id == modelo_id
    ).first()
    if not f:
        raise HTTPException(404, "Fase não encontrada")
    t = models.ModeloTarefa(fase_id=fase_id, **data.model_dump())
    db.add(t); db.commit()
    return _to_detalhe(db.query(models.ModeloProjeto).get(modelo_id))

@router.put("/{modelo_id}/fases/{fase_id}/tarefas/{tarefa_id}", response_model=schemas.ModeloDetalhe)
def atualizar_tarefa(modelo_id: int, fase_id: int, tarefa_id: int, data: schemas.ModeloTarefaCreate,
                     db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    t = db.query(models.ModeloTarefa).filter(
        models.ModeloTarefa.id == tarefa_id,
        models.ModeloTarefa.fase_id == fase_id
    ).first()
    if not t:
        raise HTTPException(404, "Tarefa não encontrada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    db.commit()
    return _to_detalhe(db.query(models.ModeloProjeto).get(modelo_id))

@router.delete("/{modelo_id}/fases/{fase_id}/tarefas/{tarefa_id}", response_model=schemas.ModeloDetalhe)
def deletar_tarefa(modelo_id: int, fase_id: int, tarefa_id: int,
                   db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    t = db.query(models.ModeloTarefa).filter(
        models.ModeloTarefa.id == tarefa_id,
        models.ModeloTarefa.fase_id == fase_id
    ).first()
    if not t:
        raise HTTPException(404, "Tarefa não encontrada")
    db.delete(t); db.commit()
    return _to_detalhe(db.query(models.ModeloProjeto).get(modelo_id))


# ── APLICAR TEMPLATE A PROJETO ────────────────────────────────────────────────

@router.post("/aplicar/{modelo_id}/projeto/{projeto_id}")
def aplicar(modelo_id: int, projeto_id: int, db: Session = Depends(get_db),
            _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    modelo = db.query(models.ModeloProjeto).get(modelo_id)
    if not modelo:
        raise HTTPException(404, "Modelo não encontrado")
    projeto = db.query(models.Projeto).get(projeto_id)
    if not projeto:
        raise HTTPException(404, "Projeto não encontrado")
    if projeto.fases:
        raise HTTPException(400, "Projeto já possui fases. Remova-as antes de aplicar um template.")

    data_base = projeto.data_inicio or datetime.now(timezone.utc)
    offset_dias = 0
    fases_ordenadas = sorted(modelo.fases, key=lambda x: x.ordem)

    for idx, mf in enumerate(fases_ordenadas):
        data_inicio_fase = data_base + timedelta(days=offset_dias)
        duracao_fase = mf.duracao_dias or 0
        data_fim_fase = data_inicio_fase + timedelta(days=duracao_fase) if duracao_fase else None

        fase = models.Fase(
            projeto_id=projeto_id,
            nome=mf.nome,
            ordem=mf.ordem,
            perc_desbloqueio=mf.perc_desbloqueio,
            bloqueado_por_anterior=True,
            status=models.StatusFase.pendente if idx == 0 else models.StatusFase.bloqueada,
            data_inicio=data_inicio_fase if projeto.data_inicio else None,
            data_fim_prev=data_fim_fase if projeto.data_inicio else None,
        )
        db.add(fase)
        db.flush()

        offset_tarefa = 0
        for mt in sorted(mf.tarefas, key=lambda x: x.ordem):
            duracao_t = mt.duracao_dias or 0
            data_prazo_t = None
            if projeto.data_inicio and duracao_t:
                data_prazo_t = data_inicio_fase + timedelta(days=offset_tarefa + duracao_t)

            tarefa = models.Tarefa(
                fase_id=fase.id,
                nome=mt.nome,
                descricao=mt.descricao,
                ordem=mt.ordem,
                requer_validacao=mt.requer_validacao,
                data_prazo=data_prazo_t,
            )
            db.add(tarefa)
            offset_tarefa += duracao_t

        offset_dias += duracao_fase

    db.commit()
    return {"ok": True, "fases_criadas": len(fases_ordenadas)}
