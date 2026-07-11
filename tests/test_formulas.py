import os
import pytest
from fastapi import HTTPException
from sqlalchemy import text
from ref_formula_engine import calcular_linha, validar_formula, detectar_ciclo
from routers.fc_exec import _eval_formula


def test_eval_formulas_legitimas():
    # Caso 1: Aritmética simples D5 + D6
    vals = {5: 100.0, 6: 50.0}
    val, err = _eval_formula("D5+D6", vals)
    assert val == 150.0
    assert err is False

    # Caso 2: IFERROR(D5/D6,0) com divisão normal
    val, err = _eval_formula("IFERROR(D5/D6,0)", vals)
    assert val == 2.0
    assert err is False

    # Caso 3: IFERROR com divisão por zero
    vals_zero = {5: 100.0, 6: 0.0}
    val, err = _eval_formula("IFERROR(D5/D6,0)", vals_zero)
    assert val == 0.0

    # Caso 4: IF(D6=0,0,D5/D6) com D6 = 0
    val, err = _eval_formula("IF(D6=0,0,D5/D6)", vals_zero)
    assert val == 0.0

    # Caso 5: IF(D6=0,0,D5/D6) com D6 != 0
    val, err = _eval_formula("IF(D6=0,0,D5/D6)", vals)
    assert val == 2.0


def test_eval_formula_maliciosa_sandbox_escape():
    # Tentativa de RCE clássica do Python
    # Uma fórmula maliciosa que tenta interagir com o sistema ou criar arquivo
    arquivo_teste = "rce_detectado.txt"
    if os.path.exists(arquivo_teste):
        os.remove(arquivo_teste)

    # Payload que tenta executar código para criar arquivo
    # Em Python eval, isso tentaria carregar os e abrir o arquivo
    payload = f"__import__('os').system('touch {arquivo_teste}')"
    val, err = _eval_formula(payload, {})

    assert val == 0.0
    assert not os.path.exists(arquivo_teste), "A vulnerabilidade de RCE ainda está ativa!"

    # Outro escape com classes builtin
    payload_mro = "().__class__.__mro__[1].__subclasses__()"
    val_mro, err_mro = _eval_formula(payload_mro, {})
    assert val_mro == 0.0


def test_if_com_ponto_e_virgula():
    # Testa normalização do ";" para "," fora de strings no motor do Fluxo de Caixa Executivo
    val1, err1 = _eval_formula("IF(D1>10; 100; 200)", {1: 15.0})
    val2, err2 = _eval_formula("IF(D1>10, 100, 200)", {1: 15.0})
    assert err1 is False
    assert err2 is False
    assert val1 == val2

    val3, err3 = _eval_formula("IF(D1>10; 100; 200)", {1: 5.0})
    val4, err4 = _eval_formula("IF(D1>10, 100, 200)", {1: 5.0})
    assert err3 is False
    assert err4 is False
    assert val3 == val4


def test_literal_porcentagem():
    # Testa suporte a N% (converte para N/100.0)
    val1, err1 = _eval_formula("D5*10%", {5: 100.0})
    assert err1 is False
    assert val1 == 10.0

    val2, err2 = _eval_formula("D5*0.1", {5: 100.0})
    assert err2 is False
    assert val2 == 10.0


def test_referencia_inexistente():
    # Referência inexistente a agrupamento ou linha deve retornar erro no ref_formula_engine
    val_agr = {"Vda_Din": 100.0}
    val_lin = {"Linha_A": 50.0}

    # Referência correta
    val, err = calcular_linha("{agrupamento:Vda_Din} + {linha:Linha_A}", val_agr, val_lin)
    assert err is None
    assert val == 150.0

    # Agrupamento inexistente
    val, err = calcular_linha("{agrupamento:inexistente} + {linha:Linha_A}", val_agr, val_lin)
    assert err == "ref_inexistente:inexistente"

    # Linha inexistente
    val, err = calcular_linha("{agrupamento:Vda_Din} + {linha:Linha_B}", val_agr, val_lin)
    assert err == "ref_inexistente:Linha_B"


def test_divisao_por_zero():
    # Divisão por zero sinalizada como "div_zero" no ref_formula_engine
    val, err = calcular_linha("10 / 0", {}, {})
    assert err == "div_zero"

    # Divisão por zero sinalizada como erro=True no fc_exec
    val, err = _eval_formula("10 / 0", {})
    assert err is True


class TestCiclosTemplate:
    def test_ciclo_rejeitado_no_save(self, client, admin_headers, db_session):
        # 1. Cria um template
        import models
        template = models.TemplateRef(tipo="fluxo_caixa", nome="Template Ciclo", ativo=True)
        db_session.add(template)
        db_session.commit()
        db_session.refresh(template)

        # 2. Cria a Linha A sem fórmula referenciando B
        r1 = client.post(
            f"/api/ref/templates/{template.id}/linhas",
            json={
                "rotulo": "Linha A",
                "ordem": 1,
                "tipo": "totalizador",
                "formula_texto": ""
            },
            headers=admin_headers
        )
        assert r1.status_code == 200
        lid_a = r1.json()["id"]

        # 3. Cria a Linha B referenciando a Linha A (permitido, pois A já existe!)
        r2 = client.post(
            f"/api/ref/templates/{template.id}/linhas",
            json={
                "rotulo": "Linha B",
                "ordem": 2,
                "tipo": "totalizador",
                "formula_texto": "{linha:Linha A}"
            },
            headers=admin_headers
        )
        assert r2.status_code == 200

        # 4. Tenta atualizar a Linha A para referenciar a Linha B (B já existe, mas fecha o ciclo A -> B -> A!)
        r3 = client.put(
            f"/api/ref/templates/{template.id}/linhas/{lid_a}",
            json={
                "formula_texto": "{linha:Linha B}"
            },
            headers=admin_headers
        )
        # Deve falhar com HTTP 400 listando o ciclo
        assert r3.status_code == 400
        assert "circular" in r3.json()["detail"]
        assert "Linha A" in r3.json()["detail"]
        assert "Linha B" in r3.json()["detail"]
