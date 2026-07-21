"""
Template DRE referencial da Controladoria E Mais — MODELO DEFINITIVO, Camada 1.

Cria o template "Controladoria - DRE Varejo" (referencial, universal por segmento
Varejo Alimentar) com o ESQUELETO ESTRUTURAL REAL da DRE de varejo alimentar:
totalizadoras e subgrupos (níveis A=1, C=2, D=3, E=4; modo folha/soma_filhos/formula).

Camada 1 = só o esqueleto de totalizadoras. As folhas ficam SEM vínculo de conta
(o de-para conta→linha vem na fase de importação — Camada 2). Não inclui departamentos
(Camada 3) nem as folhas contábeis individuais (Camada 2). Onde uma linha soma_filhos
ainda não tem filhas, ela resolve para 0 (sem erro). Ver documentos/PROJETO_REFERENCIAL.md.

NÃO roda no startup — carga manual. Guards: só SQLite local (a menos que --force).
O cliente "Supermercado Leal" (cadastro legítimo) NÃO é tocado; apenas passa a apontar
seu template DRE padrão para este referencial, para teste local.
"""
from sqlalchemy.orm import Session
import models

NOME_TEMPLATE = "Controladoria - DRE Varejo"
SEGMENTO_NOME = "Varejo Alimentar"
CNPJ_CLIENTE_TESTE = "25926205000123"   # Supermercado Leal — só para apontar o template padrão

# Nomes de templates antigos deste referencial, removidos ao recriar (limpa resíduo).
_NOMES_ANTERIORES = ["Controladoria - DRE Varejo", "DRE Gerencial - Varejo (Leal)"]

# (rotulo/slug, nivel, modo_calculo, formula_texto, negrito_totalizador)
# rotulo = slug (é a chave usada em {linha:slug}); fórmulas em forma canônica {linha:...}.
# Níveis: A=1 (bloco), C=2 (grupo), D=3 (subgrupo), E=4 (folha).
_LINHAS = [
    ("receita_bruta_operacional", 1, "formula", "{linha:venda_de_mercadorias_a_vista}+{linha:venda_de_mercadorias_a_prazo}", True),  # code=None | RECEITA BRUTA OPERACIONAL
    ("venda_de_mercadorias_a_vista", 2, "soma_filhos", None, False),  # code=None | VENDA DE MERCADORIAS - A VISTA
    ("venda_de_merc_dinheiro", 4, "agrupamento", None, False),  # code=311101 | Venda de Merc - Dinheiro
    ("venda_de_merc_cheques_a_vista", 4, "agrupamento", None, False),  # code=311102 | Venda de Merc - Cheques a vista
    ("venda_de_mercadorias_a_prazo", 2, "soma_filhos", None, False),  # code=None | VENDA DE MERCADORIAS - A PRAZO
    ("venda_de_merc_cheques_pre_datado", 4, "agrupamento", None, False),  # code=311103 | Venda de Merc - Cheques Pre-Datado
    ("venda_de_merc_cartoes_de_credito", 4, "agrupamento", None, False),  # code=311104 | Venda de Merc - Cartões de Crédito
    ("venda_de_merc_cartao_debito", 4, "agrupamento", None, False),  # code=311105 | Venda de Merc - Cartão Debito
    ("venda_de_merc_convenio", 4, "agrupamento", None, False),  # code=311106 | Venda de Merc - Convenio
    ("venda_de_merc_trocas", 4, "agrupamento", None, False),  # code=311107 | Venda de Merc - Trocas
    ("venda_de_merc_e_commerce", 4, "agrupamento", None, False),  # code=311108 | Venda de Merc - E-commerce
    ("venda_de_mercadorias_contas_a_receber__atual", 4, "agrupamento", None, False),  # code=311109 | Venda de Mercadorias - Contas a Receber_ atual
    ("venda_de_mercadorias_pix", 4, "agrupamento", None, False),  # code=311110 | Venda de Mercadorias - PIX
    ("venda_de_merc_bonificacoes_doacoes", 4, "agrupamento", None, False),  # code=311111 | Venda de Merc - Bonificações/Doações
    ("cancelamentos_e_descontos", 2, "soma_filhos", None, False),  # code=None | ( - ) CANCELAMENTOS E DESCONTOS
    ("vendas_canceladas", 4, "agrupamento", None, False),  # code=312104 | Vendas Canceladas
    ("abatimentos_sobre_vendas", 4, "agrupamento", None, False),  # code=312106 | Abatimentos Sobre Vendas
    ("venda_liquida", 1, "formula", "{linha:receita_bruta_operacional}-{linha:cancelamentos_e_descontos}", True),  # code=None | VENDA LIQUIDA
    ("deducoes_de_receita_bruta", 2, "formula", "{linha:impostos_sobre_a_venda}+{linha:devolucoes_de_vendas}", False),  # code=None | ( - ) DEDUÇÕES DE RECEITA BRUTA
    ("impostos_sobre_a_venda", 3, "soma_filhos", None, False),  # code=None | IMPOSTOS SOBRE A VENDA
    ("icms_sobre_vendas", 4, "agrupamento", None, False),  # code=312101 | ICMS Sobre Vendas
    ("pis_sobre_vendas", 4, "agrupamento", None, False),  # code=312102 | PIS Sobre Vendas
    ("cofins_sobre_vendas", 4, "agrupamento", None, False),  # code=312103 | COFINS Sobre Vendas
    ("devolucoes_de_vendas", 4, "agrupamento", None, False),  # code=312105 | Devoluções de Vendas
    ("receita_liquida", 1, "formula", "{linha:venda_liquida}-{linha:deducoes_de_receita_bruta}", True),  # code=None | RECEITA LIQUIDA
    ("custos_variaveis", 1, "formula", "{linha:cmv_custos_das_merc_vendidas}-{linha:credito_simples_nacional}-{linha:estorno_de_cmv}-{linha:encargos_sobre_operacao_de_compras}-{linha:acordos_comerciais}", True),  # code=None | ( - ) CUSTOS VARIÁVEIS
    ("cmv_custos_das_merc_vendidas", 2, "agrupamento", None, False),  # code=420 | ( - ) CMV - CUSTOS DAS MERC. VENDIDAS
    ("credito_simples_nacional", 4, "agrupamento", None, False),  # code=421 | ( - ) Credito Simples Nacional
    ("estorno_de_cmv", 4, "agrupamento", None, False),  # code=422 | ( - ) Estorno de CMV
    ("encargos_sobre_operacao_de_compras", 4, "agrupamento", None, False),  # code=423 | ( - ) Encargos Sobre Operação de Compras
    ("acordos_comerciais", 4, "agrupamento", None, False),  # code=424 | ( - ) Acordos Comerciais
    ("margem_de_venda_margem_bruta", 1, "formula", "{linha:receita_liquida}-{linha:custos_variaveis}", True),  # code=None | MARGEM DE VENDA (MARGEM BRUTA)
    ("despesas_variaveis", 1, "formula", "{linha:despesas_com_venda}+{linha:perdas}+{linha:despesas_com_venda_financeiro}", True),  # code=None | ( - ) DESPESAS VARIAVEIS
    ("despesas_com_venda", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS COM VENDA
    ("sacolas_frente_de_caixa", 4, "agrupamento", None, False),  # code=332201 | Sacolas Frente de Caixa
    ("embalagens_acougue", 4, "agrupamento", None, False),  # code=332202 | Embalagens Açougue
    ("embalagns_rotisseria", 4, "agrupamento", None, False),  # code=332203 | Embalagns Rotisseria
    ("bobina_resinite_filme", 4, "agrupamento", None, False),  # code=332204 | Bobina Resinite/ Filme
    ("rapid_bag_spred_roll", 4, "agrupamento", None, False),  # code=332205 | Rapid Bag Spred Roll
    ("bandeijas", 4, "agrupamento", None, False),  # code=332206 | Bandeijas
    ("etiqueta_para_balanca", 4, "agrupamento", None, False),  # code=332207 | Etiqueta para Balança
    ("bobina_termoscrypty", 4, "agrupamento", None, False),  # code=332208 | Bobina Termoscrypty
    ("suprimentos_para_o_pdv_bobinas", 4, "agrupamento", None, False),  # code=332209 | Suprimentos para o PDV/Bobinas
    ("embalagens_flv", 4, "agrupamento", None, False),  # code=332211 | Embalagens FLV
    ("embalagem_suchi", 4, "agrupamento", None, False),  # code=332215 | Embalagem Suchi
    ("selo_de_qualidade", 4, "agrupamento", None, False),  # code=332212 | Selo de Qualidade
    ("uso_e_consumo__utilidades", 4, "agrupamento", None, False),  # code=332214 | Uso e Consumo_ Utilidades
    ("despesas_com_venda_financeiro", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS COM VENDA ( FINANCEIRO)
    ("taxas_administrativas_cartao_de_credito_debito", 4, "agrupamento", None, False),  # code=335109 | Taxas Administrativas - Cartão de Crédito / Debito
    ("perdas", 2, "formula", "{linha:perdas_totais_reais}", False),  # code=EPE | ( - ) PERDAS
    ("perdas_totais_reais", 4, "formula", "{linha:perdas_com_mercadorias}+{linha:ajustes_de_estoques}", False),  # code=None | Perdas Totais Reais
    ("perdas_com_mercadorias", 3, "agrupamento", None, False),  # code=333209 | Perdas com Mercadorias
    ("ajustes_de_estoques", 3, "formula", "{linha:falta_de_estoques}-{linha:sobra_de_estoques}+{linha:perdas_invetario_geral}", False),  # code=None | Ajustes de Estoques
    ("falta_de_estoques", 4, "agrupamento", None, False),  # code=113150 | ( - ) Falta de Estoques
    ("sobra_de_estoques", 4, "agrupamento", None, False),  # code=113123 | ( + ) Sobra de Estoques
    ("perdas_invetario_geral", 4, "agrupamento", None, False),  # code=None | Perdas Invetário Geral
    ("margem_de_contribuicao_i", 1, "formula", "{linha:margem_de_venda_margem_bruta}-{linha:despesas_variaveis}", True),  # code=None | MARGEM DE CONTRIBUIÇÃO I
    ("custos_e_despesas_fixas_diretos", 1, "formula", "{linha:custos_e_despesas_fixas_diretos_lojas}+{linha:custos_e_despesas_fixas_diretos_adm}", True),  # code=None | ( - ) CUSTOS E DESPESAS FIXAS - DIRETOS
    ("custos_e_despesas_fixas_diretos_lojas", 1, "formula", "{linha:remuneracao}+{linha:encargos_sobre_remuneracao}+{linha:beneficios}+{linha:outras_despesas_com_pessoal}", True),  # code=None | ( - ) CUSTOS E DESPESAS FIXAS - DIRETOS - LOJAS
    ("remuneracao", 3, "soma_filhos", None, False),  # code=None | REMUNERAÇÃO
    ("honorarios_da_diretoria", 4, "agrupamento", None, False),  # code=331101 | Honorários da Diretoria
    ("ordenados_e_salarios", 4, "formula", "290835.62-71799.04", False),  # code=331102 | Ordenados e Salários
    ("horas_extraordinarias", 4, "agrupamento", None, False),  # code=331103 | Horas Extraordinárias
    ("gratificacoes", 4, "agrupamento", None, False),  # code=331106 | Gratificações
    ("remuneracao_a_estagiarios", 4, "agrupamento", None, False),  # code=331108 | Remuneração a Estagiários
    ("provisao_para_ferias", 4, "formula", "(((({linha:ordenados_e_salarios}+{linha:horas_extraordinarias}+{linha:gratificacoes})/3)+({linha:ordenados_e_salarios}+{linha:horas_extraordinarias}+{linha:gratificacoes}))/12)*(8/100.0)+(((({linha:ordenados_e_salarios}+{linha:horas_extraordinarias}+{linha:gratificacoes})/3)+({linha:ordenados_e_salarios}+{linha:horas_extraordinarias}+{linha:gratificacoes}))/12)", False),  # code=331104 | Provisão Para Férias
    ("provisao_para_13o_salario", 4, "formula", "(((({linha:ordenados_e_salarios}+{linha:horas_extraordinarias}+{linha:gratificacoes}))/12)*(8/100.0)+((+({linha:ordenados_e_salarios}+{linha:horas_extraordinarias}+{linha:gratificacoes}))/12))", False),  # code=331105 | Provisão Para 13º Salário
    ("pensao_alimenticia", 4, "agrupamento", None, False),  # code=331111 | Pensão Alimenticia
    ("pagamento_dobras", 4, "agrupamento", None, False),  # code=331113 | Pagamento Dobras
    ("outros_gastos_direto_com_pessoal", 4, "agrupamento", None, False),  # code=331114 | Outros Gastos Direto com Pessoal
    ("programa_menor_aprendiz_instituicoes_especializadas", 4, "agrupamento", None, False),  # code=331115 | Programa Menor Aprendiz - Instituições Especializadas
    ("recrutamento_e_selecao", 4, "agrupamento", None, False),  # code=331116 | Recrutamento e Seleção
    ("descanso_semanal_remunerado_dsr", 4, "agrupamento", None, False),  # code=331117 | Descanso Semanal Remunerado - DSR
    ("adicional_de_insalubridade_e_periculosidade", 4, "agrupamento", None, False),  # code=331118 | Adicional de Insalubridade e Periculosidade
    ("pensao_judicial___trabalhista", 4, "agrupamento", None, False),  # code=331119 | Pensão Judicial _ Trabalhista
    ("adicional_noturno", 4, "agrupamento", None, False),  # code=331120 | Adicional Noturno
    ("autonomos_rpa", 4, "agrupamento", None, False),  # code=331221 | Autônomos - RPA
    ("inss_provisao_sobre_ferias", 4, "agrupamento", None, False),  # code=331122 | INSS - Provisão Sobre Férias
    ("fgts_provisao_sobre_ferias", 4, "agrupamento", None, False),  # code=331123 | FGTS - Provisão Sobre Férias
    ("inss_provisao_sobre_o_13o_salario", 4, "agrupamento", None, False),  # code=331124 | INSS - Provisão Sobre o 13º Salário
    ("fgts_provisao_sobre_13o_salario", 4, "agrupamento", None, False),  # code=331125 | FGTS - Provisão Sobre 13º Salário
    ("comissoes", 4, "agrupamento", None, False),  # code=331126 | Comissões
    ("indenizacao_por_dano_moral", 4, "agrupamento", None, False),  # code=331127 | Indenização Por Dano Moral
    ("programa_jovem_aprendiz", 4, "agrupamento", None, False),  # code=331128 | Programa Jovem Aprendiz
    ("acoes_e_acordos_judiciais_trabalhistas", 4, "agrupamento", None, False),  # code=331129 | Açoes e Acordos Judiciais Trabalhistas
    ("custas_processuais_judiciais_trabalhista", 4, "agrupamento", None, False),  # code=331130 | Custas Processuais Judiciais Trabalhista
    ("perdas_com_creditos_de_funcionarios", 4, "agrupamento", None, False),  # code=331140 | Perdas com Creditos de Funcionarios
    ("premiacao", 4, "agrupamento", None, False),  # code=331141 | Premiação
    ("aponsentadoria_vitalicia", 4, "agrupamento", None, False),  # code=331142 | Aponsentadoria Vitalícia
    ("encargos_sobre_remuneracao", 3, "soma_filhos", None, False),  # code=None | ENCARGOS SOBRE REMUNERAÇÃO
    ("encargos_sociais_inss", 4, "formula", "138982.76-55000", False),  # code=331110 | Encargos Sociais - INSS
    ("encargos_sociais_fgts", 4, "formula", "41086.3-15000", False),  # code=331109 | Encargos Sociais - FGTS
    ("encargos_sociais_fgts_multas_rescisorias", 4, "agrupamento", None, False),  # code=331112 | Encargos Sociais - FGTS - Multas Rescisórias
    ("contribuicao_sindical", 4, "agrupamento", None, False),  # code=334104 | Contribuição Sindical
    ("beneficios", 3, "soma_filhos", None, False),  # code=None | BENEFÍCIOS
    ("cursos_e_treinamentos", 4, "agrupamento", None, False),  # code=331204 | Cursos e Treinamentos
    ("transporte_de_colaboradores", 4, "agrupamento", None, False),  # code=331202 | Transporte de Colaboradores
    ("assistencia_medica_e_odontologica", 4, "formula", "1592.16-5495.47", False),  # code=331203 | Assistência Médica e Odontológica
    ("uniformes_e_equipamentos_de_protecao_individual", 4, "agrupamento", None, False),  # code=331201 | Uniformes e Equipamentos de Proteção Individual
    ("subvencao_alimenticia_cesta_basica", 4, "agrupamento", None, False),  # code=331206 | Subvenção Alimentícia/Cesta Básica
    ("pat_alimentacao_do_trabalfador", 4, "agrupamento", None, False),  # code=331207 | PAT - Alimentação do TrabalFador
    ("transporte_para_funcionarios", 4, "agrupamento", None, False),  # code=331214 | Transporte para Funcionarios
    ("outras_despesas_com_pessoal", 3, "soma_filhos", None, False),  # code=None | OUTRAS DESPESAS  COM PESSOAL
    ("confraternizacoes", 4, "agrupamento", None, False),  # code=331205 | Confraternizações
    ("seguros_vida_funcionarios", 4, "agrupamento", None, False),  # code=331209 | Seguros Vida Funcionários
    ("indenizacoes_trabalhistas", 4, "agrupamento", None, False),  # code=331107 | Indenizações Trabalhistas
    ("convenios", 4, "agrupamento", None, False),  # code=331210 | Convênios
    ("medicina_do_trabalho_ppra_pcmso_outros", 4, "agrupamento", None, False),  # code=331211 | Medicina do Trabalho: PPRA/PCMSO/Outros
    ("farmacia", 4, "agrupamento", None, False),  # code=331213 | Farmacia
    ("lanches_e_refeicoes", 4, "agrupamento", None, False),  # code=331212 | Lanches e Refeições
    ("outras", 4, "agrupamento", None, False),  # code=331208 | Outras
    ("custos_e_despesas_fixas_diretos_adm", 1, "formula", "{linha:remuneracao_adm}+{linha:encargos_sobre_remuneracao_adm}+{linha:beneficios_adm}+{linha:outras_despesas_com_pessoal_adm}", True),  # code=None | ( - ) CUSTOS E DESPESAS FIXAS - DIRETOS - ADM
    ("remuneracao_adm", 3, "soma_filhos", None, False),  # code=None | REMUNERAÇÃO
    ("honorarios_da_diretoria_adm", 4, "agrupamento", None, False),  # code=ADM331101 | Honorários da Diretoria
    ("ordenados_e_salarios_adm", 4, "agrupamento", None, False),  # code=ADM331102 | Ordenados e Salários
    ("horas_extraordinarias_adm", 4, "agrupamento", None, False),  # code=ADM331103 | Horas Extraordinárias
    ("gratificacoes_adm", 4, "agrupamento", None, False),  # code=ADM331106 | Gratificações
    ("remuneracao_a_estagiarios_adm", 4, "agrupamento", None, False),  # code=ADM331108 | Remuneração a Estagiários
    ("provisao_para_ferias_adm", 4, "agrupamento", None, False),  # code=ADM331104 | Provisão Para Férias
    ("provisao_para_13o_salario_adm", 4, "agrupamento", None, False),  # code=ADM331105 | Provisão Para 13º Salário
    ("pensao_alimenticia_adm", 4, "agrupamento", None, False),  # code=ADM331111 | Pensão Alimenticia
    ("pagamento_dobras_adm", 4, "agrupamento", None, False),  # code=ADM331113 | Pagamento Dobras
    ("outros_gastos_direto_com_pessoal_adm", 4, "agrupamento", None, False),  # code=ADM331114 | Outros Gastos Direto com Pessoal
    ("programa_menor_aprendiz_instituicoes_especializadas_adm", 4, "agrupamento", None, False),  # code=ADM331115 | Programa Menor Aprendiz - Instituições Especializadas
    ("recrutamento_e_selecao_adm", 4, "agrupamento", None, False),  # code=ADM331116 | Recrutamento e Seleção
    ("descanso_semanal_remunerado_dsr_adm", 4, "agrupamento", None, False),  # code=ADM331117 | Descanso Semanal Remunerado - DSR
    ("adicional_de_insalubridade_e_periculosidade_adm", 4, "agrupamento", None, False),  # code=ADM331118 | Adicional de Insalubridade e Periculosidade
    ("pensao_judicial___trabalhista_adm", 4, "agrupamento", None, False),  # code=ADM331119 | Pensão Judicial _ Trabalhista
    ("adicional_noturno_adm", 4, "agrupamento", None, False),  # code=ADM331120 | Adicional Noturno
    ("autonomos_rpa_adm", 4, "agrupamento", None, False),  # code=ADM331221 | Autônomos - RPA
    ("inss_provisao_sobre_ferias_adm", 4, "agrupamento", None, False),  # code=ADM331122 | INSS - Provisão Sobre Férias
    ("fgts_provisao_sobre_ferias_adm", 4, "agrupamento", None, False),  # code=ADM331123 | FGTS - Provisão Sobre Férias
    ("inss_provisao_sobre_o_13o_salario_adm", 4, "agrupamento", None, False),  # code=ADM331124 | INSS - Provisão Sobre o 13º Salário
    ("fgts_provisao_sobre_13o_salario_adm", 4, "agrupamento", None, False),  # code=ADM331125 | FGTS - Provisão Sobre 13º Salário
    ("comissoes_adm", 4, "agrupamento", None, False),  # code=ADM331126 | Comissões
    ("indenizacao_por_dano_moral_adm", 4, "agrupamento", None, False),  # code=ADM331127 | Indenização Por Dano Moral
    ("programa_jovem_aprendiz_adm", 4, "agrupamento", None, False),  # code=ADM331128 | Programa Jovem Aprendiz
    ("premiacao_adm", 4, "agrupamento", None, False),  # code=ADM331141 | Premiação
    ("perdas_com_creditos_de_funcionarios_adm", 4, "agrupamento", None, False),  # code=ADM331140 | Perdas com Creditos de Funcionarios
    ("encargos_sobre_remuneracao_adm", 3, "soma_filhos", None, False),  # code=None | ENCARGOS SOBRE REMUNERAÇÃO
    ("encargos_sociais_inss_adm", 4, "agrupamento", None, False),  # code=ADM331110 | Encargos Sociais - INSS
    ("encargos_sociais_fgts_adm", 4, "agrupamento", None, False),  # code=ADM331109 | Encargos Sociais - FGTS
    ("encargos_sociais_fgts_multas_rescisorias_adm", 4, "agrupamento", None, False),  # code=ADM331112 | Encargos Sociais - FGTS - Multas Rescisórias
    ("contribuicao_sindical_adm", 4, "agrupamento", None, False),  # code=ADM334104 | Contribuição Sindical
    ("beneficios_adm", 3, "soma_filhos", None, False),  # code=None | BENEFÍCIOS
    ("cursos_e_treinamentos_adm", 4, "agrupamento", None, False),  # code=ADM331204 | Cursos e Treinamentos
    ("transporte_de_colaboradores_adm", 4, "agrupamento", None, False),  # code=ADM331202 | Transporte de Colaboradores
    ("assistencia_medica_e_odontologica_adm", 4, "agrupamento", None, False),  # code=ADM331203 | Assistência Médica e Odontológica
    ("uniformes_e_equipamentos_de_protecao_individual_adm", 4, "agrupamento", None, False),  # code=ADM331201 | Uniformes e Equipamentos de Proteção Individual
    ("subvencao_alimenticia_cesta_basica_adm", 4, "agrupamento", None, False),  # code=ADM331206 | Subvenção Alimentícia/Cesta Básica
    ("pat_alimentacao_do_trabalfador_adm", 4, "agrupamento", None, False),  # code=ADM331207 | PAT - Alimentação do TrabalFador
    ("outras_despesas_com_pessoal_adm", 3, "soma_filhos", None, False),  # code=None | OUTRAS DESPESAS  COM PESSOAL
    ("confraternizacoes_adm", 4, "agrupamento", None, False),  # code=ADM331205 | Confraternizações
    ("seguros_vida_funcionarios_adm", 4, "agrupamento", None, False),  # code=ADM331209 | Seguros Vida Funcionários
    ("indenizacoes_trabalhistas_adm", 4, "agrupamento", None, False),  # code=ADM331107 | Indenizações Trabalhistas
    ("convenios_adm", 4, "agrupamento", None, False),  # code=ADM331210 | Convênios
    ("medicina_do_trabalho_ppra_pcmso_outros_adm", 4, "agrupamento", None, False),  # code=ADM331211 | Medicina do Trabalho: PPRA/PCMSO/Outros
    ("lanches_e_refeicoes_adm", 4, "agrupamento", None, False),  # code=ADM331212 | Lanches e Refeições
    ("outras_adm", 4, "agrupamento", None, False),  # code=ADM331208 | Outras
    ("margem_de_contribuicao_ii", 1, "formula", "{linha:margem_de_contribuicao_i}-{linha:custos_e_despesas_fixas_diretos}", True),  # code=None | MARGEM DE CONTRIBUIÇÃO II
    ("custos_e_despesas_fixas_indiretas", 1, "formula", "{linha:despesas_tributarias}+{linha:despesas_com_utilidades_e_servicos}+{linha:despesas_com_manutencoes}+{linha:despesas_com_informatica}+{linha:honorarios_profissionais_com_terceiros}+{linha:material_de_expediente}+{linha:despesas_gerais}+{linha:despesas_com_propaganda_e_publicidade}+{linha:despesas_com_veiculos}+{linha:despesas_com_viagens}", True),  # code=None | ( - ) CUSTOS E DESPESAS FIXAS - INDIRETAS
    ("despesas_tributarias", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS TRIBUTÁRIAS
    ("impostos_e_taxas", 4, "agrupamento", None, False),  # code=334101 | Impostos e Taxas
    ("das_simples_nacional", 4, "agrupamento", None, False),  # code=334108 | Das - Simples Nacional
    ("iptu", 4, "agrupamento", None, False),  # code=334102 | IPTU
    ("outros_impostos_estaduais", 4, "agrupamento", None, False),  # code=334103 | Outros Impostos Estaduais
    ("multas_dedutiveis", 4, "agrupamento", None, False),  # code=334106 | Multas Dedutiveis
    ("diferenca_aliquota_de_icms_difal", 4, "agrupamento", None, False),  # code=334107 | Diferênça Alíquota de ICMS - DIFAL
    ("auto_de_infracao_geral", 4, "agrupamento", None, False),  # code=339201 | Auto de Infração Geral
    ("imposto_de_renda_geral", 4, "agrupamento", None, False),  # code=334105 | Imposto de Renda Geral
    ("inss_prestadores_de_servicos", 4, "agrupamento", None, False),  # code=334109 | INSS - Prestadores de servicos
    ("fundo_de_combate_a_pobreza", 4, "agrupamento", None, False),  # code=334110 | Fundo de Combate a Pobreza
    ("despesas_com_utilidades_e_servicos", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS COM UTILIDADES E SERVIÇOS
    ("energia_eletrica", 4, "agrupamento", None, False),  # code=333101 | Energia Elétrica
    ("combustivel_gerador", 4, "agrupamento", None, False),  # code=333102 | Combustivel - Gerador
    ("agua_e_esgoto", 4, "agrupamento", None, False),  # code=333151 | Agua e Esgoto
    ("telefonia_fixa", 4, "agrupamento", None, False),  # code=333152 | Telefonia Fixa
    ("telefonia_movel", 4, "agrupamento", None, False),  # code=333153 | Telefonia Móvel
    ("internet", 4, "agrupamento", None, False),  # code=333410 | Internet
    ("correios_e_entregas_expressas", 4, "agrupamento", None, False),  # code=333156 | Correios e Entregas Expressas
    ("seguros", 4, "agrupamento", None, False),  # code=333157 | Seguros
    ("gas", 4, "agrupamento", None, False),  # code=333154 | Gás
    ("despesas_cartorarias", 4, "agrupamento", None, False),  # code=333155 | Despesas Cartórarias
    ("rede_de_dados", 4, "agrupamento", None, False),  # code=333411 | Rede de dados
    ("conducao", 4, "agrupamento", None, False),  # code=333158 | Condução
    ("despesas_com_manutencoes", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS COM MANUTENÇÕES
    ("gondolas_e_carrinhos", 4, "agrupamento", None, False),  # code=333251 | Gôndolas e Carrinhos
    ("maquinas_de_escritorio", 4, "agrupamento", None, False),  # code=333252 | Máquinas De Escritório
    ("balcoes_e_camaras", 4, "agrupamento", None, False),  # code=333253 | Balcões e Câmaras\
    ("balancas", 4, "agrupamento", None, False),  # code=333254 | Balanças
    ("impressoras_fiscais", 4, "agrupamento", None, False),  # code=333255 | Impressoras Fiscais
    ("gerador", 4, "agrupamento", None, False),  # code=333256 | Gerador
    ("equipamento_de_producao", 4, "agrupamento", None, False),  # code=333257 | Equipamento De Produção
    ("frios_congelados", 4, "agrupamento", None, False),  # code=333258 | Frios/Congelados
    ("casa_de_maquinas", 4, "agrupamento", None, False),  # code=333259 | Casa De Máquinas
    ("ar_condicionado", 4, "formula", "21280-20700", False),  # code=333260 | Ar Condicionado
    ("manutencao_de_elevador", 4, "agrupamento", None, False),  # code=333261 | Manutenção de Elevador
    ("moveis_e_utensilios_em_geral", 4, "agrupamento", None, False),  # code=333262 | Móveis e Utensílios em Geral
    ("p_a_b_x", 4, "agrupamento", None, False),  # code=333263 | P.A.B.X
    ("reposicao_em_geral", 4, "agrupamento", None, False),  # code=333267 | Reposição em Geral
    ("pintura", 4, "agrupamento", None, False),  # code=333351 | Pintura
    ("reparos_em_geral", 4, "agrupamento", None, False),  # code=333265 | Reparos em Geral
    ("outras_maquinas_e_equipamentos", 4, "agrupamento", None, False),  # code=333264 | Outras Maquinas e Equipamentos
    ("instalacoes_de_maquinas_e_equipamentos", 4, "agrupamento", None, False),  # code=333266 | Instalaçoes de Maquinas e Equipamentos
    ("compressor", 4, "agrupamento", None, False),  # code=333268 | Compressor
    ("hidraulica", 4, "agrupamento", None, False),  # code=333352 | Hidráulica
    ("eletrica", 4, "agrupamento", None, False),  # code=333353 | Elétrica
    ("benfeitorias", 4, "agrupamento", None, False),  # code=333354 | Benfeitorias
    ("extintores", 4, "agrupamento", None, False),  # code=333355 | Extintores
    ("serralheria_e_carpintaria", 4, "agrupamento", None, False),  # code=333356 | Serralheria e Carpintaria
    ("locacao_de_equipamentos", 4, "agrupamento", None, False),  # code=333357 | Locação de Equipamentos
    ("munutencao_imoveis_de_terceiros", 4, "agrupamento", None, False),  # code=333358 | Munutenção Imóveis de Terceiros
    ("manutencao_de_obras_em_andamentos", 4, "agrupamento", None, False),  # code=333359 | Manutenção de Obras em Andamentos
    ("manutencao_em_predios_e_edificacaoes", 4, "agrupamento", None, False),  # code=333360 | Manutençao em Predios e Edificaçaoes
    ("ferragista", 4, "agrupamento", None, False),  # code=333361 | Ferragista
    ("despesas_com_informatica", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS COM INFORMÁTICA
    ("intalacoes_de_software", 4, "agrupamento", None, False),  # code=333401 | Intalações de Software
    ("suprimentos_de_hardware", 4, "agrupamento", None, False),  # code=333402 | Suprimentos de Hardware
    ("manutencao_e_uso_de_softwares", 4, "agrupamento", None, False),  # code=333403 | Manutenção e Uso de Softwares
    ("manutencao_de_hardware", 4, "agrupamento", None, False),  # code=333404 | Manutenção de Hardware
    ("altualizacao_de_sistema", 4, "agrupamento", None, False),  # code=333405 | Altualização de Sistema
    ("sistemas_de_gestao_e_informacao", 4, "agrupamento", None, False),  # code=333406 | Sistemas de Gestão e Informação
    ("pecas_e_reposicoes_de_informatica", 4, "agrupamento", None, False),  # code=333407 | Peças e Reposições de Informática
    ("manuentacao_relogio_de_ponto", 4, "agrupamento", None, False),  # code=333408 | Manuentação Relógio de Ponto
    ("manutencao_de_equipamentos_de_informatica", 4, "agrupamento", None, False),  # code=333415 | Manutençao de Equipamentos de Informatica
    ("manutencao_e_suporte_tecnico_sofware", 4, "agrupamento", None, False),  # code=333413 | Manutençao e Suporte Tecnico Sofware
    ("certificado_de_uso", 4, "agrupamento", None, False),  # code=333412 | Certificado de Uso
    ("manutencao_de_rede", 4, "agrupamento", None, False),  # code=333414 | Manutençao de Rede
    ("suprimentos_de_informatica", 4, "agrupamento", None, False),  # code=333416 | Suprimentos de Informática
    ("manutencao_de_site", 4, "agrupamento", None, False),  # code=333409 | Manutenção de Site
    ("honorarios_profissionais_com_terceiros", 2, "soma_filhos", None, False),  # code=None | ( - ) HONORÁRIOS PROFISSIONAIS COM TERCEIROS
    ("consultoria_e_assessoria", 4, "agrupamento", None, False),  # code=333451 | Consultoria e Assessoria
    ("advocacia", 4, "agrupamento", None, False),  # code=333452 | Advocacia
    ("auditoria", 4, "agrupamento", None, False),  # code=333453 | Auditoria
    ("contabilidade", 4, "agrupamento", None, False),  # code=333454 | Contabilidade
    ("servicos_prestados_terceiros_pessoa_fisica", 4, "agrupamento", None, False),  # code=333455 | Serviços Prestados Terceiros Pessoa Fisica
    ("servicos_prestados_terceiros_pessoa_juridica", 4, "formula", "55156.7-3810.09", False),  # code=333456 | Serviços Prestados Terceiros Pessoa Juridica
    ("engenharia_e_projetos", 4, "agrupamento", None, False),  # code=333457 | Engenharia e Projetos
    ("treinamentos", 4, "agrupamento", None, False),  # code=333458 | Treinamentos
    ("nutricionista_tecnico_em_alimentos", 4, "agrupamento", None, False),  # code=333459 | Nutricionista, Tecnico Em Alimentos
    ("jardinagem", 4, "agrupamento", None, False),  # code=333501 | Jardinagem
    ("vigilancia", 4, "agrupamento", None, False),  # code=333502 | Vigilância
    ("limpeza_de_loja", 4, "agrupamento", None, False),  # code=333503 | Limpeza de Loja
    ("coleta_de_lixo", 4, "agrupamento", None, False),  # code=333505 | Coleta de Lixo
    ("dedetizacao", 4, "agrupamento", None, False),  # code=333504 | Dedetização
    ("entrega_de_compras", 4, "agrupamento", None, False),  # code=333506 | Entrega de Compras
    ("associacoes_de_classe", 4, "agrupamento", None, False),  # code=333700 | Associações de Classe
    ("assinaturas_de_periodicos", 4, "agrupamento", None, False),  # code=333960 | Assinaturas de Periodicos
    ("desentupimento_de_esgoto", 4, "agrupamento", None, False),  # code=333507 | Desentupimento de Esgoto
    ("analise_tecnicas_e_pericias", 4, "agrupamento", None, False),  # code=333508 | Análise Técnicas e Perícias
    ("transporte___fretes_e_carretos", 4, "agrupamento", None, False),  # code=333509 | Transporte _ Fretes e Carretos
    ("servico_com_chaveiro_em_geral", 4, "agrupamento", None, False),  # code=333510 | Serviço Com Chaveiro em Geral
    ("servicos_de_lavanderia", 4, "agrupamento", None, False),  # code=333511 | Serviços de Lavanderia
    ("servicos_administrativos", 4, "agrupamento", None, False),  # code=332210 | Serviços Administrativos
    ("material_de_expediente", 2, "soma_filhos", None, False),  # code=None | ( - ) MATERIAL DE EXPEDIENTE
    ("material_de_escritorio", 4, "agrupamento", None, False),  # code=333602 | Material de Escritório
    ("material_de_limpeza", 4, "agrupamento", None, False),  # code=333603 | Material de Limpeza
    ("suprimentos_de_informatica_1", 4, "agrupamento", None, False),  # code=333604 | Suprimentos de Informatica
    ("despesas_com_duplicacao_e_encadernacao", 4, "agrupamento", None, False),  # code=333605 | Despesas com Duplicação e Encadernação
    ("consumo_interno_geral", 4, "agrupamento", None, False),  # code=333606 | Consumo Interno Geral
    ("material_de_seguranca", 4, "agrupamento", None, False),  # code=333607 | Material de Segurança
    ("locacao_de_equipamentos_1", 4, "agrupamento", None, False),  # code=333608 | Locação de Equipamentos
    ("material_para_expediente", 4, "agrupamento", None, False),  # code=333609 | Material para Expediente
    ("impressos", 4, "agrupamento", None, False),  # code=333601 | Impressos
    ("despesas_gerais", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS GERAIS
    ("comissao_a_pagar", 4, "agrupamento", None, False),  # code=333951 | Comissão a Pagar
    ("alugueis_e_condominios", 4, "agrupamento", None, False),  # code=333952 | Aluguéis e Condominios
    ("ferramentas", 4, "agrupamento", None, False),  # code=333953 | Ferramentas
    ("doacoes", 4, "agrupamento", None, False),  # code=333956 | Doações
    ("relacoes_publicas", 4, "agrupamento", None, False),  # code=333955 | Relações Públicas
    ("transporte_de_valores", 4, "agrupamento", None, False),  # code=333159 | Transporte de valores
    ("sistemas_monitorados", 4, "agrupamento", None, False),  # code=333160 | Sistemas Monitorados
    ("cartao_policard", 4, "agrupamento", None, False),  # code=333161 | Cartao Policard
    ("outras_contribuicoes_e_doacoes", 4, "agrupamento", None, False),  # code=333957 | Outras Contribuições e Doações
    ("uso_e_consumo", 4, "formula", "20559.39-3948.93-977.91-3730.24-581.11-1614-3139.26-2266.65", False),  # code=333958 | Uso e Consumo
    ("despesas_diversas", 4, "agrupamento", None, False),  # code=333959 | Despesas Diversas
    ("custas_e_indenizacoes_judiciais_dedutiveis", 4, "agrupamento", None, False),  # code=333961 | Custas e Indenizações Judiciais - Dedutíveis
    ("lanches_e_refeicoes_1", 4, "agrupamento", None, False),  # code=333954 | Lanches e Refeições
    ("despesas_indedutiveis", 4, "agrupamento", None, False),  # code=339205 | Despesas Indedutíveis
    ("condominios", 4, "agrupamento", None, False),  # code=333963 | Condominios
    ("decoracoes_e_eventos", 4, "agrupamento", None, False),  # code=333966 | Decoraçoes e Eventos
    ("339", 1, "agrupamento", None, True),  # code=333964 | 339
    ("despesas_com_propaganda_e_publicidade", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS COM PROPAGANDA E PUBLICIDADE
    ("anuncios_em_televisao", 4, "agrupamento", None, False),  # code=332101 | Anúncios em Televisão
    ("anuncios_em_radio", 4, "agrupamento", None, False),  # code=332102 | Anúncios em Rádio
    ("graficas", 4, "agrupamento", None, False),  # code=332104 | Gráficas
    ("panfletos", 4, "agrupamento", None, False),  # code=332103 | Panfletos
    ("faixas_e_cartazes", 4, "agrupamento", None, False),  # code=332107 | Faixas e Cartazes
    ("out_door", 4, "agrupamento", None, False),  # code=332108 | Out-door
    ("carro_de_som", 4, "agrupamento", None, False),  # code=332109 | Carro de som
    ("publicidade_agencia", 4, "agrupamento", None, False),  # code=332105 | Publicidade - Agência
    ("premios", 4, "agrupamento", None, False),  # code=332106 | Premios
    ("decoracoes_e_eventos_1", 4, "agrupamento", None, False),  # code=332110 | Decorações e Eventos
    ("patrocinios", 4, "agrupamento", None, False),  # code=332111 | Patrocínios
    ("producoes_internas_e_externas", 4, "agrupamento", None, False),  # code=332113 | Produções Internas e Externas
    ("divulgacao_em_jonais_e_revistas", 4, "agrupamento", None, False),  # code=332114 | Divulgação em Jonais e Revistas
    ("outras_despesas_propaganda", 4, "agrupamento", None, False),  # code=332112 | Outras despesas Propaganda
    ("publicidade_e_patrocinios", 4, "agrupamento", None, False),  # code=333965 | Publicidade e Patrocínios
    ("publicidade", 4, "agrupamento", None, False),  # code=332115 | Publicidade
    ("comunicacao_visual", 4, "agrupamento", None, False),  # code=332116 | Comunicaçao Visual
    ("despesas_com_veiculos", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS COM VEÍCULOS
    ("veiculos_pecas_p_manutencao", 4, "agrupamento", None, False),  # code=333301 | Veiculos - Peças p/ Manutenção
    ("veiculos_servicos_de_manutencao", 4, "agrupamento", None, False),  # code=333302 | Veiculos - Serviços de Manutenção
    ("veiculos_combustivel", 4, "agrupamento", None, False),  # code=333303 | Veiculos - Combustível
    ("estacionamento", 4, "agrupamento", None, False),  # code=333304 | Estacionamento
    ("veiculos_lavagem_e_polimentos", 4, "agrupamento", None, False),  # code=333305 | Veiculos - Lavagem e Polimentos
    ("veiculos_ipva", 4, "agrupamento", None, False),  # code=333306 | Veiculos - IPVA
    ("multas_de_transito", 4, "agrupamento", None, False),  # code=339202 | Multas de Trânsito
    ("veiculos_seguros", 4, "agrupamento", None, False),  # code=333307 | Veiculos - Seguros
    ("sistema_rastreamento_e_monitoramento", 4, "agrupamento", None, False),  # code=333308 | Sistema Rastreamento e Monitoramento
    ("locacao_de_veiculos", 4, "agrupamento", None, False),  # code=333309 | Locação de Veículos
    ("combustivel_caminhao", 4, "agrupamento", None, False),  # code=333310 | Combustivel Caminhão
    ("vistoria_veicular", 4, "agrupamento", None, False),  # code=333313 | Vistoria Veicular
    ("servico_com_despachante", 4, "agrupamento", None, False),  # code=333311 | Serviço Com Despachante
    ("multa_de_transito", 4, "agrupamento", None, False),  # code=333312 | Multa de Transito
    ("despesas_com_viagens", 2, "soma_filhos", None, False),  # code=None | ( - ) DESPESAS COM VIAGENS
    ("combustiveis_viagens", 4, "agrupamento", None, False),  # code=333551 | Combustiveis Viagens
    ("estadias", 4, "agrupamento", None, False),  # code=333552 | Estadias
    ("conducao_1", 4, "agrupamento", None, False),  # code=333553 | Condução
    ("alimentacao_em_viagens", 4, "agrupamento", None, False),  # code=333554 | Alimentação  em Viagens
    ("pedagio", 4, "agrupamento", None, False),  # code=333555 | Pedágio
    ("seguranca_alimentar_nutricionista_tec_alimentos", 4, "agrupamento", None, False),  # code=333556 | Segurança Alimentar: Nutricionista, Téc. Alimentos
    ("passagens", 4, "agrupamento", None, False),  # code=333557 | Passagens
    ("despesa_com_estacionamento", 4, "agrupamento", None, False),  # code=333558 | Despesa com Estacionamento
    ("outras_receitas_operacionais", 2, "formula", "{linha:receitas_de_fornecedores}+{linha:recuperacao_de_despesas}+{linha:receitas_eventuais}+{linha:receita_de_aluguel_espaco_loja}+{linha:outros_creditos_fiscais}+{linha:comissoes_de_rearga_de_celular}+{linha:outras_receitas}+{linha:sobras_de_caixa}-{linha:icms_sobre_outras_receitas}", False),  # code=None | ( + ) OUTRAS RECEITAS OPERACIONAIS
    ("receitas_de_fornecedores", 3, "soma_filhos", None, False),  # code=None | Receitas de Fornecedores
    ("bonificacoes_de_fornecedores", 4, "agrupamento", None, False),  # code=313201 | Bonificações de Fornecedores
    ("acordos_comerciais_rapel", 4, "agrupamento", None, False),  # code=313209 | Acordos Comerciais - Rapel
    ("acordos_comerciais_verbas", 4, "agrupamento", None, False),  # code=313206 | Acordos Comerciais - Verbas
    ("recuperacao_de_despesas", 4, "agrupamento", None, False),  # code=313202 | Recuperação de Despesas
    ("receitas_eventuais", 4, "agrupamento", None, False),  # code=313203 | Receitas Eventuais
    ("receita_de_aluguel_espaco_loja", 4, "agrupamento", None, False),  # code=313292 | Receita de Aluguel Espaço Loja
    ("outros_creditos_fiscais", 4, "agrupamento", None, False),  # code=313299 | Outros Créditos Fiscais
    ("comissoes_de_rearga_de_celular", 4, "agrupamento", None, False),  # code=313208 | Comissões de Rearga de Celular
    ("outras_receitas", 3, "agrupamento", None, False),  # code=313210 | Outras Receitas
    ("sobras_de_caixa", 3, "agrupamento", None, False),  # code=313204 | Sobras de Caixa
    ("icms_sobre_outras_receitas", 3, "agrupamento", None, False),  # code=313291 | ( - ) ICMS Sobre Outras Receitas
    ("custo_operacional", 1, "formula", "{linha:custos_e_despesas_fixas_indiretas}+{linha:custos_e_despesas_fixas_diretos}+{linha:despesas_variaveis}-{linha:outras_receitas_operacionais}", True),  # code=None | CUSTO OPERACIONAL
    ("ebitida", 1, "formula", "{linha:margem_de_contribuicao_ii}-{linha:custos_e_despesas_fixas_indiretas}+{linha:outras_receitas_operacionais}", True),  # code=None | EBITIDA
    ("depreciacao_e_amortizacao", 1, "formula", "{linha:receita_liquida}*0.007", True),  # code=339300 | ( - ) Depreciação e Amortização
    ("ebit", 1, "formula", "{linha:ebitida}-{linha:depreciacao_e_amortizacao}", True),  # code=None | EBIT
    ("resultado_financeiro_nao_operacional", 1, "formula", "{linha:despesas_financeiras}+{linha:outras_despesas}-{linha:resultado_nao_peracional}-{linha:receitas_financeiras}", True),  # code=None | ( + / - ) RESULTADO FINANCEIRO /  NÃO OPERACIONAL
    ("receitas_financeiras", 2, "formula", "{linha:juros_ativos}+{linha:variacao_monetaia}+{linha:rendimento_de_aplicacao_financeira}+{linha:descontos_sobre_operacoes_financeiras}", False),  # code=None | ( + ) RECEITAS FINANCEIRAS
    ("juros_ativos", 3, "soma_filhos", None, False),  # code=None | JUROS ATIVOS
    ("juros_ativos_1", 4, "agrupamento", None, False),  # code=313101 | Juros Ativos
    ("variacao_monetaia", 3, "formula", "{linha:variacao_monetaria_ativa}+{linha:variacao_cambial_ativa}", False),  # code=None | VARIAÇÃO MONETAIA
    ("variacao_monetaria_ativa", 4, "agrupamento", None, False),  # code=313103 | Variação Monetária Ativa
    ("variacao_cambial_ativa", 4, "agrupamento", None, False),  # code=313104 | Variação Cambial Ativa
    ("rendimento_de_aplicacao_financeira", 3, "agrupamento", None, False),  # code=313105 | RENDIMENTO DE APLICAÇÃO FINANCEIRA
    ("descontos_sobre_operacoes_financeiras", 3, "agrupamento", None, False),  # code=313102 | DESCONTOS SOBRE OPERAÇÕES FINANCEIRAS
    ("despesas_financeiras", 2, "formula", "{linha:juros_passivos}+{linha:tarifas_bancarias}+{linha:iof_imposto_sobre_operacoes_financeiras}+{linha:demais_despesas_financeiras}", False),  # code=None | ( - ) DESPESAS FINANCEIRAS
    ("juros_passivos", 3, "soma_filhos", None, False),  # code=None | Juros Passivos
    ("juros_passivos_1", 4, "agrupamento", None, False),  # code=335101 | Juros Passivos
    ("juros_s_emprestimos_e_financiamentos", 4, "agrupamento", None, False),  # code=335117 | Juros s/Emprestimos e Financiamentos
    ("tarifas_bancarias", 3, "soma_filhos", None, False),  # code=None | Tarifas Bancarias
    ("tarifa_bancaria", 4, "agrupamento", None, False),  # code=335108 | Tarifa Bancária
    ("tarifa_bancaria_sobre_cobranca", 4, "agrupamento", None, False),  # code=335111 | Tarifa Bancária - Sobre Cobrança
    ("tarifa_sobre_desconto_de_cheque", 4, "agrupamento", None, False),  # code=335110 | Tarifa Sobre Desconto de Cheque
    ("tarifas_taxas_sob_pix", 4, "agrupamento", None, False),  # code=335120 | Tarifas/Taxas sob Pix
    ("tarifas_doc_mensalidades_cartoes", 4, "agrupamento", None, False),  # code=335118 | Tarifas Doc/Mensalidades Cartoes
    ("iof_imposto_sobre_operacoes_financeiras", 3, "soma_filhos", None, False),  # code=None | IOF - Imposto sobre Operações Financeiras
    ("iof_demais_operacoes_financeiras", 4, "agrupamento", None, False),  # code=335107 | IOF - Demais Operações Financeiras
    ("iof_sobre_aplicacao_financeira", 4, "agrupamento", None, False),  # code=335112 | IOF - Sobre Aplicação Financeira
    ("demais_despesas_financeiras", 3, "soma_filhos", None, False),  # code=None | Demais Despesas Financeiras
    ("descontos_concedidos", 4, "agrupamento", None, False),  # code=335102 | Descontos Concedidos
    ("variacao_monetaria_passiva", 4, "agrupamento", None, False),  # code=335103 | Variação Monetária Passiva
    ("variacao_cambial_passiva", 4, "agrupamento", None, False),  # code=335104 | Variação Cambial Passiva
    ("juros_sobre_o_capital_proprio", 4, "agrupamento", None, False),  # code=335105 | Juros Sobre o Capital Próprio
    ("encargos_s_operacoes_de_compra", 4, "agrupamento", None, False),  # code=335113 | Encargos s/ Operações de Compra
    ("aluguel_de_p_o_s", 4, "agrupamento", None, False),  # code=335114 | Aluguel de P.O.S.
    ("locacao_canal_logico", 4, "agrupamento", None, False),  # code=335115 | Locação Canal Lógico
    ("multas_por_atrasos_c_fornecedores", 4, "agrupamento", None, False),  # code=335116 | Multas por Atrasos c/ Fornecedores
    ("contestacao_sobre_vendas", 4, "agrupamento", None, False),  # code=335119 | Contestaçao Sobre Vendas
    ("outras_despesas", 2, "soma_filhos", None, False),  # code=None | ( - ) OUTRAS DESPESAS
    ("despesas_indedutiveis_1", 4, "agrupamento", None, False),  # code=333204 | Despesas Indedutíveis
    ("falta_de_caixa", 4, "agrupamento", None, False),  # code=339102 | Falta de Caixa
    ("custas_e_indenizacoes_judiciais", 4, "agrupamento", None, False),  # code=339204 | Custas e Indenizações Judiciais
    ("perdas_com_creditos_incobraveis", 4, "agrupamento", None, False),  # code=339101 | Perdas Com Créditos Incobráveis
    ("resultado_nao_peracional", 2, "formula", "{linha:receita_de_alienacoes_do_ativo_permanente}-{linha:outras_despesas_nao_operacionais}", False),  # code=None | ( - ) RESULTADO NÃO PERACIONAL
    ("receita_de_alienacoes_do_ativo_permanente", 4, "agrupamento", None, False),  # code=341101 | Receita de Alienações do Ativo Permanente
    ("outras_despesas_nao_operacionais", 4, "agrupamento", None, False),  # code=341102 | (-) Outras Despesas Não Operacionais
    ("lucro_antes_do_irpj_e_csll", 1, "formula", "{linha:ebit}-{linha:resultado_financeiro_nao_operacional}", True),  # code=None | LUCRO ANTES DO IRPJ E CSLL
    ("irpj_e_csll", 1, "formula", "{linha:contribuicao_social_sobre_o_lucro_csll}+{linha:imposto_de_renda_pessoa_juridica_irpj}", True),  # code=None | ( - ) IRPJ E CSLL
    ("contribuicao_social_sobre_o_lucro_csll", 4, "agrupamento", None, False),  # code=0.09 | Contribuição Social sobre O Lucro - CSLL
    ("imposto_de_renda_pessoa_juridica_irpj", 4, "agrupamento", None, False),  # code=0.15 | Imposto de Renda Pessoa juridica - IRPJ
    ("previa_de_irpj_e_csll", 4, "agrupamento", None, False),  # code=None | PREVIA DE IRPJ E CSLL
    ("lucro_liquido_operacional", 1, "formula", "{linha:lucro_antes_do_irpj_e_csll}-{linha:irpj_e_csll}", True),  # code=None | LUCRO LIQUIDO OPERACIONAL
    ("despesas_nao_operacionais", 1, "soma_filhos", None, True),  # code=None | DESPESAS NÃO OPERACIONAIS
    ("aluguel_a_realizar", 4, "agrupamento", None, False),  # code=600 | ALUGUEL A REALIZAR
    ("pro_labore_1_a_realizar", 4, "agrupamento", None, False),  # code=601 | PRO LABORE 1% A REALIZAR
    ("total", 4, "formula", "{linha:inadimplentes}+{linha:cheques_devolvidos_entradas}-{linha:cheques_devolvidos_recebidos}", True),  # code=None | TOTAL
    ("inadimplentes", 4, "agrupamento", None, False),  # code=None | INADIMPLENTES
    ("cheques_devolvidos_entradas", 4, "agrupamento", None, False),  # code=602 | CHEQUES DEVOLVIDOS - ( + ) ENTRADAS
    ("cheques_devolvidos_recebidos", 4, "agrupamento", None, False),  # code=603 | CHEQUES DEVOLVIDOS - ( - ) RECEBIDOS
    ("investimentos_realizados", 4, "agrupamento", None, False),  # code=604 | INVESTIMENTOS REALIZADOS
    ("resultado_lucro_liquido", 1, "formula", "{linha:lucro_liquido_operacional}-{linha:despesas_nao_operacionais}", True),  # code=None | RESULTADO  - LUCRO LIQUIDO
    ("fluxo_de_pagamentos", 1, "soma_filhos", None, True),  # code=None | Fluxo de Pagamentos
    ("pro_labore_socios", 4, "agrupamento", None, False),  # code=605 | Pró Labore Sócios
    ("adiantamentos_socios", 4, "agrupamento", None, False),  # code=606 | Adiantamentos Sócios
    ("gastos_da_diretoria_socios_indedutiveis", 4, "agrupamento", None, False),  # code=607 | Gastos da Diretoria/Sócios - Indedutíveis
]


def _tipo_visual(modo: str) -> str:
    return {"formula": "totalizador", "soma_filhos": "titulo"}.get(modo, "agrupamento")


def _remover_templates_anteriores(db: Session) -> None:
    """Remove versões antigas deste template referencial (recria limpo, sem resíduo 'Leal').
    Preserva o cliente e o Plano Nativo — só apaga o template, suas linhas e os
    de-paras conta→linha que apontavam para linhas antigas."""
    antigos = (
        db.query(models.TemplateRef)
        .filter(models.TemplateRef.nome.in_(_NOMES_ANTERIORES))
        .all()
    )
    for t in antigos:
        linha_ids = [l.id for l in t.linhas]
        if linha_ids:
            db.query(models.DeParaDreLinha).filter(
                models.DeParaDreLinha.template_linha_id.in_(linha_ids)
            ).delete(synchronize_session=False)
        # clientes que apontavam para este template perdem o vínculo padrão
        db.query(models.Cliente).filter(
            models.Cliente.template_dre_padrao_id == t.id
        ).update({models.Cliente.template_dre_padrao_id: None}, synchronize_session=False)
        db.delete(t)  # cascade apaga as linhas
    db.commit()


def seed_dre_controladoria(db: Session) -> dict:
    relatorio = {"template_id": None, "linhas_criadas": 0, "cliente_teste_vinculado": False}

    _remover_templates_anteriores(db)

    segmento = db.query(models.Segmento).filter(models.Segmento.nome == SEGMENTO_NOME).first()
    template = models.TemplateRef(
        tipo="dre", nome=NOME_TEMPLATE,
        segmento_id=segmento.id if segmento else None, ativo=True,
    )
    db.add(template); db.commit(); db.refresh(template)

    for ordem, (rotulo, nivel, modo, formula, negrito) in enumerate(_LINHAS, start=1):
        db.add(models.TemplateLinhaRef(
            template_id=template.id, rotulo=rotulo, ordem=ordem,
            negrito_totalizador=negrito, tipo=_tipo_visual(modo),
            modo_calculo=modo, nivel=nivel,
            agrupamento_slug=None,        # DRE não usa agrupamento; folhas sem vínculo na Camada 1
            formula_texto=formula,
        ))
    db.commit()
    relatorio["template_id"] = template.id
    relatorio["linhas_criadas"] = len(_LINHAS)

    # Aponta o template DRE padrão do cliente de teste (Supermercado Leal) para este referencial.
    cliente = db.query(models.Cliente).filter(models.Cliente.cnpj == CNPJ_CLIENTE_TESTE).first()
    if cliente:
        cliente.template_dre_padrao_id = template.id
        db.commit()
        relatorio["cliente_teste_vinculado"] = True

    print(f"[seed_dre_controladoria] template '{NOME_TEMPLATE}' (id={template.id}) criado com "
          f"{relatorio['linhas_criadas']} linhas (esqueleto Camada 1)")
    if relatorio["cliente_teste_vinculado"]:
        print(f"[seed_dre_controladoria] cliente de teste (CNPJ {CNPJ_CLIENTE_TESTE}) aponta para o template")
    return relatorio


if __name__ == "__main__":
    import argparse
    import sys
    from database import _is_sqlite, SessionLocal

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Permite rodar fora do SQLite local")
    args = parser.parse_args()

    if not _is_sqlite and not args.force:
        print("[seed_dre_controladoria] seed só roda em banco local SQLite — use --force para outro ambiente")
        sys.exit(1)

    db = SessionLocal()
    try:
        seed_dre_controladoria(db)
    finally:
        db.close()
