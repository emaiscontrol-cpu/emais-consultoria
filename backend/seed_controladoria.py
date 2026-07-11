"""
Seed dos agrupamentos padrao compartilhados entre DRE, FC e Orcamento (v3 — 62 itens).
Executado automaticamente no startup do backend.
Substitui o seed antigo (agrupadores_fc) pelos 62 novos caso necessario.
"""
from sqlalchemy.orm import Session
from models import Agrupamento

# (nome, slug)
# slug: snake_case sem acentos, sem prefixo de natureza
# demonstrativos: todos os agrupamentos desta lista sao do fluxo_caixa por padrao
_AGRUPAMENTOS = [
    ("Vendas - Dinheiro",                            "vendas_dinheiro"),
    ("Vendas - Crédito",                             "vendas_credito"),
    ("Vendas - Débito",                              "vendas_debito"),
    ("Vendas - Clientes",                            "vendas_clientes"),
    ("Vendas - Private",                             "vendas_private"),
    ("Vendas - Pix",                                 "vendas_pix"),
    ("Vendas - Cheques",                             "vendas_cheques"),
    ("Vendas - Delivery",                            "vendas_delivery"),
    ("( - ) Devolução de Vendas",                    "devolucao_de_vendas"),
    ("( - ) Extra - Caixa",                          "extra_caixa"),
    ("( - ) Repasse Private",                        "repasse_private"),
    ("( - ) Compras",                                "compras"),
    ("( - ) Impostos Sobre Vendas",                  "impostos_sobre_vendas"),
    ("( + ) Créditos Operacionais",                  "creditos_operacionais"),
    ("( + ) Acordos Comerciais",                     "acordos_comerciais"),
    ("( + ) Devoluções",                             "devolucoes"),
    ("( + ) Cheques Devolvido",                      "cheques_devolvido"),
    ("( - ) Cheques Devolvidos",                     "cheques_devolvidos"),
    ("( - ) Cheques Compensados",                    "cheques_compensados"),
    ("( - ) Pessoal - Salário",                      "pessoal_salario"),
    ("( - ) Pessoal - Férias",                       "pessoal_ferias"),
    ("( - ) Pessoal - 13",                           "pessoal_13"),
    ("( - ) Pessoal - Encargos Sociais",             "pessoal_encargos_sociais"),
    ("( - ) Pessoal - Rescisões",                    "pessoal_rescisoes"),
    ("( - ) Pessoal - Benefícios",                   "pessoal_beneficios"),
    ("( - ) Pessoal - PJ",                           "pessoal_pj"),
    ("( - ) Pessoal - Outros Pagamentos",            "pessoal_outros_pagamentos"),
    ("( - ) Tributária",                             "tributaria"),
    ("( - ) Energia Elétrica",                       "energia_eletrica"),
    ("( - ) Utilidades e Serviços",                  "utilidades_e_servicos"),
    ("( - ) Manutenções",                            "manutencoes"),
    ("( - ) Veículos",                               "veiculos"),
    ("( - ) Manutenção Imóveis",                     "manutencao_imoveis"),
    ("( - ) Propaganda/Marketing",                   "propaganda_marketing"),
    ("( - ) Informática",                            "informatica"),
    ("( - ) Corporativo",                            "corporativo"),
    ("( - ) Ligadas",                                "ligadas"),
    ("( - ) Prestadores de Serviços Operacionais",   "prestadores_de_servicos_operacionais"),
    ("( - ) Viagens",                                "viagens"),
    ("( - ) Expediente",                             "expediente"),
    ("( - ) Embalagens",                             "embalagens"),
    ("( - ) Fretes",                                 "fretes"),
    ("( - ) Indedutíveis",                           "indedutiveis"),
    ("( - ) Almoxarifado",                           "almoxarifado"),
    ("( - ) Taxas Adm de Cartões",                   "taxas_adm_de_cartoes"),
    ("( - ) Aluguel",                                "aluguel"),
    ("( - ) Seguros",                                "seguros"),
    ("( + ) Ganhos Financeiros",                     "ganhos_financeiros"),
    ("( - ) Gastos Financeiros",                     "gastos_financeiros"),
    ("( - ) Despesa de Imposto de Renda",            "despesa_de_imposto_de_renda"),
    ("( - ) Empréstimos",                            "emprestimos_saida"),
    ("( - ) Investimentos/Imobilizado",              "investimentos_imobilizado"),
    ("( - ) Juros/IOF S/ Empréstimos",               "juros_iof_s_emprestimos"),
    ("( - ) Adiantamentos Efetuados",                "adiantamentos_efetuados"),
    ("Empréstimos",                                  "emprestimos"),
    ("Investimento/Imobilizado",                     "investimento_imobilizado"),
    ("( - ) Sócios",                                 "socios"),
    ("( - ) Coligadas",                              "coligadas"),
    ("Resgate",                                      "resgate"),
    ("Aplicações",                                   "aplicacoes"),
    ("Terceiros",                                    "terceiros"),
    ("(+/-) Mvto Transitório",                       "mvto_transitorio"),
]


def seed_agrupadores(db: Session) -> None:
    # Marcador: se 'Vendas - Dinheiro' existir na tabela agrupamentos, seed ja foi aplicado
    if db.query(Agrupamento).filter(Agrupamento.nome == "Vendas - Dinheiro").first():
        total = db.query(Agrupamento).count()
        print(f"[seed] agrupamentos ja populado ({total} registros) — skip")
        return

    # Limpa registros legados se existirem
    deleted = db.query(Agrupamento).delete()
    db.commit()
    if deleted:
        print(f"[seed] {deleted} agrupamentos antigos removidos")

    for nome, slug in _AGRUPAMENTOS:
        db.add(Agrupamento(
            nome=nome,
            slug=slug,
            demonstrativos='["fluxo_caixa"]',
            padrao=True,
            ativo=True,
        ))
    db.commit()

    print(f"[seed] {len(_AGRUPAMENTOS)} agrupamentos inseridos")
    print(f"[seed] slugs: {', '.join(s for _, s in _AGRUPAMENTOS)}")

if __name__ == "__main__":
    import sys
    from database import _is_sqlite, SessionLocal
    if not _is_sqlite:
        print("seed só roda em banco local SQLite")
        sys.exit(1)
    db = SessionLocal()
    try:
        seed_agrupadores(db)
    finally:
        db.close()

