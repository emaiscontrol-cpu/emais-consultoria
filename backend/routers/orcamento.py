from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from auth import get_usuario_atual

router = APIRouter()

_GONE = "Módulo de orçamento via plano de contas antigo foi removido. Use /api/ref/demonstrativos"


@router.get("/cliente/{cliente_id}/ano/{ano}")
def obter_orcamento(cliente_id: int, ano: int, db=Depends(get_db), usuario=Depends(get_usuario_atual)):
    raise HTTPException(410, _GONE)


@router.put("/cliente/{cliente_id}/ano/{ano}/item/{item_id}/mes/{mes}")
def salvar_valor(cliente_id: int, ano: int, item_id: int, mes: int, db=Depends(get_db), usuario=Depends(get_usuario_atual)):
    raise HTTPException(410, _GONE)


@router.put("/dre/cliente/{cliente_id}/ano/{ano}/item/{item_id}/mes/{mes}")
def salvar_valor_dre(cliente_id: int, ano: int, item_id: int, mes: int, db=Depends(get_db), usuario=Depends(get_usuario_atual)):
    raise HTTPException(410, _GONE)


@router.get("/cliente/{cliente_id}/ano/{ano}/unidades")
def listar_unidades(cliente_id: int, ano: int, db=Depends(get_db), usuario=Depends(get_usuario_atual)):
    raise HTTPException(410, _GONE)


@router.get("/cliente/{cliente_id}/ano/{ano}/dre")
def obter_dre(cliente_id: int, ano: int, db=Depends(get_db), usuario=Depends(get_usuario_atual)):
    raise HTTPException(410, _GONE)


@router.get("/clientes")
def listar_clientes_com_plano(db=Depends(get_db), usuario=Depends(get_usuario_atual)):
    raise HTTPException(410, _GONE)
