from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from database import get_db
from auth import requer_perfil, get_usuario_atual
import models, schemas
from ref_formula_engine import ordenar_linhas, calcular_linha

router = APIRouter()


def _get_valores_agrupamento(db: Session, cliente_id: int, ano: int, mes: int) -> dict:
    """
    Agrega LancamentoRef por agrupamento da conta referencial ativa na competência.
    Aplica percentual de rateio e natureza (soma/subtrai).
    """
    comp = date(ano, mes, 1)

    ccs = (
        db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .all()
    )

    # Pre-carrega todos os De-Para de uma vez
    cc_ids = [cc.id for cc in ccs]
    todos_dp = (
        db.query(models.DeParaRef)
        .filter(models.DeParaRef.conta_cliente_id.in_(cc_ids),
                models.DeParaRef.vigente_a_partir <= comp)
        .all()
    )

    # Agrupa De-Para por conta_cliente_id → mantém apenas os da vigência mais recente
    dp_por_cc: dict[int, list] = {}
    for dp in todos_dp:
        dp_por_cc.setdefault(dp.conta_cliente_id, []).append(dp)

    def _ativos(lista):
        if not lista:
            return []
        max_data = max(d.vigente_a_partir for d in lista)
        return [d for d in lista if d.vigente_a_partir == max_data]

    # Carrega lançamentos do período
    lancs = (
        db.query(models.LancamentoRef)
        .filter(models.LancamentoRef.conta_cliente_id.in_(cc_ids),
                models.LancamentoRef.ano == ano,
                models.LancamentoRef.mes == mes)
        .all()
    )
    lanc_por_cc = {l.conta_cliente_id: l.valor for l in lancs}

    # Pre-carrega contas referenciais referenciadas
    ref_ids = {dp.conta_referencial_id for lista in dp_por_cc.values() for dp in lista}
    refs = {cr.id: cr for cr in db.query(models.ContaReferencial).filter(
        models.ContaReferencial.id.in_(ref_ids)
    ).all()} if ref_ids else {}

    totais: dict[str, float] = {}

    for cc in ccs:
        valor_bruto = lanc_por_cc.get(cc.id, 0.0)
        if valor_bruto == 0.0:
            continue
        dp_ativos = _ativos(dp_por_cc.get(cc.id, []))
        for dp in dp_ativos:
            cr = refs.get(dp.conta_referencial_id)
            if not cr or not cr.agrupamento:
                continue
            sinal = -1.0 if cr.natureza == "subtrai" else 1.0
            contribuicao = valor_bruto * (dp.percentual / 100.0) * sinal
            totais[cr.agrupamento] = totais.get(cr.agrupamento, 0.0) + contribuicao

    return totais


def _calcular_template(
    db: Session, cliente_id: int, template_id: int, ano: int, mes: int
) -> tuple[list, bool]:
    """Retorna (lista de linhas calculadas, periodo_fechado)."""
    template = db.query(models.TemplateRef).get(template_id)
    if not template:
        raise HTTPException(404, "Template não encontrado")

    periodo_fechado = bool(
        db.query(models.PeriodoFechado)
        .filter(models.PeriodoFechado.cliente_id == cliente_id,
                models.PeriodoFechado.ano == ano,
                models.PeriodoFechado.mes == mes)
        .first()
    )

    val_agr = _get_valores_agrupamento(db, cliente_id, ano, mes)
    val_lin: dict[str, float] = {}
    linhas_ordenadas = ordenar_linhas(list(template.linhas))

    resultado = []
    for linha in linhas_ordenadas:
        valor, tem_dz = calcular_linha(linha.formula_texto or "", val_agr, val_lin)
        val_lin[linha.rotulo] = valor
        resultado.append(schemas.LinhaDemonstrativoOut(
            rotulo=linha.rotulo,
            valor=round(valor, 2),
            negrito_totalizador=linha.negrito_totalizador,
            tem_divisao_por_zero=tem_dz,
        ))

    # Reordena pelo campo `ordem` para exibição (o cálculo foi por dependência)
    ordem_map = {l.rotulo: l.ordem for l in template.linhas}
    resultado.sort(key=lambda r: ordem_map.get(r.rotulo, 9999))

    return resultado, periodo_fechado


@router.get("/cliente/{cliente_id}/template/{template_id}",
            response_model=schemas.DemonstrativoOut)
def calcular(
    cliente_id: int, template_id: int, ano: int, mes: int,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    linhas, fechado = _calcular_template(db, cliente_id, template_id, ano, mes)
    return schemas.DemonstrativoOut(
        cliente_id=cliente_id,
        template_id=template_id,
        ano=ano,
        mes=mes,
        linhas=linhas,
        periodo_fechado=fechado,
    )


@router.get("/cliente/{cliente_id}/comparativo", response_model=schemas.ComparativoOut)
def comparativo(
    cliente_id: int, ano: int, mes: int,
    template_realizado_id: int, template_orcado_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    """Realizado vs Orçado lado a lado com desvio percentual por linha."""
    linhas_real, _ = _calcular_template(db, cliente_id, template_realizado_id, ano, mes)
    linhas_orc, _  = _calcular_template(db, cliente_id, template_orcado_id,  ano, mes)

    map_orc = {l.rotulo: l.valor for l in linhas_orc}
    resultado = []
    for lr in linhas_real:
        orc = map_orc.get(lr.rotulo, 0.0)
        if orc != 0.0:
            desvio = round((lr.valor - orc) / abs(orc) * 100, 2)
        else:
            desvio = None
        resultado.append(schemas.ComparativoLinhaOut(
            rotulo=lr.rotulo,
            realizado=lr.valor,
            orcado=orc,
            desvio_percentual=desvio,
            negrito_totalizador=lr.negrito_totalizador,
        ))
    return schemas.ComparativoOut(cliente_id=cliente_id, ano=ano, mes=mes, linhas=resultado)


@router.post("/cliente/{cliente_id}/periodo/{ano}/{mes}/fechar",
             response_model=schemas.PeriodoFechadoOut)
def fechar_periodo(
    cliente_id: int, ano: int, mes: int,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    existente = (
        db.query(models.PeriodoFechado)
        .filter(models.PeriodoFechado.cliente_id == cliente_id,
                models.PeriodoFechado.ano == ano,
                models.PeriodoFechado.mes == mes)
        .first()
    )
    if existente:
        raise HTTPException(400, f"Período {mes:02d}/{ano} já está fechado")
    pf = models.PeriodoFechado(
        cliente_id=cliente_id, ano=ano, mes=mes, usuario_id=usuario.id
    )
    db.add(pf); db.commit(); db.refresh(pf)
    return pf


@router.delete("/cliente/{cliente_id}/periodo/{ano}/{mes}/reabrir")
def reabrir_periodo(
    cliente_id: int, ano: int, mes: int,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    pf = (
        db.query(models.PeriodoFechado)
        .filter(models.PeriodoFechado.cliente_id == cliente_id,
                models.PeriodoFechado.ano == ano,
                models.PeriodoFechado.mes == mes)
        .first()
    )
    if not pf:
        raise HTTPException(404, "Período não está fechado")
    db.delete(pf); db.commit()
    return {"ok": True}


@router.get("/cliente/{cliente_id}/periodos",
            response_model=List[schemas.PeriodoFechadoOut])
def listar_periodos(
    cliente_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    return (
        db.query(models.PeriodoFechado)
        .filter(models.PeriodoFechado.cliente_id == cliente_id)
        .order_by(models.PeriodoFechado.ano.desc(), models.PeriodoFechado.mes.desc())
        .all()
    )
