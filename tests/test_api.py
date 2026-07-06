"""
Testes de integração dos endpoints críticos do FastAPI.

Cobre os fluxos usados pelo frontend (frontend/src/services/api.js):
auth, clientes, projetos, fases, tarefas, usuários, dashboard, anotações
e subtarefas. Roda inteiramente contra o banco SQLite isolado de
tests/conftest.py — nunca toca no Supabase de produção.
"""
import pytest
from sqlalchemy import text

import models


# ── AUTH ─────────────────────────────────────────────────────────────────

class TestAuth:
    def test_login_sucesso_interno(self, client, db_session, admin_user):
        admin_user.codigo_acesso = "001"
        db_session.commit()
        r = client.post("/api/auth/login", json={"codigo": "001", "senha": "senha123", "is_interno": True})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert body["usuario"]["email"] == admin_user.email

    def test_login_sucesso_cliente(self, client, db_session, analista_user, cliente_teste):
        analista_user.codigo_acesso = "002"
        db_session.commit()
        r = client.post("/api/auth/login", json={"codigo": "002", "senha": "senha123", "cliente_id": cliente_teste.id})
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert body["usuario"]["email"] == analista_user.email

    def test_login_codigos_iguais_clientes_diferentes(self, client, db_session, analista_user, cliente_teste, outro_cliente):
        from auth import hash_senha
        outro_analista = models.Usuario(
            nome="Outro Analista",
            email="outro@emals.com",
            senha_hash=hash_senha("senha123"),
            perfil=models.PerfilEnum.analista,
            cliente_id=outro_cliente.id,
            codigo_acesso="999"
        )
        analista_user.codigo_acesso = "999"
        db_session.add(outro_analista)
        db_session.commit()

        r1 = client.post("/api/auth/login", json={"codigo": "999", "senha": "senha123", "cliente_id": cliente_teste.id})
        assert r1.status_code == 200
        assert r1.json()["usuario"]["id"] == analista_user.id

        r2 = client.post("/api/auth/login", json={"codigo": "999", "senha": "senha123", "cliente_id": outro_cliente.id})
        assert r2.status_code == 200
        assert r2.json()["usuario"]["id"] == outro_analista.id

    def test_login_senha_errada(self, client, db_session, admin_user):
        admin_user.codigo_acesso = "001"
        db_session.commit()
        r = client.post("/api/auth/login", json={"codigo": "001", "senha": "errada", "is_interno": True})
        assert r.status_code == 401

    def test_login_codigo_inexistente(self, client):
        r = client.post("/api/auth/login", json={"codigo": "999", "senha": "x", "is_interno": True})
        assert r.status_code == 401

    def test_login_sem_selecionar_empresa(self, client):
        r = client.post("/api/auth/login", json={"codigo": "123", "senha": "x"})
        assert r.status_code == 400

    def test_login_usuario_inativo(self, client, db_session, usuario_inativo):
        usuario_inativo.codigo_acesso = "003"
        db_session.commit()
        r = client.post("/api/auth/login", json={"codigo": "003", "senha": "senha123", "is_interno": True})
        assert r.status_code == 403

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

    def test_admin_nao_pode_alterar_proprio_perfil(self, client, admin_headers, admin_user):
        r = client.put(f"/api/usuarios/{admin_user.id}", json={"perfil": "consultor"}, headers=admin_headers)
        assert r.status_code == 400

    def test_admin_pode_alterar_outro_campo_de_si_mesmo(self, client, admin_headers, admin_user):
        r = client.put(f"/api/usuarios/{admin_user.id}", json={"nome": "Renomeado"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["nome"] == "Renomeado"

    def test_pode_rebaixar_admin_quando_ha_outro_admin_ativo(self, client, outro_admin_headers, admin_user):
        r = client.put(f"/api/usuarios/{admin_user.id}", json={"perfil": "consultor"}, headers=outro_admin_headers)
        assert r.status_code == 200
        assert r.json()["perfil"] == "consultor"

    def test_nao_pode_rebaixar_unico_admin_ativo(self, db_session, admin_user, outro_admin):
        # Via HTTP isso é inalcançável (o ator precisaria ser um admin ativo
        # diferente do alvo, o que já elevaria a contagem para >= 2), então o
        # guard é exercitado chamando o router diretamente, com o ator
        # simulado como um admin já inativo.
        import schemas
        from fastapi import HTTPException
        from routers.usuarios import atualizar

        outro_admin.ativo = False
        db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            atualizar(admin_user.id, schemas.UsuarioUpdate(perfil="consultor"),
                      db=db_session, atual=outro_admin, _=None)
        assert exc_info.value.status_code == 400
        assert "único administrador" in exc_info.value.detail


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


# ── EXPORTAÇÃO PDF (genérica, reutilizável por qualquer demonstrativo) ──────

class TestPdf:
    def test_gerar_demonstrativo_pdf(self, client, admin_headers):
        payload = {
            "titulo": "Fluxo de Caixa Executivo",
            "cliente_nome": "Rio das Pedras",
            "periodo": "Janeiro/2026",
            "colunas": ["Realizado", "% Vendas"],
            "linhas": [
                {"rotulo": "ENTRADAS", "tipo": "titulo", "valores": []},
                {"rotulo": "Vendas - Dinheiro", "tipo": "agrupamento", "valores": [4546013, 18.2]},
                {"rotulo": "Vendas - Cartão", "tipo": "agrupamento", "valores": [-12000, -0.5]},
                {"rotulo": "Vendas - Totais", "tipo": "totalizador", "valores": [25031110, 100.0]},
            ],
        }
        r = client.post("/api/pdf/demonstrativo", json=payload, headers=admin_headers)
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert "attachment" in r.headers["content-disposition"]
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 500

    def test_gerar_pdf_requer_autenticacao(self, client):
        r = client.post("/api/pdf/demonstrativo", json={
            "titulo": "X", "cliente_nome": "Y", "periodo": "Z", "colunas": [], "linhas": [],
        })
        assert r.status_code == 401


# ── ORÇAMENTO REFERENCIAL ──────────────────────────────────────────────────

class TestOrcamentoReferencial:
    def test_obter_orcamento_vazio(self, client, admin_headers, cliente_teste):
        r = client.get(f"/api/orcamento/cliente/{cliente_teste.id}/ano/2026", headers=admin_headers)
        assert r.status_code == 200
        assert r.json() == []

    def test_importar_e_obter_orcamento(self, client, admin_headers, cliente_teste):
        import io
        import openpyxl

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "CLAUDE"
        
        # Headers
        ws.append(["", "", ""])
        ws.append(["", "", "CONTA", "Janeiro", "", "", "", "", "Fevereiro", "", "", "", "", "Março", "", "", "", "", "Abril", "", "", "", "", "Maio", "", "", "", "", "Junho", "", "", "", "", "Julho", "", "", "", "", "Agosto", "", "", "", "", "Setembro", "", "", "", "", "Outubro", "", "", "", "", "Novembro", "", "", "", "", "Dezembro"])
        ws.append(["", "", "Receita", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF", "✅REALIZADO", "📐%REA", "🎯ORÇADO", "📊%ORC", "↔️DIF"])
        
        # Data row
        row = ["Vda_Din", "", "Vendas - Dinheiro"]
        for m in range(12):
            row.extend([1000.0, 1.0, 1200.0, 1.0, -200.0])
        ws.append(row)

        file_bytes = io.BytesIO()
        wb.save(file_bytes)
        file_bytes.seek(0)

        # Upload
        files = {"file": ("orçamento.xlsx", file_bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = client.post(f"/api/orcamento/cliente/{cliente_teste.id}/ano/2026/importar?versao=Original", files=files, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["success"] is True
        assert r.json()["registros_inseridos"] == 12

        # Check obtido
        r_get = client.get(f"/api/orcamento/cliente/{cliente_teste.id}/ano/2026?versao=Original", headers=admin_headers)
        assert r_get.status_code == 200
        body = r_get.json()
        assert len(body) == 1
        assert body[0]["agrupamento_slug"] == "Vda_Din"
        assert body[0]["valores_mensais"] == [1200.0] * 12

    def test_comparativo_real_vs_orcado(self, client, admin_headers, cliente_teste, db_session):
        # Create template reference and template line to compute comparative successfully
        import models
        template = models.TemplateRef(tipo="fluxo_caixa", nome="FC Teste", ativo=True)
        db_session.add(template)
        db_session.commit()
        db_session.refresh(template)

        t_line = models.TemplateLinhaRef(
            template_id=template.id,
            rotulo="Vendas - Dinheiro",
            ordem=4,
            tipo="agrupamento",
            agrupamento_slug="Vda_Din"
        )
        db_session.add(t_line)
        
        # Add budget value
        for m in range(1, 13):
            db_session.add(models.FCOrcamento(
                cliente_id=cliente_teste.id,
                agrupamento_slug="Vda_Din",
                ano=2026,
                mes=m,
                valor=1000.0,
                versao="Original"
            ))
            # Add realized value
            db_session.add(models.LancamentoFC(
                cliente_id=cliente_teste.id,
                agrupamento_slug="Vda_Din",
                ano=2026,
                mes=m,
                valor=1100.0,
                fonte="extrato"
            ))
        db_session.commit()

        r = client.get(f"/api/orcamento/cliente/{cliente_teste.id}/comparativo?ano=2026&versao=Original", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 1
        assert body[0]["rotulo"] == "Vendas - Dinheiro"
        assert body[0]["realizado"]["1"] == 1100.0
        assert body[0]["orcado"]["1"] == 1000.0

    def test_obter_orcamento_editavel(self, client, admin_headers, cliente_teste, db_session):
        import models
        db_session.execute(text("DELETE FROM ref_template_linhas"))
        db_session.execute(text("DELETE FROM ref_templates"))
        db_session.commit()

        template = models.TemplateRef(tipo="fluxo_caixa", nome="FC Teste", ativo=True)
        db_session.add(template)
        db_session.commit()
        db_session.refresh(template)

        t_line = models.TemplateLinhaRef(
            template_id=template.id,
            rotulo="Vendas - Dinheiro",
            ordem=4,
            tipo="agrupamento",
            agrupamento_slug="Vda_Din"
        )
        db_session.add(t_line)

        db_session.add(models.FCOrcamento(
            cliente_id=cliente_teste.id,
            agrupamento_slug="Vda_Din",
            ano=2026,
            mes=1,
            valor=1000.0,
            versao="Original"
        ))
        db_session.add(models.LancamentoFC(
            cliente_id=cliente_teste.id,
            agrupamento_slug="Vda_Din",
            ano=2025,
            mes=1,
            valor=900.0,
            fonte="extrato"
        ))
        db_session.commit()

        r = client.get(f"/api/orcamento/cliente/{cliente_teste.id}/ano/2026/editavel?versao=Original", headers=admin_headers)
        assert r.status_code == 200
        body = r.json()
        assert len(body) == 1
        assert body[0]["rotulo"] == "Vendas - Dinheiro"
        assert body[0]["valores"]["1"] == 1000.0
        assert body[0]["realizado_ano_anterior"]["1"] == 900.0

    def test_upsert_orcamento_sucesso_e_auditoria(self, client, admin_headers, cliente_teste, db_session):
        import models
        db_session.execute(text("DELETE FROM log_atividades"))
        db_session.commit()

        r = client.put(
            f"/api/orcamento/cliente/{cliente_teste.id}/ano/2026/mes/3/conta/Vda_Din",
            json={"valor": 1500.0, "versao": "Original"},
            headers=admin_headers
        )
        assert r.status_code == 200
        assert r.json()["success"] is True

        item = db_session.query(models.FCOrcamento).filter(
            models.FCOrcamento.cliente_id == cliente_teste.id,
            models.FCOrcamento.agrupamento_slug == "Vda_Din",
            models.FCOrcamento.ano == 2026,
            models.FCOrcamento.mes == 3,
            models.FCOrcamento.versao == "Original"
        ).first()
        assert item is not None
        assert item.valor == 1500.0

        log_entry = db_session.query(models.LogAtividade).filter(
            models.LogAtividade.acao == "orcamento_editado"
        ).first()
        assert log_entry is not None
        assert "de R$ 0.00 para R$ 1,500.00" in log_entry.descricao

    def test_editar_orcamento_restricao_tenant(self, client, analista_headers, cliente_teste):
        outro_id = cliente_teste.id + 1
        r = client.put(
            f"/api/orcamento/cliente/{outro_id}/ano/2026/mes/3/conta/Vda_Din",
            json={"valor": 1500.0, "versao": "Original"},
            headers=analista_headers
        )
        assert r.status_code == 403


