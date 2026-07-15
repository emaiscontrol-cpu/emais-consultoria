"""
Template DRE referencial da Controladoria E Mais — MODELO DEFINITIVO, Camada 1.

Cria o template "Controladoria - DRE Varejo" (referencial, universal por segmento
Varejo Alimentar) com o ESQUELETO ESTRUTURAL REAL da DRE de varejo alimentar:
totalizadoras e subgrupos (níveis A=1, C=2, D=3, E=4; modo folha/soma_filhos/formula).

Camada 1 = só o esqueleto de totalizadoras. As folhas ficam SEM vínculo de conta
(o de-para conta→linha vem na fase de importação — Camada 2). Não inclui departamentos
(Camada 3) nem as folhas contábeis individuais (Camada 2). Onde uma linha soma_filhos
ainda não tem filhas, ela resolve para 0 (sem erro). Ver documentos/PROJETO_REFERENCIAL.md.

NÃO roda no startup — carga manual. Guards: só SQLite local (a menos que --force).
O cliente "Supermercado Leal" (cadastro legítimo) NÃO é tocado; apenas passa a apontar
seu template DRE padrão para este referencial, para teste local.
"""
from sqlalchemy.orm import Session
import models

NOME_TEMPLATE = "Controladoria - DRE Varejo"
SEGMENTO_NOME = "Varejo Alimentar"
CNPJ_CLIENTE_TESTE = "25926205000123"   # Supermercado Leal — só para apontar o template padrão

# Nomes de templates antigos deste referencial, removidos ao recriar (limpa resíduo).
_NOMES_ANTERIORES = ["Controladoria - DRE Varejo", "DRE Gerencial - Varejo (Leal)"]

# (rotulo/slug, nivel, modo_calculo, formula_texto, negrito_totalizador)
# rotulo = slug (é a chave usada em {linha:slug}); fórmulas em forma canônica {linha:...}.
# Níveis: A=1 (bloco), C=2 (grupo), D=3 (subgrupo), E=4 (folha).
_LINHAS = [
    ("receita_bruta", 1, "formula", "{linha:venda_avista}+{linha:venda_aprazo}", True),
    ("venda_avista", 2, "soma_filhos", None, False),
    ("venda_aprazo", 2, "soma_filhos", None, False),
    ("cancelamentos", 2, "soma_filhos", None, False),
    ("venda_liquida", 1, "formula", "{linha:receita_bruta}-{linha:cancelamentos}", True),
    ("deducoes", 2, "formula", "{linha:impostos_venda}+{linha:devolucoes}", False),
    ("impostos_venda", 2, "soma_filhos", None, False),
    ("devolucoes", 4, "agrupamento", None, False),   # folha — sem vínculo (Camada 1)
    ("receita_liquida", 1, "formula", "{linha:venda_liquida}-{linha:deducoes}", True),
    ("custos_variaveis", 1, "formula", "{linha:cmv}-{linha:ajustes_cmv}", True),
    ("cmv", 2, "soma_filhos", None, False),
    ("ajustes_cmv", 2, "soma_filhos", None, False),
    ("margem_bruta", 1, "formula", "{linha:receita_liquida}-{linha:custos_variaveis}", True),
    ("despesas_variaveis", 1, "formula",
     "{linha:despesas_com_venda}+{linha:despesas_venda_fin}+{linha:perdas}", True),
    ("despesas_com_venda", 2, "soma_filhos", None, False),
    ("despesas_venda_fin", 2, "soma_filhos", None, False),
    ("perdas", 2, "soma_filhos", None, False),   # regra de presunção vem na Camada 1.5
    ("margem_contribuicao_i", 1, "formula", "{linha:margem_bruta}-{linha:despesas_variaveis}", True),
    ("cdf_diretos", 1, "formula", "{linha:cdf_diretos_lojas}+{linha:cdf_diretos_adm}", True),
    ("cdf_diretos_lojas", 1, "formula",
     "{linha:remuneracao_lojas}+{linha:encargos_lojas}+{linha:beneficios_lojas}+{linha:outras_pessoal_lojas}", True),
    ("remuneracao_lojas", 3, "soma_filhos", None, False),
    ("encargos_lojas", 3, "soma_filhos", None, False),
    ("beneficios_lojas", 3, "soma_filhos", None, False),
    ("outras_pessoal_lojas", 3, "soma_filhos", None, False),
    ("cdf_diretos_adm", 1, "formula",
     "{linha:remuneracao_adm}+{linha:encargos_adm}+{linha:beneficios_adm}+{linha:outras_pessoal_adm}", True),
    ("remuneracao_adm", 3, "soma_filhos", None, False),
    ("encargos_adm", 3, "soma_filhos", None, False),
    ("beneficios_adm", 3, "soma_filhos", None, False),
    ("outras_pessoal_adm", 3, "soma_filhos", None, False),
    ("margem_contribuicao_ii", 1, "formula", "{linha:margem_contribuicao_i}-{linha:cdf_diretos}", True),
    ("cdf_indiretas", 1, "formula",
     "{linha:desp_tributarias}+{linha:desp_utilidades}+{linha:desp_manutencoes}+{linha:desp_informatica}"
     "+{linha:honorarios_terceiros}+{linha:material_expediente}+{linha:despesas_gerais}"
     "+{linha:desp_propaganda}+{linha:desp_veiculos}+{linha:desp_viagens}", True),
    ("desp_tributarias", 2, "soma_filhos", None, False),
    ("desp_utilidades", 2, "soma_filhos", None, False),
    ("desp_manutencoes", 2, "soma_filhos", None, False),
    ("desp_informatica", 2, "soma_filhos", None, False),
    ("honorarios_terceiros", 2, "soma_filhos", None, False),
    ("material_expediente", 2, "soma_filhos", None, False),
    ("despesas_gerais", 2, "soma_filhos", None, False),
    ("desp_propaganda", 2, "soma_filhos", None, False),
    ("desp_veiculos", 2, "soma_filhos", None, False),
    ("desp_viagens", 2, "soma_filhos", None, False),
    ("outras_receitas_op", 2, "soma_filhos", None, False),
    ("custo_operacional", 1, "formula",
     "{linha:cdf_indiretas}+{linha:cdf_diretos}+{linha:despesas_variaveis}-{linha:outras_receitas_op}", True),
    ("ebitda", 1, "formula",
     "{linha:margem_contribuicao_ii}-{linha:cdf_indiretas}+{linha:outras_receitas_op}", True),
    # 0.007 vira parâmetro do cliente na Camada 1.5; por ora constante fixa
    ("depreciacao", 1, "formula", "{linha:receita_liquida}*0.007", True),
    ("ebit", 1, "formula", "{linha:ebitda}-{linha:depreciacao}", True),
    ("resultado_financeiro", 1, "formula",
     "{linha:despesas_financeiras}+{linha:outras_despesas_fin}-{linha:resultado_nao_op}-{linha:receitas_financeiras}", True),
    ("receitas_financeiras", 2, "soma_filhos", None, False),
    ("despesas_financeiras", 2, "soma_filhos", None, False),
    ("outras_despesas_fin", 2, "soma_filhos", None, False),
    ("resultado_nao_op", 2, "soma_filhos", None, False),
    ("lucro_antes_irpj", 1, "formula", "{linha:ebit}-{linha:resultado_financeiro}", True),
    ("irpj_csll", 1, "soma_filhos", None, False),
    ("lucro_liquido_op", 1, "formula", "{linha:lucro_antes_irpj}-{linha:irpj_csll}", True),
    ("despesas_nao_op", 1, "soma_filhos", None, False),
    ("resultado_lucro_liquido", 1, "formula", "{linha:lucro_liquido_op}-{linha:despesas_nao_op}", True),
]


def _tipo_visual(modo: str) -> str:
    return {"formula": "totalizador", "soma_filhos": "titulo"}.get(modo, "agrupamento")


def _remover_templates_anteriores(db: Session) -> None:
    """Remove versões antigas deste template referencial (recria limpo, sem resíduo 'Leal').
    Preserva o cliente e o Plano Nativo — só apaga o template, suas linhas e os
    de-paras conta→linha que apontavam para linhas antigas."""
    antigos = (
        db.query(models.TemplateRef)
        .filter(models.TemplateRef.nome.in_(_NOMES_ANTERIORES))
        .all()
    )
    for t in antigos:
        linha_ids = [l.id for l in t.linhas]
        if linha_ids:
            db.query(models.DeParaDreLinha).filter(
                models.DeParaDreLinha.template_linha_id.in_(linha_ids)
            ).delete(synchronize_session=False)
        # clientes que apontavam para este template perdem o vínculo padrão
        db.query(models.Cliente).filter(
            models.Cliente.template_dre_padrao_id == t.id
        ).update({models.Cliente.template_dre_padrao_id: None}, synchronize_session=False)
        db.delete(t)  # cascade apaga as linhas
    db.commit()


def seed_dre_controladoria(db: Session) -> dict:
    relatorio = {"template_id": None, "linhas_criadas": 0, "cliente_teste_vinculado": False}

    _remover_templates_anteriores(db)

    segmento = db.query(models.Segmento).filter(models.Segmento.nome == SEGMENTO_NOME).first()
    template = models.TemplateRef(
        tipo="dre", nome=NOME_TEMPLATE,
        segmento_id=segmento.id if segmento else None, ativo=True,
    )
    db.add(template); db.commit(); db.refresh(template)

    for ordem, (rotulo, nivel, modo, formula, negrito) in enumerate(_LINHAS, start=1):
        db.add(models.TemplateLinhaRef(
            template_id=template.id, rotulo=rotulo, ordem=ordem,
            negrito_totalizador=negrito, tipo=_tipo_visual(modo),
            modo_calculo=modo, nivel=nivel,
            agrupamento_slug=None,        # DRE não usa agrupamento; folhas sem vínculo na Camada 1
            formula_texto=formula,
        ))
    db.commit()
    relatorio["template_id"] = template.id
    relatorio["linhas_criadas"] = len(_LINHAS)

    # Aponta o template DRE padrão do cliente de teste (Supermercado Leal) para este referencial.
    cliente = db.query(models.Cliente).filter(models.Cliente.cnpj == CNPJ_CLIENTE_TESTE).first()
    if cliente:
        cliente.template_dre_padrao_id = template.id
        db.commit()
        relatorio["cliente_teste_vinculado"] = True

    print(f"[seed_dre_controladoria] template '{NOME_TEMPLATE}' (id={template.id}) criado com "
          f"{relatorio['linhas_criadas']} linhas (esqueleto Camada 1)")
    if relatorio["cliente_teste_vinculado"]:
        print(f"[seed_dre_controladoria] cliente de teste (CNPJ {CNPJ_CLIENTE_TESTE}) aponta para o template")
    return relatorio


if __name__ == "__main__":
    import argparse
    import sys
    from database import _is_sqlite, SessionLocal

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--force", action="store_true", help="Permite rodar fora do SQLite local")
    args = parser.parse_args()

    if not _is_sqlite and not args.force:
        print("[seed_dre_controladoria] seed só roda em banco local SQLite — use --force para outro ambiente")
        sys.exit(1)

    db = SessionLocal()
    try:
        seed_dre_controladoria(db)
    finally:
        db.close()
