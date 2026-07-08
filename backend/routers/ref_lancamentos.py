from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from auth import requer_perfil, get_usuario_atual
import models, schemas
import depara_service
from xlsx_parser import parse_xlsx

router = APIRouter()


def _periodo_fechado(db: Session, cliente_id: int, ano: int, mes: int) -> bool:
    return bool(
        db.query(models.PeriodoFechado)
        .filter(models.PeriodoFechado.cliente_id == cliente_id,
                models.PeriodoFechado.ano == ano,
                models.PeriodoFechado.mes == mes)
        .first()
    )


def resolver_unidade(db: Session, cliente_id: int, unidade_str: Optional[str]) -> Optional[str]:
    if not unidade_str:
        return None
        
    unidade_str = str(unidade_str).strip()
    if not unidade_str:
        return None
        
    # Se for exatamente 3 dígitos numéricos, é o código direto
    if len(unidade_str) == 3 and unidade_str.isdigit():
        # Garante cadastro
        u = db.query(models.Unidade).filter(
            models.Unidade.cliente_id == cliente_id,
            models.Unidade.codigo == unidade_str
        ).first()
        if not u:
            u = models.Unidade(
                cliente_id=cliente_id,
                codigo=unidade_str,
                nome=f"Unidade {unidade_str}",
                ativo=True
            )
            db.add(u)
            db.flush()
        return u.codigo

    # Se for um nome, busca case-insensitive
    u = db.query(models.Unidade).filter(
        models.Unidade.cliente_id == cliente_id,
        models.Unidade.nome.ilike(unidade_str)
    ).first()
    if u:
        return u.codigo
        
    # Se não encontrar pelo nome, cadastra automaticamente com código autoincremental
    codigos_existentes = {val[0] for val in db.query(models.Unidade.codigo).filter(
        models.Unidade.cliente_id == cliente_id
    ).all()}
    
    proximo_codigo = 100
    while f"{proximo_codigo:03d}" in codigos_existentes:
        proximo_codigo += 1
        
    novo_codigo = f"{proximo_codigo:03d}"
    u = models.Unidade(
        cliente_id=cliente_id,
        codigo=novo_codigo,
        nome=unidade_str,
        ativo=True
    )
    db.add(u)
    db.flush()
    return novo_codigo


@router.post("/importar", response_model=dict)
def importar(
    req: schemas.LancamentoRefBulkRequest,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    """
    Importa lançamentos em JSON com suporte a unidades.
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
        cod_unidade = resolver_unidade(db, req.cliente_id, item.unidade)

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

        # Upsert LancamentoRef (UNIQUE por conta_cliente_id, unidade_codigo, ano, mes)
        lanc = (
            db.query(models.LancamentoRef)
            .filter(models.LancamentoRef.conta_cliente_id == cc.id,
                    models.LancamentoRef.unidade_codigo == cod_unidade,
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
                unidade_codigo=cod_unidade,
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


@router.post("/importar-arquivo", response_model=dict)
async def importar_arquivo(
    arquivo: UploadFile = File(...),
    layout_id: int = Query(...),
    cliente_id: int = Query(...),
    ano: int = Query(...),
    mes: Optional[int] = Query(None),
    forcar_periodo_fechado: bool = Query(False),
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor")),
):
    """
    Recebe um arquivo XLSX do realizado do cliente e processa a leitura de lançamentos
    de acordo com o layout de importação e quebra de unidades configurado.
    """
    layout = db.query(models.ImportLayout).filter(models.ImportLayout.id == layout_id).first()
    if not layout:
        raise HTTPException(404, "Layout de importação não encontrado")

    content = await arquivo.read()
    try:
        itens_lidos = parse_xlsx(content, layout)
    except Exception as e:
        raise HTTPException(400, f"Erro ao processar arquivo XLSX: {e}")

    if not itens_lidos:
        raise HTTPException(400, "Nenhum lançamento válido encontrado no arquivo")

    meses_no_req = set()
    for item in itens_lidos:
        if item.get("mes") is None:
            if mes is None:
                raise HTTPException(
                    400,
                    "Este layout exige que você selecione a competência (mês) de importação no formulário."
                )
            item["mes"] = mes
        meses_no_req.add(item["mes"])

    if not forcar_periodo_fechado:
        for m in meses_no_req:
            if _periodo_fechado(db, cliente_id, ano, m):
                raise HTTPException(
                    400,
                    f"Período {m:02d}/{ano} está fechado. "
                    "Selecione 'Forçar período fechado' no formulário para reabrir automaticamente."
                )

    criadas = 0
    atualizadas = 0
    novas_contas = 0
    sugestoes_geradas = 0

    for item in itens_lidos:
        cod_unidade = resolver_unidade(db, cliente_id, item.get("unidade"))

        cc = (
            db.query(models.ContaClienteRef)
            .filter(models.ContaClienteRef.cliente_id == cliente_id,
                    models.ContaClienteRef.codigo_origem == item["codigo"])
            .first()
        )
        eh_nova = cc is None
        if eh_nova:
            cc = models.ContaClienteRef(
                cliente_id=cliente_id,
                codigo_origem=item["codigo"],
                descricao_origem=item["descricao"] or f"Conta {item['codigo']}",
            )
            db.add(cc)
            db.flush()
            novas_contas += 1

        lanc = (
            db.query(models.LancamentoRef)
            .filter(models.LancamentoRef.conta_cliente_id == cc.id,
                    models.LancamentoRef.unidade_codigo == cod_unidade,
                    models.LancamentoRef.ano == ano,
                    models.LancamentoRef.mes == item["mes"])
            .first()
        )
        if lanc:
            lanc.valor = item["valor"]
            atualizadas += 1
        else:
            db.add(models.LancamentoRef(
                conta_cliente_id=cc.id,
                unidade_codigo=cod_unidade,
                valor=item["valor"],
                ano=ano,
                mes=item["mes"],
            ))
            criadas += 1

        if eh_nova:
            dp = depara_service.aplicar_automatico(db, cc, ano, item["mes"])
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
def listar(cliente_id: int, ano: int = None, mes: int = None, unidade_codigo: str = None,
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
    if unidade_codigo:
        q = q.filter(models.LancamentoRef.unidade_codigo == unidade_codigo)
    return q.all()


@router.delete("/cliente/{cliente_id}/competencia/{ano}/{mes}")
def deletar_competencia(
    cliente_id: int, ano: int, mes: int, unidade_codigo: str = None,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    """Remove todos os lançamentos de uma competência (reabertura de período)."""
    ccs = (
        db.query(models.ContaClienteRef.id)
        .filter(models.ContaClienteRef.cliente_id == cliente_id)
        .subquery()
    )
    q = (
        db.query(models.LancamentoRef)
        .filter(models.LancamentoRef.conta_cliente_id.in_(ccs),
                models.LancamentoRef.ano == ano,
                models.LancamentoRef.mes == mes)
    )
    if unidade_codigo:
        q = q.filter(models.LancamentoRef.unidade_codigo == unidade_codigo)
        
    deleted = q.delete(synchronize_session=False)
    
    # Remove fechamento se não houver mais nenhum lançamento de nenhuma outra unidade
    sobrou = db.query(models.LancamentoRef).filter(
        models.LancamentoRef.conta_cliente_id.in_(ccs),
        models.LancamentoRef.ano == ano,
        models.LancamentoRef.mes == mes
    ).first()
    
    if not sobrou:
        db.query(models.PeriodoFechado).filter(
            models.PeriodoFechado.cliente_id == cliente_id,
            models.PeriodoFechado.ano == ano,
            models.PeriodoFechado.mes == mes,
        ).delete(synchronize_session=False)
        
    db.commit()
    return {"lancamentos_removidos": deleted}
