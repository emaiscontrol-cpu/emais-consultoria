"""Motor de fórmulas para templates do Plano Referencial."""
import ast
import re
import operator
from collections import deque

_RE_AGR  = re.compile(r'\{agrupamento:([^}]+)\}')
_RE_LIN  = re.compile(r'\{linha:([^}]+)\}')
_ALLOWED = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def extrair_refs(formula: str) -> tuple[set, set]:
    """Retorna (agrupamentos, rotulos_linha) referenciados na fórmula."""
    return set(_RE_AGR.findall(formula or '')), set(_RE_LIN.findall(formula or ''))


def validar_formula(formula: str, refs_validas: set | None = None) -> str | None:
    """Retorna None se OK, ou mensagem de erro."""
    if not formula or not formula.strip():
        return None

    if refs_validas is not None:
        agrs_ref, lins_ref = extrair_refs(formula)
        invalidas = []
        for agr in agrs_ref:
            if agr not in refs_validas:
                invalidas.append(f"agrupamento '{agr}'")
        for lin in lins_ref:
            if lin not in refs_validas:
                invalidas.append(f"linha '{lin}'")
        if invalidas:
            return f"Referências desconhecidas: {', '.join(invalidas)}"

    placeholder = _RE_AGR.sub('1', formula)
    placeholder = _RE_LIN.sub('1', placeholder)
    try:
        ast.parse(placeholder, mode='eval')
    except SyntaxError as e:
        return f"Sintaxe inválida: {e.msg}"
    return None


def detectar_ciclo(linhas) -> list | None:
    """DFS — retorna lista de rótulos do ciclo ou None se livre."""
    grafo = {}
    for l in linhas:
        _, refs = extrair_refs(l.formula_texto or '')
        grafo[l.rotulo] = refs

    BRANCO, CINZA, PRETO = 0, 1, 2
    cor = {r: BRANCO for r in grafo}
    caminho: list = []
    ciclo: list = []

    def dfs(v):
        cor[v] = CINZA
        caminho.append(v)
        for w in grafo.get(v, set()):
            if w not in grafo:
                continue
            if cor[w] == CINZA:
                idx = caminho.index(w)
                ciclo.extend(caminho[idx:])
                ciclo.append(w)
                return True
            if cor[w] == BRANCO and dfs(w):
                return True
        caminho.pop()
        cor[v] = PRETO
        return False

    for r in list(grafo):
        if cor[r] == BRANCO and dfs(r):
            return ciclo
    return None


def ordenar_linhas(linhas):
    """Ordenação topológica (Kahn) pelo grafo de dependências entre linhas."""
    rotulo_map = {l.rotulo: l for l in linhas}
    deps = {}  # rotulo -> set de rotulos que ele depende
    for l in linhas:
        _, refs = extrair_refs(l.formula_texto or '')
        deps[l.rotulo] = refs & rotulo_map.keys()

    # grau de entrada = quantas linhas cada rótulo depende (correção: antes ficava 0 para
    # todos, o que fazia a topológica cair no fallback de ordem original — quebrava fórmula
    # que depende de outra fórmula listada depois dela, ex.: pai exibido antes dos filhos)
    in_deg = {r: len(d) for r, d in deps.items()}
    rev = {r: set() for r in deps}
    for r, d in deps.items():
        for dep in d:
            rev[dep].add(r)

    queue = deque(r for r, d in deps.items() if not d)
    ordered = []
    while queue:
        node = queue.popleft()
        ordered.append(node)
        for successor in rev[node]:
            in_deg[successor] -= 1
            if in_deg[successor] == 0:
                queue.append(successor)

    resultado = [rotulo_map[r] for r in ordered if r in rotulo_map]
    seen = {l.rotulo for l in resultado}
    for l in linhas:
        if l.rotulo not in seen:
            resultado.append(l)
    return resultado


def safe_eval(expr: str) -> float:
    """Avalia expressão aritmética com segurança (sem eval() aberto)."""
    def _ev(node):
        if isinstance(node, ast.Constant):
            return float(node.value)
        if isinstance(node, ast.BinOp):
            op = type(node.op)
            if op not in _ALLOWED:
                raise ValueError(f"Operador não suportado: {op.__name__}")
            left, right = _ev(node.left), _ev(node.right)
            if op is ast.Div and right == 0.0:
                raise ZeroDivisionError()
            return _ALLOWED[op](left, right)
        if isinstance(node, ast.UnaryOp):
            op = type(node.op)
            if op not in _ALLOWED:
                raise ValueError(f"Operador unário não suportado: {op.__name__}")
            return _ALLOWED[op](_ev(node.operand))
        raise ValueError(f"Token não suportado: {type(node).__name__}")

    tree = ast.parse(expr.strip(), mode='eval')
    return _ev(tree.body)

_safe_eval = safe_eval


def calcular_linha(formula: str, val_agr: dict, val_lin: dict) -> tuple[float, str | None]:
    """
    Calcula o valor de uma linha de template.
    Retorna (valor, erro_str).
    """
    if not formula or not formula.strip():
        return 0.0, None

    agrs_ref, lins_ref = extrair_refs(formula)
    for agr in agrs_ref:
        if agr not in val_agr:
            return 0.0, f"ref_inexistente:{agr}"
    for lin in lins_ref:
        if lin not in val_lin:
            return 0.0, f"ref_inexistente:{lin}"

    expr = _RE_AGR.sub(lambda m: str(val_agr.get(m.group(1), 0.0)), formula)
    expr = _RE_LIN.sub(lambda m: str(val_lin.get(m.group(1), 0.0)), expr)

    try:
        return safe_eval(expr), None
    except ZeroDivisionError:
        return 0.0, "div_zero"
    except Exception as e:
        return 0.0, f"erro_calculo:{str(e)}"
