"""
Cria a DRE-espelho do cliente Leal (MODELO DEFINITIVO — Projeto Referencial).

DRE não usa agrupamento: a linha-folha aponta DIRETO para as contas nativas do cliente
via DeParaDreLinha (de-para conta→linha). Este seed cria:
  1. o template DRE (compartilhado/referencial) — folhas SEM agrupamento_slug;
  2. um Plano Nativo mínimo do Leal (ContaClienteRef) representando contas do ERP;
  3. o de-para direto (DeParaDreLinha) ligando essas contas às linhas-folha —
     incluindo uma folha ("Receita Venda à Vista") com 2 contas, para exercitar a soma.
Ver documentos/PROJETO_REFERENCIAL.md.

NÃO roda no startup — carga manual (padrão de seed_agrupamentos_ref.py).
Guards: só SQLite local (a menos que --force); idempotente por nome/CNPJ/vínculo.
"""
from datetime import date
from sqlalchemy.orm import Session
import models

NOME_TEMPLATE = "DRE Gerencial - Varejo (Leal)"
CNPJ_LEAL = "25926205000123"
SEGMENTO_NOME = "Varejo Alimentar"
VIGENCIA = date(2026, 1, 1)

# (rotulo, nivel, modo_calculo, formula_texto, negrito_totalizador)
# DRE NÃO usa agrupamento — folhas ('agrupamento'=apontamento) sem slug; recebem valor
# via DeParaDreLinha (ver _CONTAS_NATIVAS_LEAL). Totalizadores usam {linha:...}.
_LINHAS = [
    ("receita_bruta", 1, "formula", "{linha:venda_avista}+{linha:venda_aprazo}", True),
    ("venda_avista", 2, "soma_filhos", None, False),
    ("Receita Venda à Vista", 4, "agrupamento", None, False),
    ("venda_aprazo", 2, "soma_filhos", None, False),
    ("Receita Venda a Prazo", 4, "agrupamento", None, False),

    ("cancelamentos", 1, "agrupamento", None, False),
    ("venda_liquida", 1, "formula", "{linha:receita_bruta}-{linha:cancelamentos}", True),

    ("deducoes", 1, "soma_filhos", None, False),
    ("Impostos sobre Venda", 4, "agrupamento", None, False),
    ("Devoluções", 4, "agrupamento", None, False),
    ("receita_liquida", 1, "formula", "{linha:venda_liquida}-{linha:deducoes}", True),

    ("custos_variaveis", 1, "soma_filhos", None, False),
    ("CMV", 4, "agrupamento", None, False),
    ("Ajustes de CMV", 4, "agrupamento", None, False),
    ("margem_bruta", 1, "formula", "{linha:receita_liquida}-{linha:custos_variaveis}", True),

    ("despesas_variaveis", 1, "soma_filhos", None, False),
    ("Despesas com Venda", 4, "agrupamento", None, False),
    ("Despesas com Venda (Financeiro/Cartão)", 4, "agrupamento", None, False),
    ("Perdas e Ajustes de Estoque", 4, "agrupamento", None, False),
    ("margem_contribuicao_i", 1, "formula", "{linha:margem_bruta}-{linha:despesas_variaveis}", True),

    ("custos_despesas_fixas", 1, "soma_filhos", None, False),
    ("Remuneração", 4, "agrupamento", None, False),
    ("Encargos sobre Remuneração", 4, "agrupamento", None, False),
    ("Benefícios", 4, "agrupamento", None, False),
    ("Despesas de Ocupação", 4, "agrupamento", None, False),
    ("Despesas Administrativas", 4, "agrupamento", None, False),
    ("Despesas Comerciais", 4, "agrupamento", None, False),
    ("Despesas Financeiras", 4, "agrupamento", None, False),

    ("resultado", 1, "formula", "{linha:margem_contribuicao_i}-{linha:custos_despesas_fixas}", True),

    # Aberturas departamentais — folhas, de-para conta→linha na fase de importação.
    ("Venda Líquida por Departamento", 1, "agrupamento", None, False),
    ("Impostos por Departamento", 1, "agrupamento", None, False),
    ("Receita Líquida por Departamento", 1, "agrupamento", None, False),
    ("CMV por Departamento", 1, "agrupamento", None, False),
    ("Perdas por Departamento", 1, "agrupamento", None, False),
]

# Plano Nativo mínimo do Leal + de-para direto conta→linha (rotulo da folha → contas do ERP).
# "Receita Venda à Vista" tem 2 contas de propósito (exercita a soma de N contas numa folha).
_CONTAS_NATIVAS_LEAL = {
    "Receita Venda à Vista":       [("311101", "Venda de Mercadorias Dinheiro"),
                                    ("311102", "Venda de Mercadorias Cheque à Vista")],
    "Receita Venda a Prazo":       [("311104", "Venda de Mercadorias Cartão de Crédito")],
    "cancelamentos":               [("312104", "Vendas Canceladas")],
    "Impostos sobre Venda":        [("312101", "ICMS sobre Vendas")],
    "Devoluções":                  [("312106", "Devoluções de Vendas")],
    "CMV":                         [("113199", "Custo das Mercadorias Vendidas")],
    "Ajustes de CMV":              [("113151", "Crédito Simples sobre Compras")],
    "Despesas com Venda":          [("332201", "Sacolas Plásticas")],
    "Remuneração":                 [("331102", "Salários")],
    "Encargos sobre Remuneração":  [("331109", "FGTS")],
}


def _tipo_visual(modo: str) -> str:
    return {"formula": "totalizador", "soma_filhos": "titulo"}.get(modo, "agrupamento")


def _get_or_create_conta_cliente(db, cliente_id, codigo, descricao) -> tuple:
    """Retorna (conta_cliente, criada?)."""
    cc = (
        db.query(models.ContaClienteRef)
        .filter(models.ContaClienteRef.cliente_id == cliente_id,
                models.ContaClienteRef.codigo_origem == codigo)
        .first()
    )
    if cc:
        return cc, False
    cc = models.ContaClienteRef(
        cliente_id=cliente_id, codigo_origem=codigo, descricao_origem=descricao,
    )
    db.add(cc); db.flush()
    return cc, True


def seed_dre_leal(db: Session) -> dict:
    """Cria (se não existir) o template DRE-espelho do Leal + Plano Nativo + de-para direto."""
    relatorio = {
        "template_criado": False, "template_id": None, "linhas_criadas": 0,
        "contas_nativas_criadas": 0, "vinculos_criados": 0,
        "cliente_vinculado": False, "aviso_cliente": None,
    }

    template = db.query(models.TemplateRef).filter(models.TemplateRef.nome == NOME_TEMPLATE).first()
    if template:
        print(f"[seed_dre_leal] template '{NOME_TEMPLATE}' já existe (id={template.id}) — skip criação de linhas")
    else:
        segmento = db.query(models.Segmento).filter(models.Segmento.nome == SEGMENTO_NOME).first()
        template = models.TemplateRef(
            tipo="dre", nome=NOME_TEMPLATE,
            segmento_id=segmento.id if segmento else None, ativo=True,
        )
        db.add(template); db.commit(); db.refresh(template)
        relatorio["template_criado"] = True

        for ordem, (rotulo, nivel, modo, formula, negrito) in enumerate(_LINHAS, start=1):
            db.add(models.TemplateLinhaRef(
                template_id=template.id, rotulo=rotulo, ordem=ordem,
                negrito_totalizador=negrito, tipo=_tipo_visual(modo),
                modo_calculo=modo, nivel=nivel,
                agrupamento_slug=None,          # DRE não usa agrupamento
                formula_texto=formula,
            ))
        db.commit()
        relatorio["linhas_criadas"] = len(_LINHAS)

    relatorio["template_id"] = template.id

    cliente = db.query(models.Cliente).filter(models.Cliente.cnpj == CNPJ_LEAL).first()
    if not cliente:
        relatorio["aviso_cliente"] = (
            f"Cliente com CNPJ {CNPJ_LEAL} não encontrado — template criado, mas SEM "
            "Plano Nativo/de-para e não vinculado a nenhum cliente."
        )
        print(f"[seed_dre_leal] AVISO: {relatorio['aviso_cliente']}")
        return relatorio

    cliente.template_dre_padrao_id = template.id
    db.commit()
    relatorio["cliente_vinculado"] = True

    # Plano Nativo do Leal + de-para direto conta→linha (idempotente)
    linhas_por_rotulo = {l.rotulo: l for l in template.linhas}
    for rotulo, contas in _CONTAS_NATIVAS_LEAL.items():
        linha = linhas_por_rotulo.get(rotulo)
        if not linha:
            continue
        for codigo, descricao in contas:
            cc, criada = _get_or_create_conta_cliente(db, cliente.id, codigo, descricao)
            if criada:
                relatorio["contas_nativas_criadas"] += 1
            ja = (
                db.query(models.DeParaDreLinha)
                .filter(models.DeParaDreLinha.conta_cliente_id == cc.id,
                        models.DeParaDreLinha.template_linha_id == linha.id)
                .first()
            )
            if not ja:
                db.add(models.DeParaDreLinha(
                    conta_cliente_id=cc.id, template_linha_id=linha.id,
                    percentual=100.0, status="confirmado", confianca=1.0,
                    origem_vinculo="manual", vigente_a_partir=VIGENCIA,
                ))
                relatorio["vinculos_criados"] += 1
    db.commit()

    print(f"[seed_dre_leal] cliente '{cliente.razao_social}' (id={cliente.id}) vinculado ao template (id={template.id})")
    print(f"[seed_dre_leal] Plano Nativo + de-para: {relatorio['vinculos_criados']} vínculo(s) conta→linha criados")
    return relatorio


if __name__ == "__main__":
    import argparse
    import sys
    from database import _is_sqlite, SessionLocal

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true",
                         help="Permite rodar fora do SQLite local")
    args = parser.parse_args()

    if not _is_sqlite and not args.force:
        print("[seed_dre_leal] seed só roda em banco local SQLite — use --force para confirmar em outro ambiente")
        sys.exit(1)

    db = SessionLocal()
    try:
        seed_dre_leal(db)
    finally:
        db.close()
