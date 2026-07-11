import os
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from pydantic import BaseModel
from security import get_usuario_atual

router = APIRouter()

GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

SYSTEM_PROMPT = (
    "Você é um assistente de análise financeira e gerencial. "
    "Recebe dados do sistema E Mais Consultoria (gestão de projetos, DRE, fluxo de caixa, orçamento). "
    "Responda sempre em português, de forma objetiva e estruturada. "
    "Use marcadores e seções quando ajudar na leitura. Limite a 500 palavras."
)

class GeminiRequest(BaseModel):
    titulo: str = ""
    contexto: str
    pergunta: str = ""

@router.post("/analisar")
async def analisar(req: GeminiRequest, usuario=Depends(get_usuario_atual)):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Gemini não configurado (GEMINI_API_KEY ausente)")

    pergunta = req.pergunta.strip() or "Analise os dados e forneça os principais insights, tendências e alertas relevantes."
    user_text = f"Tela: {req.titulo}\n\nDados:\n{req.contexto}\n\nPergunta: {pergunta}"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={api_key}"
    payload = {
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "generationConfig": {"maxOutputTokens": 1024, "temperature": 0.4},
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, json=payload)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Gemini demorou muito. Tente novamente.")
    except Exception as e:
        logger.exception("Erro ao se conectar ao Gemini")
        raise HTTPException(status_code=502, detail=f"Erro de conexão com Gemini: {str(e)}")

    if resp.status_code != 200:
        detail = resp.json().get("error", {}).get("message", resp.text)
        raise HTTPException(status_code=502, detail=f"Erro na API Gemini: {detail}")

    candidates = resp.json().get("candidates", [])
    if not candidates:
        raise HTTPException(status_code=502, detail="Gemini não retornou resposta.")

    texto = candidates[0]["content"]["parts"][0]["text"]
    return {"resposta": texto, "modelo": GEMINI_MODEL}
