from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from auth import get_usuario_atual
import models, schemas

router = APIRouter()


@router.get("/")
def listar(
    projeto_id: Optional[int] = None,
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
        for lg in q.limit(100).all()
    ]
