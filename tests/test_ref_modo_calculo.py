"""
Testes do motor de calculo por modo_calculo (Fase A' — Projeto Referencial):
'agrupamento' (folha), 'soma_filhos' (titulo, auto-soma dos filhos diretos por
nivel/ordem) e 'formula' (totalizador, safe_eval). Ver documentos/PROJETO_REFERENCIAL.md.
"""
from datetime import date
import models
from routers.ref_demonstrativos import _calcular_template


def _seed_lancamento(db, cliente_id, agrupamento_slug, valor, ano=2026, mes=1):
    plano = db.query(models.PlanoReferencial).first()
    if not plano:
        plano = models.PlanoReferencial(nome="Plano Teste")
        db.add(plano); db.commit(); db.refresh(plano)

    cr = models.ContaReferencial(
        plano_id=plano.id, codigo=f"1.{agrupamento_slug}", descricao=agrupamento_slug,
        tipo="analitica", natureza="soma", agrupamento=agrupamento_slug,
    )
    db.add(cr); db.commit(); db.refresh(cr)

    cc = models.ContaClienteRef(
        cliente_id=cliente_id, codigo_origem=f"ERP_{agrupamento_slug}",
        descricao_origem=agrupamento_slug,
    )
    db.add(cc); db.commit(); db.refresh(cc)

    dp = models.DeParaRef(
        conta_cliente_id=cc.id, conta_referencial_id=cr.id, percentual=100.0,
        status="confirmado", vigente_a_partir=date(2025, 1, 1),
    )
    db.add(dp); db.commit()

    db.add(models.LancamentoRef(
        conta_cliente_id=cc.id, unidade_codigo=None, valor=valor, ano=ano, mes=mes,
    ))
    db.commit()


def _valor(linhas, rotulo):
    return next(l for l in linhas if l.rotulo == rotulo)


class TestModoCalculo:
    def test_agrupamento_soma_filhos_e_formula_bottom_up(self, db_session, cliente_teste):
        cliente_teste.modulo_analises_gerenciais = True
        db_session.commit()

        _seed_lancamento(db_session, cliente_teste.id, "rec_avista", 1000.0)
        _seed_lancamento(db_session, cliente_teste.id, "rec_aprazo", 500.0)
        _seed_lancamento(db_session, cliente_teste.id, "cmv", 300.0)

        template = models.TemplateRef(tipo="dre", nome="DRE Teste Modo Calculo")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        def _linha(**kw):
            db_session.add(models.TemplateLinhaRef(template_id=template.id, **kw))

        # ordem reflete a planilha: bloco (nivel menor) vem antes de suas folhas
        _linha(rotulo="bloco_receita", ordem=1, nivel=2, modo_calculo="soma_filhos")
        _linha(rotulo="folha_avista", ordem=2, nivel=4, modo_calculo="agrupamento", agrupamento_slug="rec_avista")
        _linha(rotulo="folha_aprazo", ordem=3, nivel=4, modo_calculo="agrupamento", agrupamento_slug="rec_aprazo")
        _linha(rotulo="bloco_cmv", ordem=4, nivel=2, modo_calculo="soma_filhos")
        _linha(rotulo="folha_cmv", ordem=5, nivel=4, modo_calculo="agrupamento", agrupamento_slug="cmv")
        _linha(rotulo="total", ordem=6, nivel=1, modo_calculo="formula",
               formula_texto="{linha:bloco_receita}-{linha:bloco_cmv}")
        # linha legada (sem modo_calculo explicito, so formula_texto) — fallback deve tratar como 'formula'
        _linha(rotulo="legado_soma", ordem=7, nivel=1,
               formula_texto="{linha:bloco_receita}+{linha:bloco_cmv}")
        db_session.commit()

        linhas, fechado = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)

        assert fechado is False
        assert _valor(linhas, "folha_avista").valor == 1000.0
        assert _valor(linhas, "folha_aprazo").valor == 500.0
        assert _valor(linhas, "folha_cmv").valor == 300.0
        assert _valor(linhas, "bloco_receita").valor == 1500.0
        assert _valor(linhas, "bloco_cmv").valor == 300.0
        assert _valor(linhas, "total").valor == 1200.0
        assert _valor(linhas, "legado_soma").valor == 1800.0
        for l in linhas:
            assert l.erro is None

    def test_soma_filhos_aninhado(self, db_session, cliente_teste):
        """Bloco (nivel 1) soma grupos (nivel 2), que somam folhas (nivel 4)."""
        cliente_teste.modulo_analises_gerenciais = True
        db_session.commit()

        _seed_lancamento(db_session, cliente_teste.id, "rec_avista", 100.0)
        _seed_lancamento(db_session, cliente_teste.id, "rec_aprazo", 200.0)

        template = models.TemplateRef(tipo="dre", nome="DRE Teste Aninhado")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        def _linha(**kw):
            db_session.add(models.TemplateLinhaRef(template_id=template.id, **kw))

        _linha(rotulo="bloco_a", ordem=1, nivel=1, modo_calculo="soma_filhos")
        _linha(rotulo="grupo_a1", ordem=2, nivel=2, modo_calculo="soma_filhos")
        _linha(rotulo="folha_avista", ordem=3, nivel=4, modo_calculo="agrupamento", agrupamento_slug="rec_avista")
        _linha(rotulo="folha_aprazo", ordem=4, nivel=4, modo_calculo="agrupamento", agrupamento_slug="rec_aprazo")
        db_session.commit()

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)

        assert _valor(linhas, "grupo_a1").valor == 300.0
        assert _valor(linhas, "bloco_a").valor == 300.0
