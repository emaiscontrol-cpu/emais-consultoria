from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from security import requer_perfil
import models, schemas
from routers.ref_demonstrativos import _calcular_template

router = APIRouter()


@router.get("/segmento/{segmento_id}", response_model=schemas.BenchmarkOut)
def benchmark(
    segmento_id: int,
    ano: int,
    mes: int,
    template_id: int,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    """
    Retorna média e faixa (min/max) de cada linha do template DRE para todos os clientes
    do segmento. Sem identificar clientes individualmente.
    """
    segmento = db.query(models.Segmento).get(segmento_id)
    if not segmento:
        raise HTTPException(404, "Segmento não encontrado")

    clientes = (
        db.query(models.Cliente)
        .filter(models.Cliente.segmento_id == segmento_id,
                models.Cliente.ativo == True)
        .all()
    )
    if not clientes:
        raise HTTPException(404, "Nenhum cliente neste segmento")

    # Calcula para cada cliente (coleta apenas quem tem dados)
    por_rotulo: dict[str, list] = {}
    negrito_map: dict[str, bool] = {}

    for cliente in clientes:
        try:
            linhas, _ = _calcular_template(db, cliente.id, template_id, ano, mes)
        except Exception:
            continue
        tem_dados = any(l.valor != 0.0 for l in linhas)
        if not tem_dados:
            continue
        for l in linhas:
            por_rotulo.setdefault(l.rotulo, []).append(l.valor)
            negrito_map[l.rotulo] = l.negrito_totalizador

    if not por_rotulo:
        raise HTTPException(404, "Nenhum cliente com dados para o período informado")

    linhas_out = []
    for rotulo, valores in por_rotulo.items():
        linhas_out.append(schemas.BenchmarkLinhaOut(
            rotulo=rotulo,
            media=round(sum(valores) / len(valores), 2),
            minimo=round(min(valores), 2),
            maximo=round(max(valores), 2),
            qtd_clientes=len(valores),
        ))

    # Mantém ordem do template
    template = db.query(models.TemplateRef).get(template_id)
    if template:
        ordem = {l.rotulo: l.ordem for l in template.linhas}
        linhas_out.sort(key=lambda r: ordem.get(r.rotulo, 9999))

    return schemas.BenchmarkOut(
        segmento_id=segmento_id,
        segmento_nome=segmento.nome,
        ano=ano,
        mes=mes,
        linhas=linhas_out,
    )
