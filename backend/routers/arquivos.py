import re as _re
import os as _os
import uuid
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from database import SessionLocal
from auth import get_usuario_atual
import models

router = APIRouter()

# ── Supabase Storage config ───────────────────────────────────────────────────
_DB_URL = _os.getenv('DATABASE_URL', '')
_m = _re.search(r'@db\.([a-z0-9]+)\.supabase\.co', _DB_URL)
SUPABASE_URL = _os.getenv('SUPABASE_URL', f"https://{_m.group(1)}.supabase.co" if _m else '')
SUPABASE_SERVICE_KEY = _os.getenv('SUPABASE_SERVICE_KEY', '')
BUCKET = 'arquivos-clientes'


def _storage_headers(extra: dict | None = None) -> dict:
    if not SUPABASE_SERVICE_KEY:
        raise HTTPException(503, "SUPABASE_SERVICE_KEY não configurada no servidor")
    h = {'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}', 'apikey': SUPABASE_SERVICE_KEY}
    if extra:
        h.update(extra)
    return h


async def _storage_upload(path: str, content: bytes, mime: str) -> None:
    headers = _storage_headers({'Content-Type': mime or 'application/octet-stream'})
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
                         headers=headers, content=content)
    if r.status_code not in (200, 201):
        raise HTTPException(502, f"Erro ao salvar arquivo no Storage: {r.text[:200]}")


async def _storage_signed_url(path: str, expires: int = 3600) -> str:
    headers = _storage_headers({'Content-Type': 'application/json'})
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}",
            headers=headers,
            json={'expiresIn': expires},
        )
    if r.status_code != 200:
        raise HTTPException(502, f"Erro ao gerar URL assinada: {r.text[:200]}")
    signed = r.json().get('signedURL', '')
    return signed if signed.startswith('http') else f"{SUPABASE_URL}/storage/v1{signed}"


async def _storage_delete(path: str) -> None:
    headers = _storage_headers({'Content-Type': 'application/json'})
    async with httpx.AsyncClient(timeout=15) as c:
        await c.request(
            'DELETE',
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}",
            headers=headers,
            json={'prefixes': [path]},
        )


# ── Helpers ───────────────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _so_consultor(usuario):
    if usuario.perfil not in ('admin', 'consultor'):
        raise HTTPException(403, 'Acesso restrito a consultores')


def _is_storage(nome_arquivo: str) -> bool:
    """Retorna True se o arquivo está no Supabase Storage (caminho novo)."""
    return bool(nome_arquivo and nome_arquivo.startswith('clientes/'))


def _fmt(a: models.Arquivo) -> dict:
    return {
        'id': a.id,
        'nome_original': a.nome_original,
        'tamanho': a.tamanho,
        'tipo_mime': a.tipo_mime or 'application/octet-stream',
        'criado_em': a.criado_em.isoformat() if a.criado_em else None,
        'enviado_por': a.enviado_por.nome if a.enviado_por else None,
        'disponivel': _is_storage(a.nome_arquivo),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.get('/cliente/{cliente_id}')
def listar(cliente_id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    _so_consultor(usuario)
    arquivos = (
        db.query(models.Arquivo)
        .filter(models.Arquivo.cliente_id == cliente_id)
        .order_by(models.Arquivo.criado_em.desc())
        .all()
    )
    return [_fmt(a) for a in arquivos]


@router.post('/cliente/{cliente_id}', status_code=201)
async def upload(
    cliente_id: int,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    _so_consultor(usuario)
    conteudo = await arquivo.read()
    ext = Path(arquivo.filename).suffix
    nome_disco = f"clientes/{cliente_id}/{uuid.uuid4().hex}{ext}"
    await _storage_upload(nome_disco, conteudo, arquivo.content_type)
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


@router.get('/{arquivo_id}/download')
async def download(arquivo_id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    _so_consultor(usuario)
    a = db.query(models.Arquivo).filter(models.Arquivo.id == arquivo_id).first()
    if not a:
        raise HTTPException(404, 'Arquivo não encontrado')
    if not _is_storage(a.nome_arquivo):
        raise HTTPException(410, 'Arquivo não disponível — reenvie o documento')
    url = await _storage_signed_url(a.nome_arquivo)
    return {'url': url, 'nome': a.nome_original}


@router.delete('/{arquivo_id}')
async def deletar(arquivo_id: int, db: Session = Depends(get_db), usuario=Depends(get_usuario_atual)):
    _so_consultor(usuario)
    a = db.query(models.Arquivo).filter(models.Arquivo.id == arquivo_id).first()
    if not a:
        raise HTTPException(404, 'Arquivo não encontrado')
    if _is_storage(a.nome_arquivo):
        await _storage_delete(a.nome_arquivo)
    db.delete(a)
    db.commit()
    return {'ok': True}
