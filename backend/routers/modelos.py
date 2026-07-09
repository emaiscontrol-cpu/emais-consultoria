from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone, timedelta
from database import get_db
from security import get_usuario_atual, requer_perfil
import models, schemas

router = APIRouter()


# ── HELPER ────────────────────────────────────────────────────────────────────

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
                        subtarefas=[
                            schemas.ModeloSubtarefaOut(
                                id=s.id, tarefa_id=s.tarefa_id,
                                nome=s.nome, ordem=s.ordem,
                                duracao_dias=s.duracao_dias,
                            )
                            for s in sorted(t.subtarefas, key=lambda x: x.ordem)
                        ]
                    )
                    for t in sorted(f.tarefas, key=lambda x: x.ordem)
                ]
            )
            for f in sorted(m.fases, key=lambda x: x.ordem)
        ]
    )

def _get_modelo(modelo_id: int, db: Session) -> models.ModeloProjeto:
    m = db.query(models.ModeloProjeto).get(modelo_id)
    if not m:
        raise HTTPException(404, "Modelo não encontrado")
    return m

def _get_fase(modelo_id: int, fase_id: int, db: Session) -> models.ModeloFase:
    f = db.query(models.ModeloFase).filter(
        models.ModeloFase.id == fase_id,
        models.ModeloFase.modelo_id == modelo_id
    ).first()
    if not f:
        raise HTTPException(404, "Fase não encontrada")
    return f

def _get_tarefa(fase_id: int, tarefa_id: int, db: Session) -> models.ModeloTarefa:
    t = db.query(models.ModeloTarefa).filter(
        models.ModeloTarefa.id == tarefa_id,
        models.ModeloTarefa.fase_id == fase_id
    ).first()
    if not t:
        raise HTTPException(404, "Tarefa não encontrada")
    return t


# ── MODELOS (CRUD) ────────────────────────────────────────────────────────────

@router.get("/", response_model=List[schemas.ModeloOut])
def listar(db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return [
        schemas.ModeloOut(
            id=m.id, nome=m.nome, descricao=m.descricao,
            total_fases=len(m.fases),
            total_tarefas=sum(len(f.tarefas) for f in m.fases),
        )
        for m in db.query(models.ModeloProjeto).all()
    ]

@router.post("/", response_model=schemas.ModeloDetalhe)
def criar(data: schemas.ModeloCreate, db: Session = Depends(get_db),
          _=Depends(requer_perfil("admin", "consultor"))):
    m = models.ModeloProjeto(**data.model_dump())
    db.add(m); db.commit(); db.refresh(m)
    return _to_detalhe(m)

@router.get("/{modelo_id}", response_model=schemas.ModeloDetalhe)
def detalhe(modelo_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return _to_detalhe(_get_modelo(modelo_id, db))

@router.put("/{modelo_id}", response_model=schemas.ModeloDetalhe)
def atualizar(modelo_id: int, data: schemas.ModeloCreate, db: Session = Depends(get_db),
              _=Depends(requer_perfil("admin", "consultor"))):
    m = _get_modelo(modelo_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return _to_detalhe(m)

@router.delete("/{modelo_id}")
def deletar(modelo_id: int, db: Session = Depends(get_db),
            _=Depends(requer_perfil("admin"))):
    db.delete(_get_modelo(modelo_id, db)); db.commit()
    return {"ok": True}


# ── FASES ─────────────────────────────────────────────────────────────────────

@router.post("/{modelo_id}/fases", response_model=schemas.ModeloDetalhe)
def criar_fase(modelo_id: int, data: schemas.ModeloFaseCreate, db: Session = Depends(get_db),
               _=Depends(requer_perfil("admin", "consultor"))):
    _get_modelo(modelo_id, db)
    db.add(models.ModeloFase(modelo_id=modelo_id, **data.model_dump()))
    db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))

@router.put("/{modelo_id}/fases/{fase_id}", response_model=schemas.ModeloDetalhe)
def atualizar_fase(modelo_id: int, fase_id: int, data: schemas.ModeloFaseCreate,
                   db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    f = _get_fase(modelo_id, fase_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))

@router.delete("/{modelo_id}/fases/{fase_id}", response_model=schemas.ModeloDetalhe)
def deletar_fase(modelo_id: int, fase_id: int, db: Session = Depends(get_db),
                 _=Depends(requer_perfil("admin", "consultor"))):
    db.delete(_get_fase(modelo_id, fase_id, db)); db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))


# ── TAREFAS ───────────────────────────────────────────────────────────────────

@router.post("/{modelo_id}/fases/{fase_id}/tarefas", response_model=schemas.ModeloDetalhe)
def criar_tarefa(modelo_id: int, fase_id: int, data: schemas.ModeloTarefaCreate,
                 db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    _get_fase(modelo_id, fase_id, db)
    db.add(models.ModeloTarefa(fase_id=fase_id, **data.model_dump()))
    db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))

@router.put("/{modelo_id}/fases/{fase_id}/tarefas/{tarefa_id}", response_model=schemas.ModeloDetalhe)
def atualizar_tarefa(modelo_id: int, fase_id: int, tarefa_id: int, data: schemas.ModeloTarefaCreate,
                     db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    t = _get_tarefa(fase_id, tarefa_id, db)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))

@router.delete("/{modelo_id}/fases/{fase_id}/tarefas/{tarefa_id}", response_model=schemas.ModeloDetalhe)
def deletar_tarefa(modelo_id: int, fase_id: int, tarefa_id: int,
                   db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    db.delete(_get_tarefa(fase_id, tarefa_id, db)); db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))


# ── SUBTAREFAS (ATIVIDADES) ───────────────────────────────────────────────────

@router.post("/{modelo_id}/fases/{fase_id}/tarefas/{tarefa_id}/subtarefas",
             response_model=schemas.ModeloDetalhe)
def criar_subtarefa(modelo_id: int, fase_id: int, tarefa_id: int,
                    data: schemas.ModeloSubtarefaCreate,
                    db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    _get_tarefa(fase_id, tarefa_id, db)
    db.add(models.ModeloSubtarefa(tarefa_id=tarefa_id, **data.model_dump()))
    db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))

@router.put("/{modelo_id}/fases/{fase_id}/tarefas/{tarefa_id}/subtarefas/{sub_id}",
            response_model=schemas.ModeloDetalhe)
def atualizar_subtarefa(modelo_id: int, fase_id: int, tarefa_id: int, sub_id: int,
                        data: schemas.ModeloSubtarefaCreate,
                        db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    s = db.query(models.ModeloSubtarefa).filter(
        models.ModeloSubtarefa.id == sub_id,
        models.ModeloSubtarefa.tarefa_id == tarefa_id
    ).first()
    if not s:
        raise HTTPException(404, "Atividade não encontrada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))

@router.delete("/{modelo_id}/fases/{fase_id}/tarefas/{tarefa_id}/subtarefas/{sub_id}",
               response_model=schemas.ModeloDetalhe)
def deletar_subtarefa(modelo_id: int, fase_id: int, tarefa_id: int, sub_id: int,
                      db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "consultor"))):
    s = db.query(models.ModeloSubtarefa).filter(
        models.ModeloSubtarefa.id == sub_id,
        models.ModeloSubtarefa.tarefa_id == tarefa_id
    ).first()
    if not s:
        raise HTTPException(404, "Atividade não encontrada")
    db.delete(s); db.commit()
    return _to_detalhe(_get_modelo(modelo_id, db))


# ── APLICAR TEMPLATE A PROJETO ────────────────────────────────────────────────

@router.post("/aplicar/{modelo_id}/projeto/{projeto_id}")
def aplicar(modelo_id: int, projeto_id: int, db: Session = Depends(get_db),
            _=Depends(requer_perfil("admin", "consultor", "ger_projeto"))):
    modelo = _get_modelo(modelo_id, db)
    projeto = db.query(models.Projeto).get(projeto_id)
    if not projeto:
        raise HTTPException(404, "Projeto não encontrado")
    if projeto.fases:
        raise HTTPException(400, "Projeto já possui fases. Remova-as antes de aplicar um template.")

    data_base = projeto.data_inicio or datetime.now(timezone.utc)
    offset_fase = 0

    for idx, mf in enumerate(sorted(modelo.fases, key=lambda x: x.ordem)):
        data_inicio_fase = data_base + timedelta(days=offset_fase)
        dur_fase = mf.duracao_dias or 0

        fase = models.Fase(
            projeto_id=projeto_id,
            nome=mf.nome,
            ordem=mf.ordem,
            perc_desbloqueio=mf.perc_desbloqueio,
            bloqueado_por_anterior=True,
            status=models.StatusFase.pendente if idx == 0 else models.StatusFase.bloqueada,
            data_inicio=data_inicio_fase if projeto.data_inicio else None,
            data_fim_prev=(data_inicio_fase + timedelta(days=dur_fase)) if projeto.data_inicio and dur_fase else None,
        )
        db.add(fase)
        db.flush()

        offset_tarefa = 0
        for mt in sorted(mf.tarefas, key=lambda x: x.ordem):
            dur_tar = mt.duracao_dias or 0
            tarefa = models.Tarefa(
                fase_id=fase.id,
                nome=mt.nome,
                descricao=mt.descricao,
                ordem=mt.ordem,
                requer_validacao=mt.requer_validacao,
                data_prazo=(data_inicio_fase + timedelta(days=offset_tarefa + dur_tar))
                           if projeto.data_inicio and dur_tar else None,
            )
            db.add(tarefa)
            db.flush()

            for ms in sorted(mt.subtarefas, key=lambda x: x.ordem):
                dur_sub = ms.duracao_dias or 0
                subtarefa = models.Subtarefa(
                    tarefa_id=tarefa.id,
                    nome=ms.nome,
                    ordem=ms.ordem,
                    data_prazo=(data_inicio_fase + timedelta(days=offset_tarefa + dur_sub))
                               if projeto.data_inicio and dur_sub else None,
                )
                db.add(subtarefa)

            offset_tarefa += dur_tar

        offset_fase += dur_fase

    db.commit()
    return {"ok": True, "fases_criadas": len(modelo.fases)}
