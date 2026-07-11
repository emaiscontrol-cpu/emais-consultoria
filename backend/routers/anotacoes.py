from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import SessionLocal
from models import Anotacao, Cliente
from auth import get_usuario_atual as get_current_user, verificar_tenant

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


def _to_dict(r: Anotacao) -> dict:
    return {
        "id": r.id,
        "usuario": r.autor.nome if r.autor else r.usuario,
        "usuario_id": r.usuario_id,
        "data": r.data.isoformat(),
        "texto": r.texto,
        "criado_em": r.criado_em.isoformat() if r.criado_em else None,
    }


@router.get("/cliente/{cliente_id}")
def listar(cliente_id: int, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    verificar_tenant(usuario, cliente_id)
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")
    rows = (
        db.query(Anotacao)
        .filter(Anotacao.cliente_id == cliente_id)
        .order_by(Anotacao.data.desc(), Anotacao.criado_em.desc())
        .all()
    )
    return [_to_dict(r) for r in rows]


@router.post("/cliente/{cliente_id}", status_code=201)
def criar(cliente_id: int, body: AnotacaoIn, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    verificar_tenant(usuario, cliente_id)
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")
    anotacao = Anotacao(
        cliente_id=cliente_id,
        usuario=usuario.nome,
        usuario_id=usuario.id,
        data=body.data,
        texto=body.texto.strip(),
    )
    db.add(anotacao)
    db.commit()
    db.refresh(anotacao)
    return _to_dict(anotacao)


@router.put("/{anotacao_id}")
def atualizar(anotacao_id: int, body: AnotacaoIn, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    anotacao = db.query(Anotacao).filter(Anotacao.id == anotacao_id).first()
    if not anotacao:
        raise HTTPException(404, "Anotação não encontrada")
    verificar_tenant(usuario, anotacao.cliente_id)
    anotacao.texto = body.texto.strip()
    anotacao.data  = body.data
    db.commit()
    db.refresh(anotacao)
    return _to_dict(anotacao)


@router.delete("/{anotacao_id}")
def deletar(anotacao_id: int, db: Session = Depends(get_db), usuario=Depends(get_current_user)):
    anotacao = db.query(Anotacao).filter(Anotacao.id == anotacao_id).first()
    if not anotacao:
        raise HTTPException(404, "Anotação não encontrada")
    verificar_tenant(usuario, anotacao.cliente_id)
    db.delete(anotacao)
    db.commit()
    return {"removido": anotacao_id}
