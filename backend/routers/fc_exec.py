"""
Demonstrativo de Fluxo de Caixa Executivo.
Calcula linha a linha a partir do template FC e dos lançamentos importados.
"""
import re
from collections import defaultdict
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from auth import get_usuario_atual
from models import Cliente

router = APIRouter(prefix="/api/demonstrativos", tags=["Demonstrativos FC"])


# ── Helpers de parsing ────────────────────────────────────────────────────────

def _parse_compound_slug(slug_str: Optional[str]) -> list[tuple[str, int]]:
    """'Vda_Din+Vda_Che-Vda_Che_S' → [('Vda_Din',1),('Vda_Che',1),('Vda_Che_S',-1)]"""
    if not slug_str:
        return []
    parts = re.split(r'([+-])', slug_str)
    result, sign = [], 1
    for p in parts:
        if p == '+':
            sign = 1
        elif p == '-':
            sign = -1
        elif p.strip():
            result.append((p.strip(), sign))
            sign = 1
    return result


def _eval_formula(formula: str, row_vals: dict) -> float:
    """
    Avalia fórmula Excel-like usando row_vals = {ordem: valor}.
    Suporta: SUM(Da:Db), IFERROR(expr,0), IF(cond,val,val), aritmética com D{n}.
    """
    if not formula:
        return 0.0
    f = formula.strip().lstrip('=')

    # Expand SUM(Da:Db) → (Da+Da+1+...+Db)
    f = re.sub(
        r'SUM\(D(\d+):D(\d+)\)',
        lambda m: '(' + '+'.join(f'D{i}' for i in range(int(m.group(1)), int(m.group(2)) + 1)) + ')',
        f, flags=re.IGNORECASE
    )

    # Strip IFERROR(expr, fallback) → expr
    if re.match(r'^IFERROR\(', f, re.IGNORECASE):
        depth = 0
        for i, c in enumerate(f):
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    break
            elif c == ',' and depth == 1:
                f = f[8:i]   # skip "IFERROR("
                break

    # Strip IF(cond, true_val, false_val) → false_val (the non-zero computation branch)
    elif re.match(r'^IF\(', f, re.IGNORECASE):
        depth, commas = 0, []
        for idx, c in enumerate(f):
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
            elif c == ',' and depth == 1:
                commas.append(idx)
        if len(commas) >= 2:
            inner = f[commas[1] + 1:]
            last_p = inner.rfind(')')
            f = inner[:last_p] if last_p >= 0 else inner

    # Replace D{n} with numeric values
    f = re.sub(r'D(\d+)', lambda m: str(row_vals.get(int(m.group(1)), 0.0)), f, flags=re.IGNORECASE)
    f = f.replace('""', '0').replace("''", '0')

    try:
        result = eval(f, {"__builtins__": {}})
        return float(result) if result not in (None, '') else 0.0
    except Exception:
        return 0.0


# ── Cálculo principal ─────────────────────────────────────────────────────────

def _compute_fc(db: Session, cliente_id: int, ano: int, mes: Optional[int], modo: str) -> list[dict]:
    # 1. Template lines
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

    # 2. De-Para: slug_extrato.lower() → agrupamento_id
    depara = {
        r.slug: r.agrupamento_id
        for r in db.execute(text(
            "SELECT LOWER(slug_extrato) as slug, agrupamento_id "
            "FROM fc_slug_depara WHERE cliente_id = :cid"
        ), {"cid": cliente_id}).fetchall()
    }

    # 3. fc_lancamentos aggregation
    if modo == "todos":
        fc_raw = db.execute(text(
            "SELECT LOWER(agrupamento_slug) as slug, mes, COALESCE(SUM(valor),0) as total "
            "FROM fc_lancamentos WHERE cliente_id=:cid AND ano=:ano "
            "GROUP BY LOWER(agrupamento_slug), mes"
        ), {"cid": cliente_id, "ano": ano}).fetchall()
        # agrupamento_id → {mes → total}
        by_mes: dict[int, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        for r in fc_raw:
            aid = depara.get(r.slug)
            if aid:
                by_mes[aid][r.mes] += float(r.total)
    else:
        if modo == "mensal" and mes:
            fc_raw = db.execute(text(
                "SELECT LOWER(agrupamento_slug) as slug, COALESCE(SUM(valor),0) as total "
                "FROM fc_lancamentos WHERE cliente_id=:cid AND ano=:ano AND mes=:mes "
                "GROUP BY LOWER(agrupamento_slug)"
            ), {"cid": cliente_id, "ano": ano, "mes": mes}).fetchall()
        else:
            mes_max = mes if mes else 12
            fc_raw = db.execute(text(
                "SELECT LOWER(agrupamento_slug) as slug, COALESCE(SUM(valor),0) as total "
                "FROM fc_lancamentos WHERE cliente_id=:cid AND ano=:ano AND mes<=:mx "
                "GROUP BY LOWER(agrupamento_slug)"
            ), {"cid": cliente_id, "ano": ano, "mx": mes_max}).fetchall()
        agrup_totals: dict[int, float] = defaultdict(float)
        for r in fc_raw:
            aid = depara.get(r.slug)
            if aid:
                agrup_totals[aid] += float(r.total)

    # 4. Helper: value for one agrupamento line
    def agrup_val(slug_str: Optional[str]) -> float | dict:
        components = _parse_compound_slug(slug_str)
        if modo == "todos":
            result: dict[int, float] = defaultdict(float)
            seen: set[int] = set()
            for slug_comp, sign in components:
                aid = depara.get(slug_comp.lower())
                if aid is None or aid in seen:
                    continue
                seen.add(aid)
                for m in range(1, 13):
                    result[m] += sign * by_mes[aid].get(m, 0.0)
            return dict(result)
        else:
            total, seen = 0.0, set()
            for slug_comp, sign in components:
                aid = depara.get(slug_comp.lower())
                if aid is None or aid in seen:
                    continue
                seen.add(aid)
                total += sign * agrup_totals.get(aid, 0.0)
            return total

    # 5. Phase 1 — compute agrupamentos; titulos → 0
    row_vals: dict[int, object] = {}
    linhas_out = []
    for r in rows:
        entry = {
            "ordem": r.ordem,
            "rotulo": r.rotulo,
            "tipo": r.tipo,
            "negrito_totalizador": bool(r.negrito_totalizador),
            "realizado": None,
            "pct_realizado": None,
            "valores_mensais": None,
        }
        if r.tipo == "agrupamento":
            val = agrup_val(r.agrupamento_slug)
            row_vals[r.ordem] = val
            if modo == "todos":
                entry["valores_mensais"] = val
                entry["realizado"] = round(sum(val.values()), 2) if val else 0.0
            else:
                entry["realizado"] = round(float(val), 2)
        else:
            row_vals[r.ordem] = {} if modo == "todos" else 0.0
        linhas_out.append(entry)

    # 6. Phase 2 — compute totalizadores (multi-pass for forward refs)
    formula_map = {r.ordem: r.formula_texto for r in rows if r.tipo == "totalizador"}
    for _ in range(10):
        changed = False
        for entry in linhas_out:
            if entry["tipo"] != "totalizador":
                continue
            ordem = entry["ordem"]
            formula = formula_map.get(ordem)
            if not formula:
                continue
            if modo == "todos":
                new_by_mes = {}
                for mes_i in range(1, 13):
                    scalars = {
                        k: (v.get(mes_i, 0.0) if isinstance(v, dict) else float(v))
                        for k, v in row_vals.items()
                    }
                    new_by_mes[mes_i] = _eval_formula(formula, scalars)
                if row_vals.get(ordem) != new_by_mes:
                    row_vals[ordem] = new_by_mes
                    entry["valores_mensais"] = new_by_mes
                    entry["realizado"] = round(sum(new_by_mes.values()), 2)
                    changed = True
            else:
                new_val = _eval_formula(formula, {k: float(v) for k, v in row_vals.items() if not isinstance(v, dict)})
                if row_vals.get(ordem) != new_val:
                    row_vals[ordem] = new_val
                    entry["realizado"] = round(new_val, 2)
                    changed = True
        if not changed:
            break

    # 7. %Realizado vs Vendas Totais (ordem 12)
    ref = row_vals.get(12, 0.0)
    ref_f = sum(ref.values()) if isinstance(ref, dict) else float(ref)
    if ref_f:
        for entry in linhas_out:
            real = entry.get("realizado")
            if isinstance(real, (int, float)) and real is not None:
                entry["pct_realizado"] = round(real / ref_f * 100, 2)

    return linhas_out


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/fluxo-caixa")
def demonstrativo_fluxo_caixa(
    cliente_id: int = Query(..., description="ID do cliente"),
    ano: int = Query(..., description="Ano do demonstrativo"),
    mes: Optional[int] = Query(None, ge=1, le=12, description="Mês (obrigatório no modo mensal)"),
    modo: str = Query("mensal", regex="^(mensal|acumulado|todos)$"),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")
    if usuario.perfil in ("analista", "ger_projeto", "ti") and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")
    if modo == "mensal" and not mes:
        raise HTTPException(422, "Parâmetro 'mes' obrigatório no modo mensal")

    linhas = _compute_fc(db, cliente_id, ano, mes, modo)
    if not linhas:
        raise HTTPException(404, "Template de Fluxo de Caixa não encontrado ou sem dados")

    return {
        "cliente_id": cliente_id,
        "cliente_nome": cliente.razao_social,
        "ano": ano,
        "mes": mes,
        "modo": modo,
        "linhas": linhas,
    }
