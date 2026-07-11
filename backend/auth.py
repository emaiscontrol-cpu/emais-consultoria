from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db, _is_sqlite
from dotenv import load_dotenv
import models, os

load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "emais-consultoria-secret-2026-change-in-production")
if SECRET_KEY == "emais-consultoria-secret-2026-change-in-production":
    if not _is_sqlite:
        raise RuntimeError(
            "CRITICAL SECURITY ERROR: SECRET_KEY is set to default but database is not SQLite (production environment). "
            "Please configure a secure SECRET_KEY in your .env file."
        )
    print("[AVISO DE SEGURANÇA] SECRET_KEY usando valor padrão inseguro. "
          "Defina SECRET_KEY no arquivo .env antes de usar em produção.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 horas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)

def verificar_senha(senha: str, hash: str) -> bool:
    return pwd_context.verify(senha, hash)

def criar_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_usuario_atual(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    usuario = db.query(models.Usuario).filter(models.Usuario.email == email).first()
    if usuario is None or not usuario.ativo:
        raise credentials_exception
    return usuario

def requer_perfil(*perfis):
    def _check(usuario: models.Usuario = Depends(get_usuario_atual)):
        if usuario.perfil not in perfis:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado para este perfil"
            )
        return usuario
    return _check


def verificar_tenant(usuario, cliente_id: int) -> None:
    """
    Verifica se o usuário possui permissão para acessar os dados do cliente_id especificado.
    Levanta HTTPException 403 se o usuário for restrito (analista, ger_projeto, ti)
    e não possuir o cliente_id correspondente ou se for nulo.
    """
    if usuario.perfil in ("analista", "ger_projeto", "ti"):
        if usuario.cliente_id is None or usuario.cliente_id != cliente_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso negado: este recurso pertence a outro cliente"
            )
