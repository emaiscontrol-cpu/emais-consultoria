from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from auth import get_usuario_atual
from helpers import notificar_mencoes
import models

router = APIRouter()


class MensagemIn(BaseModel):
    texto: str


@router.get("/projeto/{projeto_id}/nao-lidas")
def nao_lidas(
    projeto_id: int,
    desde: str = None,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    q = db.query(func.count(models.MensagemChat.id)).filter(
        models.MensagemChat.projeto_id == projeto_id,
        models.MensagemChat.autor_id != usuario.id,
    )
    if desde:
        try:
            dt = datetime.fromisoformat(desde.replace('Z', '+00:00'))
            q = q.filter(models.MensagemChat.criado_em > dt)
        except Exception:
            pass
    return {"count": q.scalar() or 0}


@router.get("/projeto/{projeto_id}")
def listar(
    projeto_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    msgs = (
        db.query(models.MensagemChat)
        .filter(models.MensagemChat.projeto_id == projeto_id)
        .order_by(models.MensagemChat.criado_em.asc())
        .limit(200)
        .all()
    )
    return [
        {
            "id": m.id,
            "texto": m.texto,
            "criado_em": m.criado_em,
            "autor_id": m.autor_id,
            "autor_nome": m.autor.nome,
            "autor_foto": m.autor.foto,
        }
        for m in msgs
    ]


@router.post("/projeto/{projeto_id}", status_code=201)
def enviar(
    projeto_id: int,
    body: MensagemIn,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    if not body.texto.strip():
        return {}
    projeto = db.query(models.Projeto).get(projeto_id)
    msg = models.MensagemChat(
        projeto_id=projeto_id,
        autor_id=usuario.id,
        texto=body.texto.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    if '@' in body.texto:
        nome_projeto = projeto.nome if projeto else f"projeto {projeto_id}"
        notificar_mencoes(db, body.texto, usuario,
            f'{usuario.nome} mencionou você no chat do projeto "{nome_projeto}"',
            projeto_id=projeto_id)
    return {
        "id": msg.id,
        "texto": msg.texto,
        "criado_em": msg.criado_em,
        "autor_id": usuario.id,
        "autor_nome": usuario.nome,
        "autor_foto": usuario.foto,
    }
