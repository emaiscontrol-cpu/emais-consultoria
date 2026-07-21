"""
Testes do MODELO DEFINITIVO da DRE: a linha-folha aponta DIRETO para N contas nativas
do cliente (via DeParaDreLinha), sem agrupamento. O valor da folha é a soma dos
LancamentoRef das contas vinculadas. Ver documentos/PROJETO_REFERENCIAL.md.
"""
from datetime import date
import models
from routers.ref_demonstrativos import _calcular_template


def _conta(db, cliente_id, codigo, desc):
    cc = models.ContaClienteRef(cliente_id=cliente_id, codigo_origem=codigo, descricao_origem=desc)
    db.add(cc); db.commit(); db.refresh(cc)
    return cc


def _lanc(db, cc_id, valor, ano=2026, mes=1, unidade=None):
    db.add(models.LancamentoRef(
        conta_cliente_id=cc_id, unidade_codigo=unidade, valor=valor, ano=ano, mes=mes,
    ))
    db.commit()


def _vinculo(db, cc_id, linha_id, percentual=100.0, vigencia=date(2025, 1, 1)):
    db.add(models.DeParaDreLinha(
        conta_cliente_id=cc_id, template_linha_id=linha_id, percentual=percentual,
        status="confirmado", confianca=1.0, origem_vinculo="manual", vigente_a_partir=vigencia,
    ))
    db.commit()


def _valor(linhas, rotulo):
    return next(l for l in linhas if l.rotulo == rotulo).valor


class TestDreVinculoDireto:
    def test_folha_soma_duas_contas_nativas(self, db_session, cliente_teste):
        """O caso pedido: uma linha-folha com 2 contas nativas vinculadas soma as duas."""
        cliente_teste.modulo_analises_gerenciais = True
        db_session.commit()

        template = models.TemplateRef(tipo="dre", nome="DRE Teste Direto")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        folha = models.TemplateLinhaRef(
            template_id=template.id, rotulo="Receita à Vista", ordem=1, nivel=4,
            modo_calculo="agrupamento", agrupamento_slug=None,  # sem agrupamento -> DRE direto
        )
        db_session.add(folha); db_session.commit(); db_session.refresh(folha)

        cc1 = _conta(db_session, cliente_teste.id, "311101", "Venda Dinheiro")
        cc2 = _conta(db_session, cliente_teste.id, "311102", "Venda Cheque à Vista")
        _lanc(db_session, cc1.id, 1000.0)
        _lanc(db_session, cc2.id, 250.0)
        _vinculo(db_session, cc1.id, folha.id)
        _vinculo(db_session, cc2.id, folha.id)

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)
        assert _valor(linhas, "Receita à Vista") == 1250.0

    def test_totalizador_sobre_folhas_diretas(self, db_session, cliente_teste):
        """Totalizador ({linha:...}) opera sobre folhas alimentadas por de-para direto."""
        cliente_teste.modulo_analises_gerenciais = True
        db_session.commit()

        template = models.TemplateRef(tipo="dre", nome="DRE Teste Totalizador")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        receita = models.TemplateLinhaRef(template_id=template.id, rotulo="Receita", ordem=1,
                                          nivel=4, modo_calculo="agrupamento", agrupamento_slug=None)
        deducao = models.TemplateLinhaRef(template_id=template.id, rotulo="Deducoes", ordem=2,
                                          nivel=4, modo_calculo="agrupamento", agrupamento_slug=None)
        liquida = models.TemplateLinhaRef(template_id=template.id, rotulo="Liquida", ordem=3,
                                          nivel=1, modo_calculo="formula",
                                          formula_texto="{linha:Receita}-{linha:Deducoes}")
        db_session.add_all([receita, deducao, liquida]); db_session.commit()
        db_session.refresh(receita); db_session.refresh(deducao)

        cc_r = _conta(db_session, cliente_teste.id, "311101", "Venda")
        cc_d = _conta(db_session, cliente_teste.id, "312101", "Imposto")
        _lanc(db_session, cc_r.id, 1000.0)
        _lanc(db_session, cc_d.id, 180.0)
        _vinculo(db_session, cc_r.id, receita.id)
        _vinculo(db_session, cc_d.id, deducao.id)

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)
        assert _valor(linhas, "Receita") == 1000.0
        assert _valor(linhas, "Deducoes") == 180.0
        assert _valor(linhas, "Liquida") == 820.0

    def test_rateio_percentual(self, db_session, cliente_teste):
        """1 conta pode dividir seu valor entre linhas por percentual."""
        cliente_teste.modulo_analises_gerenciais = True
        db_session.commit()

        template = models.TemplateRef(tipo="dre", nome="DRE Teste Rateio")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        la = models.TemplateLinhaRef(template_id=template.id, rotulo="LinhaA", ordem=1,
                                     nivel=4, modo_calculo="agrupamento", agrupamento_slug=None)
        lb = models.TemplateLinhaRef(template_id=template.id, rotulo="LinhaB", ordem=2,
                                     nivel=4, modo_calculo="agrupamento", agrupamento_slug=None)
        db_session.add_all([la, lb]); db_session.commit()
        db_session.refresh(la); db_session.refresh(lb)

        cc = _conta(db_session, cliente_teste.id, "999", "Conta Rateada")
        _lanc(db_session, cc.id, 1000.0)
        _vinculo(db_session, cc.id, la.id, percentual=70.0)
        _vinculo(db_session, cc.id, lb.id, percentual=30.0)

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)
        assert _valor(linhas, "LinhaA") == 700.0
        assert _valor(linhas, "LinhaB") == 300.0

    def test_rateio_adm_faturamento(self, db_session, cliente_teste):
        """Unidade administrativa rateada por faturamento nas operacionais."""
        cliente_teste.modulo_analises_gerenciais = True
        cliente_teste.criterio_rateio_adm = "faturamento"
        db_session.commit()

        # Cria unidades: OP1, OP2 e ADM
        u_op1 = models.Unidade(cliente_id=cliente_teste.id, codigo="101", nome="OP1", eh_adm=False, ativo=True)
        u_op2 = models.Unidade(cliente_id=cliente_teste.id, codigo="102", nome="OP2", eh_adm=False, ativo=True)
        u_adm = models.Unidade(cliente_id=cliente_teste.id, codigo="999", nome="ADM", eh_adm=True, ativo=True)
        db_session.add_all([u_op1, u_op2, u_adm]); db_session.commit()

        template = models.TemplateRef(tipo="dre", nome="DRE ADM Rateio Faturamento")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        # Precisamos de venda_avista ou venda_aprazo (ou ambas) para definir faturamento
        venda_avista = models.TemplateLinhaRef(template_id=template.id, rotulo="venda_avista", ordem=1, nivel=2, modo_calculo="soma_filhos")
        folha_venda = models.TemplateLinhaRef(template_id=template.id, rotulo="venda_din", ordem=2, nivel=4, modo_calculo="agrupamento")
        venda_aprazo = models.TemplateLinhaRef(template_id=template.id, rotulo="venda_aprazo", ordem=3, nivel=2, modo_calculo="soma_filhos")
        despesa = models.TemplateLinhaRef(template_id=template.id, rotulo="desp_adm", ordem=4, nivel=4, modo_calculo="agrupamento")
        db_session.add_all([venda_avista, folha_venda, venda_aprazo, despesa]); db_session.commit()
        db_session.refresh(folha_venda); db_session.refresh(despesa)

        # Receitas: OP1 vende 7000, OP2 vende 3000 (total faturamento = 10000)
        cc_venda = _conta(db_session, cliente_teste.id, "311101", "Venda Dinheiro")
        _lanc(db_session, cc_venda.id, 7000.0, unidade="101")
        _lanc(db_session, cc_venda.id, 3000.0, unidade="102")
        _vinculo(db_session, cc_venda.id, folha_venda.id)

        # Despesa de 1000.0 lançada na unidade ADM (999)
        cc_desp = _conta(db_session, cliente_teste.id, "333101", "Despesa ADM")
        _lanc(db_session, cc_desp.id, 1000.0, unidade="999")
        _vinculo(db_session, cc_desp.id, despesa.id)

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)

        linha_res = next(l for l in linhas if l.rotulo == "desp_adm")
        assert linha_res.valores_unidades["101"] == 700.0
        assert linha_res.valores_unidades["102"] == 300.0
        assert linha_res.valores_unidades.get("999", 0.0) == 0.0
        assert linha_res.valores_unidades["Consolidado"] == 1000.0

    def test_rateio_adm_percentual(self, db_session, cliente_teste):
        """Unidade administrativa rateada por percentual fixo nas operacionais."""
        cliente_teste.modulo_analises_gerenciais = True
        cliente_teste.criterio_rateio_adm = "percentual"
        db_session.commit()

        # Cria unidades: OP1 (80%), OP2 (20%) e ADM
        u_op1 = models.Unidade(cliente_id=cliente_teste.id, codigo="101", nome="OP1", eh_adm=False, percentual_rateio=80.0, ativo=True)
        u_op2 = models.Unidade(cliente_id=cliente_teste.id, codigo="102", nome="OP2", eh_adm=False, percentual_rateio=20.0, ativo=True)
        u_adm = models.Unidade(cliente_id=cliente_teste.id, codigo="999", nome="ADM", eh_adm=True, ativo=True)
        db_session.add_all([u_op1, u_op2, u_adm]); db_session.commit()

        template = models.TemplateRef(tipo="dre", nome="DRE ADM Rateio Percentual")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        despesa = models.TemplateLinhaRef(template_id=template.id, rotulo="desp_adm", ordem=1, nivel=4, modo_calculo="agrupamento")
        db_session.add(despesa); db_session.commit(); db_session.refresh(despesa)

        cc_desp = _conta(db_session, cliente_teste.id, "333101", "Despesa ADM")
        _lanc(db_session, cc_desp.id, 500.0, unidade="999")
        _vinculo(db_session, cc_desp.id, despesa.id)

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)

        linha_res = next(l for l in linhas if l.rotulo == "desp_adm")
        assert linha_res.valores_unidades["101"] == 400.0
        assert linha_res.valores_unidades["102"] == 100.0
        assert linha_res.valores_unidades.get("999", 0.0) == 0.0
        assert linha_res.valores_unidades["Consolidado"] == 500.0

    def test_perdas_presumidas(self, db_session, cliente_teste):
        """A regra de presunção de perdas: usa real se real >= limiar, senão usa presumido."""
        cliente_teste.modulo_analises_gerenciais = True
        cliente_teste.percentual_perdas_presumido = 3.0  # limiar 3%
        db_session.commit()

        template = models.TemplateRef(tipo="dre", nome="DRE Perdas Presumidas")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        rec_liq = models.TemplateLinhaRef(template_id=template.id, rotulo="receita_liquida", ordem=1, nivel=1, modo_calculo="agrupamento")
        perdas_reais = models.TemplateLinhaRef(template_id=template.id, rotulo="perdas_totais_reais", ordem=2, nivel=4, modo_calculo="agrupamento")
        perdas = models.TemplateLinhaRef(template_id=template.id, rotulo="perdas", ordem=3, nivel=2, modo_calculo="formula", formula_texto="{linha:perdas_totais_reais}")
        db_session.add_all([rec_liq, perdas_reais, perdas]); db_session.commit()
        db_session.refresh(rec_liq); db_session.refresh(perdas_reais); db_session.refresh(perdas)

        # Caso A: perda real (100.0) / receita (10000.0) = 1%, que é menor que limiar (3%).
        # Deve assumir perda presumida: 10000.0 * 3% = 300.0
        cc_rec = _conta(db_session, cliente_teste.id, "311", "Receita")
        cc_perda = _conta(db_session, cliente_teste.id, "333", "Perda")
        
        # Limpa lançamentos anteriores
        db_session.query(models.LancamentoRef).delete()
        db_session.commit()

        _lanc(db_session, cc_rec.id, 10000.0)
        _lanc(db_session, cc_perda.id, 100.0)
        _vinculo(db_session, cc_rec.id, rec_liq.id)
        _vinculo(db_session, cc_perda.id, perdas_reais.id)

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)
        assert _valor(linhas, "perdas") == 300.0

        # Caso B: perda real (500.0) / receita (10000.0) = 5%, que é maior ou igual ao limiar (3%).
        # Deve assumir perda real: 500.0
        db_session.query(models.LancamentoRef).delete()
        db_session.commit()
        _lanc(db_session, cc_rec.id, 10000.0)
        _lanc(db_session, cc_perda.id, 500.0)

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)
        assert _valor(linhas, "perdas") == 500.0
