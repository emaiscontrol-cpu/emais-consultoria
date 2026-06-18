import re
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


def notificar_mencoes(db: Session, texto: str, autor, mensagem: str, projeto_id: int = None):
    """Detecta @Nome no texto e cria NotificacaoMencao para cada usuário citado."""
    nomes = set(re.findall(r'@(\w+)', texto))
    for nome in nomes:
        alvo = db.query(models.Usuario).filter(
            models.Usuario.nome.ilike(f"{nome}%"),
            models.Usuario.ativo == True,
        ).first()
        if alvo and alvo.id != autor.id:
            db.add(models.NotificacaoMencao(
                usuario_destino_id=alvo.id,
                de_usuario_id=autor.id,
                mensagem=mensagem,
                projeto_id=projeto_id,
            ))
    db.commit()
