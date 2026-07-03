from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional, List
from collections import defaultdict
import openpyxl
import io
import models
from database import get_db
from auth import get_usuario_atual, requer_perfil
from routers.fc_exec import _parse_compound_slug, _eval_formula

router = APIRouter()

@router.get("/clientes")
def listar_clientes_com_analise_gerencial(
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual)
):
    """Lista apenas clientes ativos que possuem o módulo de Análises Gerenciais habilitado."""
    return db.query(models.Cliente).filter(
        models.Cliente.ativo == True,
        models.Cliente.modulo_analises_gerenciais == True
    ).all()

@router.get("/cliente/{cliente_id}/ano/{ano}")
def obter_orcamento(
    cliente_id: int,
    ano: int,
    versao: str = "Original",
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual)
):
    """Retorna os valores orçados por agrupamento_slug para um ano e versão."""
    orcamentos = db.query(models.FCOrcamento).filter(
        models.FCOrcamento.cliente_id == cliente_id,
        models.FCOrcamento.ano == ano,
        models.FCOrcamento.versao == versao
    ).all()
    
    data = {}
    for o in orcamentos:
        if o.agrupamento_slug not in data:
            data[o.agrupamento_slug] = [0.0] * 12
        if 1 <= o.mes <= 12:
            data[o.agrupamento_slug][o.mes - 1] = o.valor
            
    return [
        {
            "agrupamento_slug": slug,
            "versao": versao,
            "valores_mensais": vals
        }
        for slug, vals in data.items()
    ]


@router.post("/cliente/{cliente_id}/ano/{ano}/importar")
def importar_orcamento(
    cliente_id: int,
    ano: int,
    file: UploadFile = File(...),
    versao: str = "Original",
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor"))
):
    """Lê planilha Excel (aba CLAUDE) e salva os valores de orçamento no banco."""
    try:
        contents = file.file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
    except Exception as e:
        raise HTTPException(400, f"Erro ao ler arquivo Excel: {str(e)}")
        
    if "CLAUDE" not in wb.sheetnames:
        raise HTTPException(400, "Aba 'CLAUDE' não encontrada no arquivo.")
        
    sheet = wb["CLAUDE"]
    
    # Remove registros anteriores da mesma versão
    db.execute(
        text("DELETE FROM fc_orcamento WHERE cliente_id = :cid AND ano = :ano AND versao = :ver"),
        {"cid": cliente_id, "ano": ano, "ver": versao}
    )
    db.commit()
    
    # Load template lines to map row index (ordem) to DB slug
    template_map = {}
    db_lines = db.execute(text("""
        SELECT tl.ordem, tl.agrupamento_slug
        FROM ref_template_linhas tl
        JOIN ref_templates t ON t.id = tl.template_id
        WHERE t.tipo = 'fluxo_caixa' AND t.ativo = true
    """)).fetchall()
    for line in db_lines:
        if line.agrupamento_slug:
            template_map[line.ordem] = line.agrupamento_slug
            
    registros_inseridos = 0
    rows = list(sheet.iter_rows(values_only=True))
    
    for r_idx, row in enumerate(rows, start=1):
        if r_idx < 4:
            continue
            
        db_slug = template_map.get(r_idx)
        if not db_slug:
            slug = row[0]
            if not slug or not str(slug).strip():
                continue
            db_slug = str(slug).strip()
            
        for m in range(1, 13):
            col_idx = 5 + (m - 1) * 5
            if col_idx >= len(row):
                break
                
            val_raw = row[col_idx]
            try:
                val = float(val_raw) if val_raw is not None else 0.0
            except (ValueError, TypeError):
                val = 0.0
                
            db.add(models.FCOrcamento(
                cliente_id=cliente_id,
                agrupamento_slug=db_slug,
                ano=ano,
                mes=m,
                valor=val,
                versao=versao
            ))
            registros_inseridos += 1
            
    db.commit()
    return {"success": True, "registros_inseridos": registros_inseridos}


@router.get("/cliente/{cliente_id}/comparativo")
def obter_comparativo(
    cliente_id: int,
    ano: int,
    versao: str = "Original",
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual)
):
    """Calcula comparativo Realizado vs Orçado lado a lado por mês."""
    # 1. Carrega as linhas de template do fluxo de caixa
    rows = db.execute(text("""
        SELECT tl.ordem, tl.rotulo, tl.tipo, tl.negrito_totalizador,
               tl.agrupamento_slug, tl.formula_texto
        FROM ref_template_linhas tl
        JOIN ref_templates t ON t.id = tl.template_id
        WHERE t.tipo = 'fluxo_caixa' AND t.ativo = true
        ORDER BY tl.ordem
    """)).fetchall()
    
    if not rows:
        return []
        
    # 2. Busca Realizado agrupado por slug e mês
    fc_raw = db.execute(text(
        "SELECT LOWER(agrupamento_slug) as slug, mes, COALESCE(SUM(valor),0) as total "
        "FROM fc_lancamentos WHERE cliente_id=:cid AND ano=:ano "
        "GROUP BY LOWER(agrupamento_slug), mes"
    ), {"cid": cliente_id, "ano": ano}).fetchall()
    by_mes_real: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for r in fc_raw:
        by_mes_real[r.slug][r.mes] += float(r.total)
        
    # 3. Busca Orçado agrupado por slug e mês
    orc_raw = db.execute(text(
        "SELECT LOWER(agrupamento_slug) as slug, mes, COALESCE(SUM(valor),0) as total "
        "FROM fc_orcamento WHERE cliente_id=:cid AND ano=:ano AND versao=:ver "
        "GROUP BY LOWER(agrupamento_slug), mes"
    ), {"cid": cliente_id, "ano": ano, "ver": versao}).fetchall()
    by_mes_orc: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    for r in orc_raw:
        by_mes_orc[r.slug][r.mes] += float(r.total)
        
    # Helpers de cálculo de chaves compostas
    def get_val_real(slug_str: Optional[str]) -> dict[int, float]:
        components = _parse_compound_slug(slug_str)
        res = defaultdict(float)
        seen = set()
        for slug_comp, sign in components:
            key = slug_comp.lower()
            if key in seen:
                continue
            seen.add(key)
            for m in range(1, 13):
                res[m] += sign * by_mes_real[key].get(m, 0.0)
        return res
        
    def get_val_orc(slug_str: Optional[str]) -> dict[int, float]:
        if not slug_str:
            return defaultdict(float)
        full_key = slug_str.lower()
        if full_key in by_mes_orc:
            res = defaultdict(float)
            for m in range(1, 13):
                res[m] = by_mes_orc[full_key].get(m, 0.0)
            return res
            
        components = _parse_compound_slug(slug_str)
        res = defaultdict(float)
        seen = set()
        for slug_comp, sign in components:
            key = slug_comp.lower()
            if key in seen:
                continue
            seen.add(key)
            for m in range(1, 13):
                res[m] += sign * by_mes_orc[key].get(m, 0.0)
        return res
        
    real_row_vals: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    orc_row_vals: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
    
    resultado = []
    for r in rows:
        ordem = r.ordem
        tipo = r.tipo
        slug_str = r.agrupamento_slug
        formula = r.formula_texto
        
        vals_real = {}
        vals_orc = {}
        
        if tipo == "agrupamento":
            vals_real = get_val_real(slug_str)
            vals_orc = get_val_orc(slug_str)
            for m in range(1, 13):
                real_row_vals[ordem][m] = vals_real[m]
                orc_row_vals[ordem][m] = vals_orc[m]
        elif tipo == "totalizador":
            for m in range(1, 13):
                m_real_vals = {o: val_dict[m] for o, val_dict in real_row_vals.items()}
                m_orc_vals = {o: val_dict[m] for o, val_dict in orc_row_vals.items()}
                
                val_real = _eval_formula(formula, m_real_vals)
                val_orc = _eval_formula(formula, m_orc_vals)
                
                real_row_vals[ordem][m] = val_real
                orc_row_vals[ordem][m] = val_orc
                vals_real[m] = val_real
                vals_orc[m] = val_orc
                
        resultado.append({
            "ordem": ordem,
            "rotulo": r.rotulo,
            "tipo": tipo,
            "negrito_totalizador": bool(r.negrito_totalizador),
            "realizado": vals_real,
            "orcado": vals_orc,
        })
        
    return resultado
