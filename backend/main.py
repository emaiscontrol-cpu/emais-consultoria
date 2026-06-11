from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from database import engine, Base
from routers import auth, clientes, projetos, fases, tarefas, usuarios, dashboard, notificacoes, relatorios, historico, subtarefas, controladoria, fluxo_caixa, planos, balancete, anotacoes, orcamento, admin, bandeiras, modelos, busca, chat, arquivos, ia, gemini, openrouter

try:
    Base.metadata.create_all(bind=engine)
except Exception as _ce:
    print(f"[warning] create_all: {_ce}")

# Add missing columns to existing tables (safe to run on every startup)
from sqlalchemy import text
with engine.connect() as conn:
    for stmt in [
        "ALTER TABLE tarefas ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT 1",
        "ALTER TABLE fases ADD COLUMN bloqueado_por_anterior BOOLEAN NOT NULL DEFAULT 1",
        "ALTER TABLE contas_fc ADD COLUMN agrupador_id INTEGER REFERENCES agrupadores_fc(id)",
        "ALTER TABLE planos_itens ADD COLUMN modulo TEXT",
        "ALTER TABLE planos_itens ADD COLUMN conta TEXT",
        "ALTER TABLE planos DROP COLUMN tipo",
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
        "ALTER TABLE planos_itens ADD COLUMN formula TEXT",
        "UPDATE planos_itens SET tipo='AN' WHERE tipo='NN' OR tipo IS NULL",
        # Tabela nova — create_all já cria, mas garante caso banco antigo
        """CREATE TABLE IF NOT EXISTS orcamento_valores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plano_item_id INTEGER NOT NULL REFERENCES planos_itens(id),
            cliente_id INTEGER NOT NULL REFERENCES clientes(id),
            ano INTEGER NOT NULL,
            mes INTEGER NOT NULL,
            valor REAL DEFAULT 0.0,
            UNIQUE(plano_item_id, cliente_id, ano, mes)
        )""",
        """CREATE TABLE IF NOT EXISTS bandeiras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER NOT NULL REFERENCES clientes(id),
            nome TEXT NOT NULL,
            unidades_json TEXT DEFAULT '[]'
        )""",
        """CREATE TABLE IF NOT EXISTS orcamento_unidade_valores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plano_item_id INTEGER NOT NULL REFERENCES planos_itens(id),
            cliente_id INTEGER NOT NULL REFERENCES clientes(id),
            ano INTEGER NOT NULL,
            mes INTEGER NOT NULL,
            unidade TEXT NOT NULL,
            valor REAL DEFAULT 0.0,
            UNIQUE(plano_item_id, cliente_id, ano, mes, unidade)
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
    ]:
        try:
            conn.execute(text(stmt))
            conn.commit()
        except Exception:
            pass  # column already exists

# Seed dados padrÃ£o (executa apenas uma vez)
from database import SessionLocal
from seed_controladoria import seed_agrupadores
from seed_orcamento import seed_orcamento
from seed_dre import seed_dre
_db = SessionLocal()
try:
    seed_agrupadores(_db)
    try:
        seed_orcamento(_db)
    except Exception as _e:
        print(f"[warning] seed_orcamento: {_e}")
    try:
        seed_dre(_db)
    except Exception as _e:
        print(f"[warning] seed_dre: {_e}")
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
app.include_router(planos.router,         prefix="/api/planos",         tags=["Planos de Contas"])
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

# Cria diretório de uploads se não existir
from pathlib import Path as _Path
_Path(r"C:\emals-service\uploads").mkdir(parents=True, exist_ok=True)

# Inicia backup automático diário
from routers.admin import iniciar_backup_automatico
iniciar_backup_automatico()

app.version = "2.5.0"

@app.get("/api/version", tags=["Sistema"])
def get_version():
    return {"version": app.version}

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































































































