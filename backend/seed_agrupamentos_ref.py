"""
Seed dos agrupamentos-padrao do Projeto Referencial (Fase A — DRE varejo).

Substitui completamente os agrupamentos antigos (seed_controladoria.py, modelo de
Fluxo de Caixa) pelo novo desenho do Motor DE-PARA/Importacao Referencial — ver
documentos/PROJETO_REFERENCIAL.md.

NAO roda automaticamente no startup do backend (ao contrario de seed_controladoria):
e um reset explicito, disparado manualmente pelo desenvolvedor.

Guards:
- Ambiente: so executa em SQLite local, a menos que --force seja passado explicitamente.
- Dados em uso: se ja existirem vinculos ContaAgrupamento apontando para agrupamentos
  atuais, recusa apagar sem --force (perderia os vinculos).
"""
from sqlalchemy.orm import Session
from models import Agrupamento, ContaAgrupamento

# (slug, descricao, dimensao)
# dimensao: 'contabil' (balde de contas via DE-PARA) | 'departamento' (dimensao
# paralela por secao da loja, origem "itens", nao e subconta)
_AGRUPAMENTOS = [
    ("rec_avista",       "Receita Venda à Vista",                              "contabil"),
    ("rec_aprazo",       "Receita Venda a Prazo",                              "contabil"),
    ("cancel_desc",      "Cancelamentos e Descontos",                          "contabil"),
    ("impostos_venda",   "Impostos sobre Venda",                               "contabil"),
    ("devolucoes",       "Devoluções de Venda",                                "contabil"),
    ("cmv",              "CMV - Custo das Mercadorias Vendidas",               "contabil"),
    ("ajustes_cmv",      "Ajustes de CMV (crédito Simples, estornos, acordos)","contabil"),
    ("desp_venda",       "Despesas com Venda",                                 "contabil"),
    ("desp_venda_fin",   "Despesas com Venda (Financeiro/Cartão)",             "contabil"),
    ("perdas",           "Perdas e Ajustes de Estoque",                        "contabil"),
    ("remuneracao",      "Remuneração",                                        "contabil"),
    ("encargos_remun",   "Encargos sobre Remuneração",                        "contabil"),
    ("beneficios",       "Benefícios",                                        "contabil"),
    ("desp_ocupacao",    "Despesas de Ocupação",                              "contabil"),
    ("desp_admin",       "Despesas Administrativas",                          "contabil"),
    ("desp_comercial",   "Despesas Comerciais",                               "contabil"),
    ("desp_financeira",  "Despesas Financeiras",                              "contabil"),
    ("outras_receitas",  "Outras Receitas Operacionais",                      "contabil"),
    ("outras_despesas",  "Outras Despesas Operacionais",                      "contabil"),
    ("dept_venda_liq",   "Venda Líquida por Departamento",                    "departamento"),
    ("dept_impostos",    "Impostos por Departamento",                        "departamento"),
    ("dept_receita_liq", "Receita Líquida por Departamento",                  "departamento"),
    ("dept_cmv",         "CMV por Departamento",                              "departamento"),
    ("dept_perdas",      "Perdas por Departamento",                           "departamento"),
]


def seed_agrupamentos_ref(db: Session, force: bool = False) -> bool:
    """Retorna True se o reset foi aplicado, False se foi abortado pelo guard de uso."""
    total_atual = db.query(Agrupamento).count()
    vinculos_em_uso = db.query(ContaAgrupamento).count()

    if total_atual and vinculos_em_uso and not force:
        print(f"[seed_ref] ABORTADO: {total_atual} agrupamentos existentes, "
              f"{vinculos_em_uso} vínculo(s) ContaAgrupamento em uso.")
        print("[seed_ref] Rode novamente com --force para apagar e recriar "
              "(os vínculos existentes serão perdidos).")
        return False

    deleted_vinculos = db.query(ContaAgrupamento).delete()
    deleted_agrup = db.query(Agrupamento).delete()
    db.commit()
    if deleted_vinculos or deleted_agrup:
        print(f"[seed_ref] limpos: {deleted_agrup} agrupamentos, "
              f"{deleted_vinculos} vínculos ContaAgrupamento")

    for slug, descricao, dimensao in _AGRUPAMENTOS:
        db.add(Agrupamento(
            nome=descricao,
            slug=slug,
            demonstrativos='["dre"]',
            dimensao=dimensao,
            padrao=True,
            ativo=True,
        ))
    db.commit()

    contabeis = sum(1 for _, _, d in _AGRUPAMENTOS if d == "contabil")
    departamentais = sum(1 for _, _, d in _AGRUPAMENTOS if d == "departamento")
    print(f"[seed_ref] {len(_AGRUPAMENTOS)} agrupamentos inseridos "
          f"({contabeis} contábeis, {departamentais} departamentais)")
    return True


if __name__ == "__main__":
    import argparse
    import sys
    from database import _is_sqlite, SessionLocal

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true",
                         help="Permite rodar fora do SQLite local e apagar agrupamentos em uso")
    args = parser.parse_args()

    if not _is_sqlite and not args.force:
        print("[seed_ref] seed só roda em banco local SQLite — use --force para confirmar em outro ambiente")
        sys.exit(1)

    db = SessionLocal()
    try:
        ok = seed_agrupamentos_ref(db, force=args.force)
        sys.exit(0 if ok else 1)
    finally:
        db.close()
