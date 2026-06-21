"""
Seed dos dados padrão do módulo Controladoria:
- 48 Agrupadores FC
- Plano de Contas padrão (template) com hierarquia pai/filho
Executado automaticamente no startup do backend se os dados ainda não existirem.
"""
from sqlalchemy.orm import Session
from models import AgrupadorFC

AGRUPADORES = [
    "Venda Dinheiro",
    "Vendas Crédito",
    "Vendas Débito",
    "Vendas Clientes",
    "Vendas PIX",
    "Vendas - Cheques",
    "(-) Deduções",
    "(-) Compras",
    "(-) Impostos Sobre Vendas",
    "(+) Acordo Comerciais",
    "(+) Trocas/Devoluções Recebidas",
    "(+) Outras Entradas Operacionais",
    "(-) Outras Saídas Operacionais",
    "Tributárias",
    "Fretes",
    "Pessoal - Folha",
    "Pessoal - Benefícios",
    "Utilidades e Serviços",
    "Energia Elétrica",
    "Manutenções e Equipamentos",
    "Veículos",
    "Imóvel",
    "Publicidade",
    "Informática",
    "Terceiros - Adm",
    "Terceiros - OPE",
    "Vendas",
    "Gerais",
    "Seguros",
    "Alugueis",
    "Taxas Adm de Cartões",
    "Diretoria",
    "(-) Recuperação de Despesas",
    "Receita Financeira",
    "Despesas Financeiras",
    "(-) Empréstimos Bancários",
    "(-) Parcelamentos",
    "(-) Imobilizado/Investimentos",
    "(+) Venda Imobilizados",
    "(+) Dividendos Outras Empresas",
    "(+) Adiantamentos Efetuados",
    "(+) Adiantamentos Recebidos",
    "Retirada Sócios",
    "(-) Super Compras",
    "Aplicação Financeira",
    "Resgate",
    "Recurso de Ligadas",
    "Recurso Enviado a Ligadas",
]

# Plano de contas padrão
# Formato: (codigo, nome, tipo, agrupador_nome, codigo_pai)
PLANO_PADRAO = [
    # ── ENTRADAS (raiz) ───────────────────────────────────────────────────────
    ("111102", "Caixa - Tesouraria",                                    "entrada", "Venda Dinheiro",              None),
    ("111299", "(-) Depósitos em Cheques à Liberar",                    "entrada", "(-) Deduções",                None),
    ("112101", "Títulos de Clientes a Receber",                         "entrada", "Vendas Clientes",             None),
    ("112102", "Convênio Loja - Funcionários à Receber",                "entrada", "Vendas Clientes",             None),
    ("112105", "Duplicatas a Receber - Devolução de Compras",           "entrada", "(+) Outras Entradas Operacionais", None),
    ("112108", "Títulos à Receber - PIX",                               "entrada", "Vendas PIX",                  None),
    ("112109", "Títulos à Receber - PIX REDE",                         "entrada", "Vendas PIX",                  None),
    ("112384", "Cartão Débito Alelo Alimentação",                       "entrada", "Vendas Débito",               None),
    ("112387", "Cartão Crédito BIGCARD",                                "entrada", "Vendas Crédito",              None),
    ("112404", "Cartão de Crédito Amex",                                "entrada", "Vendas Crédito",              None),
    ("112415", "Cartão Débito Elo",                                     "entrada", "Vendas Débito",               None),
    ("112416", "Cartão Crédito Elo",                                    "entrada", "Vendas Crédito",              None),
    ("112422", "Cartão Crédito Mastercard",                             "entrada", "Vendas Crédito",              None),
    ("112435", "Cartão Débito Ticket Alimentação",                      "entrada", "Vendas Débito",               None),
    ("112437", "Cartão Crédito SuperCompras Tricard",                   "entrada", "Vendas Crédito",              None),
    ("112440", "Cartão Débito Cabal",                                   "entrada", "Vendas Débito",               None),
    ("112442", "Cartão Débito Mastercard / Maestro",                    "entrada", "Vendas Débito",               None),
    ("112444", "Cartão Débito Valecard",                                "entrada", "Vendas Débito",               None),
    ("112445", "Cartão Crédito Visa",                                   "entrada", "Vendas Crédito",              None),
    ("112447", "Cartão Débito Visa / Eletrocon",                        "entrada", "Vendas Débito",               None),
    ("112701", "Adiantamentos a Fornecedores Nacionais",                "entrada", "(+) Adiantamentos Efetuados", None),
    ("112801", "Adiantamento de Salário - CR",                          "entrada", "(-) Deduções",                None),
    ("112807", "Quebra de Caixa a Descontar",                           "entrada", "(-) Deduções",                None),
    ("112951", "Acordos Comerciais a Receber",                          "entrada", "(+) Acordo Comerciais",       None),
    ("112955", "Outras Contas a Receber - Clientes",                    "entrada", "Vendas Clientes",             None),
    ("222215", "(-) Juros a Transcorrer - Banco Volkswagen",            "entrada", "Receita Financeira",          None),
    ("222217", "(-) Juros a Transcorrer Banco do Brasil S/A",           "entrada", "Receita Financeira",          None),
    ("313101", "Outras Receitas Financeiras - Juros Recebidos",         "entrada", "Receita Financeira",          None),
    ("313102", "Descontos Obtidos",                                     "entrada", "Receita Financeira",          None),
    ("313299", "Outros Créditos Fiscais",                               "entrada", "(+) Outras Entradas Operacionais", None),
    ("333109E","Desp. Financeiras - Juros Antecipação Cartões (E)",     "entrada", "Taxas Adm de Cartões",        None),
    ("333115E","Taxa Administrativa de Cartões (E)",                    "entrada", "Taxas Adm de Cartões",        None),

    # ── SAÍDAS (raiz — grupos) ────────────────────────────────────────────────
    ("111299S","(-) Depósitos em Cheques à Liberar (S)",                "saida",   "(-) Deduções",                None),
    ("112701S","Adiantamentos a Fornecedores Nacionais (S)",            "saida",   "(+) Adiantamentos Efetuados", None),
    ("112704", "Antecipação de Lucros",                                 "saida",   "Retirada Sócios",             None),
    ("112919", "Créditos Tributários a Compensar",                      "saida",   "Tributárias",                 None),
    ("113110", "Matéria Prima e Insumos",                               "saida",   "(-) Compras",                 None),
    ("211101", "Fornecedores de Mercadorias p/ Revenda",                "saida",   "(-) Compras",                 None),
    ("211102", "Fornecedores de Mercadorias p/ Consumo",                "saida",   "(-) Compras",                 None),
    ("211103", "Fornecedores de Serviços",                              "saida",   "Terceiros - OPE",             None),
    ("211105", "Fretes e Carretos a Pagar",                             "saida",   "Fretes",                      None),
    ("211203", "Tributos Municipais a Pagar",                           "saida",   "Tributárias",                 None),
    ("211205", "Taxas Sindicais e Outras Taxas",                        "saida",   "Tributárias",                 None),
    ("211301", "Obrigações por Aquisição de Imobilizado",               "saida",   "(-) Imobilizado/Investimentos", None),
    ("211401", "Salários e Ordenados",                                  "saida",   "Pessoal - Folha",             None),
    ("211404", "Férias a Pagar",                                        "saida",   "Pessoal - Folha",             None),
    ("211406", "Adiantamentos",                                         "saida",   "Pessoal - Folha",             None),
    ("211408", "Rescisões a Pagar",                                     "saida",   "Pessoal - Folha",             None),
    ("211417", "F.G.T.S. Rescisório à Pagar",                          "saida",   "Pessoal - Folha",             None),
    ("211501", "INSS à Recolher",                                       "saida",   "Tributárias",                 None),
    ("211502", "FGTS a Pagar",                                          "saida",   "Tributárias",                 None),
    ("211552", "Simples a Recolher",                                    "saida",   "Tributárias",                 None),
    ("211601", "ICMS a Recolher",                                       "saida",   "Tributárias",                 None),
    ("211602", "ICMS Diferencial de Alíquota à Pagar",                 "saida",   "Tributárias",                 None),
    ("211603", "ICMS Substituição Tributária à Recolher",               "saida",   "Tributárias",                 None),
    ("211606", "IRRF a Recolher",                                       "saida",   "Tributárias",                 None),
    ("211608", "CSLL - Contribuição Social à Recolher",                 "saida",   "Tributárias",                 None),
    ("211610", "Funrural a Recolher",                                   "saida",   "Tributárias",                 None),
    ("211611", "I.R.P.J. - Imposto de Renda a Recolher",               "saida",   "Tributárias",                 None),
    ("211618", "Pis/Cofins/CSLL Retido 5952 à Recolher",               "saida",   "Tributárias",                 None),
    ("211623", "ICMS FEM à Recolher",                                   "saida",   "Tributárias",                 None),
    ("211624", "Antecipação do ICMS - Arroz - à Recolher",             "saida",   "Tributárias",                 None),
    ("211812", "Outras Contas a Pagar - Fornecedor",                    "saida",   "Terceiros - OPE",             None),
    ("211813", "Outras Contas a Pagar",                                 "saida",   "Gerais",                      None),
    ("211903", "Seguros a Pagar",                                       "saida",   "Seguros",                     None),
    ("211910", "Super Compras a Pagar",                                 "saida",   "(-) Super Compras",           None),
    ("212214", "Banco Volkswagen",                                      "saida",   "(-) Parcelamentos",           None),
    ("212216", "Banco do Brasil S/A",                                   "saida",   "(-) Parcelamentos",           None),
    ("212801", "Alugueis a Pagar",                                      "saida",   "Alugueis",                    None),
    ("212212", "Empréstimo SICOOB",                                     "saida",   "(-) Empréstimos Bancários",   None),

    # ── SAÍDAS (grupos pai para sub-contas) ───────────────────────────────────
    ("331GRP", "Pessoal",                                               "saida",   "Pessoal - Folha",             None),
    ("332GRP", "Serviços Terceiros",                                    "saida",   "Terceiros - OPE",             None),
    ("333GRP", "Despesas Financeiras",                                  "saida",   "Despesas Financeiras",        None),
    ("334GRP", "Manutenções",                                           "saida",   "Manutenções e Equipamentos",  None),
    ("335GRP", "Veículos",                                              "saida",   "Veículos",                    None),
    ("336GRP", "Imóvel",                                                "saida",   "Imóvel",                      None),
    ("337GRP", "Publicidade",                                           "saida",   "Publicidade",                 None),
    ("338GRP", "Informática",                                           "saida",   "Informática",                 None),
    ("339GRP", "Suprimentos",                                           "saida",   "Gerais",                      None),
    ("340GRP", "Diretoria",                                             "saida",   "Diretoria",                   None),

    # ── SAÍDAS (filhas de Pessoal — 331GRP) ──────────────────────────────────
    ("331102", "Pessoal - Ordenados e Salários",                        "saida",   "Pessoal - Folha",             "331GRP"),
    ("321202", "Custo das Mercadorias Vendidas - Matéria Prima",        "saida",   "(-) Compras",                 "331GRP"),
    ("331208", "Confraternização e Eventos com Pessoal",                "saida",   "Pessoal - Benefícios",        "331GRP"),
    ("331209", "Serviço de Saúde Ocupacional",                          "saida",   "Pessoal - Benefícios",        "331GRP"),
    ("331112", "Pessoal - Admissões",                                   "saida",   "Pessoal - Folha",             "331GRP"),
    ("331201", "Uniformes e EPI",                                       "saida",   "Pessoal - Benefícios",        "331GRP"),
    ("331203", "Plano de Saúde Unimed",                                 "saida",   "Pessoal - Benefícios",        "331GRP"),
    ("331205", "Benefícios - Exames Admissionais",                      "saida",   "Pessoal - Benefícios",        "331GRP"),
    ("331206", "Vale Alimentação Caju",                                 "saida",   "Pessoal - Benefícios",        "331GRP"),
    ("331207", "Alimentação do Trabalhador - Viagens",                  "saida",   "Pessoal - Benefícios",        "331GRP"),
    ("331204", "Cursos e Treinamentos",                                 "saida",   "Pessoal - Benefícios",        "331GRP"),
    ("331304", "Tributária - Multas Dedutíveis",                        "saida",   "Tributárias",                 "331GRP"),

    # ── SAÍDAS (filhas de Manutenções — 334GRP) ──────────────────────────────
    ("331319", "Aluguel de Máquinas e Equipamentos",                    "saida",   "Manutenções e Equipamentos",  "334GRP"),
    ("331326", "Gás Produção",                                          "saida",   "Utilidades e Serviços",       "334GRP"),
    ("331324", "Embalagens - Bobinas - Etiquetas - Descartáveis",       "saida",   "Gerais",                      "334GRP"),
    ("331350", "Energia Elétrica - AME",                                "saida",   "Energia Elétrica",            "334GRP"),
    ("331401", "Energia Elétrica",                                      "saida",   "Energia Elétrica",            "334GRP"),
    ("331402", "Água e Esgoto",                                         "saida",   "Utilidades e Serviços",       "334GRP"),
    ("331404", "Telefonia Fixa / Móvel / Internet",                     "saida",   "Utilidades e Serviços",       "334GRP"),
    ("331407", "Correios e Entregas Expressas",                         "saida",   "Fretes",                      "334GRP"),
    ("331501", "Loja - Manutenção - Freezers/Câmara Fria",             "saida",   "Manutenções e Equipamentos",  "334GRP"),
    ("331502", "Loja - Manutenção - Equipamentos Loja",                 "saida",   "Manutenções e Equipamentos",  "334GRP"),
    ("331503", "Loja - Manutenção Corretiva/Diversas",                  "saida",   "Manutenções e Equipamentos",  "334GRP"),
    ("331505", "Açougue - Manutenção - Equipamentos/Ferramentas",       "saida",   "Manutenções e Equipamentos",  "334GRP"),
    ("331506", "Açougue - Manutenção - Câmara Fria/Frigorífica",       "saida",   "Manutenções e Equipamentos",  "334GRP"),
    ("331509", "Padaria - Manutenção - Equipamentos/Ferramentas",       "saida",   "Manutenções e Equipamentos",  "334GRP"),

    # ── SAÍDAS (filhas de Veículos — 335GRP) ─────────────────────────────────
    ("331602", "Diretoria - Veículos - Manutenção/Revisões",            "saida",   "Veículos",                    "335GRP"),
    ("331603", "AME - Veículos - Combustível",                          "saida",   "Veículos",                    "335GRP"),
    ("331605", "Loja - Veículos - Manutenção / Revisões / Peças",       "saida",   "Veículos",                    "335GRP"),
    ("331606", "Loja - Veículos - IPVA / Licenciamento / Dpvat",        "saida",   "Veículos",                    "335GRP"),
    ("331608", "Loja - Veículos - Peças e Reposições",                  "saida",   "Veículos",                    "335GRP"),
    ("331609", "Loja - Veículos - Multa de Trânsito",                   "saida",   "Veículos",                    "335GRP"),
    ("331610", "Loja - Veículos - Combustível e Lubrificante",          "saida",   "Veículos",                    "335GRP"),

    # ── SAÍDAS (filhas de Imóvel — 336GRP) ───────────────────────────────────
    ("331701", "Construções",                                           "saida",   "Imóvel",                      "336GRP"),
    ("331702", "Imóvel - Melhorias / Reparos",                          "saida",   "Imóvel",                      "336GRP"),
    ("331703", "Imóvel - Elétrica",                                     "saida",   "Imóvel",                      "336GRP"),

    # ── SAÍDAS (filhas de Publicidade — 337GRP) ───────────────────────────────
    ("331803", "Propaganda - Panfletos e Cartazes",                     "saida",   "Publicidade",                 "337GRP"),
    ("331804", "Propaganda - Gráfica - Panfletos",                      "saida",   "Publicidade",                 "337GRP"),
    ("331807", "Propaganda - Agência de Marketing",                     "saida",   "Publicidade",                 "337GRP"),
    ("331809", "Propaganda - Carro de Som",                             "saida",   "Publicidade",                 "337GRP"),
    ("331813", "Propaganda - Tráfego Pago",                             "saida",   "Publicidade",                 "337GRP"),

    # ── SAÍDAS (filhas de Informática — 338GRP) ───────────────────────────────
    ("331901", "Admin - Informática - Suporte TI - KEEP INFO",          "saida",   "Informática",                 "338GRP"),
    ("331902", "Admin - Informática - Softwares Diversos",              "saida",   "Informática",                 "338GRP"),
    ("331903", "Admin - Informática - Peças/Equipamentos/Manutenção",   "saida",   "Informática",                 "338GRP"),
    ("331906", "Admin - Informática - Mensalidade Sistema RP INFO",     "saida",   "Informática",                 "338GRP"),

    # ── SAÍDAS (filhas de Serviços Terceiros — 332GRP) ────────────────────────
    ("332001", "Admin - Honorários - Consultoria",                      "saida",   "Terceiros - Adm",             "332GRP"),
    ("332003", "Auditoria",                                             "saida",   "Terceiros - Adm",             "332GRP"),
    ("332004", "Admin - Honorários - Contabilidade",                    "saida",   "Terceiros - Adm",             "332GRP"),
    ("332006", "Serviços Prestados Pessoa Jurídica",                    "saida",   "Terceiros - OPE",             "332GRP"),
    ("332102", "Serviços - Vigilância",                                 "saida",   "Terceiros - OPE",             "332GRP"),
    ("332103", "Serviços - Fretes/Correio/Taxi/Entregas",               "saida",   "Fretes",                      "332GRP"),
    ("332104", "Serviços - Detetização da Loja",                        "saida",   "Terceiros - OPE",             "332GRP"),
    ("332105", "Serviços - Coleta de Lixo",                             "saida",   "Terceiros - OPE",             "332GRP"),
    ("332106", "Serviços - Diversos",                                   "saida",   "Terceiros - OPE",             "332GRP"),
    ("332202", "Hospedagens / Estadias",                                "saida",   "Gerais",                      "332GRP"),

    # ── SAÍDAS (filhas de Suprimentos — 339GRP) ───────────────────────────────
    ("332501", "Suprimentos - Impressos/Materiais",                     "saida",   "Gerais",                      "339GRP"),
    ("332502", "Material de Escritório",                                "saida",   "Gerais",                      "339GRP"),
    ("332503", "Material de Limpeza",                                   "saida",   "Gerais",                      "339GRP"),
    ("332602", "Açougue - Suprimentos - Embalagens",                    "saida",   "Gerais",                      "339GRP"),
    ("332608", "Loja - Suprimentos - Bobinas",                          "saida",   "Gerais",                      "339GRP"),

    # ── SAÍDAS (filhas de Diretoria — 340GRP) ────────────────────────────────
    ("332701", "Pró-Labore Diretoria",                                  "saida",   "Diretoria",                   "340GRP"),
    ("332702", "Benefícios da Diretoria - GASTOS",                      "saida",   "Diretoria",                   "340GRP"),

    # ── SAÍDAS (filhas de Despesas Financeiras — 333GRP) ─────────────────────
    ("333101", "Juros e Taxas de Empréstimos e Financiamentos",         "saida",   "Despesas Financeiras",        "333GRP"),
    ("333103", "Despesas Financeiras - Descontos Concedidos",           "saida",   "Despesas Financeiras",        "333GRP"),
    ("333106", "Juros/Multas Parcelamentos Federais",                   "saida",   "Despesas Financeiras",        "333GRP"),
    ("333108", "Tarifas Bancárias",                                     "saida",   "Despesas Financeiras",        "333GRP"),
    ("333109", "Desp. Financeiras - Juros Antecipação Cartões",         "saida",   "Taxas Adm de Cartões",        "333GRP"),
    ("333111", "Tarifa s/ Cobrança",                                    "saida",   "Despesas Financeiras",        "333GRP"),
    ("333114", "Aluguel P.O.S.",                                        "saida",   "Taxas Adm de Cartões",        "333GRP"),
    ("333115", "Taxa Administrativa de Cartões",                        "saida",   "Taxas Adm de Cartões",        "333GRP"),
    ("333116", "Tributos Passivos",                                     "saida",   "Tributárias",                 "333GRP"),
    ("333117", "Taxa Cartão - Anuidades",                               "saida",   "Taxas Adm de Cartões",        "333GRP"),
    ("333211", "Loja - Perdas - Falta de Caixa",                        "saida",   "(-) Recuperação de Despesas", "333GRP"),
]


def seed_agrupadores(db: Session):
    existentes = db.query(AgrupadorFC).count()
    if existentes > 0:
        return
    for nome in AGRUPADORES:
        db.add(AgrupadorFC(nome=nome, padrao=True))
    db.commit()
    print(f"[seed] {len(AGRUPADORES)} agrupadores criados.")


