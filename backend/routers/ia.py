import os, json
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from security import get_usuario_atual

router = APIRouter()

ANTHROPIC_URL    = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL  = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
MAX_TOKENS       = int(os.getenv("ANTHROPIC_MAX_TOKENS", "1024"))

SYSTEM_PROMPT = (
    "Você é um assistente de análise financeira e gerencial. "
    "Recebe dados do sistema E Mais Consultoria (gestão de projetos, DRE, fluxo de caixa, orçamento). "
    "Responda sempre em português, de forma objetiva e estruturada. "
    "Use marcadores e seções quando ajudar na leitura. Limite a 500 palavras."
)

class IARequest(BaseModel):
    titulo: str = ""
    contexto: str          # JSON ou texto da tela atual
    pergunta: str = ""     # pergunta opcional do usuário

@router.post("/analisar")
async def analisar(req: IARequest, usuario=Depends(get_usuario_atual)):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="IA não configurada (ANTHROPIC_API_KEY ausente)")

    pergunta = req.pergunta.strip() or "Analise os dados e forneça os principais insights, tendências e alertas relevantes."

    user_msg = f"Tela: {req.titulo}\n\nDados:\n{req.contexto}\n\nPergunta: {pergunta}"

    payload = {
        "model":      ANTHROPIC_MODEL,
        "max_tokens": MAX_TOKENS,
        "system":     SYSTEM_PROMPT,
        "messages":   [{"role": "user", "content": user_msg}],
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                ANTHROPIC_URL,
                headers={
                    "x-api-key":         api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type":      "application/json",
                },
                json=payload,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="IA demorou muito para responder. Tente novamente.")
    except Exception as e:
        logger.exception("Erro ao se conectar à Anthropic/IA")
        raise HTTPException(status_code=502, detail=f"Erro de conexão com a IA: {str(e)}")

    if resp.status_code != 200:
        detail = resp.json().get("error", {}).get("message", resp.text)
        raise HTTPException(status_code=502, detail=f"Erro na API de IA: {detail}")

    texto = resp.json()["content"][0]["text"]
    return {"resposta": texto, "modelo": ANTHROPIC_MODEL}
