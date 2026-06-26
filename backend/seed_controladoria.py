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
    ("Vendas - Dinheiro",                         "vendas_dinheiro"),
    ("Vendas - Credito",                          "vendas_credito"),
    ("Vendas - Debito",                           "vendas_debito"),
    ("Vendas - Clientes",                         "vendas_clientes"),
    ("Vendas - Private",                          "vendas_private"),
    ("Vendas - Pix",                              "vendas_pix"),
    ("Vendas - Cheques",                          "vendas_cheques"),
    ("Vendas - Delivery",                         "vendas_delivery"),
    ("( - ) Devolucao de Vendas",                 "devolucao_de_vendas"),
    ("( - ) Extra - Caixa",                       "extra_caixa"),
    ("( - ) Repasse Private",                     "repasse_private"),
    ("( - ) Compras",                             "compras"),
    ("( - ) Impostos Sobre Vendas",               "impostos_sobre_vendas"),
    ("( + ) Creditos Operacionais",               "creditos_operacionais"),
    ("( + ) Acordos Comerciais",                  "acordos_comerciais"),
    ("( + ) Devolucoes",                          "devolucoes"),
    ("( + ) Cheques Devolvido",                   "cheques_devolvido"),
    ("( - ) Cheques Devolvidos",                  "cheques_devolvidos"),
    ("( - ) Cheques Compensados",                 "cheques_compensados"),
    ("( - ) Pessoal - Salario",                   "pessoal_salario"),
    ("( - ) Pessoal - Ferias",                    "pessoal_ferias"),
    ("( - ) Pessoal - 13",                        "pessoal_13"),
    ("( - ) Pessoal - Encargos Sociais",          "pessoal_encargos_sociais"),
    ("( - ) Pessoal - Rescisoes",                 "pessoal_rescisoes"),
    ("( - ) Pessoal - Beneficios",                "pessoal_beneficios"),
    ("( - ) Pessoal - PJ",                        "pessoal_pj"),
    ("( - ) Pessoal - Outros Pagamentos",         "pessoal_outros_pagamentos"),
    ("( - ) Tributaria",                          "tributaria"),
    ("( - ) Energia Eletrica",                    "energia_eletrica"),
    ("( - ) Utilidades e Servicos",               "utilidades_e_servicos"),
    ("( - ) Manutencoes",                         "manutencoes"),
    ("( - ) Veiculos",                            "veiculos"),
    ("( - ) Manutencao Imoveis",                  "manutencao_imoveis"),
    ("( - ) Propaganda/Marketing",                "propaganda_marketing"),
    ("( - ) Informatica",                         "informatica"),
    ("( - ) Corporativo",                         "corporativo"),
    ("( - ) Ligadas",                             "ligadas"),
    ("( - ) Prestadores de Servicos Operacionais","prestadores_de_servicos_operacionais"),
    ("( - ) Viagens",                             "viagens"),
    ("( - ) Expediente",                          "expediente"),
    ("( - ) Embalagens",                          "embalagens"),
    ("( - ) Fretes",                              "fretes"),
    ("( - ) Indedutiveis",                        "indedutiveis"),
    ("( - ) Almoxarifado",                        "almoxarifado"),
    ("( - ) Taxas Adm de Cartoes",                "taxas_adm_de_cartoes"),
    ("( - ) Aluguel",                             "aluguel"),
    ("( - ) Seguros",                             "seguros"),
    ("( + ) Ganhos Financeiros",                  "ganhos_financeiros"),
    ("( - ) Gastos Financeiros",                  "gastos_financeiros"),
    ("( - ) Despesa de Imposto de Renda",         "despesa_de_imposto_de_renda"),
    ("( - ) Emprestimos",                         "emprestimos_saida"),
    ("( - ) Investimentos/Imobilizado",           "investimentos_imobilizado"),
    ("( - ) Juros/IOF S/ Emprestimos",            "juros_iof_s_emprestimos"),
    ("( - ) Adiantamentos Efetuados",             "adiantamentos_efetuados"),
    ("Emprestimos",                               "emprestimos"),
    ("Investimento/Imobilizado",                  "investimento_imobilizado"),
    ("( - ) Socios",                              "socios"),
    ("( - ) Coligadas",                           "coligadas"),
    ("Resgate",                                   "resgate"),
    ("Aplicacoes",                                "aplicacoes"),
    ("Terceiros",                                 "terceiros"),
    ("(+/-) Mvto Transitorio",                    "mvto_transitorio"),
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
