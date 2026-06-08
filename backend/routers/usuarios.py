from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import hash_senha, get_usuario_atual, requer_perfil
import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.UsuarioOut])
def listar(db: Session = Depends(get_db), _=Depends(requer_perfil("admin", "ger_projeto", "consultor"))):
    return db.query(models.Usuario).filter(models.Usuario.ativo == True).all()

@router.post("/", response_model=schemas.UsuarioOut)
def criar(data: schemas.UsuarioCreate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin"))):
    if db.query(models.Usuario).filter(models.Usuario.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    usuario = models.Usuario(
        nome=data.nome, email=data.email,
        senha_hash=hash_senha(data.senha),
        perfil=data.perfil, cliente_id=data.cliente_id
    )
    db.add(usuario); db.commit(); db.refresh(usuario)
    return usuario

@router.put("/{id}", response_model=schemas.UsuarioOut)
def atualizar(id: int, data: schemas.UsuarioUpdate, db: Session = Depends(get_db), _=Depends(requer_perfil("admin"))):
    u = db.query(models.Usuario).get(id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    payload = data.model_dump(exclude_none=True)
    if payload.pop("remover_cliente", False):
        u.cliente_id = None
    for k, v in payload.items():
        if k == "senha":
            u.senha_hash = hash_senha(v)
        else:
            setattr(u, k, v)
    db.commit(); db.refresh(u)
    return u

@router.delete("/{id}")
def excluir(id: int, db: Session = Depends(get_db), atual=Depends(get_usuario_atual), _=Depends(requer_perfil("admin"))):
    if atual.id == id:
        raise HTTPException(status_code=400, detail="Você não pode excluir seu próprio usuário")
    u = db.query(models.Usuario).get(id)
    if not u:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.get("/reset-requests")
def listar_reset_requests(db: Session = Depends(get_db), _=Depends(requer_perfil("admin"))):
    reqs = db.query(models.SolicitacaoReset).order_by(models.SolicitacaoReset.criado_em).all()
    return [
        {
            "id": r.id,
            "usuario_id": r.usuario_id,
            "nome": r.usuario.nome,
            "email": r.usuario.email,
            "criado_em": r.criado_em,
        }
        for r in reqs
    ]


@router.delete("/reset-requests/{req_id}")
def dispensar_reset_request(req_id: int, db: Session = Depends(get_db), _=Depends(requer_perfil("admin"))):
    r = db.query(models.SolicitacaoReset).get(req_id)
    if r:
        db.delete(r); db.commit()
    return {"ok": True}
