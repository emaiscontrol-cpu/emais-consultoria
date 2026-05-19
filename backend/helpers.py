from sqlalchemy.orm import Session
import models


def log(db: Session, usuario_id: int, acao: str, descricao: str, projeto_id: int = None):
    entry = models.LogAtividade(
        usuario_id=usuario_id,
        projeto_id=projeto_id,
        acao=acao,
        descricao=descricao,
    )
    db.add(entry)
    db.commit()
