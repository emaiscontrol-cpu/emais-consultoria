from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from auth import hash_senha, verificar_senha, criar_token, get_usuario_atual
import models, schemas

router = APIRouter()

# ── Rate limiting simples em memória (SEC-3) ──────────────────────────────────
_login_attempts: dict = defaultdict(list)
_MAX_TENTATIVAS = 10
_JANELA_SEG = 60

def _checar_rate_limit(ip: str):
    agora = datetime.utcnow()
    corte = agora - timedelta(seconds=_JANELA_SEG)
    _login_attempts[ip] = [t for t in _login_attempts[ip] if t > corte]
    if len(_login_attempts[ip]) >= _MAX_TENTATIVAS:
        raise HTTPException(429, "Muitas tentativas de login. Aguarde 1 minuto.")
    _login_attempts[ip].append(agora)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.Token)
def login(req: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    _checar_rate_limit(ip)
    from sqlalchemy import func
    usuario = db.query(models.Usuario).filter(func.lower(models.Usuario.email) == req.email.lower()).first()
    if not usuario or not verificar_senha(req.senha, usuario.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha inválidos")
    if not usuario.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta desativada. Entre em contato com o administrador.")
    token = criar_token({"sub": usuario.email, "perfil": usuario.perfil})
    return {"access_token": token, "token_type": "bearer", "usuario": usuario}

@router.get("/me", response_model=schemas.UsuarioOut)
def me(usuario=Depends(get_usuario_atual)):
    return usuario

@router.put("/senha")
def alterar_senha(req: schemas.AlterarSenha, usuario=Depends(get_usuario_atual), db: Session = Depends(get_db)):
    if not verificar_senha(req.senha_atual, usuario.senha_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    usuario.senha_hash = hash_senha(req.nova_senha)
    db.commit()
    return {"ok": True}

class FotoRequest(BaseModel):
    foto: str  # data URL base64

@router.put("/foto", response_model=schemas.UsuarioOut)
def atualizar_foto(req: FotoRequest, usuario=Depends(get_usuario_atual), db: Session = Depends(get_db)):
    if len(req.foto) > 500_000:
        raise HTTPException(status_code=400, detail="Foto muito grande. O limite é 500 KB.")
    usuario.foto = req.foto
    db.commit(); db.refresh(usuario)
    return usuario

@router.post("/refresh", response_model=schemas.Token)
def refresh_token(usuario=Depends(get_usuario_atual)):
    """Renova o token JWT antes de expirar, sem precisar de novo login."""
    token = criar_token({"sub": usuario.email, "perfil": usuario.perfil})
    return {"access_token": token, "token_type": "bearer", "usuario": usuario}


class EsqueciSenhaRequest(BaseModel):
    email: str

@router.post("/esqueci-senha")
def esqueci_senha(req: EsqueciSenhaRequest, db: Session = Depends(get_db)):
    from sqlalchemy import func as sqlfunc
    usuario = db.query(models.Usuario).filter(
        sqlfunc.lower(models.Usuario.email) == req.email.lower(),
        models.Usuario.ativo == True,
    ).first()
    if usuario:
        existente = db.query(models.SolicitacaoReset).filter(
            models.SolicitacaoReset.usuario_id == usuario.id
        ).first()
        if not existente:
            db.add(models.SolicitacaoReset(usuario_id=usuario.id))
            db.commit()
    # Sempre retorna ok — não revela se e-mail existe
    return {"ok": True}
