import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_usuario_atual
from models import Bandeira

router = APIRouter()


def _b2dict(b):
    return {"id": b.id, "nome": b.nome, "unidades": json.loads(b.unidades_json or "[]")}


@router.get("/cliente/{cliente_id}")
def listar(cliente_id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    if usuario.perfil == "analista" and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")
    return [_b2dict(b) for b in db.query(Bandeira).filter(Bandeira.cliente_id == cliente_id).all()]


@router.post("/cliente/{cliente_id}", status_code=201)
def criar(cliente_id: int, body: dict, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    if usuario.perfil not in ("admin", "consultor"):
        raise HTTPException(403, "Sem permissão")
    unidades = body.get("unidades", [])
    if not isinstance(unidades, list) or not all(isinstance(u, str) for u in unidades):
        raise HTTPException(400, "unidades deve ser uma lista de strings")
    b = Bandeira(
        cliente_id=cliente_id,
        nome=body["nome"],
        unidades_json=json.dumps(unidades),
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return _b2dict(b)


@router.put("/{bid}")
def atualizar(bid: int, body: dict, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    if usuario.perfil not in ("admin", "consultor"):
        raise HTTPException(403, "Sem permissão")
    b = db.query(Bandeira).filter(Bandeira.id == bid).first()
    if not b:
        raise HTTPException(404)
    if "nome" in body:
        b.nome = body["nome"]
    if "unidades" in body:
        unidades = body["unidades"]
        if not isinstance(unidades, list) or not all(isinstance(u, str) for u in unidades):
            raise HTTPException(400, "unidades deve ser uma lista de strings")
        b.unidades_json = json.dumps(unidades)
    db.commit()
    return _b2dict(b)


@router.delete("/{bid}")
def deletar(bid: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    if usuario.perfil not in ("admin", "consultor"):
        raise HTTPException(403, "Sem permissão")
    b = db.query(Bandeira).filter(Bandeira.id == bid).first()
    if not b:
        raise HTTPException(404)
    db.delete(b)
    db.commit()
    return {"ok": True}
