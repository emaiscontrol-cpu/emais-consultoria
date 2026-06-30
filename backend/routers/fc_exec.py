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

    # 2. fc_lancamentos aggregados por LOWER(agrupamento_slug).
    #    Para mensal/acumulado: COUNT(DISTINCT conta_origem) na mesma query.
    #    Para todos: query separada de counts (agrupada por mes+slug não serve).
    if modo == "todos":
        fc_raw = db.execute(text(
            "SELECT LOWER(agrupamento_slug) as slug, mes, COALESCE(SUM(valor),0) as total "
            "FROM fc_lancamentos WHERE cliente_id=:cid AND ano=:ano "
            "GROUP BY LOWER(agrupamento_slug), mes"
        ), {"cid": cliente_id, "ano": ano}).fetchall()
        by_mes: dict[str, dict[int, float]] = defaultdict(lambda: defaultdict(float))
        for r in fc_raw:
            by_mes[r.slug][r.mes] += float(r.total)

        cnt_raw = db.execute(text(
            "SELECT LOWER(agrupamento_slug) as slug, COUNT(DISTINCT conta_origem) as cnt "
            "FROM fc_lancamentos WHERE cliente_id=:cid AND ano=:ano "
            "GROUP BY LOWER(agrupamento_slug)"
        ), {"cid": cliente_id, "ano": ano}).fetchall()
        slug_counts: dict[str, int] = {r.slug: int(r.cnt) for r in cnt_raw}
    else:
        if modo == "mensal" and mes:
            fc_raw = db.execute(text(
                "SELECT LOWER(agrupamento_slug) as slug, COALESCE(SUM(valor),0) as total, "
                "COUNT(DISTINCT conta_origem) as cnt "
                "FROM fc_lancamentos WHERE cliente_id=:cid AND ano=:ano AND mes=:mes "
                "GROUP BY LOWER(agrupamento_slug)"
            ), {"cid": cliente_id, "ano": ano, "mes": mes}).fetchall()
        else:
            mes_max = mes if mes else 12
            fc_raw = db.execute(text(
                "SELECT LOWER(agrupamento_slug) as slug, COALESCE(SUM(valor),0) as total, "
                "COUNT(DISTINCT conta_origem) as cnt "
                "FROM fc_lancamentos WHERE cliente_id=:cid AND ano=:ano AND mes<=:mx "
                "GROUP BY LOWER(agrupamento_slug)"
            ), {"cid": cliente_id, "ano": ano, "mx": mes_max}).fetchall()
        slug_totals: dict[str, float] = {}
        slug_counts = {}
        for r in fc_raw:
            slug_totals[r.slug] = float(r.total)
            slug_counts[r.slug] = int(r.cnt)

    # 3. Helpers para valores e contagem de contas
    def agrup_val(slug_str: Optional[str]) -> float | dict:
        components = _parse_compound_slug(slug_str)
        if modo == "todos":
            result: dict[int, float] = defaultdict(float)
            seen: set[str] = set()
            for slug_comp, sign in components:
                key = slug_comp.lower()
                if key in seen:
                    continue
                seen.add(key)
                for m in range(1, 13):
                    result[m] += sign * by_mes[key].get(m, 0.0)
            return dict(result)
        else:
            total, seen = 0.0, set()
            for slug_comp, sign in components:
                key = slug_comp.lower()
                if key in seen:
                    continue
                seen.add(key)
                total += sign * slug_totals.get(key, 0.0)
            return total

    def get_conta_count(slug_str: Optional[str]) -> int:
        """Soma COUNT(DISTINCT conta_origem) por componente do slug composto (dedup by lowercase)."""
        components = _parse_compound_slug(slug_str)
        seen: set[str] = set()
        total = 0
        for slug_comp, _ in components:
            key = slug_comp.lower()
            if key in seen:
                continue
            seen.add(key)
            total += slug_counts.get(key, 0)
        return total

    # 4. Phase 1 — compute agrupamentos
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
            "conta_count": 0,
            "agrupamento_slug": None,
        }
        if r.tipo == "agrupamento":
            val = agrup_val(r.agrupamento_slug)
            row_vals[r.ordem] = val
            entry["conta_count"] = get_conta_count(r.agrupamento_slug)
            entry["agrupamento_slug"] = r.agrupamento_slug
            if modo == "todos":
                entry["valores_mensais"] = val
                entry["realizado"] = round(sum(val.values()), 2) if val else 0.0
            else:
                entry["realizado"] = round(float(val), 2)
        else:
            row_vals[r.ordem] = {} if modo == "todos" else 0.0
        linhas_out.append(entry)

    # 5. Phase 2 — compute totalizadores (multi-pass for forward refs)
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

    # 6. %Realizado vs Vendas Totais (ordem 12)
    ref = row_vals.get(12, 0.0)
    ref_f = sum(ref.values()) if isinstance(ref, dict) else float(ref)
    if ref_f:
        for entry in linhas_out:
            real = entry.get("realizado")
            if isinstance(real, (int, float)) and real is not None:
                entry["pct_realizado"] = round(real / ref_f * 100, 2)

    return linhas_out


# ── Endpoints ─────────────────────────────────────────────────────────────────

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


@router.get("/fluxo-caixa/detalhe")
def detalhe_agrupamento(
    cliente_id: int = Query(...),
    ano: int = Query(...),
    mes: Optional[int] = Query(None, ge=1, le=12),
    mes_fim: Optional[int] = Query(None, ge=1, le=12),
    agrupamento_slug: str = Query(...),
    modo: str = Query("mensal", regex="^(mensal|acumulado|todos)$"),
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual),
):
    """Lançamentos por conta_origem de um agrupamento no período informado.

    Modo mensal  → mes obrigatório, filtra pelo mês exato.
    Modo acumulado → mes (início, default 1) e mes_fim (fim, default mes); soma o intervalo.
    Modo todos   → se mes fornecido filtra pelo mês; senão retorna o ano inteiro.
    """
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente não encontrado")
    if usuario.perfil in ("analista", "ger_projeto", "ti") and usuario.cliente_id != cliente_id:
        raise HTTPException(403, "Acesso negado")

    components = _parse_compound_slug(agrupamento_slug)
    slugs = list({s.lower() for s, _ in components})
    if not slugs:
        return []

    # Placeholders parametrizados para o IN clause (slug_ph = ':s0,:s1,...')
    slug_params = {f's{i}': s for i, s in enumerate(slugs)}
    slug_ph = ','.join(f':s{i}' for i in range(len(slugs)))

    if modo == "mensal":
        if not mes:
            raise HTTPException(422, "mes obrigatório no modo mensal")
        where_date = "AND mes = :mes"
        date_params: dict = {"mes": mes}
    elif modo == "acumulado":
        mes_ini = mes or 1
        mes_end = mes_fim if mes_fim is not None else (mes or 12)
        where_date = "AND mes >= :mes_ini AND mes <= :mes_end"
        date_params = {"mes_ini": mes_ini, "mes_end": mes_end}
    else:  # todos
        if mes:
            where_date = "AND mes = :mes"
            date_params = {"mes": mes}
        else:
            where_date = ""
            date_params = {}

    rows = db.execute(
        text(f"""
            SELECT conta_origem, MAX(descricao) as descricao,
                   COALESCE(SUM(valor), 0) as valor
            FROM fc_lancamentos
            WHERE cliente_id=:cid AND ano=:ano {where_date}
              AND LOWER(agrupamento_slug) IN ({slug_ph})
            GROUP BY conta_origem
            ORDER BY COALESCE(SUM(valor), 0) DESC
        """),
        {"cid": cliente_id, "ano": ano, **date_params, **slug_params}
    ).fetchall()

    return [
        {
            "conta_origem": r.conta_origem or "—",
            "descricao": r.descricao,
            "valor": float(r.valor),
        }
        for r in rows
    ]
