from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import requer_perfil, get_usuario_atual
import models, schemas
import depara_service

router = APIRouter()


def _periodo_fechado(db: Session, cliente_id: int, ano: int, mes: int) -> bool:
    return bool(
        db.query(models.PeriodoFechado)
        .filter(models.PeriodoFechado.cliente_id == cliente_id,
                models.PeriodoFechado.ano == ano,
                models.PeriodoFechado.mes == mes)
        .first()
    )


@router.post("/importar", response_model=dict)
def importar(
    req: schemas.LancamentoRefBulkRequest,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    """
    Importa lançamentos em JSON.
    Cria ContaClienteRef para códigos novos e dispara sugestão automática de De-Para.
    """
    # Verifica períodos fechados por competência
    periodos_no_req = {(l.ano, l.mes) for l in req.lancamentos}
    if not req.forcar_periodo_fechado:
        for ano, mes in periodos_no_req:
            if _periodo_fechado(db, req.cliente_id, ano, mes):
                raise HTTPException(
                    400,
                    f"Período {mes:02d}/{ano} está fechado. "
                    "Envie 'forcar_periodo_fechado: true' para reabrir automaticamente."
                )

    criadas = 0
    atualizadas = 0
    novas_contas = 0
    sugestoes_geradas = 0

    for item in req.lancamentos:
        # Garante existência da ContaClienteRef
        cc = (
            db.query(models.ContaClienteRef)
            .filter(models.ContaClienteRef.cliente_id == req.cliente_id,
                    models.ContaClienteRef.codigo_origem == item.codigo_origem)
            .first()
        )
        eh_nova = cc is None
        if eh_nova:
            cc = models.ContaClienteRef(
                cliente_id=req.cliente_id,
                codigo_origem=item.codigo_origem,
                descricao_origem=item.descricao_origem,
            )
            db.add(cc)
            db.flush()
            novas_contas += 1

        # Upsert LancamentoRef (UNIQUE por conta_cliente_id, ano, mes)
        lanc = (
            db.query(models.LancamentoRef)
            .filter(models.LancamentoRef.conta_cliente_id == cc.id,
                    models.LancamentoRef.ano == item.ano,
                    models.LancamentoRef.mes == item.mes)
            .first()
        )
        if lanc:
            lanc.valor = item.valor
            atualizadas += 1
        else:
            db.add(models.LancamentoRef(
                conta_cliente_id=cc.id,
                valor=item.valor,
                ano=item.ano,
                mes=item.mes,
            ))
            criadas += 1

        # Para contas novas, dispara sugestão automática de De-Para
        if eh_nova:
            dp = depara_service.aplicar_automatico(db, cc, item.ano, item.mes)
            if dp:
                sugestoes_geradas += 1

    db.commit()
    return {
        "lancamentos_criados": criadas,
        "lancamentos_atualizados": atualizadas,
        "contas_novas": novas_contas,
        "sugestoes_de_para_geradas": sugestoes_geradas,
    }


@router.get("/cliente/{cliente_id}", response_model=List[schemas.LancamentoRefOut])
def listar(cliente_id: int, ano: int = None, mes: int = None,
           db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    q = (
        db.query(models.LancamentoRef)
        .join(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
    )
    if ano:
        q = q.filter(models.LancamentoRef.ano == ano)
    if mes:
        q = q.filter(models.LancamentoRef.mes == mes)
    return q.all()


@router.delete("/cliente/{cliente_id}/competencia/{ano}/{mes}")
def deletar_competencia(
    cliente_id: int, ano: int, mes: int,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    """Remove todos os lançamentos de uma competência (reabertura de período)."""
    ccs = (
        db.query(models.ContaClienteRef.id)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .subquery()
    )
    deleted = (
        db.query(models.LancamentoRef)
        .filter(models.LancamentoRef.conta_cliente_id.in_(ccs),
                models.LancamentoRef.ano == ano,
                models.LancamentoRef.mes == mes)
        .delete(synchronize_session=False)
    )
    # Remove fechamento se existir
    db.query(models.PeriodoFechado).filter(
        models.PeriodoFechado.cliente_id == cliente_id,
        models.PeriodoFechado.ano == ano,
        models.PeriodoFechado.mes == mes,
    ).delete(synchronize_session=False)
    db.commit()
    return {"lancamentos_removidos": deleted}
