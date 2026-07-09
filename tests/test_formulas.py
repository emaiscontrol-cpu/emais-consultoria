import os
from routers.fc_exec import _eval_formula

def test_eval_formulas_legitimas():
    # Caso 1: Aritmética simples D5 + D6
    vals = {5: 100.0, 6: 50.0}
    assert _eval_formula("D5+D6", vals) == 150.0

    # Caso 2: IFERROR(D5/D6,0) com divisão normal
    assert _eval_formula("IFERROR(D5/D6,0)", vals) == 2.0

    # Caso 3: IFERROR com divisão por zero
    vals_zero = {5: 100.0, 6: 0.0}
    assert _eval_formula("IFERROR(D5/D6,0)", vals_zero) == 0.0

    # Caso 4: IF(D6=0,0,D5/D6) com D6 = 0
    assert _eval_formula("IF(D6=0,0,D5/D6)", vals_zero) == 0.0

    # Caso 5: IF(D6=0,0,D5/D6) com D6 != 0
    assert _eval_formula("IF(D6=0,0,D5/D6)", vals) == 2.0


def test_eval_formula_maliciosa_sandbox_escape():
    # Tentativa de RCE clássica do Python
    # Uma fórmula maliciosa que tenta interagir com o sistema ou criar arquivo
    arquivo_teste = "rce_detectado.txt"
    if os.path.exists(arquivo_teste):
        os.remove(arquivo_teste)

    # Payload que tenta executar código para criar arquivo
    # Em Python eval, isso tentaria carregar os e abrir o arquivo
    payload = f"__import__('os').system('touch {arquivo_teste}')"
    resultado = _eval_formula(payload, {})
    
    assert resultado == 0.0
    assert not os.path.exists(arquivo_teste), "A vulnerabilidade de RCE ainda está ativa!"

    # Outro escape com classes builtin
    payload_mro = "().__class__.__mro__[1].__subclasses__()"
    resultado_mro = _eval_formula(payload_mro, {})
    assert resultado_mro == 0.0
