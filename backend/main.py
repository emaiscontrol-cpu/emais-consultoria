from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from database import engine, Base
from routers import auth, clientes, projetos, fases, tarefas, usuarios, dashboard, notificacoes, relatorios, historico, subtarefas, controladoria, fluxo_caixa, balancete, anotacoes, orcamento, admin, bandeiras, modelos, busca, chat, arquivos, ia, gemini, openrouter, dre_import
from routers import ref_segmentos, ref_plano, ref_lancamentos, ref_depara, ref_templates, ref_demonstrativos, ref_benchmark

try:
    Base.metadata.create_all(bind=engine)
except Exception as _ce:
    print(f"[warning] create_all: {_ce}")

# Add missing columns to existing tables (SQLite only — Supabase starts fresh via create_all)
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
        # DB-4: índices para acelerar queries frequentes
        "CREATE INDEX IF NOT EXISTS ix_log_atividades_criado_em ON log_atividades(criado_em)",
        "CREATE INDEX IF NOT EXISTS ix_tarefas_data_prazo ON tarefas(data_prazo)",
        # UX-7: histórico detalhado por tarefa
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
        # Módulo de Arquivos por cliente
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
        # Categoria de arquivo (Contrato, Relatório, Financeiro, Jurídico, Outros)
        "ALTER TABLE arquivos ADD COLUMN categoria TEXT NOT NULL DEFAULT 'Outros'",
        # Agrupadores FC — colunas de metadados adicionadas na v2.6.0f
        "ALTER TABLE agrupadores_fc ADD COLUMN natureza TEXT NOT NULL DEFAULT 'soma'",
        "ALTER TABLE agrupadores_fc ADD COLUMN slug TEXT",
        'ALTER TABLE agrupadores_fc ADD COLUMN demonstrativos TEXT DEFAULT \'["fluxo_caixa"]\'',
        # v2.6.0g: natureza removido (sinal definido na fórmula); tabela renomeada para agrupamentos
        "ALTER TABLE agrupadores_fc DROP COLUMN natureza",
        "ALTER TABLE agrupadores_fc RENAME TO agrupamentos",
        # Módulos contratados por cliente
        "ALTER TABLE clientes ADD COLUMN modulo_projetos BOOLEAN NOT NULL DEFAULT 1",
        "ALTER TABLE clientes ADD COLUMN modulo_inteligencia_mercado BOOLEAN NOT NULL DEFAULT 0",
        "ALTER TABLE clientes ADD COLUMN modulo_analises_gerenciais BOOLEAN NOT NULL DEFAULT 0",
        # Segmento do cliente (Plano Referencial)
        "ALTER TABLE clientes ADD COLUMN segmento_id INTEGER REFERENCES ref_segmentos(id)",
        # UX-11: notificações de menção @usuario
        """CREATE TABLE IF NOT EXISTS notificacoes_mencao (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_destino_id INTEGER NOT NULL REFERENCES usuarios(id),
            de_usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
            mensagem TEXT NOT NULL,
            projeto_id INTEGER REFERENCES projetos(id),
            lida BOOLEAN DEFAULT 0,
            criado_em DATETIME DEFAULT (datetime('now'))
        )""",
        # DROP tabelas do plano de contas antigo (migração definitiva)
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
        "DROP TABLE IF EXISTS planos",
    ]):
        try:
            conn.execute(text(stmt))
            conn.commit()
        except Exception:
            pass  # column already exists

# Migrações para PostgreSQL (Supabase) — colunas novas em tabelas existentes
# SQLite usa ALTER TABLE acima; PostgreSQL precisa de ADD COLUMN IF NOT EXISTS
if not _is_sqlite:
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modulo_projetos BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modulo_inteligencia_mercado BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modulo_analises_gerenciais BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS segmento_id INTEGER REFERENCES ref_segmentos(id)",
            # Storage: colunas adicionadas na v2.6.0
            "ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS tipo_mime VARCHAR(120)",
            "ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS enviado_por_id INTEGER REFERENCES usuarios(id)",
            # Categoria de arquivo adicionada na v2.6.0e
            "ALTER TABLE arquivos ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) NOT NULL DEFAULT 'Outros'",
            # Agrupadores FC — colunas de metadados adicionadas na v2.6.0f
            "ALTER TABLE agrupadores_fc ADD COLUMN IF NOT EXISTS natureza VARCHAR(20) NOT NULL DEFAULT 'soma'",
            "ALTER TABLE agrupadores_fc ADD COLUMN IF NOT EXISTS slug VARCHAR(100)",
            'ALTER TABLE agrupadores_fc ADD COLUMN IF NOT EXISTS demonstrativos TEXT DEFAULT \'["fluxo_caixa"]\'',
            # v2.6.0g: natureza removido; tabela renomeada para agrupamentos
            "ALTER TABLE agrupadores_fc DROP COLUMN IF EXISTS natureza",
            "ALTER TABLE agrupadores_fc RENAME TO agrupamentos",
            # Corrige TODAS as sequences dessincronizadas (UniqueViolation na PK após migração/import)
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
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass

# Seed dados padrão (executa apenas uma vez)
from database import SessionLocal
from seed_controladoria import seed_agrupadores
from seed_ref_plano import seed_ref_plano
_db = SessionLocal()
try:
    seed_agrupadores(_db)
    try:
        seed_ref_plano(_db)
    except Exception as _e:
        print(f"[warning] seed_ref_plano: {_e}")
finally:
    _db.close()

app = FastAPI(
    title="E Mais Consultoria â€” Sistema de GestÃ£o",
    version="1.0.0",
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
app.include_router(anotacoes.router,      prefix="/api/anotacoes",      tags=["Anotações"])
app.include_router(orcamento.router,      prefix="/api/orcamento",      tags=["Orçamento"])
app.include_router(admin.router,          prefix="/api/admin",          tags=["Administração"])
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
app.include_router(ref_lancamentos.router,     prefix="/api/ref/lancamentos",  tags=["Ref: Lançamentos"])
app.include_router(ref_depara.router,          prefix="/api/ref/depara",       tags=["Ref: De-Para"])
app.include_router(ref_templates.router,       prefix="/api/ref/templates",    tags=["Ref: Templates"])
app.include_router(ref_demonstrativos.router,  prefix="/api/ref/demonstrativos", tags=["Ref: Demonstrativos"])
app.include_router(ref_benchmark.router,       prefix="/api/ref/benchmark",    tags=["Ref: Benchmark"])

# Cria diretório de uploads se não existir
from pathlib import Path as _Path
import os as _os
_Path(_os.getenv("UPLOADS_DIR", str(_Path(__file__).parent / "uploads"))).mkdir(parents=True, exist_ok=True)

# Inicia backup automático diário
from routers.admin import iniciar_backup_automatico
iniciar_backup_automatico()

app.version = "2.6.0g"

@app.get("/api/version", tags=["Sistema"])
def get_version():
    import os as _os
    from database import SQLALCHEMY_DATABASE_URL as _db_url
    from database import SessionLocal as _SL
    import models as _m
    _db = _SL()
    try:
        _nc = _db.query(_m.Cliente).count()
        _nu = _db.query(_m.Usuario).count()
        _np = _db.query(_m.Projeto).count()
    finally:
        _db.close()
    from routers.admin import DB_PATH as _admin_db_path, BACKUP_DIR as _backup_dir
    return {
        "version": app.version,
        "db_url": _db_url,
        "db_cwd": _os.getcwd(),
        "admin_db_path": str(_admin_db_path),
        "admin_db_exists": _admin_db_path.exists() if _admin_db_path else None,
        "backup_dir": str(_backup_dir),
        "clientes": _nc,
        "usuarios": _nu,
        "projetos": _np,
    }

# Servir o frontend React (arquivos estÃ¡ticos do build)
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/")
    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str = ""):
        # Rotas da API jÃ¡ foram registradas antes â€” qualquer outra rota serve o index.html
        index = FRONTEND_DIST / "index.html"
        return FileResponse(index)
else:
    @app.get("/")
    def root():
        return {"message": "E Mais Consultoria API â€” Online"}









































































































































