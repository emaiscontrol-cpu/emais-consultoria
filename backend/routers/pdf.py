import re
import unicodedata
from datetime import datetime
from io import BytesIO

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from security import get_usuario_atual
from services.pdf_service import gerar_pdf_demonstrativo

router = APIRouter()


class LinhaPdf(BaseModel):
    rotulo: str
    tipo: str = "agrupamento"  # "titulo" | "agrupamento" | "totalizador"
    valores: list = []


class DemonstrativoPdfRequest(BaseModel):
    titulo: str
    cliente_nome: str
    periodo: str
    colunas: list[str]
    linhas: list[LinhaPdf]


def _slug(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    texto = re.sub(r"[^\w]+", "_", texto).strip("_").lower()
    return texto or "demonstrativo"


@router.post("/demonstrativo")
def gerar_demonstrativo_pdf(
    body: DemonstrativoPdfRequest,
    _usuario=Depends(get_usuario_atual),
):
    pdf_bytes = gerar_pdf_demonstrativo(
        titulo=body.titulo,
        cliente_nome=body.cliente_nome,
        periodo=body.periodo,
        linhas=[l.model_dump() for l in body.linhas],
        colunas=body.colunas,
    )
    nome = f"{_slug(body.titulo)}_{_slug(body.cliente_nome)}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={nome}"},
    )
