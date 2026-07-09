"""
Configuração compartilhada dos testes do backend.

Cria um banco SQLite isolado (arquivo temporário, recriado a cada teste) para
que a suíte NUNCA toque no Supabase/PostgreSQL real. As variáveis de
ambiente DATABASE_URL e SECRET_KEY são definidas ANTES de importar qualquer
módulo do backend, porque `database.py` cria a engine no momento do import.
"""
import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

_TEST_DB_PATH = Path(tempfile.gettempdir()) / "emais_consultoria_test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_DB_PATH.as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-key-nao-usar-em-producao"
os.environ.setdefault("UPLOADS_DIR", str(Path(tempfile.gettempdir()) / "emais_test_uploads"))
os.environ.setdefault("BACKUP_DIR", str(Path(tempfile.gettempdir()) / "emais_test_backup"))

if _TEST_DB_PATH.exists():
    _TEST_DB_PATH.unlink()

from database import Base, engine, SessionLocal  # noqa: E402
import models  # noqa: E402  garante que todas as tabelas entrem em Base.metadata
from auth import hash_senha, criar_token  # noqa: E402
from routers import (  # noqa: E402
    auth as auth_router,
    usuarios,
    clientes,
    projetos,
    fases,
    tarefas,
    dashboard,
    anotacoes,
    subtarefas,
    pdf,
    orcamento,
    ref_demonstrativos,
    bandeiras,
    ref_unidades,
)


@pytest.fixture(autouse=True)
def _banco_limpo():
    """Recria o schema do zero antes de cada teste — isolamento total entre testes."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(_banco_limpo):
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def _montar_app() -> FastAPI:
    """Monta um FastAPI mínimo só com os routers cobertos pelos testes.

    Evita importar backend/main.py diretamente: main.py dispara migrações,
    seeds e um timer de backup automático no import, o que é desnecessário
    (e arriscado) para testes unitários de endpoint.
    """
    app = FastAPI(redirect_slashes=False)
    app.include_router(auth_router.router, prefix="/api/auth")
    app.include_router(usuarios.router,    prefix="/api/usuarios")
    app.include_router(clientes.router,    prefix="/api/clientes")
    app.include_router(projetos.router,    prefix="/api/projetos")
    app.include_router(fases.router,       prefix="/api/fases")
    app.include_router(tarefas.router,     prefix="/api/tarefas")
    app.include_router(dashboard.router,   prefix="/api/dashboard")
    app.include_router(anotacoes.router,   prefix="/api/anotacoes")
    app.include_router(subtarefas.router,  prefix="/api/subtarefas")
    app.include_router(pdf.router,         prefix="/api/pdf")
    app.include_router(orcamento.router,   prefix="/api/orcamento")
    app.include_router(ref_demonstrativos.router, prefix="/api/ref/demonstrativos")
    app.include_router(bandeiras.router,   prefix="/api/bandeiras")
    app.include_router(ref_unidades.router, prefix="/api/ref/unidades")
    return app


@pytest.fixture
def app(_banco_limpo):
    return _montar_app()


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


# ── Fixtures de domínio ────────────────────────────────────────────────────

def _criar_usuario(db, nome, email, senha, perfil, cliente_id=None, ativo=True):
    usuario = models.Usuario(
        nome=nome, email=email, senha_hash=hash_senha(senha),
        perfil=perfil, cliente_id=cliente_id, ativo=ativo,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@pytest.fixture
def cliente_teste(db_session):
    cliente = models.Cliente(razao_social="Cliente Teste LTDA", cnpj="00.000.000/0001-00")
    db_session.add(cliente)
    db_session.commit()
    db_session.refresh(cliente)
    return cliente


@pytest.fixture
def outro_cliente(db_session):
    cliente = models.Cliente(razao_social="Outro Cliente LTDA", cnpj="11.111.111/0001-11")
    db_session.add(cliente)
    db_session.commit()
    db_session.refresh(cliente)
    return cliente


@pytest.fixture
def admin_user(db_session):
    return _criar_usuario(db_session, "Admin Teste", "admin.teste@emals.com",
                           "senha123", models.PerfilEnum.admin)


@pytest.fixture
def consultor_user(db_session):
    return _criar_usuario(db_session, "Consultor Teste", "consultor.teste@emals.com",
                           "senha123", models.PerfilEnum.consultor)


@pytest.fixture
def outro_admin(db_session):
    return _criar_usuario(db_session, "Outro Admin", "outro.admin.teste@emals.com",
                           "senha123", models.PerfilEnum.admin)


@pytest.fixture
def analista_user(db_session, cliente_teste):
    return _criar_usuario(db_session, "Analista Teste", "analista.teste@emals.com",
                           "senha123", models.PerfilEnum.analista, cliente_id=cliente_teste.id)


@pytest.fixture
def usuario_inativo(db_session):
    return _criar_usuario(db_session, "Usuario Inativo", "inativo.teste@emals.com",
                           "senha123", models.PerfilEnum.consultor, ativo=False)


def auth_headers(usuario) -> dict:
    token = criar_token({"sub": usuario.email, "perfil": usuario.perfil})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_user):
    return auth_headers(admin_user)


@pytest.fixture
def consultor_headers(consultor_user):
    return auth_headers(consultor_user)


@pytest.fixture
def outro_admin_headers(outro_admin):
    return auth_headers(outro_admin)


@pytest.fixture
def analista_headers(analista_user):
    return auth_headers(analista_user)


@pytest.fixture
def projeto_teste(db_session, cliente_teste):
    projeto = models.Projeto(nome="Projeto Teste", cliente_id=cliente_teste.id)
    db_session.add(projeto)
    db_session.commit()
    db_session.refresh(projeto)
    return projeto


@pytest.fixture
def fase_teste(db_session, projeto_teste):
    fase = models.Fase(
        projeto_id=projeto_teste.id, nome="Fase Teste", ordem=1,
        status=models.StatusFase.pendente,
    )
    db_session.add(fase)
    db_session.commit()
    db_session.refresh(fase)
    return fase


@pytest.fixture
def tarefa_teste(db_session, fase_teste):
    tarefa = models.Tarefa(fase_id=fase_teste.id, nome="Tarefa Teste", ordem=1)
    db_session.add(tarefa)
    db_session.commit()
    db_session.refresh(tarefa)
    return tarefa
