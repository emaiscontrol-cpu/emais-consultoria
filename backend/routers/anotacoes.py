from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import SessionLocal
from models import Anotacao, Cliente
from auth import get_usuario_atual as get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AnotacaoIn(BaseModel):
    texto: str
    data: date


@router.get("/cliente/{cliente_id}")
def listar(cliente_id: int, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    # perfis restritos só acessam dados do seu cliente
    if usuario.perfil in ("analista", "ger_projeto", "ti") and usuario.cliente_id and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")
    rows = (
        db.query(Anotacao)
        .filter(Anotacao.cliente_id == cliente_id)
        .order_by(Anotacao.data.desc(), Anotacao.criado_em.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "usuario": r.usuario,
            "data": r.data.isoformat(),
            "texto": r.texto,
            "criado_em": r.criado_em.isoformat() if r.criado_em else None,
        }
        for r in rows
    ]


@router.post("/cliente/{cliente_id}", status_code=201)
def criar(cliente_id: int, body: AnotacaoIn, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")
    anotacao = Anotacao(
        cliente_id=cliente_id,
        usuario=usuario.nome,
        data=body.data,
        texto=body.texto.strip(),
    )
    db.add(anotacao)
    db.commit()
    db.refresh(anotacao)
    return {
        "id": anotacao.id,
        "usuario": anotacao.usuario,
        "data": anotacao.data.isoformat(),
        "texto": anotacao.texto,
        "criado_em": anotacao.criado_em.isoformat() if anotacao.criado_em else None,
    }


@router.put("/{anotacao_id}")
def atualizar(anotacao_id: int, body: AnotacaoIn, db: Session = Depends(get_db), _=Depends(get_current_user)):
    anotacao = db.query(Anotacao).filter(Anotacao.id == anotacao_id).first()
    if not anotacao:
        raise HTTPException(404, "Anotação não encontrada")
    anotacao.texto = body.texto.strip()
    anotacao.data  = body.data
    db.commit()
    db.refresh(anotacao)
    return {
        "id": anotacao.id,
        "usuario": anotacao.usuario,
        "data": anotacao.data.isoformat(),
        "texto": anotacao.texto,
        "criado_em": anotacao.criado_em.isoformat() if anotacao.criado_em else None,
    }


@router.delete("/{anotacao_id}")
def deletar(anotacao_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    anotacao = db.query(Anotacao).filter(Anotacao.id == anotacao_id).first()
    if not anotacao:
        raise HTTPException(404, "Anotação não encontrada")
    db.delete(anotacao)
    db.commit()
    return {"removido": anotacao_id}
