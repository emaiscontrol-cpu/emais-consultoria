"""
Seed do template de Orçamento — Varejo SC
Executa uma única vez (idempotente).
"""
from models import Plano, PlanoItem

# ── Estrutura DRE baseada na planilha ORCAMENTO - SC 3.11.xlsx ──────────────
# Campos: (ordem, agrupamento, conta, descricao, tipo, movimento, formula)
#   tipo=None   → conta editável comum (NN)
#   tipo='TT'   → subtotal calculado (não editável)
#   tipo='GRP'  → cabeçalho de grupo (sem valor)
#   tipo='RES'  → resultado final (EBITDA)
#
# Lógica de fórmulas:
#   Tokens separados por espaço com operadores + e -
#   - Nome de agrupamento  → soma de todos os NNs daquele grupo
#   - Código de conta TT   → resultado calculado de um TT anterior
#   ex: "RLQ - CUSTOS_VAR" = valor do TT RLQ  menos  soma do grupo CUSTOS_VAR

ITENS_VAREJO_SC = [
    # ── RECEITA ──────────────────────────────────────────────────────────────
    # RECEITA  = contas Analíticas de faturamento bruto
    # DEDUCOES = contas Analíticas de deduções de receita
    # RLQ soma os dois grupos: RECEITA - DEDUCOES
    (1,  "RECEITA",        "FAT",    "Faturamento Bruto Operacional",                         "AN",  "Receita",  None),
    (2,  "DEDUCOES",       "DED",    "( - ) Deduções da Receita Bruta",                       "AN",  "Despesa",  None),
    (3,  "RECEITA",        "RLQ",    "( = ) Receita Líquida",                                 "TT",  None,       "RECEITA - DEDUCOES"),
    # ── CUSTOS VARIÁVEIS ─────────────────────────────────────────────────────
    (4,  "CUSTOS_VAR",     "CMV",    "( - ) Custos Variáveis (Compras / CMV)",                "AN",  "Despesa",  None),
    (5,  "CUSTOS_VAR",     "MV",     "( = ) Margem de Venda",                                 "TT",  None,       "RLQ - CUSTOS_VAR"),
    # ── DESPESAS VARIÁVEIS ───────────────────────────────────────────────────
    (6,  "DESPESAS_VAR",   "DV",     "( - ) Despesas Variáveis",                              "AN",  "Despesa",  None),
    (7,  "DESPESAS_VAR",   "MC",     "( = ) Margem de Contribuição",                          "TT",  None,       "MV - DESPESAS_VAR"),
    # ── CUSTOS FIXOS DIRETOS (FOLHA) ─────────────────────────────────────────
    (8,  "CUSTOS_FIX_DIR", "CFD",    "( - ) Custos / Despesas Fixas Diretas (Folha/Pessoal)", "AN",  "Despesa",  None),
    (9,  "CUSTOS_FIX_DIR", "MC2",    "( = ) Margem de Contribuição II",                       "TT",  None,       "MC - CUSTOS_FIX_DIR"),
    # ── CUSTOS FIXOS INDIRETOS ───────────────────────────────────────────────
    # Todas as AN abaixo pertencem ao grupo CUSTOS_FIX_IND
    # TCI as soma integralmente via agrupamento: formula = "CUSTOS_FIX_IND"
    (11, "CUSTOS_FIX_IND", "A1",     "( - ) Despesas Tributárias",                            "AN",  "Despesa",  None),
    (12, "CUSTOS_FIX_IND", "A3",     "( - ) Utilidades e Serviços",                           "AN",  "Despesa",  None),
    (13, "CUSTOS_FIX_IND", "A4",     "( - ) Manutenções",                                     "AN",  "Despesa",  None),
    (14, "CUSTOS_FIX_IND", "A8",     "( - ) Informática",                                     "AN",  "Despesa",  None),
    (15, "CUSTOS_FIX_IND", "A10",    "( - ) Serviços de Terceiros",                           "AN",  "Despesa",  None),
    (16, "CUSTOS_FIX_IND", "A14",    "( - ) Material de Expediente",                          "AN",  "Despesa",  None),
    (17, "CUSTOS_FIX_IND", "A16",    "( - ) Despesas Gerais",                                 "AN",  "Despesa",  None),
    (18, "CUSTOS_FIX_IND", "A23",    "( - ) Taxas Adm de Cartões",                            "AN",  "Despesa",  None),
    (19, "CUSTOS_FIX_IND", "A7",     "( - ) Marketing / Verbas",                              "AN",  "Despesa",  None),
    (20, "CUSTOS_FIX_IND", "A5",     "( - ) Despesas com Veículos",                           "AN",  "Despesa",  None),
    (21, "CUSTOS_FIX_IND", "A11",    "( - ) Despesas com Viagens",                            "AN",  "Despesa",  None),
    (22, "CUSTOS_FIX_IND", "B5",     "( - ) Trocas / Devoluções",                             "AN",  "Despesa",  None),
    (23, "CUSTOS_FIX_IND", "TCI",    "( = ) Total Custos e Despesas Indiretas",               "TT",  None,       "CUSTOS_FIX_IND"),
    # ── OUTRAS RECEITAS ──────────────────────────────────────────────────────
    (24, "OUTRAS_REC",     "ORO",    "( + ) Outras Receitas Operacionais",                    "AN",  "Receita",  None),
    # ── RESULTADO ────────────────────────────────────────────────────────────
    # EBITDA = MC2 (código TT) − TCI (código TT) + OUTRAS_REC (agrupamento AN)
    (25, "RESULTADO",      "EBITDA", "Lucro das Operações (EBITDA)",                          "RES", None,       "MC2 - TCI + OUTRAS_REC"),
]

# Mapas para sincronização de itens já existentes no banco
_FORMULAS_SC     = {row[2]: row[6] for row in ITENS_VAREJO_SC if row[6]}
_AGRUPAMENTOS_SC = {row[2]: row[1] for row in ITENS_VAREJO_SC}


def _atualizar_formulas(db, plano):
    """Corrige formulas e agrupamentos dos itens existentes para aderir ao template."""
    alterados = 0
    for item in plano.itens:
        nova_formula = _FORMULAS_SC.get(item.conta)
        novo_agrup   = _AGRUPAMENTOS_SC.get(item.conta)
        if nova_formula is not None and item.formula != nova_formula:
            item.formula = nova_formula
            alterados += 1
        if novo_agrup is not None and item.agrupamento != novo_agrup:
            item.agrupamento = novo_agrup
            alterados += 1
    if alterados:
        db.commit()
        print(f"[seed_orcamento] {alterados} campo(s) corrigido(s).")


def seed_orcamento(db):
    """Cria o plano Varejo SC se ainda não existir; sempre sincroniza fórmulas e agrupamentos."""
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
