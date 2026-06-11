"""
Parse de XLSX de estrutura de Plano de Contas (formato ERP externo).
Usa openpyxl. NÃO salva no banco.

Retorna:
  {
    "contas":    [{"conta", "descricao", "nivel", "tipo"}, ...],
    "erros":     [{"linha", "codigo", "erro"}, ...],
    "ignoradas": int,
    "resumo":    {"total", "n1", "n2", "n3"},
  }
"""

import io
import json
from models import ImportLayout
from nivel_detector import detectar_nivel_tipo


def _str_cell(val) -> str:
    if val is None:
        return ""
    return str(val).strip()


def parse_plano_xlsx(content: bytes, layout: ImportLayout) -> dict:
    """
    Lê o XLSX usando a configuração do layout e classifica cada linha.
    """
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active

    prefixos: list[str] = json.loads(layout.prefixos_ignorar or "[]")
    col_conta = layout.coluna_conta    # 0-based
    col_desc = layout.coluna_descricao  # 0-based or None

    contas: list[dict] = []
    erros: list[dict] = []
    ignoradas = 0
    n_nivel = {1: 0, 2: 0, 3: 0}

    rows = list(ws.iter_rows(values_only=True))
    wb.close()

    for row_num, row in enumerate(rows, start=1):
        if row_num < layout.linha_inicio:
            continue

        # Linha completamente vazia
        if not any(c for c in row if c is not None):
            ignoradas += 1
            continue

        codigo = _str_cell(row[col_conta] if col_conta < len(row) else None)
        if not codigo:
            ignoradas += 1
            continue

        # Prefixos ignorados
        if any(codigo.startswith(p) for p in prefixos if p):
            ignoradas += 1
            continue

        desc = ""
        if col_desc is not None and col_desc < len(row):
            desc = _str_cell(row[col_desc])
        if not desc:
            desc = codigo  # fallback

        try:
            nt = detectar_nivel_tipo(codigo)
        except ValueError as e:
            erros.append({"linha": row_num, "codigo": codigo, "erro": str(e)})
            continue

        contas.append({
            "conta": codigo,
            "descricao": desc,
            "nivel": nt["nivel"],
            "tipo": nt["tipo"],
        })
        n_nivel[nt["nivel"]] += 1

    return {
        "contas": contas,
        "erros": erros,
        "ignoradas": ignoradas,
        "resumo": {
            "total": len(contas),
            "n1": n_nivel[1],
            "n2": n_nivel[2],
            "n3": n_nivel[3],
        },
    }


def preview_contas(contas: list[dict], n: int = 10) -> list[dict]:
    return contas[:n]
