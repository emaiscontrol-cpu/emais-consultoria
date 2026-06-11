"""
Endpoints de importação de Plano de Contas.
Prefixo: /api/plano
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from database import SessionLocal
from models import ImportLayout
from auth import get_usuario_atual
from plano_parser import parse_plano_xlsx, preview_contas
from plano_import_service import importar_plano

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/importar/preview")
async def preview_plano(
    arquivo: UploadFile = File(...),
    layout_id: int = Query(...),
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    """Analisa o arquivo XLSX e retorna resumo + preview sem salvar."""
    layout = db.query(ImportLayout).filter(ImportLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(404, "Layout não encontrado")

    content = await arquivo.read()
    try:
        resultado = parse_plano_xlsx(content, layout)
    except Exception as e:
        raise HTTPException(400, f"Erro ao ler arquivo: {e}")

    resultado["preview"] = preview_contas(resultado["contas"], n=15)
    return resultado


@router.post("/importar")
async def importar(
    arquivo: UploadFile = File(...),
    layout_id: int = Query(...),
    cliente_id: int = Query(...),
    modo: str = Query("ATUALIZAR"),  # NOVO | ATUALIZAR | MESCLAR
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    """Importa o XLSX para o plano de contas do cliente."""
    if modo not in ("NOVO", "ATUALIZAR", "MESCLAR"):
        raise HTTPException(400, "modo deve ser NOVO, ATUALIZAR ou MESCLAR")

    layout = db.query(ImportLayout).filter(ImportLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(404, "Layout não encontrado")

    content = await arquivo.read()
    try:
        parsed = parse_plano_xlsx(content, layout)
        resultado = importar_plano(parsed["contas"], cliente_id, modo, db)
        resultado["parse_resumo"] = parsed["resumo"]
        resultado["parse_erros"] = parsed["erros"]
        resultado["parse_ignoradas"] = parsed["ignoradas"]
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Erro interno: {e}")

    return resultado
