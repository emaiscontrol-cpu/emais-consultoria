"""
Testes de integração dos endpoints críticos do FastAPI.

Cobre os fluxos usados pelo frontend (frontend/src/services/api.js):
auth, clientes, projetos, fases, tarefas, usuários, dashboard, anotações
e subtarefas. Roda inteiramente contra o banco SQLite isolado de
tests/conftest.py — nunca toca no Supabase de produção.
"""
import models


# ── AUTH ─────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_sucesso(self, client, admin_user):
        r = client.post("/api/auth/login", json={"email": admin_user.email, "senha": "senha123"})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert body["usuario"]["email"] == admin_user.email

    def test_login_senha_errada(self, client, admin_user):
        r = client.post("/api/auth/login", json={"email": admin_user.email, "senha": "errada"})
        assert r.status_code == 401

    def test_login_email_inexistente(self, client):
        r = client.post("/api/auth/login", json={"email": "naoexiste@emals.com", "senha": "x"})
        assert r.status_code == 401

    def test_login_usuario_inativo(self, client, usuario_inativo):
        r = client.post("/api/auth/login", json={"email": usuario_inativo.email, "senha": "senha123"})
        assert r.status_code == 403

    def test_login_case_insensitive_email(self, client, admin_user):
        r = client.post("/api/auth/login", json={"email": admin_user.email.upper(), "senha": "senha123"})
        assert r.status_code == 200

    def test_me_com_token_valido(self, client, admin_headers, admin_user):
        r = client.get("/api/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == admin_user.email

    def test_me_sem_token(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401

    def test_me_token_invalido(self, client):
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer token-invalido"})
        assert r.status_code == 401

    def test_refresh_token(self, client, admin_headers):
        r = client.post("/api/auth/refresh", headers=admin_headers)
        assert r.status_code == 200
        assert "access_token" in r.json()


# ── CLIENTES ─────────────────────────────────────────────────────────────

class TestClientes:
    def test_listar_requer_autenticacao(self, client):
        r = client.get("/api/clientes/")
        assert r.status_code == 401

    def test_listar_vazio(self, client, admin_headers):
        r = client.get("/api/clientes/", headers=admin_headers)
        assert r.status_code == 200
        assert r.json() == []

    def test_listar_oculta_inativos(self, client, admin_headers, db_session):
        db_session.add(models.Cliente(razao_social="Inativo LTDA", ativo=False))
        db_session.commit()
        r = client.get("/api/clientes/", headers=admin_headers)
        assert r.status_code == 200
        assert r.json() == []

    def test_criar_como_admin(self, client, admin_headers):
        r = client.post("/api/clientes/", json={"razao_social": "Nova Empresa LTDA"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["razao_social"] == "Nova Empresa LTDA"
        assert r.json()["ativo"] is True

    def test_criar_como_analista_proibido(self, client, analista_headers):
        r = client.post("/api/clientes/", json={"razao_social": "Tentativa LTDA"}, headers=analista_headers)
        assert r.status_code == 403

    def test_detalhe_404(self, client, admin_headers):
        r = client.get("/api/clientes/9999", headers=admin_headers)
        assert r.status_code == 404

    def test_detalhe_existente(self, client, admin_headers, cliente_teste):
        r = client.get(f"/api/clientes/{cliente_teste.id}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["id"] == cliente_teste.id

    def test_atualizar(self, client, admin_headers, cliente_teste):
        r = client.put(
            f"/api/clientes/{cliente_teste.id}",
            json={"razao_social": "Nome Atualizado LTDA"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["razao_social"] == "Nome Atualizado LTDA"

    def test_desativar_requer_admin(self, client, consultor_headers, cliente_teste):
        r = client.delete(f"/api/clientes/{cliente_teste.id}", headers=consultor_headers)
        assert r.status_code == 403

    def test_desativar_como_admin(self, client, admin_headers, cliente_teste):
        r = client.delete(f"/api/clientes/{cliente_teste.id}", headers=admin_headers)
        assert r.status_code == 200
        listagem = client.get("/api/clientes/", headers=admin_headers)
        assert listagem.json() == []


# ── PROJETOS ─────────────────────────────────────────────────────────────

class TestProjetos:
    def test_criar_projeto(self, client, admin_headers, cliente_teste):
        r = client.post(
            "/api/projetos/",
            json={"nome": "Projeto Novo", "cliente_id": cliente_teste.id},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "planejamento"
        assert r.json()["progresso"] == 0.0

    def test_listar_filtra_por_cliente_id(self, client, admin_headers, cliente_teste, outro_cliente, db_session):
        db_session.add_all([
            models.Projeto(nome="P1", cliente_id=cliente_teste.id),
            models.Projeto(nome="P2", cliente_id=outro_cliente.id),
        ])
        db_session.commit()
        r = client.get("/api/projetos/", params={"cliente_id": cliente_teste.id}, headers=admin_headers)
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["nome"] == "P1"

    def test_analista_so_ve_projetos_do_proprio_cliente(self, client, analista_headers, analista_user, outro_cliente, db_session):
        db_session.add_all([
            models.Projeto(nome="Meu projeto", cliente_id=analista_user.cliente_id),
            models.Projeto(nome="Projeto de outro cliente", cliente_id=outro_cliente.id),
        ])
        db_session.commit()
        r = client.get("/api/projetos/", headers=analista_headers)
        assert r.status_code == 200
        nomes = [p["nome"] for p in r.json()]
        assert nomes == ["Meu projeto"]

    def test_detalhe_projeto_404(self, client, admin_headers):
        r = client.get("/api/projetos/9999", headers=admin_headers)
        assert r.status_code == 404

    def test_analista_de_outro_cliente_nao_acessa_detalhe(self, client, analista_headers, projeto_teste, outro_cliente, db_session):
        projeto_teste.cliente_id = outro_cliente.id
        db_session.commit()
        r = client.get(f"/api/projetos/{projeto_teste.id}", headers=analista_headers)
        assert r.status_code == 403

    def test_deletar_e_soft_delete(self, client, admin_headers, projeto_teste, db_session):
        r = client.delete(f"/api/projetos/{projeto_teste.id}", headers=admin_headers)
        assert r.status_code == 200
        db_session.expire_all()
        atualizado = db_session.query(models.Projeto).get(projeto_teste.id)
        assert atualizado.ativo is False  # registro continua no banco, só fica oculto


# ── FASES E TAREFAS ──────────────────────────────────────────────────────

class TestFasesTarefas:
    def test_criar_fase(self, client, admin_headers, projeto_teste):
        r = client.post(
            "/api/fases/",
            json={"projeto_id": projeto_teste.id, "nome": "Fase 1", "ordem": 1},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "pendente"  # primeira fase do projeto começa liberada

    def test_criar_tarefa(self, client, admin_headers, fase_teste):
        r = client.post(
            "/api/tarefas/",
            json={"fase_id": fase_teste.id, "nome": "Fazer X"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "pendente"

    def test_concluir_tarefa_recalcula_progresso_da_fase(self, client, admin_headers, fase_teste, tarefa_teste, db_session):
        r = client.put(
            f"/api/tarefas/{tarefa_teste.id}",
            json={"status": "concluida"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "concluida"
        assert r.json()["percentual"] == 100.0

        db_session.expire_all()
        fase_atualizada = db_session.query(models.Fase).get(fase_teste.id)
        assert fase_atualizada.progresso == 100.0
        assert fase_atualizada.status == models.StatusFase.concluida

    def test_analista_nao_pode_concluir_tarefa_diretamente(self, client, analista_headers, analista_user, db_session, tarefa_teste):
        tarefa_teste.fase.projeto.cliente_id = analista_user.cliente_id
        db_session.commit()
        r = client.put(
            f"/api/tarefas/{tarefa_teste.id}",
            json={"status": "concluida"},
            headers=analista_headers,
        )
        assert r.status_code == 403

    def test_deletar_tarefa_requer_admin_ou_ger_projeto(self, client, consultor_headers, tarefa_teste):
        r = client.delete(f"/api/tarefas/{tarefa_teste.id}", headers=consultor_headers)
        assert r.status_code == 403

    def test_comentar_tarefa(self, client, admin_headers, tarefa_teste):
        r = client.post(
            f"/api/tarefas/{tarefa_teste.id}/comentarios",
            json={"tarefa_id": tarefa_teste.id, "texto": "Comentário de teste"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["texto"] == "Comentário de teste"

    def test_deletar_tarefa_e_soft_delete_preserva_historico(self, client, admin_headers, fase_teste, tarefa_teste, db_session):
        # gera histórico (log_tarefas) e um comentário antes de excluir
        client.put(f"/api/tarefas/{tarefa_teste.id}", json={"status": "em_andamento"}, headers=admin_headers)
        client.post(
            f"/api/tarefas/{tarefa_teste.id}/comentarios",
            json={"tarefa_id": tarefa_teste.id, "texto": "Comentário antes de excluir"},
            headers=admin_headers,
        )

        r = client.delete(f"/api/tarefas/{tarefa_teste.id}", headers=admin_headers)
        assert r.status_code == 200

        db_session.expire_all()
        atualizada = db_session.query(models.Tarefa).get(tarefa_teste.id)
        assert atualizada is not None  # registro continua no banco, só fica oculto
        assert atualizada.ativo is False

        assert db_session.query(models.LogTarefa).filter_by(tarefa_id=tarefa_teste.id).count() > 0
        assert db_session.query(models.Comentario).filter_by(tarefa_id=tarefa_teste.id).count() > 0

        r = client.get(f"/api/tarefas/fase/{fase_teste.id}", headers=admin_headers)
        assert tarefa_teste.id not in [t["id"] for t in r.json()]


# ── USUÁRIOS ─────────────────────────────────────────────────────────────

class TestUsuarios:
    def test_listar_requer_perfil_permitido(self, client, analista_headers):
        r = client.get("/api/usuarios/", headers=analista_headers)
        assert r.status_code == 403

    def test_listar_como_admin(self, client, admin_headers, admin_user):
        r = client.get("/api/usuarios/", headers=admin_headers)
        assert r.status_code == 200
        assert any(u["email"] == admin_user.email for u in r.json())

    def test_criar_usuario_admin(self, client, admin_headers):
        r = client.post(
            "/api/usuarios/",
            json={"nome": "Novo Usuário", "email": "novo@emals.com", "senha": "abc12345", "perfil": "consultor"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["email"] == "novo@emals.com"

    def test_criar_usuario_email_duplicado(self, client, admin_headers, admin_user):
        r = client.post(
            "/api/usuarios/",
            json={"nome": "Duplicado", "email": admin_user.email, "senha": "abc12345"},
            headers=admin_headers,
        )
        assert r.status_code == 400

    def test_criar_usuario_nao_admin_proibido(self, client, consultor_headers):
        r = client.post(
            "/api/usuarios/",
            json={"nome": "X", "email": "x@emals.com", "senha": "abc12345"},
            headers=consultor_headers,
        )
        assert r.status_code == 403

    def test_excluir_proprio_usuario_proibido(self, client, admin_headers, admin_user):
        r = client.delete(f"/api/usuarios/{admin_user.id}", headers=admin_headers)
        assert r.status_code == 400


# ── DASHBOARD ────────────────────────────────────────────────────────────

class TestDashboard:
    def test_resumo_requer_autenticacao(self, client):
        r = client.get("/api/dashboard/resumo")
        assert r.status_code == 401

    def test_resumo_vazio(self, client, admin_headers):
        r = client.get("/api/dashboard/resumo", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert body["total_projetos"] == 0
        assert body["tarefas_em_andamento"] == 0

    def test_resumo_conta_projetos_e_tarefas(self, client, admin_headers, projeto_teste, tarefa_teste):
        r = client.get("/api/dashboard/resumo", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["total_projetos"] == 1

    def test_executivo_restrito_a_admin_consultor(self, client, analista_headers):
        r = client.get("/api/dashboard/executivo", headers=analista_headers)
        assert r.status_code == 403

    def test_dashboard_cliente_analista_nao_acessa_outro_cliente(self, client, analista_headers, outro_cliente):
        r = client.get(f"/api/dashboard/cliente/{outro_cliente.id}", headers=analista_headers)
        assert r.status_code == 403


# ── ANOTAÇÕES E SUBTAREFAS ───────────────────────────────────────────────

class TestAnotacoes:
    def test_criar_e_listar(self, client, admin_headers, cliente_teste):
        r = client.post(
            f"/api/anotacoes/cliente/{cliente_teste.id}",
            json={"texto": "Nota importante", "data": "2026-06-15"},
            headers=admin_headers,
        )
        assert r.status_code == 201
        r2 = client.get(f"/api/anotacoes/cliente/{cliente_teste.id}", headers=admin_headers)
        assert r2.status_code == 200
        assert len(r2.json()) == 1

    def test_listar_cliente_inexistente(self, client, admin_headers):
        r = client.get("/api/anotacoes/cliente/9999", headers=admin_headers)
        assert r.status_code == 404


class TestSubtarefas:
    def test_criar_e_listar(self, client, admin_headers, tarefa_teste):
        r = client.post(
            "/api/subtarefas/",
            json={"tarefa_id": tarefa_teste.id, "nome": "Subtarefa 1"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        r2 = client.get(f"/api/subtarefas/tarefa/{tarefa_teste.id}", headers=admin_headers)
        assert r2.status_code == 200
        assert len(r2.json()) == 1

    def test_atualizar_status(self, client, admin_headers, tarefa_teste):
        criada = client.post(
            "/api/subtarefas/",
            json={"tarefa_id": tarefa_teste.id, "nome": "Subtarefa 2"},
            headers=admin_headers,
        ).json()
        r = client.put(
            f"/api/subtarefas/{criada['id']}",
            json={"status": "concluida"},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "concluida"
