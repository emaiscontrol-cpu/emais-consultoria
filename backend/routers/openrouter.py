import os
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_usuario_atual

router = APIRouter()

SYSTEM_PROMPT = (
    "Você é um assistente de análise financeira e gerencial. "
    "Recebe dados do sistema E Mais Consultoria (gestão de projetos, DRE, fluxo de caixa, orçamento). "
    "Responda sempre em português, de forma objetiva e estruturada. "
    "Use marcadores e seções quando ajudar na leitura. Limite a 500 palavras."
)

ALLOWED_MODELS = {
    "anthropic/claude-sonnet-4-5",
    "google/gemini-2.0-flash-001",
    "openai/gpt-4o",
    "meta-llama/llama-3.3-70b-instruct",
    "nvidia/llama-3.1-nemotron-70b-instruct",
    "deepseek/deepseek-chat",
}

class OpenRouterRequest(BaseModel):
    titulo: str = ""
    contexto: str
    pergunta: str = ""
    modelo: str = "openai/gpt-4o"

@router.post("/analisar")
async def analisar(req: OpenRouterRequest, usuario=Depends(get_usuario_atual)):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OpenRouter não configurado (OPENROUTER_API_KEY ausente)")

    modelo = req.modelo if req.modelo in ALLOWED_MODELS else "openai/gpt-4o"
    pergunta = req.pergunta.strip() or "Analise os dados e forneça os principais insights, tendências e alertas relevantes."

    payload = {
        "model": modelo,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Tela: {req.titulo}\n\nDados:\n{req.contexto}\n\nPergunta: {pergunta}"},
        ],
        "max_tokens": 1024,
        "temperature": 0.4,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost",
        "X-Title": "Sistema de Analise",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                json=payload, headers=headers,
            )
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="OpenRouter demorou muito. Tente novamente.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erro de conexão com OpenRouter: {str(e)}")

    if resp.status_code != 200:
        try:
            detail = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            detail = resp.text
        raise HTTPException(status_code=502, detail=f"Erro na API OpenRouter: {detail}")

    choices = resp.json().get("choices", [])
    if not choices:
        raise HTTPException(status_code=502, detail="OpenRouter não retornou resposta.")

    texto = choices[0]["message"]["content"]
    return {"resposta": texto, "modelo": modelo}
