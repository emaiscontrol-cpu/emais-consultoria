import logger as _logger_init
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from database import engine, Base
from routers import auth, clientes, projetos, fases, tarefas, usuarios, dashboard, notificacoes, relatorios, historico, subtarefas, controladoria, fluxo_caixa, balancete, anotacoes, orcamento, admin, bandeiras, modelos, busca, chat, arquivos, ia, gemini, openrouter, dre_import
from routers import ref_segmentos, ref_plano, ref_lancamentos, ref_depara, ref_templates, ref_demonstrativos, ref_benchmark, ref_unidades
from routers import fc_exec
from routers import pdf
import logging

logger = logging.getLogger("uvicorn")

APP_VERSION = "2.6.2v"

logger = logging.getLogger(__name__)

try:
    Base.metadata.create_all(bind=engine)
except Exception as _ce:
    logger.exception("create_all falhou")

# Add missing columns to existing tables (SQLite only  Supabase starts fresh via create_all)
from sqlalchemy import text
from database import _is_sqlite
with engine.connect() as conn:
    for stmt in ([] if not _is_sqlite else [
        "ALTER TABLE tarefas ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT 1",
        "ALTER TABLE fases ADD COLUMN bloqueado_por_anterior BOOLEAN NOT NULL DEFAULT 1",
        "ALTER TABLE fases ADD COLUMN responsavel_id INTEGER REFERENCES usuarios(id)",
        "ALTER TABLE subtarefas ADD COLUMN responsavel_id INTEGER REFERENCES usuarios(id)",
        "ALTER TABLE subtarefas ADD COLUMN data_inicio DATETIME",
        "ALTER TABLE subtarefas ADD COLUMN data_fim DATETIME",
        "ALTER TABLE usuarios ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT 1",
        "ALTER TABLE usuarios ADD COLUMN ia_habilitado BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE usuarios ADD COLUMN ia_claude BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE usuarios ADD COLUMN ia_gemini BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE usuarios ADD COLUMN ia_openrouter BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE usuarios ADD COLUMN foto TEXT",
        "ALTER TABLE usuarios ADD COLUMN codigo_acesso VARCHAR(3)",
        "UPDATE usuarios SET perfil='analista' WHERE perfil='cliente'",
        """CREATE TABLE IF NOT EXISTS bandeiras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL REFERENCES clientes(id),
            nome TEXT NOT NULL,
            unidades_json TEXT DEFAULT '[]'
        )""",
        """CREATE TABLE IF NOT EXISTS modelos_subtarefas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tarefa_id INTEGER NOT NULL REFERENCES modelos_tarefas(id) ON DELETE CASCADE,
            nome TEXT NOT NULL,
            ordem INTEGER DEFAULT 0,
            duracao_dias INTEGER
        )""",
        # DB-2: soft delete para projetos e fases
        "ALTER TABLE projetos ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT 1",
        "ALTER TABLE fases ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT 1",
        # DB-1: FK autor em anotacoes
        "ALTER TABLE anotacoes ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)",
        "UPDATE anotacoes SET usuario_id = (SELECT id FROM usuarios WHERE lower(usuarios.nome) = lower(anotacoes.usuario)) WHERE usuario_id IS NULL",
        # DB-4: Ãndices para acelerar queries frequentes
        "CREATE INDEX IF NOT EXISTS ix_log_atividades_criado_em ON log_atividades(criado_em)",
        "CREATE INDEX IF NOT EXISTS ix_tarefas_data_prazo ON tarefas(data_prazo)",
        # UX-7: histÃ³rico detalhado por tarefa
        """CREATE TABLE IF NOT EXISTS log_tarefas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tarefa_id INTEGER NOT NULL REFERENCES tarefas(id),
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
            campo TEXT NOT NULL,
            valor_antes TEXT,
            valor_depois TEXT,
            criado_em DATETIME DEFAULT (datetime('now'))
        )""",
        # UX-10: chat por projeto
        """CREATE TABLE IF NOT EXISTS mensagens_chat (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            projeto_id INTEGER NOT NULL REFERENCES projetos(id),
            autor_id INTEGER NOT NULL REFERENCES usuarios(id),
            texto TEXT NOT NULL,
            criado_em DATETIME DEFAULT (datetime('now'))
        )""",
        # Esqueci minha senha
        """CREATE TABLE IF NOT EXISTS solicitacoes_reset (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
            criado_em DATETIME DEFAULT (datetime('now'))
        )""",
        # MÃ³dulo de Arquivos por cliente
        """CREATE TABLE IF NOT EXISTS arquivos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL REFERENCES clientes(id),
            nome_original TEXT NOT NULL,
            nome_arquivo TEXT NOT NULL,
            tamanho INTEGER NOT NULL,
            tipo_mime TEXT,
            enviado_por_id INTEGER REFERENCES usuarios(id),
            criado_em DATETIME DEFAULT (datetime('now'))
        )""",
        """CREATE TABLE IF NOT EXISTS import_layouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER REFERENCES clientes(id),
            nome TEXT NOT NULL,
            linha_inicio INTEGER DEFAULT 2,
            coluna_conta INTEGER DEFAULT 0,
            coluna_descricao INTEGER,
            tipo_estrutura TEXT DEFAULT 'COLUNAS_MESES',
            mapa_colunas_meses TEXT DEFAULT '[]',
            coluna_mes INTEGER,
            coluna_valor INTEGER,
            formato_mes TEXT DEFAULT 'MM/YYYY',
            prefixos_ignorar TEXT DEFAULT '[]',
            linhas_ignorar TEXT DEFAULT '[]',
            ativo BOOLEAN DEFAULT 1,
            criado_em DATETIME DEFAULT (datetime('now'))
        )""",
        """CREATE TABLE IF NOT EXISTS importacao_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL REFERENCES clientes(id),
            layout_id INTEGER REFERENCES import_layouts(id),
            ano INTEGER NOT NULL,
            mes INTEGER DEFAULT 0,
            unidade TEXT NOT NULL,
            total_linhas INTEGER DEFAULT 0,
            direto INTEGER DEFAULT 0,
            via_depara INTEGER DEFAULT 0,
            pendencias INTEGER DEFAULT 0,
            criado_em DATETIME DEFAULT (datetime('now')),
            criado_por_id INTEGER REFERENCES usuarios(id)
        )""",
        """CREATE TABLE IF NOT EXISTS importacao_pendencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            log_id INTEGER NOT NULL REFERENCES importacao_logs(id),
            codigo_erp TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            valor REAL DEFAULT 0.0,
            mes INTEGER DEFAULT 0,
            resolvido BOOLEAN DEFAULT 0
        )""",
        # Categoria de layout (REALIZADO | PLANO)
        "ALTER TABLE import_layouts ADD COLUMN categoria TEXT DEFAULT 'REALIZADO'",
        # Categoria de arquivo (Contrato, RelatÃ³rio, Financeiro, JurÃ­dico, Outros)
        "ALTER TABLE arquivos ADD COLUMN categoria TEXT NOT NULL DEFAULT 'Outros'",
        # Agrupadores FC â†’ colunas de metadados adicionadas na v2.6.0f
        "ALTER TABLE agrupadores_fc ADD COLUMN natureza TEXT NOT NULL DEFAULT 'soma'",
        "ALTER TABLE agrupadores_fc ADD COLUMN slug TEXT",
        'ALTER TABLE agrupadores_fc ADD COLUMN demonstrativos TEXT DEFAULT \'["fluxo_caixa"]\'',
        # v2.6.0g: natureza removido (sinal definido na fÃ³rmula); tabela renomeada para agrupamentos
        "ALTER TABLE agrupadores_fc DROP COLUMN natureza",
        "ALTER TABLE agrupadores_fc RENAME TO agrupamentos",
        # MÃ³dulos contratados por cliente
        "ALTER TABLE clientes ADD COLUMN modulo_projetos BOOLEAN NOT NULL DEFAULT 1",
        "ALTER TABLE clientes ADD COLUMN modulo_inteligencia_mercado BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE clientes ADD COLUMN modulo_analises_gerenciais BOOLEAN NOT NULL DEFAULT 0",
        # Segmento do cliente (Plano Referencial)
        "ALTER TABLE clientes ADD COLUMN segmento_id INTEGER REFERENCES ref_segmentos(id)",
        # UX-11: notificaÃ§Ãµes de menÃ§Ã£o @usuario
        """CREATE TABLE IF NOT EXISTS notificacoes_mencao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_destino_id INTEGER NOT NULL REFERENCES usuarios(id),
            de_usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
            mensagem TEXT NOT NULL,
            projeto_id INTEGER REFERENCES projetos(id),
            lida BOOLEAN DEFAULT 0,
            criado_em DATETIME DEFAULT (datetime('now'))
        )""",
        # v2.6.0v: DEMO-3 â†’ template FC e lanÃ§amentos FC
        "ALTER TABLE ref_template_linhas ADD COLUMN tipo VARCHAR(20) DEFAULT 'agrupamento'",
        "ALTER TABLE ref_template_linhas ADD COLUMN agrupamento_slug VARCHAR(200)",
        # v2.6.0w: DEMO-4 â†’ tabela de De-Para de slugs do extrato por cliente
        # fc_slug_depara Ã© tabela nova â†’ criada pelo create_all acima
        # DROP tabelas do plano de contas antigo (migraÃ§Ã£o definitiva)
        "DROP TABLE IF EXISTS template_formulas",
        "DROP TABLE IF EXISTS conta_de_para",
        "DROP TABLE IF EXISTS orcamento_valores",
        "DROP TABLE IF EXISTS orcamento_unidade_valores",
        "DROP TABLE IF EXISTS valores_mensais_fc",
        "DROP TABLE IF EXISTS saldos_iniciais_fc",
        "DROP TABLE IF EXISTS contas_fc",
        "DROP TABLE IF EXISTS cliente_plano",
        "DROP TABLE IF EXISTS planos_itens",
        "DROP TABLE IF EXISTS planos_contas",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_cliente_id_codigo_acesso ON usuarios (cliente_id, codigo_acesso) WHERE cliente_id IS NOT NULL",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_codigo_acesso_internal ON usuarios (codigo_acesso) WHERE cliente_id IS NULL",
        "ALTER TABLE ref_lancamentos ADD COLUMN unidade_nome VARCHAR(100)",
        "ALTER TABLE ref_lancamentos ADD COLUMN unidade_codigo VARCHAR(3)",
        "ALTER TABLE import_layouts ADD COLUMN coluna_unidade INTEGER",
        "ALTER TABLE import_layouts ADD COLUMN coluna_inicio_unidades INTEGER",
        "ALTER TABLE clientes ADD COLUMN template_dre_padrao_id INTEGER",
        "ALTER TABLE unidades ADD COLUMN cnpj VARCHAR(20)",
        "ALTER TABLE unidades ADD COLUMN endereco_logradouro VARCHAR(200)",
        "ALTER TABLE unidades ADD COLUMN endereco_numero VARCHAR(30)",
        "ALTER TABLE unidades ADD COLUMN endereco_complemento VARCHAR(100)",
        "ALTER TABLE unidades ADD COLUMN endereco_bairro VARCHAR(100)",
        "ALTER TABLE unidades ADD COLUMN endereco_cidade VARCHAR(100)",
        "ALTER TABLE unidades ADD COLUMN endereco_estado VARCHAR(2)",
        "ALTER TABLE unidades ADD COLUMN endereco_cep VARCHAR(10)",
        # Projeto Referencial Fase A: dimensao do agrupamento (contabil | departamento)
        "ALTER TABLE agrupamentos ADD COLUMN dimensao TEXT NOT NULL DEFAULT 'contabil'",
    ]):
        try:
            conn.execute(text(stmt))
            conn.commit()
        except Exception:
            pass  # column already exists

# MigraÃ§Ãµes para PostgreSQL (Supabase) â†’ colunas novas em tabelas existentes
# SQLite usa ALTER TABLE acima; PostgreSQL precisa de ADD COLUMN IF NOT EXISTS
if not _is_sqlite:
    with engine.connect() as conn:
        for stmt in [
            # Drop old constraint/index on codigo_acesso
            "ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_codigo_acesso_key",
            "DROP INDEX IF EXISTS idx_usuarios_codigo_acesso",
            # Create new partial unique indexes
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_cliente_id_codigo_acesso ON usuarios (cliente_id, codigo_acesso) WHERE cliente_id IS NOT NULL",
            "CREATE UNIQUE INDEX IF NOT EXISTS ix_usuarios_codigo_acesso_internal ON usuarios (codigo_acesso) WHERE cliente_id IS NULL",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modulo_projetos BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modulo_inteligencia_mercado BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modulo_analises_gerenciais BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS segmento_id INTEGER REFERENCES ref_segmentos(id)",
            # Storage: colunas adicionadas na v2.6.0
            "ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS tipo_mime VARCHAR(120)",
            "ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS enviado_por_id INTEGER REFERENCES usuarios(id)",
            # Categoria de arquivo adicionada na v2.6.0e
            "ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) NOT NULL DEFAULT 'Outros'",
            # v2.6.2q: DRE Multi-Unidades - colunas e constraints
            "ALTER TABLE ref_lancamentos ADD COLUMN IF NOT EXISTS unidade_nome VARCHAR(100)",
            "ALTER TABLE ref_lancamentos ADD COLUMN IF NOT EXISTS unidade_codigo VARCHAR(3)",
            "ALTER TABLE ref_lancamentos DROP CONSTRAINT IF EXISTS ref_lancamentos_conta_cliente_id_ano_mes_key CASCADE",
            "ALTER TABLE ref_lancamentos DROP CONSTRAINT IF EXISTS ref_lancamentos_conta_cliente_id_unidade_nome_ano_mes_key CASCADE",
            "ALTER TABLE ref_lancamentos DROP CONSTRAINT IF EXISTS uq_ref_lancamentos_unidade CASCADE",
            "ALTER TABLE ref_lancamentos ADD CONSTRAINT uq_ref_lancamentos_unidade_codigo UNIQUE (conta_cliente_id, unidade_codigo, ano, mes)",
            "ALTER TABLE import_layouts ADD COLUMN IF NOT EXISTS coluna_unidade INTEGER",
            "ALTER TABLE import_layouts ADD COLUMN IF NOT EXISTS coluna_inicio_unidades INTEGER",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS template_dre_padrao_id INTEGER REFERENCES ref_templates(id)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS endereco_logradouro VARCHAR(200)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS endereco_numero VARCHAR(30)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS endereco_complemento VARCHAR(100)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS endereco_bairro VARCHAR(100)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS endereco_cidade VARCHAR(100)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS endereco_estado VARCHAR(2)",
            "ALTER TABLE unidades ADD COLUMN IF NOT EXISTS endereco_cep VARCHAR(10)",
            # Agrupadores FC â†’ colunas de metadados adicionadas na v2.6.0f
            "ALTER TABLE agrupadores_fc ADD COLUMN IF NOT EXISTS natureza VARCHAR(20) NOT NULL DEFAULT 'soma'",
            "ALTER TABLE agrupadores_fc ADD COLUMN IF NOT EXISTS slug VARCHAR(100)",
            'ALTER TABLE agrupadores_fc ADD COLUMN IF NOT EXISTS demonstrativos TEXT DEFAULT \'["fluxo_caixa"]\'',
            # v2.6.0g: natureza removido; tabela renomeada para agrupamentos
            "ALTER TABLE agrupadores_fc DROP COLUMN IF EXISTS natureza",
            "ALTER TABLE agrupadores_fc RENAME TO agrupamentos",
            # Corrige TODAS as sequences dessincronizadas (UniqueViolation na PK apÃ³s migraÃ§Ã£o/import)
            """DO $$
DECLARE
    r RECORD;
    max_val BIGINT;
BEGIN
    FOR r IN
        SELECT seq.relname AS seq_name, tab.relname AS tab_name
        FROM pg_class seq
        JOIN pg_depend d ON d.objid = seq.oid
            AND d.classid = 'pg_class'::regclass
            AND d.refclassid = 'pg_class'::regclass
            AND d.deptype = 'a'
        JOIN pg_class tab ON tab.oid = d.refobjid
        JOIN pg_namespace ns ON ns.oid = seq.relnamespace
        WHERE seq.relkind = 'S' AND ns.nspname = 'public'
    LOOP
        BEGIN
            EXECUTE 'SELECT COALESCE(MAX(id), 0) FROM ' || quote_ident(r.tab_name) INTO max_val;
            IF max_val > 0 THEN
                PERFORM setval(r.seq_name::regclass, max_val);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END LOOP;
END;
$$""",
            # v2.6.0j: remove vinculos duplicados (mesmo conta+demo, nÃ£o-herdado â†’ mantÃ©m o mais recente)
            """DELETE FROM ref_conta_agrupamento
WHERE herdado = false
AND id NOT IN (
    SELECT MAX(id) FROM ref_conta_agrupamento
    WHERE herdado = false
    GROUP BY conta_referencial_id, demonstrativo
)""",
            # v2.6.0p: remove herdado=True redundantes onde jÃ¡ existe herdado=False para o mesmo conta+demo
            """DELETE FROM ref_conta_agrupamento
WHERE herdado = true
AND EXISTS (
    SELECT 1 FROM ref_conta_agrupamento AS b
    WHERE b.conta_referencial_id = ref_conta_agrupamento.conta_referencial_id
    AND b.demonstrativo = ref_conta_agrupamento.demonstrativo
    AND b.herdado = false
)""",
            # v2.6.0o: corrige nomes de agrupamentos importados sem acento
            "UPDATE agrupamentos SET nome='Vendas - CrÃ©dito'                             WHERE slug='vendas_credito'",
            "UPDATE agrupamentos SET nome='Vendas - DÃ©bito'                              WHERE slug='vendas_debito'",
            "UPDATE agrupamentos SET nome='( - ) DevoluÃ§Ã£o de Vendas'                   WHERE slug='devolucao_de_vendas'",
            "UPDATE agrupamentos SET nome='( + ) CrÃ©ditos Operacionais'                 WHERE slug='creditos_operacionais'",
            "UPDATE agrupamentos SET nome='( + ) DevoluÃ§Ãµes'                            WHERE slug='devolucoes'",
            "UPDATE agrupamentos SET nome='( - ) Pessoal - SalÃ¡rio'                     WHERE slug='pessoal_salario'",
            "UPDATE agrupamentos SET nome='( - ) Pessoal - FÃ©rias'                      WHERE slug='pessoal_ferias'",
            "UPDATE agrupamentos SET nome='( - ) Pessoal - RescisÃµes'                   WHERE slug='pessoal_rescisoes'",
            "UPDATE agrupamentos SET nome='( - ) Pessoal - BenefÃ­cios'                  WHERE slug='pessoal_beneficios'",
            "UPDATE agrupamentos SET nome='( - ) TributÃ¡ria'                             WHERE slug='tributaria'",
            "UPDATE agrupamentos SET nome='( - ) Energia ElÃ©trica'                      WHERE slug='energia_eletrica'",
            "UPDATE agrupamentos SET nome='( - ) Utilidades e ServiÃ§os'                 WHERE slug='utilidades_e_servicos'",
            "UPDATE agrupamentos SET nome='( - ) ManutenÃ§Ãµes'                           WHERE slug='manutencoes'",
            "UPDATE agrupamentos SET nome='( - ) VeÃ­culos'                              WHERE slug='veiculos'",
            "UPDATE agrupamentos SET nome='( - ) ManutenÃ§Ã£o ImÃ³veis'                    WHERE slug='manutencao_imoveis'",
            "UPDATE agrupamentos SET nome='( - ) InformÃ¡tica'                            WHERE slug='informatica'",
            "UPDATE agrupamentos SET nome='( - ) Prestadores de ServiÃ§os Operacionais'  WHERE slug='prestadores_de_servicos_operacionais'",
            "UPDATE agrupamentos SET nome='( - ) IndedutÃ­veis'                          WHERE slug='indedutiveis'",
            "UPDATE agrupamentos SET nome='( - ) Taxas Adm de CartÃµes'                  WHERE slug='taxas_adm_de_cartoes'",
            "UPDATE agrupamentos SET nome='( - ) EmprÃ©stimos'                            WHERE slug='emprestimos_saida'",
            "UPDATE agrupamentos SET nome='( - ) Juros/IOF S/ EmprÃ©stimos'              WHERE slug='juros_iof_s_emprestimos'",
            "UPDATE agrupamentos SET nome='EmprÃ©stimos'                                  WHERE slug='emprestimos'",
            "UPDATE agrupamentos SET nome='AplicaÃ§Ãµes'                                   WHERE slug='aplicacoes'",
            "UPDATE agrupamentos SET nome='( - ) SÃ³cios'                                WHERE slug='socios'",
            "UPDATE agrupamentos SET nome='(+/-) Mvto TransitÃ³rio'                      WHERE slug='mvto_transitorio'",
            # v2.6.0r: cÃ³digo de acesso de 3 dÃ­gitos para login simplificado
            "ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS codigo_acesso VARCHAR(3)",
            # v2.6.2h: NAO recriar idx_usuarios_codigo_acesso (indice unico GLOBAL) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â conflita com o
            # design multi-tenant. A unicidade correta e POR cliente, garantida pelos Ã­ndices parciais
            # ix_usuarios_cliente_id_codigo_acesso / ix_usuarios_codigo_acesso_internal (criados acima).
            # O "DROP INDEX IF EXISTS idx_usuarios_codigo_acesso" acima remove o legado a cada startup.
            # v2.6.0v: DEMO-3 â†’ colunas novas em ref_template_linhas; segmento_id nullable em ref_templates
            # fc_lancamentos Ã© tabela nova â†’ criada pelo create_all acima
            "ALTER TABLE ref_template_linhas ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) DEFAULT 'agrupamento'",
            "ALTER TABLE ref_template_linhas ADD COLUMN IF NOT EXISTS agrupamento_slug VARCHAR(200)",
            "ALTER TABLE ref_templates ALTER COLUMN segmento_id DROP NOT NULL",
            # v2.6.0w: DEMO-4 â†’ fc_slug_depara Ã© tabela nova, criada pelo create_all acima
            # v2.6.0x: DEMO-4 â†’ 8 novos agrupamentos (Rio das Pedras + recuperaÃ§Ã£o pessoal)
            "INSERT INTO agrupamentos (nome, slug, demonstrativos, padrao, ativo) VALUES ('Vendas - Cheques SaÃ­da','vendas_cheques_saida','[\"fluxo_caixa\"]',true,true) ON CONFLICT (slug) DO NOTHING",
            "INSERT INTO agrupamentos (nome, slug, demonstrativos, padrao, ativo) VALUES ('Vendas - Extra Caixa SaÃ­da','vendas_extra_caixa_saida','[\"fluxo_caixa\"]',true,true) ON CONFLICT (slug) DO NOTHING",
            "INSERT INTO agrupamentos (nome, slug, demonstrativos, padrao, ativo) VALUES ('( + ) Outras Entradas Operacionais','outras_entradas_operacionais','[\"fluxo_caixa\"]',true,true) ON CONFLICT (slug) DO NOTHING",
            "INSERT INTO agrupamentos (nome, slug, demonstrativos, padrao, ativo) VALUES ('( - ) Outras SaÃ­das Operacionais','outras_saidas_operacionais','[\"fluxo_caixa\"]',true,true) ON CONFLICT (slug) DO NOTHING",
            "INSERT INTO agrupamentos (nome, slug, demonstrativos, padrao, ativo) VALUES ('( - ) Acordos Comerciais SaÃ­da','acordos_comerciais_saida','[\"fluxo_caixa\"]',true,true) ON CONFLICT (slug) DO NOTHING",
            "INSERT INTO agrupamentos (nome, slug, demonstrativos, padrao, ativo) VALUES ('( + ) Terceiros - Recarga Entrada','terceiros_recarga_entrada','[\"fluxo_caixa\"]',true,true) ON CONFLICT (slug) DO NOTHING",
            "INSERT INTO agrupamentos (nome, slug, demonstrativos, padrao, ativo) VALUES ('( - ) Terceiros - Recarga SaÃ­da','terceiros_recarga_saida','[\"fluxo_caixa\"]',true,true) ON CONFLICT (slug) DO NOTHING",
            "INSERT INTO agrupamentos (nome, slug, demonstrativos, padrao, ativo) VALUES ('( + ) RecuperaÃ§Ã£o de Pessoal','recuperacao_pessoal','[\"fluxo_caixa\"]',true,true) ON CONFLICT (slug) DO NOTHING",
            # DROP tabelas do plano de contas antigo
            "DROP TABLE IF EXISTS template_formulas CASCADE",
            "DROP TABLE IF EXISTS conta_de_para CASCADE",
            "DROP TABLE IF EXISTS orcamento_valores CASCADE",
            "DROP TABLE IF EXISTS orcamento_unidade_valores CASCADE",
            "DROP TABLE IF EXISTS valores_mensais_fc CASCADE",
            "DROP TABLE IF EXISTS saldos_iniciais_fc CASCADE",
            "DROP TABLE IF EXISTS contas_fc CASCADE",
            "DROP TABLE IF EXISTS cliente_plano CASCADE",
            "DROP TABLE IF EXISTS planos_itens CASCADE",
            "DROP TABLE IF EXISTS planos_contas CASCADE",
            "DROP TABLE IF EXISTS planos CASCADE",
            # MigraÃ§Ã£o de colunas Float para Numeric(15, 2) (Supabase/Postgres)
            "ALTER TABLE lancamentos ALTER COLUMN valor TYPE NUMERIC(15, 2) USING ROUND(valor::numeric, 2)",
            "ALTER TABLE orcamento_linhas ALTER COLUMN valor_previsto TYPE NUMERIC(15, 2) USING ROUND(valor_previsto::numeric, 2)",
            "ALTER TABLE balancete_lancamentos ALTER COLUMN valor TYPE NUMERIC(15, 2) USING ROUND(valor::numeric, 2)",
            "ALTER TABLE importacao_pendencias ALTER COLUMN valor TYPE NUMERIC(15, 2) USING ROUND(valor::numeric, 2)",
            "ALTER TABLE ref_lancamentos ALTER COLUMN valor TYPE NUMERIC(15, 2) USING ROUND(valor::numeric, 2)",
            "ALTER TABLE fc_lancamentos ALTER COLUMN valor TYPE NUMERIC(15, 2) USING ROUND(valor::numeric, 2)",
            "ALTER TABLE fc_orcamento ALTER COLUMN valor TYPE NUMERIC(15, 2) USING ROUND(valor::numeric, 2)",
            # Projeto Referencial Fase A: dimensao do agrupamento (contabil | departamento)
            "ALTER TABLE agrupamentos ADD COLUMN IF NOT EXISTS dimensao VARCHAR(20) NOT NULL DEFAULT 'contabil'",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                # Rollback obrigatÃ³rio â†’ sem isso, PostgreSQL mantÃ©m a conexÃ£o em
                # InFailedSqlTransaction e todos os statements seguintes falham silenciosamente
                try:
                    conn.rollback()
                except Exception:
                    pass

# Seed dados padrÃ£o (executa apenas uma vez)
from database import SessionLocal
from seed_controladoria import seed_agrupadores
from seed_ref_plano import seed_ref_plano
_db = SessionLocal()
try:
    seed_agrupadores(_db)
    try:
        seed_ref_plano(_db)
    except Exception as _e:
        logger.exception("seed_ref_plano falhou")
finally:
    _db.close()

app = FastAPI(
    title="E Mais Consultoria â€” Sistema de GestÃ£o",
    version=APP_VERSION,
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["AutenticaÃ§Ã£o"])
app.include_router(usuarios.router,  prefix="/api/usuarios",  tags=["UsuÃ¡rios"])
app.include_router(clientes.router,  prefix="/api/clientes",  tags=["Clientes"])
app.include_router(projetos.router,  prefix="/api/projetos",  tags=["Projetos"])
app.include_router(fases.router,     prefix="/api/fases",     tags=["Fases"])
app.include_router(tarefas.router,   prefix="/api/tarefas",   tags=["Tarefas"])
app.include_router(dashboard.router,      prefix="/api/dashboard",      tags=["Dashboard"])
app.include_router(notificacoes.router,   prefix="/api/notificacoes",   tags=["NotificaÃ§Ãµes"])
app.include_router(relatorios.router,     prefix="/api/relatorios",     tags=["RelatÃ³rios"])
app.include_router(historico.router,      prefix="/api/historico",      tags=["HistÃ³rico"])
app.include_router(subtarefas.router,     prefix="/api/subtarefas",     tags=["Subtarefas"])
app.include_router(controladoria.router,  prefix="/api/controladoria",  tags=["Controladoria"])
app.include_router(fluxo_caixa.router,    prefix="/api/fluxo",          tags=["Fluxo de Caixa"])
app.include_router(balancete.router,      prefix="/api/balancete",      tags=["Balancete"])
app.include_router(anotacoes.router,      prefix="/api/anotacoes",      tags=["AnotaÃ§Ãµes"])
app.include_router(orcamento.router,      prefix="/api/orcamento",      tags=["OrÃ§amento"])
app.include_router(admin.router,          prefix="/api/admin",          tags=["AdministraÃ§Ã£o"])
app.include_router(bandeiras.router,      prefix="/api/bandeiras",      tags=["Bandeiras"])
app.include_router(modelos.router,        prefix="/api/modelos",        tags=["Modelos de Projeto"])
app.include_router(busca.router,          prefix="/api/busca",          tags=["Busca Global"])
app.include_router(chat.router,           prefix="/api/chat",           tags=["Chat"])
app.include_router(arquivos.router,       prefix="/api/arquivos",       tags=["Arquivos"])
app.include_router(ia.router,             prefix="/api/ia",             tags=["IA"])
app.include_router(gemini.router,         prefix="/api/gemini",         tags=["Gemini"])
app.include_router(openrouter.router,     prefix="/api/openrouter",     tags=["OpenRouter"])
app.include_router(dre_import.router,          prefix="/api/dre",              tags=["Motor DRE"])
app.include_router(ref_segmentos.router,       prefix="/api/ref/segmentos",    tags=["Ref: Segmentos"])
app.include_router(ref_plano.router,           prefix="/api/ref/plano",        tags=["Ref: Plano"])
app.include_router(ref_lancamentos.router,     prefix="/api/ref/lancamentos",  tags=["Ref: LanÃ§amentos"])
app.include_router(ref_depara.router,          prefix="/api/ref/depara",       tags=["Ref: De-Para"])
app.include_router(ref_templates.router,       prefix="/api/ref/templates",    tags=["Ref: Templates"])
app.include_router(ref_demonstrativos.router,  prefix="/api/ref/demonstrativos", tags=["Ref: Demonstrativos"])
app.include_router(ref_benchmark.router,       prefix="/api/ref/benchmark",    tags=["Ref: Benchmark"])
app.include_router(ref_unidades.router,        prefix="/api/ref/unidades",     tags=["Ref: Unidades"])
app.include_router(fc_exec.router,             tags=["Demonstrativos FC"])
app.include_router(pdf.router,                 prefix="/api/pdf",             tags=["PDF"])

# Cria diretÃ³rio de uploads se nÃ£o existir
from pathlib import Path as _Path
import os as _os
_Path(_os.getenv("UPLOADS_DIR", str(_Path(__file__).parent / "uploads"))).mkdir(parents=True, exist_ok=True)

# Inicia backup automÃ¡tico diÃ¡rio
from routers.admin import iniciar_backup_automatico
iniciar_backup_automatico()

app.version = APP_VERSION

@app.get("/api/version", tags=["Sistema"])
def get_version():
    return {
        "version": app.version,
    }

# Servir o frontend React (arquivos estÃ¡ticos do build)
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/")
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str = ""):
        # Rotas da API jÃ¡ foram registradas antes â†’ qualquer outra rota serve o index.html
        index = FRONTEND_DIST / "index.html"
        return FileResponse(index)
else:
    @app.get("/")
    def root():
        return {"message": "E Mais Consultoria API â†’ Online"}


























































































































































