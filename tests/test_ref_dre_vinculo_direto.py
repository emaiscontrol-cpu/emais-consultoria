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
