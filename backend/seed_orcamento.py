"""
Seed do template de Orçamento — Varejo SC
Executa uma única vez (idempotente).
"""
from models import Plano, PlanoItem

# ── Estrutura DRE baseada na planilha ORCAMENTO - SC 3.11.xlsx ──────────────
# Campos: (ordem, agrupamento, conta, descricao, tipo, movimento, formula)
#   tipo=None   → conta editável comum
#   tipo='TT'   → subtotal calculado (não editável)
#   tipo='GRP'  → cabeçalho de grupo (sem valor)
#   tipo='RES'  → resultado final (EBITDA)
#
# Fórmulas (referências a 'conta' ou 'agrupamento'):
#   tokens separados por espaço com operadores + e -
#   ex: "FAT - DED" significa valor_FAT - valor_DED

ITENS_VAREJO_SC = [
    # ── RECEITA ─────────────────────────────────────────────────────────────
    (1,  "RECEITA",        "FAT",    "Faturamento Bruto Operacional",                         None,   "Receita",  None),
    (2,  "RECEITA",        "DED",    "( - ) Deduções da Receita Bruta",                       None,   "Despesa",  None),
    (3,  "RECEITA",        "RLQ",    "( = ) Receita Líquida",                                 "TT",   None,       "FAT - DED"),
    # ── CUSTOS VARIÁVEIS ────────────────────────────────────────────────────
    (4,  "CUSTOS_VAR",     "CMV",    "( - ) Custos Variáveis (Compras / CMV)",                None,   "Despesa",  None),
    (5,  "CUSTOS_VAR",     "MV",     "( = ) Margem de Venda",                                 "TT",   None,       "RLQ - CMV"),
    # ── DESPESAS VARIÁVEIS ──────────────────────────────────────────────────
    (6,  "DESPESAS_VAR",   "DV",     "( - ) Despesas Variáveis",                              None,   "Despesa",  None),
    (7,  "DESPESAS_VAR",   "MC",     "( = ) Margem de Contribuição",                          "TT",   None,       "MV - DV"),
    # ── CUSTOS FIXOS DIRETOS (FOLHA) ─────────────────────────────────────────
    (8,  "CUSTOS_FIX_DIR", "CFD",    "( - ) Custos / Despesas Fixas Diretas (Folha/Pessoal)", None,   "Despesa",  None),
    (9,  "CUSTOS_FIX_DIR", "MC2",    "( = ) Margem de Contribuição II",                       "TT",   None,       "MC - CFD"),
    # ── CUSTOS FIXOS INDIRETOS ──────────────────────────────────────────────
    (10, "CUSTOS_FIX_IND", "CFI",    "Custos e Despesas Fixas Indiretas",                     "GRP",  None,       None),
    (11, "CUSTOS_FIX_IND", "A1",     "( - ) Despesas Tributárias",                            None,   "Despesa",  None),
    (12, "CUSTOS_FIX_IND", "A3",     "( - ) Utilidades e Serviços",                           None,   "Despesa",  None),
    (13, "CUSTOS_FIX_IND", "A4",     "( - ) Manutenções",                                     None,   "Despesa",  None),
    (14, "CUSTOS_FIX_IND", "A8",     "( - ) Informática",                                     None,   "Despesa",  None),
    (15, "CUSTOS_FIX_IND", "A10",    "( - ) Serviços de Terceiros",                           None,   "Despesa",  None),
    (16, "CUSTOS_FIX_IND", "A14",    "( - ) Material de Expediente",                          None,   "Despesa",  None),
    (17, "CUSTOS_FIX_IND", "A16",    "( - ) Despesas Gerais",                                 None,   "Despesa",  None),
    (18, "CUSTOS_FIX_IND", "A23",    "( - ) Taxas Adm de Cartões",                            None,   "Despesa",  None),
    (19, "CUSTOS_FIX_IND", "A7",     "( - ) Marketing / Verbas",                              None,   "Despesa",  None),
    (20, "CUSTOS_FIX_IND", "A5",     "( - ) Despesas com Veículos",                           None,   "Despesa",  None),
    (21, "CUSTOS_FIX_IND", "A11",    "( - ) Despesas com Viagens",                            None,   "Despesa",  None),
    (22, "CUSTOS_FIX_IND", "B5",     "( - ) Trocas / Devoluções",                             None,   "Despesa",  None),
    (23, "CUSTOS_FIX_IND", "TCI",    "( = ) Total Custos e Despesas Indiretas",               "TT",   None,       "CUSTOS_FIX_IND"),
    # ── OUTRAS RECEITAS ──────────────────────────────────────────────────────
    (24, "OUTRAS_REC",     "ORO",    "( + ) Outras Receitas Operacionais",                    None,   "Receita",  None),
    # ── RESULTADO ────────────────────────────────────────────────────────────
    (25, "RESULTADO",      "EBITDA", "Lucro das Operações (EBITDA)",                          "RES",  None,       "MC2 - TCI + ORO"),
]

# Mapa conta → formula para atualização de itens existentes
_FORMULAS_SC = {row[2]: row[6] for row in ITENS_VAREJO_SC if row[6]}


def _atualizar_formulas(db, plano):
    """Atualiza o campo formula nos itens já existentes do plano."""
    for item in plano.itens:
        nova = _FORMULAS_SC.get(item.conta)
        if nova and item.formula != nova:
            item.formula = nova
    db.commit()


def seed_orcamento(db):
    """Cria o plano Varejo SC se ainda não existir; sempre atualiza fórmulas."""
    plano = db.query(Plano).filter(Plano.nome == "Varejo SC — Padrão").first()

    if not plano:
        plano = Plano(
            nome="Varejo SC — Padrão",
            descricao="Template DRE para varejo — estrutura baseada no modelo SC (importado da planilha ORCAMENTO - SC 3.11.xlsx)",
        )
        db.add(plano)
        db.flush()

        for ordem, agrup, conta, desc, tipo, mov, formula in ITENS_VAREJO_SC:
            db.add(PlanoItem(
                plano_id    = plano.id,
                ordem       = ordem,
                agrupamento = agrup,
                conta       = conta,
                descricao   = desc,
                tipo        = tipo,
                modulo      = "D,O",
                movimento   = mov,
                formula     = formula,
            ))

        db.commit()
        print(f"[seed_orcamento] Plano '{plano.nome}' criado com {len(ITENS_VAREJO_SC)} itens.")
    else:
        _atualizar_formulas(db, plano)
