"""
Orquestra a importação de realizado:
  1. Parse do XLSX (xlsx_parser)
  2. Match direto: codigo_erp == conta/agrupamento de N3
  3. Match via DE-PARA
  4. Pendências: sem mapeamento
  5. Upsert em OrcamentoUnidadeValor
  6. Recálculo N2/N1 (recalculo_engine)
  7. Log + pendências persistidos
"""

from typing import Optional
from sqlalchemy.orm import Session
from models import (
    ImportLayout, ContaDePara, OrcamentoUnidadeValor,
    PlanoItem, ClientePlano, ImportacaoLog, ImportacaoPendencia,
)
from xlsx_parser import parse_xlsx
from recalculo_engine import recalcular_dre, persistir_recalculo


def _nivel(conta: str, tipo: str) -> int:
    if (tipo or "").upper() not in ("TT", "RES"):
        return 3
    s = (conta or "").rstrip("0")
    return 1 if len(s) <= 1 else 2


def importar_realizado(
    content: bytes,
    layout_id: int,
    cliente_id: int,
    unidade: str,
    ano: int,
    mes_filtro: Optional[int],
    reprocessar: bool,
    usuario_id: int,
    db: Session,
) -> dict:
    layout = db.query(ImportLayout).filter(ImportLayout.id == layout_id).first()
    if not layout:
        raise ValueError(f"Layout {layout_id} não encontrado")

    vinculo = db.query(ClientePlano).filter(ClientePlano.cliente_id == cliente_id).first()
    if not vinculo:
        raise ValueError("Cliente sem plano de contas vinculado")
    plano_id = vinculo.plano_id

    # Parse arquivo
    linhas = parse_xlsx(content, layout)
    if mes_filtro:
        linhas = [l for l in linhas if l["mes"] == mes_filtro]

    # Index: conta → item_id e agrupamento → item_id (apenas N3)
    items = db.query(PlanoItem).filter(PlanoItem.plano_id == plano_id).all()
    conta_idx: dict[str, int] = {}
    for it in items:
        if _nivel(it.conta or "", it.tipo or "") == 3:
            if it.conta and it.conta.strip():
                conta_idx[it.conta.strip()] = it.id
            if it.agrupamento and it.agrupamento.strip():
                conta_idx[it.agrupamento.strip()] = it.id

    # DE-PARA
    de_paras = (
        db.query(ContaDePara)
        .filter(ContaDePara.cliente_id == cliente_id, ContaDePara.ativo == True)
        .all()
    )
    depara_map: dict[str, int] = {dp.codigo_erp: dp.plano_item_id for dp in de_paras}

    # Deletar existentes se reprocessar
    if reprocessar:
        q = db.query(OrcamentoUnidadeValor).filter(
            OrcamentoUnidadeValor.cliente_id == cliente_id,
            OrcamentoUnidadeValor.ano == ano,
            OrcamentoUnidadeValor.unidade == unidade,
        )
        if mes_filtro:
            q = q.filter(OrcamentoUnidadeValor.mes == mes_filtro)
        q.delete()
        db.flush()

    n_direto = 0
    n_depara = 0
    pendencias_raw: list[dict] = []
    upserts: list[dict] = []

    for linha in linhas:
        codigo = linha["codigo"]
        mes = linha["mes"]
        valor = linha["valor"]

        item_id = conta_idx.get(codigo)
        if item_id:
            n_direto += 1
        else:
            item_id = depara_map.get(codigo)
            if item_id:
                n_depara += 1
            else:
                pendencias_raw.append({
                    "codigo_erp": codigo,
                    "descricao": linha.get("descricao", ""),
                    "valor": valor,
                    "mes": mes,
                })
                continue

        upserts.append({
            "plano_item_id": item_id,
            "cliente_id": cliente_id,
            "ano": ano,
            "mes": mes,
            "unidade": unidade,
            "valor": valor,
        })

    # Upsert N3 values
    for v in upserts:
        reg = (
            db.query(OrcamentoUnidadeValor)
            .filter(
                OrcamentoUnidadeValor.plano_item_id == v["plano_item_id"],
                OrcamentoUnidadeValor.cliente_id == v["cliente_id"],
                OrcamentoUnidadeValor.ano == v["ano"],
                OrcamentoUnidadeValor.mes == v["mes"],
                OrcamentoUnidadeValor.unidade == v["unidade"],
            )
            .first()
        )
        if reg:
            reg.valor = v["valor"]
        else:
            db.add(OrcamentoUnidadeValor(**v))
    db.flush()

    # Recalcular N2 e N1
    resultado = recalcular_dre(cliente_id, ano, unidade, db, mes=mes_filtro)
    persistir_recalculo(cliente_id, ano, unidade, resultado, db)

    # Log
    log = ImportacaoLog(
        cliente_id=cliente_id,
        layout_id=layout_id,
        ano=ano,
        mes=mes_filtro or 0,
        unidade=unidade,
        total_linhas=len(linhas),
        direto=n_direto,
        via_depara=n_depara,
        pendencias=len(pendencias_raw),
        criado_por_id=usuario_id,
    )
    db.add(log)
    db.flush()

    for p in pendencias_raw:
        db.add(ImportacaoPendencia(
            log_id=log.id,
            codigo_erp=p["codigo_erp"],
            descricao=p.get("descricao", ""),
            valor=p.get("valor", 0.0),
            mes=p.get("mes", 0),
        ))

    db.commit()

    return {
        "log_id": log.id,
        "importadas": n_direto + n_depara,
        "direto": n_direto,
        "via_depara": n_depara,
        "pendencias": len(pendencias_raw),
        "lista_pendencias": pendencias_raw,
    }
