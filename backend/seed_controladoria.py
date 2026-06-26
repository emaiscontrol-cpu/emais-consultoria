"""
Seed dos agrupadores padrao do Fluxo de Caixa (v2 — 62 itens).
Executado automaticamente no startup do backend.
Substitui o seed antigo (48 itens nomes legados) pelos 62 novos caso necessario.
"""
from sqlalchemy.orm import Session
from models import AgrupadorFC

# (nome, natureza, slug)
# natureza: "soma" | "subtrai" | "neutro"
# slug: snake_case sem acentos, sem prefixo de natureza
# demonstrativos: todos os agrupadores desta lista sao exclusivos do fluxo_caixa
_AGRUPADORES = [
    ("Vendas - Dinheiro",                         "soma",    "vendas_dinheiro"),
    ("Vendas - Credito",                          "soma",    "vendas_credito"),
    ("Vendas - Debito",                           "soma",    "vendas_debito"),
    ("Vendas - Clientes",                         "soma",    "vendas_clientes"),
    ("Vendas - Private",                          "soma",    "vendas_private"),
    ("Vendas - Pix",                              "soma",    "vendas_pix"),
    ("Vendas - Cheques",                          "soma",    "vendas_cheques"),
    ("Vendas - Delivery",                         "soma",    "vendas_delivery"),
    ("( - ) Devolucao de Vendas",                 "subtrai", "devolucao_de_vendas"),
    ("( - ) Extra - Caixa",                       "subtrai", "extra_caixa"),
    ("( - ) Repasse Private",                     "subtrai", "repasse_private"),
    ("( - ) Compras",                             "subtrai", "compras"),
    ("( - ) Impostos Sobre Vendas",               "subtrai", "impostos_sobre_vendas"),
    ("( + ) Creditos Operacionais",               "soma",    "creditos_operacionais"),
    ("( + ) Acordos Comerciais",                  "soma",    "acordos_comerciais"),
    ("( + ) Devolucoes",                          "soma",    "devolucoes"),
    ("( + ) Cheques Devolvido",                   "soma",    "cheques_devolvido"),
    ("( - ) Cheques Devolvidos",                  "subtrai", "cheques_devolvidos"),
    ("( - ) Cheques Compensados",                 "subtrai", "cheques_compensados"),
    ("( - ) Pessoal - Salario",                   "subtrai", "pessoal_salario"),
    ("( - ) Pessoal - Ferias",                    "subtrai", "pessoal_ferias"),
    ("( - ) Pessoal - 13",                        "subtrai", "pessoal_13"),
    ("( - ) Pessoal - Encargos Sociais",          "subtrai", "pessoal_encargos_sociais"),
    ("( - ) Pessoal - Rescisoes",                 "subtrai", "pessoal_rescisoes"),
    ("( - ) Pessoal - Beneficios",                "subtrai", "pessoal_beneficios"),
    ("( - ) Pessoal - PJ",                        "subtrai", "pessoal_pj"),
    ("( - ) Pessoal - Outros Pagamentos",         "subtrai", "pessoal_outros_pagamentos"),
    ("( - ) Tributaria",                          "subtrai", "tributaria"),
    ("( - ) Energia Eletrica",                    "subtrai", "energia_eletrica"),
    ("( - ) Utilidades e Servicos",               "subtrai", "utilidades_e_servicos"),
    ("( - ) Manutencoes",                         "subtrai", "manutencoes"),
    ("( - ) Veiculos",                            "subtrai", "veiculos"),
    ("( - ) Manutencao Imoveis",                  "subtrai", "manutencao_imoveis"),
    ("( - ) Propaganda/Marketing",                "subtrai", "propaganda_marketing"),
    ("( - ) Informatica",                         "subtrai", "informatica"),
    ("( - ) Corporativo",                         "subtrai", "corporativo"),
    ("( - ) Ligadas",                             "subtrai", "ligadas"),
    ("( - ) Prestadores de Servicos Operacionais","subtrai", "prestadores_de_servicos_operacionais"),
    ("( - ) Viagens",                             "subtrai", "viagens"),
    ("( - ) Expediente",                          "subtrai", "expediente"),
    ("( - ) Embalagens",                          "subtrai", "embalagens"),
    ("( - ) Fretes",                              "subtrai", "fretes"),
    ("( - ) Indedutiveis",                        "subtrai", "indedutiveis"),
    ("( - ) Almoxarifado",                        "subtrai", "almoxarifado"),
    ("( - ) Taxas Adm de Cartoes",                "subtrai", "taxas_adm_de_cartoes"),
    ("( - ) Aluguel",                             "subtrai", "aluguel"),
    ("( - ) Seguros",                             "subtrai", "seguros"),
    ("( + ) Ganhos Financeiros",                  "soma",    "ganhos_financeiros"),
    ("( - ) Gastos Financeiros",                  "subtrai", "gastos_financeiros"),
    ("( - ) Despesa de Imposto de Renda",         "subtrai", "despesa_de_imposto_de_renda"),
    ("( - ) Emprestimos",                         "subtrai", "emprestimos_saida"),
    ("( - ) Investimentos/Imobilizado",           "subtrai", "investimentos_imobilizado"),
    ("( - ) Juros/IOF S/ Emprestimos",            "subtrai", "juros_iof_s_emprestimos"),
    ("( - ) Adiantamentos Efetuados",             "subtrai", "adiantamentos_efetuados"),
    ("Emprestimos",                               "soma",    "emprestimos"),
    ("Investimento/Imobilizado",                  "soma",    "investimento_imobilizado"),
    ("( - ) Socios",                              "subtrai", "socios"),
    ("( - ) Coligadas",                           "subtrai", "coligadas"),
    ("Resgate",                                   "soma",    "resgate"),
    ("Aplicacoes",                                "soma",    "aplicacoes"),
    ("Terceiros",                                 "soma",    "terceiros"),
    ("(+/-) Mvto Transitorio",                    "neutro",  "mvto_transitorio"),
]


def seed_agrupadores(db: Session) -> None:
    # Marcador: se 'Vendas - Dinheiro' existir, o novo seed ja foi aplicado
    if db.query(AgrupadorFC).filter(AgrupadorFC.nome == "Vendas - Dinheiro").first():
        total = db.query(AgrupadorFC).count()
        print(f"[seed] agrupadores_fc ja populado com novo seed ({total} registros) — skip")
        return

    # Limpa seed legado (48 itens com nomes diferentes)
    deleted = db.query(AgrupadorFC).delete()
    db.commit()
    if deleted:
        print(f"[seed] {deleted} agrupadores antigos removidos")

    for nome, natureza, slug in _AGRUPADORES:
        db.add(AgrupadorFC(
            nome=nome,
            natureza=natureza,
            slug=slug,
            demonstrativos='["fluxo_caixa"]',
            padrao=True,
            ativo=True,
        ))
    db.commit()

    soma    = sum(1 for _, n, _ in _AGRUPADORES if n == "soma")
    subtrai = sum(1 for _, n, _ in _AGRUPADORES if n == "subtrai")
    neutro  = sum(1 for _, n, _ in _AGRUPADORES if n == "neutro")
    print(f"[seed] {len(_AGRUPADORES)} agrupadores FC inseridos | soma={soma} subtrai={subtrai} neutro={neutro}")
    print(f"[seed] slugs gerados: {', '.join(s for _, _, s in _AGRUPADORES)}")
