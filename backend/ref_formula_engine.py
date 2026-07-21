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

_COMP_OPS = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
}

BUILTINS = {"max", "min", "sum"}


def extrair_refs(formula: str) -> tuple[set, set]:
    """Retorna (agrupamentos, rotulos_linha) referenciados na fórmula."""
    agrs = set(_RE_AGR.findall(formula or ''))
    lins = set(_RE_LIN.findall(formula or ''))

    # Para não quebrar o parser com sintaxe legada de chaves, substitui temporariamente por 1
    placeholder = _RE_AGR.sub('1', formula or '')
    placeholder = _RE_LIN.sub('1', placeholder)

    try:
        tree = ast.parse(placeholder.strip(), mode='exec')
    except Exception:
        return agrs, lins

    local_vars = set()

    def _visit(node, is_write=False):
        if isinstance(node, ast.Name):
            name = node.id
            if is_write:
                local_vars.add(name)
            else:
                if name not in local_vars and name not in BUILTINS:
                    lins.add(name)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                _visit(target, is_write=True)
            _visit(node.value)
        elif isinstance(node, ast.BinOp):
            _visit(node.left)
            _visit(node.right)
        elif isinstance(node, ast.UnaryOp):
            _visit(node.operand)
        elif isinstance(node, ast.Call):
            for arg in node.args:
                _visit(arg)
        elif isinstance(node, ast.Compare):
            _visit(node.left)
            for comparator in node.comparators:
                _visit(comparator)
        elif isinstance(node, ast.IfExp):
            _visit(node.test)
            _visit(node.body)
            _visit(node.orelse)
        elif isinstance(node, ast.Expr):
            _visit(node.value)
        elif isinstance(node, (ast.List, ast.Tuple)):
            for elt in node.elts:
                _visit(elt)

    for stmt in tree.body:
        _visit(stmt)

    return agrs, lins


def validar_formula(formula: str, refs_validas: set | None = None) -> str | None:
    """Retorna None se OK, ou mensagem de erro."""
    if not formula or not formula.strip():
        return None

    # Substitui os marcadores legados por 1 para simplificar o parse sintático
    placeholder = _RE_AGR.sub('1', formula)
    placeholder = _RE_LIN.sub('1', placeholder)

    try:
        tree = ast.parse(placeholder.strip(), mode='exec')
    except SyntaxError as e:
        return f"Sintaxe inválida: {e.msg}"

    local_vars = set()

    def _visit(node, is_write=False):
        if isinstance(node, ast.Name):
            name = node.id
            if is_write:
                local_vars.add(name)
            else:
                if name not in local_vars and name not in BUILTINS:
                    if refs_validas is not None and name not in refs_validas:
                        return f"Referência desconhecida: '{name}'"
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                err = _visit(target, is_write=True)
                if err: return err
            err = _visit(node.value)
            if err: return err
        elif isinstance(node, ast.BinOp):
            op = type(node.op)
            if op not in _ALLOWED:
                return f"Operador não suportado: {op.__name__}"
            err = _visit(node.left)
            if err: return err
            err = _visit(node.right)
            if err: return err
        elif isinstance(node, ast.UnaryOp):
            op = type(node.op)
            if op not in _ALLOWED:
                return f"Operador unário não suportado: {op.__name__}"
            err = _visit(node.operand)
            if err: return err
        elif isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in BUILTINS:
                func_name = node.func.id if isinstance(node.func, ast.Name) else "desconhecida"
                return f"Função não suportada: '{func_name}'"
            for arg in node.args:
                err = _visit(arg)
                if err: return err
        elif isinstance(node, ast.Compare):
            err = _visit(node.left)
            if err: return err
            for op_type, comparator in zip(node.ops, node.comparators):
                op = type(op_type)
                if op not in _COMP_OPS:
                    return f"Operador de comparação não suportado: {op.__name__}"
                err = _visit(comparator)
                if err: return err
        elif isinstance(node, ast.IfExp):
            err = _visit(node.test)
            if err: return err
            err = _visit(node.body)
            if err: return err
            err = _visit(node.orelse)
            if err: return err
        elif isinstance(node, ast.Constant):
            pass
        elif isinstance(node, ast.Expr):
            err = _visit(node.value)
            if err: return err
        elif isinstance(node, (ast.List, ast.Tuple)):
            for elt in node.elts:
                err = _visit(elt)
                if err: return err
        else:
            return f"Elemento não suportado: {type(node).__name__}"
        return None

    for stmt in tree.body:
        err = _visit(stmt)
        if err:
            return err

    return None


def detectar_ciclo(linhas) -> list | None:
    """DFS — retorna lista de rótulos do ciclo ou None se livre."""
    grafo = {}
    for l in linhas:
        _, refs = extrair_refs(l.formula_texto or '')
        if l.rotulo == "perdas":
            refs.add("receita_liquida")
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
    deps = {}
    for l in linhas:
        _, refs = extrair_refs(l.formula_texto or '')
        deps[l.rotulo] = refs & rotulo_map.keys()
        if l.rotulo == "perdas" and "receita_liquida" in rotulo_map:
            deps[l.rotulo].add("receita_liquida")

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


def safe_eval(expr: str, variables: dict = None) -> float:
    """Avalia expressão aritmética com segurança (sem eval() aberto)."""
    local_vars = {}

    def _ev(node):
        if isinstance(node, ast.Constant):
            return float(node.value)
        if isinstance(node, ast.Name):
            name = node.id
            if name in local_vars:
                return local_vars[name]
            if variables and name in variables:
                return float(variables[name])
            raise NameError(f"Variável não definida: '{name}'")
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
        if isinstance(node, ast.Call):
            func_name = node.func.id if isinstance(node.func, ast.Name) else None
            if func_name == "max":
                args = [_ev(arg) for arg in node.args]
                return max(args) if args else 0.0
            if func_name == "min":
                args = [_ev(arg) for arg in node.args]
                return min(args) if args else 0.0
            if func_name == "sum":
                args = []
                for arg in node.args:
                    if isinstance(arg, (ast.List, ast.Tuple)):
                        args.extend([_ev(item) for item in arg.elts])
                    else:
                        args.append(_ev(arg))
                return sum(args)
            raise ValueError(f"Função não suportada: '{func_name}'")
        if isinstance(node, ast.Compare):
            left = _ev(node.left)
            for op_type, comparator in zip(node.ops, node.comparators):
                op = type(op_type)
                if op not in _COMP_OPS:
                    raise ValueError(f"Operador de comparação não suportado: {op.__name__}")
                right = _ev(comparator)
                if not _COMP_OPS[op](left, right):
                    return 0.0
                left = right
            return 1.0
        if isinstance(node, ast.IfExp):
            cond = _ev(node.test)
            if cond:
                return _ev(node.body)
            else:
                return _ev(node.orelse)
        if isinstance(node, (ast.List, ast.Tuple)):
            return [_ev(elt) for elt in node.elts]
        raise ValueError(f"Token não suportado: {type(node).__name__}")

    tree = ast.parse(expr.strip(), mode='exec')
    last_val = 0.0
    for stmt in tree.body:
        if isinstance(stmt, ast.Assign):
            val = _ev(stmt.value)
            for target in stmt.targets:
                if isinstance(target, ast.Name):
                    local_vars[target.id] = val
                else:
                    raise ValueError("Atribuição inválida (apenas variáveis simples são permitidas)")
        elif isinstance(stmt, ast.Expr):
            last_val = _ev(stmt.value)
        else:
            raise ValueError(f"Comando não suportado: {type(stmt).__name__}")
    return last_val

_safe_eval = safe_eval


def calcular_linha(formula: str, val_agr: dict, val_lin: dict) -> tuple[float, str | None]:
    """Retorna (valor, erro_str)."""
    if not formula or not formula.strip():
        return 0.0, None

    def repl_agr(m):
        name = m.group(1)
        if name not in val_agr:
            raise NameError(f"Variável não definida: '{name}'")
        return str(val_agr[name])

    def repl_lin(m):
        name = m.group(1)
        if name not in val_lin:
            raise NameError(f"Variável não definida: '{name}'")
        return str(val_lin[name])

    try:
        expr = _RE_AGR.sub(repl_agr, formula)
        expr = _RE_LIN.sub(repl_lin, expr)

        variables = {}
        variables.update(val_agr)
        variables.update(val_lin)

        return safe_eval(expr, variables), None
    except ZeroDivisionError:
        return 0.0, "div_zero"
    except NameError as ne:
        # Extrai o nome da variável que causou a falha do NameError
        # Ex: "Variável não definida: 'xxx'"
        msg = str(ne)
        match = re.search(r"'([^']+)'", msg)
        ref = match.group(1) if match else "desconhecida"
        return 0.0, f"ref_inexistente:{ref}"
    except Exception as e:
        return 0.0, f"erro_calculo:{str(e)}"
