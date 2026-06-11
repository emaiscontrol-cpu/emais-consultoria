"""
Gera TemplateFormula automaticamente a partir da estrutura do Plano de Contas.

Lógica de hierarquia (por prioridade):
  1. Agrupamento com dot-notation "GRUPO.SUBGRUPO" → N2
  2. item.nivel definido no banco (diferente de NULL)
  3. Conta contábil: 1 dígito significativo → N1, 2+ → N2
  4. Sem conta e sem dot → N1 (posição no topo da hierarquia)
  AN/qualquer outro tipo → N3

Relacionamento pai-filho:
  N3 → pertence ao último N2 visto (por ordem); fallback ao último N1
  N2 → pai = N1 cujo agrupamento == prefixo antes do ponto,
        OU cujo prefixo de conta é início do código N2,
        OU o último N1 visto
"""

import json
from sqlalchemy.orm import Session
from models import PlanoItem, TemplateFormula


def _nivel_item(it) -> int:
    """
    Determina nível hierárquico de um PlanoItem.
    Prioridade: dot-notation → nivel DB → conta → padrão N1.
    """
    tipo = (it.tipo or "").upper()
    if tipo not in ("TT", "RES"):
        return 3
    agr = it.agrupamento or ""
    # Dot-notation → N2 sem ambiguidade
    if "." in agr:
        return 2
    # Nível explícito no banco (exceto 1, que pode ser resultado de migração por conta vazia)
    if it.nivel is not None and it.nivel == 2:
        return 2
    if it.nivel is not None and it.nivel == 1:
        # Só confia em nivel=1 se conta tem dígito significativo OU agrupamento não é vazio
        s = (it.conta or "").rstrip("0")
        if s or (agr and "." not in agr):
            return 1
    # Fallback: conta contábil
    s = (it.conta or "").rstrip("0")
    return 1 if len(s) <= 1 else 2


def _n1_pai_id(it, n1s: list[tuple]) -> int | None:
    """
    Encontra N1 pai de um item N2.
    Tenta: (1) prefixo no agrupamento, (2) prefixo no conta, (3) último N1.
    n1s: [(id, agrupamento, conta), ...]
    """
    agr = it.agrupamento or ""
    conta = it.conta or ""

    # 1. Dot-notation: "RECEITA.VDA_VISTA" → pai tem agrupamento "RECEITA"
    if "." in agr:
        prefix = agr.split(".")[0]
        for item_id, n1_agr, _ in n1s:
            if (n1_agr or "") == prefix:
                return item_id

    # 2. Prefixo de conta contábil
    s2 = conta.rstrip("0")
    if s2:
        for item_id, _, n1_conta in n1s:
            s1 = (n1_conta or "").rstrip("0")
            if s1 and s2.startswith(s1):
                return item_id

    # 3. Fallback: primeiro N1 da lista
    return n1s[0][0] if n1s else None


def gerar_formulas_do_plano(
    plano_id: int,
    db: Session,
    sobrescrever: bool = False,
) -> dict:
    """
    Gera (ou sobrescreve) TemplateFormula para todos os itens do plano.
    Retorna resumo com contagem e lista de N1s para revisão.
    """
    items = (
        db.query(PlanoItem)
        .filter(PlanoItem.plano_id == plano_id)
        .order_by(PlanoItem.ordem)
        .all()
    )
    if not items:
        return {"geradas": 0, "revisao_n1": []}

    # Calcular nível de cada item usando a lógica corrigida
    for it in items:
        it._nv = _nivel_item(it)

    n1s = [(it.id, it.agrupamento, it.conta) for it in items if it._nv == 1]

    # N2 → N1 parent
    n2_pai: dict[int, int | None] = {}
    for it in items:
        if it._nv == 2:
            n2_pai[it.id] = _n1_pai_id(it, n1s)

    # Percorre em ordem para montar listas de filhos
    n2_filhos: dict[int, list] = {}  # n2_id → chaves de N3 filhos
    n1_filhos: dict[int, list] = {}  # n1_id → agrupamentos de N2 filhos

    last_n2: int | None = None
    last_n1: int | None = None
    for it in items:
        if it._nv == 1:
            last_n1 = it.id
            last_n2 = None
        elif it._nv == 2:
            last_n2 = it.id
            pai_n1 = n2_pai.get(it.id) or last_n1
            if pai_n1 and (it.agrupamento or "").strip():
                n1_filhos.setdefault(pai_n1, []).append(it.agrupamento)
        else:
            # N3 → filho do N2 atual (ou N1 se não há N2)
            pai = last_n2 or last_n1
            key = (it.agrupamento or "").strip() or (it.conta or "").strip()
            if pai and key:
                n2_filhos.setdefault(pai, []).append(key)

    geradas = 0
    revisao_n1 = []

    for it in items:
        existe = (
            db.query(TemplateFormula)
            .filter(TemplateFormula.plano_item_id == it.id)
            .first()
        )
        if existe and not sobrescrever:
            continue

        nv = it._nv

        if nv == 3:
            tipo_f = "VALOR"
            componentes: list = []
        elif nv == 2:
            tipo_f = "FILHOS"
            filhos = n2_filhos.get(it.id, [])
            componentes = [{"agrupamento": agr, "sinal": 1} for agr in filhos]
        else:  # N1
            tipo_f = "AGRUPAMENTOS"
            filhos_n2 = n1_filhos.get(it.id, [])
            componentes = [{"agrupamento": agr, "sinal": 1} for agr in filhos_n2]
            revisao_n1.append({
                "item_id": it.id,
                "descricao": it.descricao,
                "n_filhos": len(filhos_n2),
                "filhos": filhos_n2,
            })

        comp_json = json.dumps(componentes, ensure_ascii=False)
        if existe:
            existe.tipo_formula = tipo_f
            existe.componentes = comp_json
            existe.auto_gerada = True
        else:
            db.add(TemplateFormula(
                plano_item_id=it.id,
                tipo_formula=tipo_f,
                componentes=comp_json,
                auto_gerada=True,
            ))
        geradas += 1

    db.commit()
    return {"geradas": geradas, "revisao_n1": revisao_n1}
