from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
from auth import requer_perfil, get_usuario_atual
import models, schemas
from ref_formula_engine import ordenar_linhas, calcular_linha

router = APIRouter()


def _get_valores_agrupamento(db: Session, cliente_id: int, ano: int, mes: int) -> dict[str, dict[str, float]]:
    """
    Agrega LancamentoRef por agrupamento da conta referencial ativa na competência e por unidade contábil.
    Retorna dicionário { agrupamento_slug: { unidade_codigo: valor, "Consolidado": valor } }
    """
    comp = date(ano, mes, 1)

    ccs = (
        db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .all()
    )

    cc_ids = [cc.id for cc in ccs]
    todos_dp = (
        db.query(models.DeParaRef)
        .filter(models.DeParaRef.conta_cliente_id.in_(cc_ids),
                models.DeParaRef.vigente_a_partir <= comp)
        .all()
    )

    dp_por_cc: dict[int, list] = {}
    for dp in todos_dp:
        dp_por_cc.setdefault(dp.conta_cliente_id, []).append(dp)

    def _ativos(lista):
        if not lista:
            return []
        max_data = max(d.vigente_a_partir for d in lista)
        return [d for d in lista if d.vigente_a_partir == max_data]

    # Carrega lançamentos do período (trazendo código da unidade e valor)
    lancs = (
        db.query(models.LancamentoRef)
        .filter(models.LancamentoRef.conta_cliente_id.in_(cc_ids),
                models.LancamentoRef.ano == ano,
                models.LancamentoRef.mes == mes)
        .all()
    )

    # Pre-carrega contas referenciais
    ref_ids = {dp.conta_referencial_id for lista in dp_por_cc.values() for dp in lista}
    refs = {cr.id: cr for cr in db.query(models.ContaReferencial).filter(
        models.ContaReferencial.id.in_(ref_ids)
    ).all()} if ref_ids else {}

    totais: dict[str, dict[str, float]] = {}

    for l in lancs:
        cc_id = l.conta_cliente_id
        valor_bruto = l.valor
        unidade_cod = l.unidade_codigo or "Consolidado"

        dp_ativos = _ativos(dp_por_cc.get(cc_id, []))
        for dp in dp_ativos:
            cr = refs.get(dp.conta_referencial_id)
            if not cr or not cr.agrupamento:
                continue

            sinal = -1.0 if cr.natureza == "subtrai" else 1.0
            contribuicao = valor_bruto * (dp.percentual / 100.0) * sinal

            # Agrega por unidade específica
            dict_agr = totais.setdefault(cr.agrupamento, {})
            if unidade_cod != "Consolidado":
                dict_agr[unidade_cod] = dict_agr.get(unidade_cod, 0.0) + contribuicao
            
            # Agrega no Consolidado geral
            dict_agr["Consolidado"] = dict_agr.get("Consolidado", 0.0) + contribuicao

    return totais


def _calcular_template(
    db: Session, cliente_id: int, template_id: int, ano: int, mes: int,
    unidade_codigo: Optional[str] = None
) -> tuple[list, bool]:
    """Retorna (lista de linhas calculadas, periodo_fechado)."""
    cliente = db.query(models.Cliente).get(cliente_id)
    if not cliente or not cliente.ativo:
        raise HTTPException(404, "Cliente não encontrado ou inativo")
    if not cliente.modulo_analises_gerenciais:
        raise HTTPException(403, "Este cliente não possui o módulo de análises gerenciais ativo.")

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

    # val_agr: { agrupamento_slug: { unidade_codigo: valor, "Consolidado": valor } }
    val_agr = _get_valores_agrupamento(db, cliente_id, ano, mes)

    # Descobre todas as unidades que possuem dados na competência
    todas_unidades = set()
    for valores in val_agr.values():
        todas_unidades.update(valores.keys())

    if not todas_unidades:
        todas_unidades = {"Consolidado"}
    else:
        todas_unidades.add("Consolidado")

    # Calcula de forma isolada para cada unidade e consolidado
    val_lin_por_unidade: dict[str, dict[str, float]] = {u: {} for u in todas_unidades}
    linhas_ordenadas = ordenar_linhas(list(template.linhas))

    erros_dz_por_linha: dict[str, dict[str, bool]] = {}

    for linha in linhas_ordenadas:
        rotulo = linha.rotulo
        erros_dz_por_linha[rotulo] = {}

        # Determina a fórmula a ser executada. Se for vazia e tiver agrupamento_slug, considera o agrupamento.
        formula = linha.formula_texto
        if not formula and linha.agrupamento_slug:
            formula = f"{{agrupamento:{linha.agrupamento_slug}}}"

        for u in todas_unidades:
            val_agr_u = {agr: valores.get(u, 0.0) for agr, valores in val_agr.items()}
            val_lin_u = val_lin_por_unidade[u]

            valor, tem_dz = calcular_linha(formula or "", val_agr_u, val_lin_u)
            val_lin_u[rotulo] = valor
            erros_dz_por_linha[rotulo][u] = tem_dz

    # Compila resultado para retorno
    resultado = []
    for linha in template.linhas:
        rotulo = linha.rotulo
        
        # Determina o valor a ser focado no campo valor principal
        u_foco = unidade_codigo if (unidade_codigo and unidade_codigo in todas_unidades) else "Consolidado"
        valor_principal = val_lin_por_unidade.get(u_foco, {}).get(rotulo, 0.0)
        tem_dz_principal = erros_dz_por_linha.get(rotulo, {}).get(u_foco, False)

        # Mapa com a abertura de todas as unidades
        valores_unidades = {u: round(val_lin_por_unidade[u].get(rotulo, 0.0), 2) for u in todas_unidades}

        resultado.append(schemas.LinhaDemonstrativoOut(
            rotulo=rotulo,
            valor=round(valor_principal, 2),
            negrito_totalizador=linha.negrito_totalizador,
            tem_divisao_por_zero=tem_dz_principal,
            valores_unidades=valores_unidades
        ))

    # Reordena pelo campo `ordem` para exibição
    ordem_map = {l.rotulo: l.ordem for l in template.linhas}
    resultado.sort(key=lambda r: ordem_map.get(r.rotulo, 9999))

    return resultado, periodo_fechado


@router.get("/cliente/{cliente_id}/template/{template_id}",
            response_model=schemas.DemonstrativoOut)
def calcular(
    cliente_id: int, template_id: int, ano: int, mes: int,
    unidade_codigo: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    linhas, fechado = _calcular_template(db, cliente_id, template_id, ano, mes, unidade_codigo)
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
    unidade_codigo: Optional[str] = None,
    db: Session = Depends(get_db),
    _=Depends(get_usuario_atual),
):
    """Realizado vs Orçado lado a lado com desvio percentual por linha."""
    linhas_real, _ = _calcular_template(db, cliente_id, template_realizado_id, ano, mes, unidade_codigo)
    linhas_orc, _  = _calcular_template(db, cliente_id, template_orcado_id,  ano, mes, unidade_codigo)

    map_orc = {l.rotulo: l.valor for l in linhas_orc}
    resultado = []
    for lr in lines_real:
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
