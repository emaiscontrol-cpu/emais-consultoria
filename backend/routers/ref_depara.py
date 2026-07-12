from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from database import get_db
from security import requer_perfil, get_usuario_atual, verificar_tenant
import models, schemas
import depara_service

router = APIRouter()


@router.get("/pendencias", response_model=List[dict])
def listar_pendencias(
    cliente_id: int = None,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    """De-Para pendentes de revisão, agrupados por conta_cliente."""
    if cliente_id:
        verificar_tenant(usuario, cliente_id)

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
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    cc = db.get(models.ContaClienteRef, conta_cliente_id)
    if not cc:
        raise HTTPException(404, "Conta do cliente não encontrada")
    verificar_tenant(usuario, cc.cliente_id)
    return depara_service.sugerir(db, cc)


@router.post("/confirmar")
def confirmar(
    req: schemas.DeParaConfirmarRequest,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    """
    Confirma (ou substitui) o De-Para de uma conta do cliente.
    Suporta rateio: múltiplos itens com percentuais somando ≤ 100%.
    """
    cc = db.get(models.ContaClienteRef, req.conta_cliente_id)
    if not cc:
        raise HTTPException(404, "Conta do cliente não encontrada")
    verificar_tenant(usuario, cc.cliente_id)

    soma_perc = sum(i.percentual for i in req.itens)
    if soma_perc > 100.01:
        raise HTTPException(400, f"Soma dos percentuais ({soma_perc:.1f}%) excede 100%")

    vigencia = date(req.vigente_a_partir_ano, req.vigente_a_partir_mes, 1)

    # Não apaga De-Para anteriores — apenas cria novos com a nova vigência
    for item in req.itens:
        cr = db.get(models.ContaReferencial, item.conta_referencial_id)
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

    # Confirmar um vínculo resolve a tratativa — desfaz "ignorada" se estivesse marcada
    cc.ignorada = False
    db.commit()
    return {"ok": True}


@router.get("/cliente/{cliente_id}", response_model=List[dict])
def listar_por_cliente(
    cliente_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    """Todos os De-Para do cliente com status e vigência."""
    verificar_tenant(usuario, cliente_id)

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
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    verificar_tenant(usuario, cliente_id)
    return (
        db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .order_by(models.ContaClienteRef.codigo_origem)
        .all()
    )


# ── Fase B: Preparo DE-PARA ────────────────────────────────────────────────────
# Etapa que roda ANTES da importação de valores: registra o plano de contas do
# cliente e classifica cada conta em auto_vinculada / ambigua / sem_match, usando
# depara_service.classificar (3 camadas) — ver documentos/PROJETO_REFERENCIAL.md.

@router.post("/cliente/{cliente_id}/plano-de-contas", response_model=dict)
def registrar_plano_de_contas(
    cliente_id: int,
    req: schemas.PlanoContasClienteIn,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    """
    Registra o plano de contas do cliente (codigo_origem + descricao_origem) SEM
    depender da importação de lançamentos. Idempotente: contas já existentes
    (mesmo cliente_id + codigo_origem) não são duplicadas nem alteradas.
    """
    verificar_tenant(usuario, cliente_id)

    existentes = {
        cc.codigo_origem
        for cc in db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .all()
    }

    criadas = 0
    for item in req.contas:
        if item.codigo_origem in existentes:
            continue
        db.add(models.ContaClienteRef(
            cliente_id=cliente_id,
            codigo_origem=item.codigo_origem,
            descricao_origem=item.descricao_origem,
        ))
        existentes.add(item.codigo_origem)
        criadas += 1

    db.commit()
    return {"criadas": criadas, "existentes": len(req.contas) - criadas, "total_enviado": len(req.contas)}


@router.post("/cliente/{cliente_id}/preparar", response_model=dict)
def preparar(
    cliente_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    """
    Roda a classificação em 3 camadas para toda conta do cliente ainda não
    resolvida (sem De-Para confirmado e não ignorada). Não grava nada no banco —
    apenas classifica; a gravação acontece quando o usuário resolve a tratativa
    (confirmar / escolher / incluir+vincular / vincular existente / ignorar).
    """
    verificar_tenant(usuario, cliente_id)

    todas = (
        db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .order_by(models.ContaClienteRef.codigo_origem)
        .all()
    )

    def _tem_vinculo_confirmado(cc):
        return any(dp.status == "confirmado" for dp in cc.de_paras)

    resolvidas = 0
    auto_vinculadas, ambiguas, sem_match = [], [], []

    for cc in todas:
        if cc.ignorada or _tem_vinculo_confirmado(cc):
            resolvidas += 1
            continue

        resultado = depara_service.classificar(db, cc)
        item = {
            "conta_cliente_id": cc.id,
            "codigo_origem": cc.codigo_origem,
            "descricao_origem": cc.descricao_origem,
            "candidatos": resultado["candidatos"],
        }
        if resultado["situacao"] == "auto_vinculada":
            item["resolvido_por"] = resultado.get("resolvido_por", "descricao")
            auto_vinculadas.append(item)
        elif resultado["situacao"] == "ambigua":
            ambiguas.append(item)
        else:
            sem_match.append(item)

    total = len(todas)
    return {
        "total": total,
        "resolvidas": resolvidas,
        "auto_vinculadas": auto_vinculadas,
        "ambiguas": ambiguas,
        "sem_match": sem_match,
    }


@router.put("/contas-cliente/{conta_cliente_id}/ignorar", response_model=schemas.ContaClienteRefOut)
def ignorar_conta_cliente(
    conta_cliente_id: int,
    req: schemas.IgnorarContaClienteRequest,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    """Marca (ou desmarca) uma conta do cliente como ignorada — reversível, sem exclusão."""
    cc = db.get(models.ContaClienteRef, conta_cliente_id)
    if not cc:
        raise HTTPException(404, "Conta do cliente não encontrada")
    verificar_tenant(usuario, cc.cliente_id)

    cc.ignorada = req.ignorar
    db.commit()
    db.refresh(cc)
    return cc
