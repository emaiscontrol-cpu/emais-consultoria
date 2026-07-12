"""
Cria a DRE-espelho do cliente Leal (Fase A' — Projeto Referencial): template real
com modo_calculo/nivel, mapeando a estrutura da planilha do cliente aos 24
agrupamentos-padrao da Fase A (backend/seed_agrupamentos_ref.py). Ver
documentos/PROJETO_REFERENCIAL.md.

NAO roda automaticamente no startup do backend — carga manual, disparada pelo
desenvolvedor, igual ao padrao de seed_agrupamentos_ref.py.

Guards:
- Ambiente: so executa em SQLite local, a menos que --force seja passado explicitamente.
- Idempotente: se o template (mesmo nome) ja existir, nao duplica as linhas.
- Cliente Leal localizado por CNPJ (nao por nome); se nao encontrado, reporta e
  segue sem vincular (nao falha silenciosamente nem derruba o script).
"""
from sqlalchemy.orm import Session
import models

NOME_TEMPLATE = "DRE Gerencial - Varejo (Leal)"
CNPJ_LEAL = "25926205000123"
SEGMENTO_NOME = "Varejo Alimentar"

# (rotulo, nivel, modo_calculo, agrupamento_slug, formula_texto, negrito_totalizador)
# rotulo dobra como rotulo de exibicao E como chave de referencia em {linha:...} —
# por isso linhas referenciadas por alguma formula usam slug interno (ex: "venda_avista"),
# e linhas nunca referenciadas usam rotulo legivel (ex: "Impostos sobre Venda").
_LINHAS = [
    ("receita_bruta", 1, "formula", None, "{linha:venda_avista}+{linha:venda_aprazo}", True),
    ("venda_avista", 2, "soma_filhos", None, None, False),
    ("Receita Venda à Vista", 4, "agrupamento", "rec_avista", None, False),
    ("venda_aprazo", 2, "soma_filhos", None, None, False),
    ("Receita Venda a Prazo", 4, "agrupamento", "rec_aprazo", None, False),

    ("cancelamentos", 1, "agrupamento", "cancel_desc", None, False),

    ("venda_liquida", 1, "formula", None, "{linha:receita_bruta}-{linha:cancelamentos}", True),

    ("deducoes", 1, "soma_filhos", None, None, False),
    ("Impostos sobre Venda", 4, "agrupamento", "impostos_venda", None, False),
    ("Devoluções", 4, "agrupamento", "devolucoes", None, False),

    ("receita_liquida", 1, "formula", None, "{linha:venda_liquida}-{linha:deducoes}", True),

    ("custos_variaveis", 1, "soma_filhos", None, None, False),
    ("CMV", 4, "agrupamento", "cmv", None, False),
    ("Ajustes de CMV", 4, "agrupamento", "ajustes_cmv", None, False),

    ("margem_bruta", 1, "formula", None, "{linha:receita_liquida}-{linha:custos_variaveis}", True),

    ("despesas_variaveis", 1, "soma_filhos", None, None, False),
    ("Despesas com Venda", 4, "agrupamento", "desp_venda", None, False),
    ("Despesas com Venda (Financeiro/Cartão)", 4, "agrupamento", "desp_venda_fin", None, False),
    ("Perdas e Ajustes de Estoque", 4, "agrupamento", "perdas", None, False),

    ("margem_contribuicao_i", 1, "formula", None, "{linha:margem_bruta}-{linha:despesas_variaveis}", True),

    ("custos_despesas_fixas", 1, "soma_filhos", None, None, False),
    ("Remuneração", 4, "agrupamento", "remuneracao", None, False),
    ("Encargos sobre Remuneração", 4, "agrupamento", "encargos_remun", None, False),
    ("Benefícios", 4, "agrupamento", "beneficios", None, False),
    ("Despesas de Ocupação", 4, "agrupamento", "desp_ocupacao", None, False),
    ("Despesas Administrativas", 4, "agrupamento", "desp_admin", None, False),
    ("Despesas Comerciais", 4, "agrupamento", "desp_comercial", None, False),
    ("Despesas Financeiras", 4, "agrupamento", "desp_financeira", None, False),

    ("resultado", 1, "formula", None, "{linha:margem_contribuicao_i}-{linha:custos_despesas_fixas}", True),

    # Aberturas departamentais — por ora linhas soltas em modo 'agrupamento'; o
    # drill-down por departamento sera refinado na fase de importacao (D/E).
    ("Venda Líquida por Departamento", 1, "agrupamento", "dept_venda_liq", None, False),
    ("Impostos por Departamento", 1, "agrupamento", "dept_impostos", None, False),
    ("Receita Líquida por Departamento", 1, "agrupamento", "dept_receita_liq", None, False),
    ("CMV por Departamento", 1, "agrupamento", "dept_cmv", None, False),
    ("Perdas por Departamento", 1, "agrupamento", "dept_perdas", None, False),
]


def _tipo_visual(modo: str) -> str:
    return {"formula": "totalizador", "soma_filhos": "titulo"}.get(modo, "agrupamento")


def seed_dre_leal(db: Session) -> dict:
    """Cria (se nao existir) o template DRE-espelho do Leal. Retorna relatorio dict."""
    relatorio = {
        "template_criado": False, "template_id": None, "linhas_criadas": 0,
        "agrupamentos_ausentes": [], "cliente_vinculado": False, "aviso_cliente": None,
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

        slugs_validos = {
            a.slug for a in db.query(models.Agrupamento).filter(models.Agrupamento.ativo == True).all() if a.slug
        }

        for ordem, (rotulo, nivel, modo, agr_slug, formula, negrito) in enumerate(_LINHAS, start=1):
            if agr_slug and agr_slug not in slugs_validos:
                relatorio["agrupamentos_ausentes"].append((rotulo, agr_slug))
            db.add(models.TemplateLinhaRef(
                template_id=template.id, rotulo=rotulo, ordem=ordem,
                negrito_totalizador=negrito, tipo=_tipo_visual(modo),
                modo_calculo=modo, nivel=nivel,
                agrupamento_slug=agr_slug, formula_texto=formula,
            ))
        db.commit()
        relatorio["linhas_criadas"] = len(_LINHAS)

        if relatorio["agrupamentos_ausentes"]:
            print(f"[seed_dre_leal] AVISO: {len(relatorio['agrupamentos_ausentes'])} linha(s) com agrupamento inexistente:")
            for rotulo, slug in relatorio["agrupamentos_ausentes"]:
                print(f"  - {rotulo}: {slug}")

    relatorio["template_id"] = template.id

    cliente = db.query(models.Cliente).filter(models.Cliente.cnpj == CNPJ_LEAL).first()
    if not cliente:
        relatorio["aviso_cliente"] = (
            f"Cliente com CNPJ {CNPJ_LEAL} não encontrado — template criado, "
            "mas NÃO vinculado a nenhum cliente."
        )
        print(f"[seed_dre_leal] AVISO: {relatorio['aviso_cliente']}")
    else:
        cliente.template_dre_padrao_id = template.id
        db.commit()
        relatorio["cliente_vinculado"] = True
        print(f"[seed_dre_leal] cliente '{cliente.razao_social}' (id={cliente.id}) vinculado ao template (id={template.id})")

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
