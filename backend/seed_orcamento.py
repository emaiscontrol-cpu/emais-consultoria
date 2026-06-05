"""
Seed do template de Orçamento — Varejo SC
Executa uma única vez (idempotente).
"""
from models import Plano, PlanoItem

# ── Estrutura DRE baseada na planilha ORCAMENTO - SC 3.11.xlsx ──────────────
# Campos: (ordem, agrupamento, conta, descricao, tipo, movimento)
#   tipo=None   → conta editável comum
#   tipo='TT'   → subtotal calculado (não editável)
#   tipo='GRP'  → cabeçalho de grupo (sem valor)
#   tipo='RES'  → resultado final (EBITDA)

ITENS_VAREJO_SC = [
    # ── RECEITA ─────────────────────────────────────────────────────────────
    (1,  "RECEITA",        "FAT",    "Faturamento Bruto Operacional",            None,   "Receita"),
    (2,  "RECEITA",        "DED",    "( - ) Deduções da Receita Bruta",          None,   "Despesa"),
    (3,  "RECEITA",        "RLQ",    "( = ) Receita Líquida",                    "TT",   None),
    # ── CUSTOS VARIÁVEIS ────────────────────────────────────────────────────
    (4,  "CUSTOS_VAR",     "CMV",    "( - ) Custos Variáveis (Compras / CMV)",   None,   "Despesa"),
    (5,  "CUSTOS_VAR",     "MV",     "( = ) Margem de Venda",                    "TT",   None),
    # ── DESPESAS VARIÁVEIS ──────────────────────────────────────────────────
    (6,  "DESPESAS_VAR",   "DV",     "( - ) Despesas Variáveis",                 None,   "Despesa"),
    (7,  "DESPESAS_VAR",   "MC",     "( = ) Margem de Contribuição",             "TT",   None),
    # ── CUSTOS FIXOS DIRETOS (FOLHA) ─────────────────────────────────────────
    (8,  "CUSTOS_FIX_DIR", "CFD",    "( - ) Custos / Despesas Fixas Diretas (Folha/Pessoal)", None, "Despesa"),
    (9,  "CUSTOS_FIX_DIR", "MC2",    "( = ) Margem de Contribuição II",          "TT",   None),
    # ── CUSTOS FIXOS INDIRETOS ──────────────────────────────────────────────
    (10, "CUSTOS_FIX_IND", "CFI",    "Custos e Despesas Fixas Indiretas",        "GRP",  None),
    (11, "CUSTOS_FIX_IND", "A1",     "( - ) Despesas Tributárias",               None,   "Despesa"),
    (12, "CUSTOS_FIX_IND", "A3",     "( - ) Utilidades e Serviços",              None,   "Despesa"),
    (13, "CUSTOS_FIX_IND", "A4",     "( - ) Manutenções",                        None,   "Despesa"),
    (14, "CUSTOS_FIX_IND", "A8",     "( - ) Informática",                        None,   "Despesa"),
    (15, "CUSTOS_FIX_IND", "A10",    "( - ) Serviços de Terceiros",              None,   "Despesa"),
    (16, "CUSTOS_FIX_IND", "A14",    "( - ) Material de Expediente",             None,   "Despesa"),
    (17, "CUSTOS_FIX_IND", "A16",    "( - ) Despesas Gerais",                    None,   "Despesa"),
    (18, "CUSTOS_FIX_IND", "A23",    "( - ) Taxas Adm de Cartões",               None,   "Despesa"),
    (19, "CUSTOS_FIX_IND", "A7",     "( - ) Marketing / Verbas",                 None,   "Despesa"),
    (20, "CUSTOS_FIX_IND", "A5",     "( - ) Despesas com Veículos",              None,   "Despesa"),
    (21, "CUSTOS_FIX_IND", "A11",    "( - ) Despesas com Viagens",               None,   "Despesa"),
    (22, "CUSTOS_FIX_IND", "B5",     "( - ) Trocas / Devoluções",                None,   "Despesa"),
    (23, "CUSTOS_FIX_IND", "TCI",    "( = ) Total Custos e Despesas Indiretas",  "TT",   None),
    # ── OUTRAS RECEITAS ──────────────────────────────────────────────────────
    (24, "OUTRAS_REC",     "ORO",    "( + ) Outras Receitas Operacionais",       None,   "Receita"),
    # ── RESULTADO ────────────────────────────────────────────────────────────
    (25, "RESULTADO",      "EBITDA", "Lucro das Operações (EBITDA)",             "RES",  None),
]


def seed_orcamento(db):
    """Cria o plano Varejo SC se ainda não existir."""
    existe = db.query(Plano).filter(Plano.nome == "Varejo SC — Padrão").first()
    if existe:
        return

    plano = Plano(
        nome="Varejo SC — Padrão",
        descricao="Template DRE para varejo — estrutura baseada no modelo SC (importado da planilha ORCAMENTO - SC 3.11.xlsx)",
    )
    db.add(plano)
    db.flush()

    for ordem, agrup, conta, desc, tipo, mov in ITENS_VAREJO_SC:
        db.add(PlanoItem(
            plano_id    = plano.id,
            ordem       = ordem,
            agrupamento = agrup,
            conta       = conta,
            descricao   = desc,
            tipo        = tipo,
            modulo      = "O",
            movimento   = mov,
        ))

    db.commit()
    print(f"[seed_orcamento] Plano '{plano.nome}' criado com {len(ITENS_VAREJO_SC)} itens.")
