from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import SessionLocal
from auth import get_usuario_atual
import models
import uuid
from pathlib import Path

router = APIRouter()

import os as _os
UPLOADS_DIR = Path(_os.getenv("UPLOADS_DIR", str(Path(__file__).parent.parent / "uploads")))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def _so_consultor(usuario):
    if usuario.perfil not in ("admin", "consultor"):
        raise HTTPException(403, "Acesso restrito a consultores")

def _fmt(a: models.Arquivo) -> dict:
    return {
        "id": a.id,
        "nome_original": a.nome_original,
        "tamanho": a.tamanho,
        "tipo_mime": a.tipo_mime or "application/octet-stream",
        "criado_em": a.criado_em.isoformat() if a.criado_em else None,
        "enviado_por": a.enviado_por.nome if a.enviado_por else None,
    }


@router.get("/cliente/{cliente_id}")
def listar(cliente_id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    _so_consultor(usuario)
    arquivos = (
        db.query(models.Arquivo)
        .filter(models.Arquivo.cliente_id == cliente_id)
        .order_by(models.Arquivo.criado_em.desc())
        .all()
    )
    return [_fmt(a) for a in arquivos]


@router.post("/cliente/{cliente_id}", status_code=201)
def upload(
    cliente_id: int,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    _so_consultor(usuario)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(arquivo.filename).suffix
    nome_disco = f"{uuid.uuid4().hex}{ext}"
    conteudo = arquivo.file.read()
    (UPLOADS_DIR / nome_disco).write_bytes(conteudo)
    registro = models.Arquivo(
        cliente_id=cliente_id,
        nome_original=arquivo.filename,
        nome_arquivo=nome_disco,
        tamanho=len(conteudo),
        tipo_mime=arquivo.content_type,
        enviado_por_id=usuario.id,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)
    return _fmt(registro)


@router.get("/{arquivo_id}/download")
def download(arquivo_id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    _so_consultor(usuario)
    a = db.query(models.Arquivo).filter(models.Arquivo.id == arquivo_id).first()
    if not a:
        raise HTTPException(404, "Arquivo não encontrado")
    caminho = UPLOADS_DIR / a.nome_arquivo
    if not caminho.exists():
        raise HTTPException(404, "Arquivo não encontrado no servidor")
    return FileResponse(
        path=str(caminho),
        filename=a.nome_original,
        media_type=a.tipo_mime or "application/octet-stream",
    )


@router.delete("/{arquivo_id}")
def deletar(arquivo_id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    _so_consultor(usuario)
    a = db.query(models.Arquivo).filter(models.Arquivo.id == arquivo_id).first()
    if not a:
        raise HTTPException(404, "Arquivo não encontrado")
    caminho = UPLOADS_DIR / a.nome_arquivo
    if caminho.exists():
        caminho.unlink()
    db.delete(a)
    db.commit()
    return {"ok": True}
