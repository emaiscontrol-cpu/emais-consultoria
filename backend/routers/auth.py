from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import hash_senha, verificar_senha, criar_token, get_usuario_atual
import models, schemas

router = APIRouter()

@router.post("/login", response_model=schemas.Token)
def login(req: schemas.LoginRequest, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.email == req.email).first()
    if not usuario or not verificar_senha(req.senha, usuario.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos")
    if not usuario.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta desativada. Entre em contato com o administrador.")
    token = criar_token({"sub": usuario.email, "perfil": usuario.perfil})
    return {"access_token": token, "token_type": "bearer", "usuario": usuario}

@router.get("/me", response_model=schemas.UsuarioOut)
def me(usuario = Depends(get_usuario_atual)):
    return usuario

@router.put("/senha")
def alterar_senha(req: schemas.AlterarSenha, usuario=Depends(get_usuario_atual), db: Session = Depends(get_db)):
    if not verificar_senha(req.senha_atual, usuario.senha_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    usuario.senha_hash = hash_senha(req.nova_senha)
    db.commit()
    return {"ok": True}
