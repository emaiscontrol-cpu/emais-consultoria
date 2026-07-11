import sys
sys.path.append(r'c:\Users\luiz\OneDrive\Anexos\Administrador\Documentos\Projetos\emals_consultoria\backend')
from database import _is_sqlite, SessionLocal, engine

if not _is_sqlite:
    print("seed só roda em banco local SQLite")
    sys.exit(1)
import models
from datetime import date
from sqlalchemy import text

db = SessionLocal()

def recriar_tabela_lancamentos_local():
    """
    Como o SQLite local não suporta recriação de constraints de unicidade diretamente via ALTER TABLE,
    nós recriamos a tabela copiando os dados para alinhar com a nova constraint do models.py.
    """
    try:
        with engine.begin() as conn:
            # Verifica se a tabela antiga existe
            res = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='ref_lancamentos'"))
            if res.fetchone():
                # Checa as colunas da tabela antiga
                res_cols = conn.execute(text("PRAGMA table_info(ref_lancamentos)"))
                cols = [row[1] for row in res_cols.fetchall()]
                
                # Se não tiver a coluna unidade_codigo, adiciona
                if "unidade_codigo" not in cols:
                    conn.execute(text("ALTER TABLE ref_lancamentos ADD COLUMN unidade_codigo VARCHAR(3)"))
                if "unidade_nome" not in cols:
                    conn.execute(text("ALTER TABLE ref_lancamentos ADD COLUMN unidade_nome VARCHAR(100)"))

                print("Recriando ref_lancamentos no SQLite local para atualizar a constraint de unicidade...")
                conn.execute(text("ALTER TABLE ref_lancamentos RENAME TO ref_lancamentos_old"))
                
                # Recria a tabela ref_lancamentos usando SQLAlchemy Metadata
                models.Base.metadata.tables["ref_lancamentos"].create(conn)
                
                # Copia dados antigos para a nova tabela
                try:
                    conn.execute(text("""
                        INSERT INTO ref_lancamentos (id, conta_cliente_id, unidade_codigo, valor, ano, mes, data_importacao, unidade_nome)
                        SELECT id, conta_cliente_id, unidade_codigo, valor, ano, mes, data_importacao, unidade_nome
                        FROM ref_lancamentos_old
                    """))
                    print("Dados contábeis migrados com sucesso para a nova estrutura.")
                except Exception as e:
                    print(f"Aviso ao migrar dados: {e}")
                
                conn.execute(text("DROP TABLE ref_lancamentos_old"))
                print("Reconstrução da tabela SQLite local concluída!")
    except Exception as e:
        print(f"Erro ou tabela já atualizada: {e}")

def seed_leal():
    recriar_tabela_lancamentos_local()

    # 1. Cria o cliente "Leal-MG" se nao existir
    cliente = db.query(models.Cliente).filter(models.Cliente.razao_social == "Leal-MG").first()
    if not cliente:
        cliente = models.Cliente(
            razao_social="Leal-MG",
            ativo=True,
            modulo_analises_gerenciais=True
        )
        db.add(cliente)
        db.flush()
        print(f"Cliente Leal-MG criado com ID: {cliente.id}")
    else:
        print(f"Cliente Leal-MG ja existe com ID: {cliente.id}")

    # 2. Cria as filiais/unidades no banco local
    filiais_data = [
        {"codigo": "100", "nome": "Roosevelt"},
        {"codigo": "101", "nome": "Tibery"},
        {"codigo": "102", "nome": "Mansour"},
        {"codigo": "103", "nome": "Santa Mônica"},
        {"codigo": "104", "nome": "Alvorada"},
        {"codigo": "105", "nome": "Gravatas"},
        {"codigo": "106", "nome": "J. Holanda"},
    ]
    for f in filiais_data:
        uni = db.query(models.Unidade).filter(
            models.Unidade.cliente_id == cliente.id,
            models.Unidade.codigo == f["codigo"]
        ).first()
        if not uni:
            uni = models.Unidade(
                cliente_id=cliente.id,
                codigo=f["codigo"],
                nome=f["nome"],
                ativo=True
            )
            db.add(uni)
            print(f"Filial {f['nome']} ({f['codigo']}) criada.")
    db.flush()

    # 3. Cria as contas referenciais analiticas no Plano Referencial 1 se nao existirem
    plano_id = 1
    # Deleta as contas referenciais analíticas antigas para recriá-las com a natureza contábil correta
    db.query(models.ContaReferencial).filter(
        models.ContaReferencial.plano_id == plano_id,
        models.ContaReferencial.codigo.in_(["1.02", "1.03", "1.04", "1.05"])
    ).delete(synchronize_session=False)
    db.flush()

    contas_ref_data = [
        {"codigo": "1.01", "descricao": "Receita Bruta Leal", "agrupamento": "receita_bruta", "natureza": "soma"},
        {"codigo": "1.02", "descricao": "Deduções de Receita", "agrupamento": "deducoes", "natureza": "soma"},
        {"codigo": "1.03", "descricao": "Custo de Mercadorias Vendidas (CMV)", "agrupamento": "cmv", "natureza": "soma"},
        {"codigo": "1.04", "descricao": "Despesas Variáveis de Venda", "agrupamento": "despesas_variaveis", "natureza": "soma"},
        {"codigo": "1.05", "descricao": "Despesas Operacionais Fixas", "agrupamento": "despesas_fixas", "natureza": "soma"},
    ]
    
    cr_objs = {}
    for c_ref in contas_ref_data:
        cr = db.query(models.ContaReferencial).filter(
            models.ContaReferencial.plano_id == plano_id,
            models.ContaReferencial.agrupamento == c_ref["agrupamento"]
        ).first()
        if not cr:
            cr = models.ContaReferencial(
                plano_id=plano_id,
                codigo=c_ref["codigo"],
                descricao=c_ref["descricao"],
                tipo="analitica",
                natureza=c_ref["natureza"],
                agrupamento=c_ref["agrupamento"],
                ativo=True
            )
            db.add(cr)
            db.flush()
            print(f"Conta referencial '{c_ref['descricao']}' criada.")
        else:
            print(f"Conta referencial '{c_ref['descricao']}' ja existe.")
        cr_objs[c_ref["agrupamento"]] = cr

    # 4. Cria o Template DRE se nao existir
    template = db.query(models.TemplateRef).filter(
        models.TemplateRef.nome == "DRE Padrão Leal",
        models.TemplateRef.tipo == "dre"
    ).first()
    if not template:
        template = models.TemplateRef(
            nome="DRE Padrão Leal",
            tipo="dre",
            segmento_id=1,  # Segmento padrao
            ativo=True
        )
        db.add(template)
        db.flush()
        print(f"Template DRE Padrão Leal criado com ID: {template.id}")

        # Insere as linhas do template
        linhas_data = [
            {"ordem": 10, "rotulo": "RECEITA BRUTA OPERACIONAL", "agrupamento_slug": "receita_bruta", "formula_texto": None, "negrito": False},
            {"ordem": 20, "rotulo": "( - ) DEDUÇÕES E IMPOSTOS", "agrupamento_slug": "deducoes", "formula_texto": None, "negrito": False},
            {"ordem": 30, "rotulo": "RECEITA LÍQUIDA", "agrupamento_slug": None, "formula_texto": "{agrupamento:receita_bruta} - {agrupamento:deducoes}", "negrito": True},
            {"ordem": 40, "rotulo": "( - ) CUSTO DAS MERC. VENDIDAS (CMV)", "agrupamento_slug": "cmv", "formula_texto": None, "negrito": False},
            {"ordem": 50, "rotulo": "MARGEM BRUTA", "agrupamento_slug": None, "formula_texto": "{linha:RECEITA LÍQUIDA} - {agrupamento:cmv}", "negrito": True},
            {"ordem": 60, "rotulo": "( - ) DESPESAS VARIÁVEIS", "agrupamento_slug": "despesas_variaveis", "formula_texto": None, "negrito": False},
            {"ordem": 70, "rotulo": "MARGEM DE CONTRIBUIÇÃO", "agrupamento_slug": None, "formula_texto": "{linha:MARGEM BRUTA} - {agrupamento:despesas_variaveis}", "negrito": True},
            {"ordem": 80, "rotulo": "( - ) DESPESAS FIXAS", "agrupamento_slug": "despesas_fixas", "formula_texto": None, "negrito": False},
            {"ordem": 90, "rotulo": "LUCRO OPERACIONAL (EBITDA)", "agrupamento_slug": None, "formula_texto": "{linha:MARGEM DE CONTRIBUIÇÃO} - {agrupamento:despesas_fixas}", "negrito": True},
        ]
        for l in linhas_data:
            linha_ref = models.TemplateLinhaRef(
                template_id=template.id,
                ordem=l["ordem"],
                rotulo=l["rotulo"],
                agrupamento_slug=l["agrupamento_slug"],
                formula_texto=l["formula_texto"],
                negrito_totalizador=l["negrito"]
            )
            db.add(linha_ref)
        print("Linhas da DRE Leal criadas.")
    else:
        print(f"Template DRE Padrão Leal ja existe com ID: {template.id}")

    # Associa o template padrão ao cliente
    cliente.template_dre_padrao_id = template.id
    db.flush()
    print("Template DRE Padrão Leal associado como padrão do cliente Leal-MG.")

    # 5. Cria as contas do ERP cliente e De-Para correspondente
    contas_cliente_data = [
        {"codigo": "REC_LEAL", "descricao": "Receita Vendas ERP", "agrupamento": "receita_bruta"},
        {"codigo": "DED_LEAL", "descricao": "Deduções Vendas ERP", "agrupamento": "deducoes"},
        {"codigo": "CMV_LEAL", "descricao": "Custo Mercadorias ERP", "agrupamento": "cmv"},
        {"codigo": "DVAR_LEAL", "descricao": "Despesas Variáveis ERP", "agrupamento": "despesas_variaveis"},
        {"codigo": "DFIX_LEAL", "descricao": "Despesas Fixas ERP", "agrupamento": "despesas_fixas"},
    ]
    
    cc_objs = {}
    for cc_data in contas_cliente_data:
        cc = db.query(models.ContaClienteRef).filter(
            models.ContaClienteRef.cliente_id == cliente.id,
            models.ContaClienteRef.codigo_origem == cc_data["codigo"]
        ).first()
        if not cc:
            cc = models.ContaClienteRef(
                cliente_id=cliente.id,
                codigo_origem=cc_data["codigo"],
                descricao_origem=cc_data["descricao"]
            )
            db.add(cc)
            db.flush()
            print(f"Conta cliente '{cc_data['descricao']}' criada.")
        cc_objs[cc_data["agrupamento"]] = cc

        # Cria De-Para correspondente
        cr_vinc = cr_objs[cc_data["agrupamento"]]
        dp = db.query(models.DeParaRef).filter(
            models.DeParaRef.conta_cliente_id == cc.id,
            models.DeParaRef.conta_referencial_id == cr_vinc.id
        ).first()
        if not dp:
            dp = models.DeParaRef(
                conta_cliente_id=cc.id,
                conta_referencial_id=cr_vinc.id,
                percentual=100.0,
                status="confirmado",
                confianca=1.0,
                origem_vinculo="manual",
                vigente_a_partir=date(2026, 1, 1)
            )
            db.add(dp)
            print(f"De-Para criado para {cc_data['codigo']} -> {cr_vinc.codigo}.")

    # 6. Insere lançamentos contábeis de teste para Janeiro de 2026 (Ano 2026, Mes 1)
    lancs_testes = [
        # Roosevelt (100)
        {"unidade": "100", "agr": "receita_bruta", "val": 3543173.51},
        {"unidade": "100", "agr": "deducoes", "val": 173309.30},
        {"unidade": "100", "agr": "cmv", "val": 2441694.69},
        {"unidade": "100", "agr": "despesas_variaveis", "val": 168024.41},
        {"unidade": "100", "agr": "despesas_fixas", "val": 432915.22},

        # Tibery (101)
        {"unidade": "101", "agr": "receita_bruta", "val": 1892153.03},
        {"unidade": "101", "agr": "deducoes", "val": 82543.61},
        {"unidade": "101", "agr": "cmv", "val": 1335642.89},
        {"unidade": "101", "agr": "despesas_variaveis", "val": 113129.44},
        {"unidade": "101", "agr": "despesas_fixas", "val": 215000.00},

        # Mansour (102)
        {"unidade": "102", "agr": "receita_bruta", "val": 3036205.19},
        {"unidade": "102", "agr": "deducoes", "val": 124804.84},
        {"unidade": "102", "agr": "cmv", "val": 2149092.02},
        {"unidade": "102", "agr": "despesas_variaveis", "val": 143326.00},
        {"unidade": "102", "agr": "despesas_fixas", "val": 342000.00},

        # Santa Monica (103)
        {"unidade": "103", "agr": "receita_bruta", "val": 2277549.67},
        {"unidade": "103", "agr": "deducoes", "val": 97130.93},
        {"unidade": "103", "agr": "cmv", "val": 1603872.21},
        {"unidade": "103", "agr": "despesas_variaveis", "val": 109376.37},
        {"unidade": "103", "agr": "despesas_fixas", "val": 287000.00},

        # Alvorada (104)
        {"unidade": "104", "agr": "receita_bruta", "val": 1500000.00},
        {"unidade": "104", "agr": "deducoes", "val": 60000.00},
        {"unidade": "104", "agr": "cmv", "val": 1050000.00},
        {"unidade": "104", "agr": "despesas_variaveis", "val": 75000.00},
        {"unidade": "104", "agr": "despesas_fixas", "val": 180000.00},

        # Gravatas (105)
        {"unidade": "105", "agr": "receita_bruta", "val": 1250000.00},
        {"unidade": "105", "agr": "deducoes", "val": 52000.00},
        {"unidade": "105", "agr": "cmv", "val": 880000.00},
        {"unidade": "105", "agr": "despesas_variaveis", "val": 62000.00},
        {"unidade": "105", "agr": "despesas_fixas", "val": 150000.00},

        # J. Holanda (106)
        {"unidade": "106", "agr": "receita_bruta", "val": 950000.00},
        {"unidade": "106", "agr": "deducoes", "val": 38000.00},
        {"unidade": "106", "agr": "cmv", "val": 670000.00},
        {"unidade": "106", "agr": "despesas_variaveis", "val": 48000.00},
        {"unidade": "106", "agr": "despesas_fixas", "val": 110000.00},
    ]

    for lt in lancs_testes:
        cc_vinc = cc_objs[lt["agr"]]
        # Upsert lancamento
        lanc = db.query(models.LancamentoRef).filter(
            models.LancamentoRef.conta_cliente_id == cc_vinc.id,
            models.LancamentoRef.unidade_codigo == lt["unidade"],
            models.LancamentoRef.ano == 2026,
            models.LancamentoRef.mes == 1
        ).first()
        if not lanc:
            lanc = models.LancamentoRef(
                conta_cliente_id=cc_vinc.id,
                unidade_codigo=lt["unidade"],
                valor=lt["val"],
                ano=2026,
                mes=1
            )
            db.add(lanc)
        else:
            lanc.valor = lt["val"]
    
    db.commit()
    print("Lançamentos de teste populados com sucesso!")

if __name__ == "__main__":
    seed_leal()
