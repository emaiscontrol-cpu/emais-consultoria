from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from database import engine, Base
from routers import auth, clientes, projetos, fases, tarefas, usuarios, dashboard, notificacoes, relatorios, historico, subtarefas, controladoria, fluxo_caixa, planos, balancete, anotacoes, orcamento

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
        "ALTER TABLE subtarefas ADD COLUMN responsavel_id INTEGER REFERENCES usuarios(id)",
        "ALTER TABLE subtarefas ADD COLUMN data_inicio DATETIME",
        "ALTER TABLE subtarefas ADD COLUMN data_fim DATETIME",
        "ALTER TABLE usuarios ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT 1",
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

app.version = "2.2.0e"

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






































