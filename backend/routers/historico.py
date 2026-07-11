from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from security import get_usuario_atual
import models, schemas

router = APIRouter()


@router.get("/")
def listar(
    projeto_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    q = db.query(models.LogAtividade).order_by(models.LogAtividade.criado_em.desc())
    if projeto_id:
        q = q.filter(models.LogAtividade.projeto_id == projeto_id)
    return [
        {
            "id": lg.id,
            "acao": lg.acao,
            "descricao": lg.descricao,
            "criado_em": lg.criado_em,
            "usuario_nome": lg.usuario.nome if lg.usuario else "",
            "projeto_nome": lg.projeto.nome if lg.projeto else "",
        }
        for lg in q.offset(skip).limit(min(limit, 500)).all()
    ]


@router.get("/tarefa/{tarefa_id}")
def por_tarefa(
    tarefa_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    """Histórico detalhado de alterações de uma tarefa específica (UX-7)."""
    logs = (
        db.query(models.LogTarefa)
        .filter(models.LogTarefa.tarefa_id == tarefa_id)
        .order_by(models.LogTarefa.criado_em.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": lg.id,
            "campo": lg.campo,
            "valor_antes": lg.valor_antes,
            "valor_depois": lg.valor_depois,
            "criado_em": lg.criado_em,
            "usuario_nome": lg.usuario.nome if lg.usuario else "",
        }
        for lg in logs
    ]
