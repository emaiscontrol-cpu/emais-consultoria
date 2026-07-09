from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from database import get_db
from security import requer_perfil, get_usuario_atual
import models, schemas
import depara_service

router = APIRouter()


@router.get("/pendencias", response_model=List[dict])
def listar_pendencias(
    cliente_id: int = None,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    """De-Para pendentes de revisão, agrupados por conta_cliente."""
    q = (
        db.query(models.DeParaRef)
        .join(models.ContaClienteRef,
              models.DeParaRef.conta_cliente_id == models.ContaClienteRef.id)
        .filter(models.DeParaRef.status == "pendente_revisao")
    )
    if cliente_id:
        q = q.filter(models.ContaClienteRef.cliente_id == cliente_id)

    resultado = []
    for dp in q.all():
        cr = dp.conta_referencial
        cc = dp.conta_cliente
        resultado.append({
            "id": dp.id,
            "conta_cliente_id": cc.id,
            "codigo_origem": cc.codigo_origem,
            "descricao_origem": cc.descricao_origem,
            "cliente_id": cc.cliente_id,
            "conta_referencial_id": cr.id if cr else None,
            "conta_referencial_codigo": cr.codigo if cr else None,
            "conta_referencial_descricao": cr.descricao if cr else None,
            "confianca": dp.confianca,
            "percentual": dp.percentual,
            "origem_vinculo": dp.origem_vinculo,
            "vigente_a_partir": str(dp.vigente_a_partir),
        })
    return resultado


@router.get("/sugestoes/{conta_cliente_id}", response_model=List[schemas.SugestaoDeParaOut])
def sugestoes(
    conta_cliente_id: int,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    cc = db.query(models.ContaClienteRef).get(conta_cliente_id)
    if not cc:
        raise HTTPException(404, "Conta do cliente não encontrada")
    return depara_service.sugerir(db, cc)


@router.post("/confirmar")
def confirmar(
    req: schemas.DeParaConfirmarRequest,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    """
    Confirma (ou substitui) o De-Para de uma conta do cliente.
    Suporta rateio: múltiplos itens com percentuais somando ≤ 100%.
    """
    cc = db.query(models.ContaClienteRef).get(req.conta_cliente_id)
    if not cc:
        raise HTTPException(404, "Conta do cliente não encontrada")

    soma_perc = sum(i.percentual for i in req.itens)
    if soma_perc > 100.01:
        raise HTTPException(400, f"Soma dos percentuais ({soma_perc:.1f}%) excede 100%")

    vigencia = date(req.vigente_a_partir_ano, req.vigente_a_partir_mes, 1)

    # Não apaga De-Para anteriores — apenas cria novos com a nova vigência
    for item in req.itens:
        cr = db.query(models.ContaReferencial).get(item.conta_referencial_id)
        if not cr:
            raise HTTPException(404, f"Conta referencial {item.conta_referencial_id} não encontrada")
        dp = models.DeParaRef(
            conta_cliente_id=cc.id,
            conta_referencial_id=item.conta_referencial_id,
            percentual=item.percentual,
            status="confirmado",
            confianca=1.0,
            origem_vinculo="manual",
            vigente_a_partir=vigencia,
        )
        db.add(dp)

    db.commit()
    return {"ok": True}


@router.get("/cliente/{cliente_id}", response_model=List[dict])
def listar_por_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    """Todos os De-Para do cliente com status e vigência."""
    ccs = (
        db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .all()
    )
    resultado = []
    for cc in ccs:
        for dp in cc.de_paras:
            cr = dp.conta_referencial
            resultado.append({
                "id": dp.id,
                "codigo_origem": cc.codigo_origem,
                "descricao_origem": cc.descricao_origem,
                "conta_referencial_codigo": cr.codigo if cr else None,
                "conta_referencial_descricao": cr.descricao if cr else None,
                "conta_referencial_agrupamento": cr.agrupamento if cr else None,
                "percentual": dp.percentual,
                "status": dp.status,
                "confianca": dp.confianca,
                "origem_vinculo": dp.origem_vinculo,
                "vigente_a_partir": str(dp.vigente_a_partir),
            })
    return resultado


@router.get("/contas-cliente/{cliente_id}", response_model=List[schemas.ContaClienteRefOut])
def listar_contas_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    return (
        db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .order_by(models.ContaClienteRef.codigo_origem)
        .all()
    )
