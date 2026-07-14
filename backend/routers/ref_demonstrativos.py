from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from database import get_db
from security import requer_perfil, get_usuario_atual, verificar_tenant
import models, schemas
from ref_formula_engine import ordenar_linhas, calcular_linha, detectar_ciclo

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
        valor_bruto = float(l.valor) if l.valor is not None else 0.0
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


def _get_valores_dre_por_linha(
    db: Session, cliente_id: int, template, ano: int, mes: int
) -> dict[int, dict[str, float]]:
    """
    MODELO DEFINITIVO da DRE: soma os LancamentoRef das contas nativas do cliente
    vinculadas DIRETO a cada linha-folha do template (via DeParaDreLinha), por unidade.
    Sem agrupamento e sem sinal por natureza — o valor entra bruto; a subtração fica nas
    linhas totalizadoras (fórmula). Ver documentos/PROJETO_REFERENCIAL.md.

    Retorna { template_linha_id: { unidade_codigo: valor, "Consolidado": valor } }.
    """
    comp = date(ano, mes, 1)

    cc_ids = [
        cc.id for cc in db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id).all()
    ]
    if not cc_ids:
        return {}

    linha_ids = [l.id for l in template.linhas]
    if not linha_ids:
        return {}

    todos_dp = (
        db.query(models.DeParaDreLinha)
        .filter(models.DeParaDreLinha.conta_cliente_id.in_(cc_ids),
                models.DeParaDreLinha.template_linha_id.in_(linha_ids),
                models.DeParaDreLinha.vigente_a_partir <= comp)
        .all()
    )
    if not todos_dp:
        return {}

    # Versionamento: por conta_cliente, valem só os vínculos da vigência mais recente.
    dp_por_cc: dict[int, list] = {}
    for dp in todos_dp:
        dp_por_cc.setdefault(dp.conta_cliente_id, []).append(dp)

    def _ativos(lista):
        max_data = max(d.vigente_a_partir for d in lista)
        return [d for d in lista if d.vigente_a_partir == max_data]

    lancs = (
        db.query(models.LancamentoRef)
        .filter(models.LancamentoRef.conta_cliente_id.in_(cc_ids),
                models.LancamentoRef.ano == ano,
                models.LancamentoRef.mes == mes)
        .all()
    )

    totais: dict[int, dict[str, float]] = {}
    for l in lancs:
        valor_bruto = float(l.valor) if l.valor is not None else 0.0
        unidade_cod = l.unidade_codigo or "Consolidado"
        for dp in _ativos(dp_por_cc.get(l.conta_cliente_id, [])) if dp_por_cc.get(l.conta_cliente_id) else []:
            contribuicao = valor_bruto * (dp.percentual / 100.0)
            dict_lin = totais.setdefault(dp.template_linha_id, {})
            if unidade_cod != "Consolidado":
                dict_lin[unidade_cod] = dict_lin.get(unidade_cod, 0.0) + contribuicao
            dict_lin["Consolidado"] = dict_lin.get("Consolidado", 0.0) + contribuicao

    return totais


def _modo_efetivo(linha) -> str:
    """
    Resolve o modo de calculo efetivo de uma linha.
    Fallback legado: templates anteriores a Fase A' nao tem modo_calculo explicito
    (migracao aplica default 'agrupamento' em massa) — uma linha com formula_texto e
    sem agrupamento_slug e, na pratica, um totalizador, mesmo com modo_calculo default.
    """
    if linha.modo_calculo == "soma_filhos":
        return "soma_filhos"
    if linha.modo_calculo == "formula":
        return "formula"
    if linha.formula_texto and not linha.agrupamento_slug:
        return "formula"
    return "agrupamento"


def _construir_filhos_diretos(linhas: list) -> dict:
    """
    Mapeia id da linha -> lista de linhas-filhas diretas, inferida por nivel/ordem
    (indentacao da planilha) — ver documentos/PROJETO_REFERENCIAL.md. `linhas` deve
    vir na ordem de exibicao (ordem crescente).
    """
    filhos: dict = {l.id: [] for l in linhas}
    pilha: list = []  # pilha de (nivel, linha) dos ancestrais em aberto
    for linha in linhas:
        nivel = linha.nivel if linha.nivel is not None else 4
        while pilha and pilha[-1][0] >= nivel:
            pilha.pop()
        if pilha:
            filhos[pilha[-1][1].id].append(linha)
        pilha.append((nivel, linha))
    return filhos


def _calcular_template(
    db: Session, cliente_id: int, template_id: int, ano: int, mes: int,
    unidade_codigo: Optional[str] = None
) -> tuple[list, bool]:
    """Retorna (lista de linhas calculadas, periodo_fechado)."""
    cliente = db.get(models.Cliente, cliente_id)
    if not cliente or not cliente.ativo:
        raise HTTPException(404, "Cliente não encontrado ou inativo")
    if not cliente.modulo_analises_gerenciais:
        raise HTTPException(403, "Este cliente não possui o módulo de análises gerenciais ativo.")

    template = db.get(models.TemplateRef, template_id)
    if not template:
        raise HTTPException(404, "Template não encontrado")

    periodo_fechado = bool(
        db.query(models.PeriodoFechado)
        .filter(models.PeriodoFechado.cliente_id == cliente_id,
                models.PeriodoFechado.ano == ano,
                models.PeriodoFechado.mes == mes)
        .first()
    )

    # val_agr: { agrupamento_slug: {unid: valor} } — folhas de FC/legado (via agrupamento)
    val_agr = _get_valores_agrupamento(db, cliente_id, ano, mes)
    # val_dre: { template_linha_id: {unid: valor} } — folhas de DRE (de-para direto conta→linha)
    val_dre = _get_valores_dre_por_linha(db, cliente_id, template, ano, mes)

    # Descobre todas as unidades que possuem dados na competência (de ambos os modelos)
    todas_unidades = set()
    for valores in val_agr.values():
        todas_unidades.update(valores.keys())
    for valores in val_dre.values():
        todas_unidades.update(valores.keys())

    if not todas_unidades:
        todas_unidades = {"Consolidado"}
    else:
        todas_unidades.add("Consolidado")

    # Calcula de forma isolada para cada unidade e consolidado.
    # Ordem: folhas ('agrupamento') → soma_filhos (de baixo p/ cima, por nivel) →
    # formulas (ordenacao topologica existente) — ver documentos/PROJETO_REFERENCIAL.md.
    linhas_todas = list(template.linhas)
    filhos_diretos = _construir_filhos_diretos(linhas_todas)
    linhas_por_nivel_desc = sorted(linhas_todas, key=lambda l: -(l.nivel if l.nivel is not None else 4))

    val_lin_por_unidade: dict[str, dict[str, float]] = {u: {} for u in todas_unidades}
    linhas_ordenadas = ordenar_linhas(linhas_todas)

    ciclo_detectado = detectar_ciclo(linhas_todas)
    ciclo_set = set(ciclo_detectado) if ciclo_detectado else set()

    erros_por_linha: dict[str, dict[str, str | None]] = {l.rotulo: {} for l in linhas_todas}

    for u in todas_unidades:
        val_agr_u = {agr: valores.get(u, 0.0) for agr, valores in val_agr.items()}
        val_lin_u = val_lin_por_unidade[u]

        # 1) folhas (apontamento) — nao dependem de outras linhas.
        #    Discriminador: folha COM agrupamento_slug -> FC/legado (caminho do agrupamento);
        #    folha SEM agrupamento_slug -> DRE modelo definitivo (soma direta das contas
        #    nativas vinculadas via DeParaDreLinha). Ver documentos/PROJETO_REFERENCIAL.md.
        for linha in linhas_todas:
            if _modo_efetivo(linha) != "agrupamento":
                continue
            if linha.agrupamento_slug:
                formula = f"{{agrupamento:{linha.agrupamento_slug}}}"
                valor, erro_str = calcular_linha(formula, val_agr_u, val_lin_u)
            else:
                valor = val_dre.get(linha.id, {}).get(u, 0.0)
                erro_str = None
            val_lin_u[linha.rotulo] = valor
            erros_por_linha[linha.rotulo][u] = erro_str

        # 2) soma_filhos — de baixo para cima (niveis mais profundos primeiro)
        for linha in linhas_por_nivel_desc:
            if _modo_efetivo(linha) != "soma_filhos":
                continue
            total = sum(val_lin_u.get(filho.rotulo, 0.0) for filho in filhos_diretos.get(linha.id, []))
            val_lin_u[linha.rotulo] = total
            erros_por_linha[linha.rotulo][u] = None

        # 3) formulas — ordem topologica existente, com deteccao de ciclo preservada
        for linha in linhas_ordenadas:
            if _modo_efetivo(linha) != "formula":
                continue
            rotulo = linha.rotulo
            if rotulo in ciclo_set:
                valor, erro_str = 0.0, "ciclo"
            else:
                valor, erro_str = calcular_linha(linha.formula_texto or "", val_agr_u, val_lin_u)
            val_lin_u[rotulo] = valor
            erros_por_linha[rotulo][u] = erro_str

    # Compila resultado para retorno
    resultado = []
    for linha in template.linhas:
        rotulo = linha.rotulo
        
        # Determina o valor a ser focado no campo valor principal
        u_foco = unidade_codigo if (unidade_codigo and unidade_codigo in todas_unidades) else "Consolidado"
        valor_principal = val_lin_por_unidade.get(u_foco, {}).get(rotulo, 0.0)
        erro_principal = erros_por_linha.get(rotulo, {}).get(u_foco)
        tem_dz_principal = (erro_principal == "div_zero")

        # Mapa com a abertura de todas as unidades
        valores_unidades = {u: round(val_lin_por_unidade[u].get(rotulo, 0.0), 2) for u in todas_unidades}
        erros_unidades = {u: erros_por_linha[rotulo].get(u) for u in todas_unidades}

        resultado.append(schemas.LinhaDemonstrativoOut(
            rotulo=rotulo,
            valor=round(valor_principal, 2),
            negrito_totalizador=linha.negrito_totalizador,
            tem_divisao_por_zero=tem_dz_principal,
            valores_unidades=valores_unidades,
            erro=erro_principal,
            erros_unidades=erros_unidades
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
    usuario=Depends(get_usuario_atual),
):
    verificar_tenant(usuario, cliente_id)
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
    usuario=Depends(get_usuario_atual),
):
    """Realizado vs Orçado lado a lado com desvio percentual por linha."""
    verificar_tenant(usuario, cliente_id)
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
    verificar_tenant(usuario, cliente_id)
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
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    verificar_tenant(usuario, cliente_id)
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
    usuario=Depends(get_usuario_atual),
):
    verificar_tenant(usuario, cliente_id)
    return (
        db.query(models.PeriodoFechado)
        .filter(models.PeriodoFechado.cliente_id == cliente_id)
        .order_by(models.PeriodoFechado.ano.desc(), models.PeriodoFechado.mes.desc())
        .all()
    )
