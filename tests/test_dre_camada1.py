"""
Camada 1 do template DRE real (esqueleto + motor).
- Motor de fórmulas: suporte a *, / e constantes numéricas.
- Regressão da ordenação topológica: fórmula que depende de outra fórmula listada DEPOIS
  dela (pai exibido antes dos filhos) deve calcular na ordem correta.
Ver documentos/PROJETO_REFERENCIAL.md.
"""
import models
from ref_formula_engine import calcular_linha
from routers.ref_demonstrativos import _calcular_template


# ── Motor: * / e constantes (calcular_linha) ────────────────────────────────
class TestMotorMultDivConstante:
    def test_multiplicacao(self):
        val, err = calcular_linha("{linha:a}*{linha:b}", {}, {"a": 30.0, "b": 4.0})
        assert err is None
        assert val == 120.0

    def test_divisao(self):
        val, err = calcular_linha("{linha:a}/{linha:b}", {}, {"a": 100.0, "b": 4.0})
        assert err is None
        assert val == 25.0

    def test_constante(self):
        # ex. real da DRE: depreciação = receita_liquida * 0.007
        val, err = calcular_linha("{linha:receita_liquida}*0.007", {}, {"receita_liquida": 200000.0})
        assert err is None
        assert val == 1400.0

    def test_divisao_por_zero_sinalizada(self):
        val, err = calcular_linha("{linha:a}/{linha:b}", {}, {"a": 10.0, "b": 0.0})
        assert err == "div_zero"


# ── Regressão: ordenação topológica com fórmula→fórmula fora de ordem ─────────
class TestOrdenacaoFormulaAninhada:
    def test_formula_depende_de_formula_listada_depois(self, db_session, cliente_teste):
        """pai (ordem 1) refere filho (ordem 2), que refere base (ordem 3). Sem a
        ordenação topológica correta, pai calcularia antes → ref_inexistente."""
        cliente_teste.modulo_analises_gerenciais = True
        db_session.commit()

        template = models.TemplateRef(tipo="dre", nome="DRE Ordem Topologica")
        db_session.add(template); db_session.commit(); db_session.refresh(template)

        db_session.add_all([
            models.TemplateLinhaRef(template_id=template.id, rotulo="pai", ordem=1, nivel=1,
                                    modo_calculo="formula", formula_texto="{linha:filho}"),
            models.TemplateLinhaRef(template_id=template.id, rotulo="filho", ordem=2, nivel=1,
                                    modo_calculo="formula", formula_texto="{linha:base}"),
            models.TemplateLinhaRef(template_id=template.id, rotulo="base", ordem=3, nivel=1,
                                    modo_calculo="formula", formula_texto="100"),
        ])
        db_session.commit()

        linhas, _ = _calcular_template(db_session, cliente_teste.id, template.id, 2026, 1)
        val = {l.rotulo: (l.valor, l.erro) for l in linhas}
        assert val["base"] == (100.0, None)
        assert val["filho"] == (100.0, None)
        assert val["pai"] == (100.0, None)
