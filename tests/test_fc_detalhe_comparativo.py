"""
Testes de regressão para GET /api/demonstrativos/fluxo-caixa/detalhe-comparativo.

Cobre o bug relatado: clicar na coluna TOTAL (grade "todos os meses") de uma
linha filha (conta analítica) chamava esse endpoint com modo="todos" e mes
ausente, e o backend só aceitava mes ausente no modo "acumulado" — o resto
caía num HTTPException 422 ("Erro ao carregar lançamentos." no frontend).
"""
import models


def _lancar(db, cliente_id, ano, mes, valor, agrupamento_slug="vendas_dinheiro", conta_origem="111102"):
    db.add(models.LancamentoFC(
        cliente_id=cliente_id, agrupamento_slug=agrupamento_slug,
        conta_origem=conta_origem, descricao="Caixa Tesouraria",
        ano=ano, mes=mes, valor=valor, fonte="extrato",
    ))
    db.commit()


def _seed_ano(db, cliente_id):
    # Jan a Mai/2026 com movimento; Jun-Dez sem lançamento (simula "ano em andamento").
    for mes, valor in [(1, 1000), (2, 1200), (3, 900), (4, 1100), (5, 800)]:
        _lancar(db, cliente_id, 2026, mes, valor)
    # Dezembro/2025 — período anterior de referência para o mês 1.
    _lancar(db, cliente_id, 2025, 12, 500)


class TestDetalheComparativo:
    def test_modo_mensal_continua_igual(self, client, admin_headers, db_session, cliente_teste):
        _seed_ano(db_session, cliente_teste.id)
        r = client.get(
            "/api/demonstrativos/fluxo-caixa/detalhe-comparativo",
            params={
                "cliente_id": cliente_teste.id, "ano": 2026, "mes": 3,
                "agrupamento_slug": "vendas_dinheiro", "modo": "mensal",
            },
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["periodo_atual"] == "Março/2026"
        assert data["atual"][0]["valor"] == 900
        # Anterior = mês imediatamente anterior (Fevereiro/2026).
        assert data["periodo_anterior"] == "Fevereiro/2026"
        assert data["anterior"][0]["valor"] == 1200

    def test_modo_acumulado_soma_meses(self, client, admin_headers, db_session, cliente_teste):
        _seed_ano(db_session, cliente_teste.id)
        r = client.get(
            "/api/demonstrativos/fluxo-caixa/detalhe-comparativo",
            params={
                "cliente_id": cliente_teste.id, "ano": 2026, "mes": 1, "mes_fim": 3,
                "agrupamento_slug": "vendas_dinheiro", "modo": "acumulado",
            },
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["atual"][0]["valor"] == 1000 + 1200 + 900
        assert data["periodo_atual"] == "Janeiro a Março/2026"

    def test_modo_todos_sem_mes_nao_quebra_mais(self, client, admin_headers, db_session, cliente_teste):
        """Caso do bug: clique na coluna TOTAL de uma linha filha — modo='todos', mes ausente."""
        _seed_ano(db_session, cliente_teste.id)
        r = client.get(
            "/api/demonstrativos/fluxo-caixa/detalhe-comparativo",
            params={
                "cliente_id": cliente_teste.id, "ano": 2026,
                "agrupamento_slug": "vendas_dinheiro", "modo": "todos",
            },
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        # Sem mes_fim informado, agrega o ano inteiro — meses sem lançamento somam 0,
        # então o total é idêntico à soma dos meses com movimento (Jan-Mai).
        assert data["atual"][0]["valor"] == 1000 + 1200 + 900 + 1100 + 800
        assert data["periodo_atual"] == "Janeiro a Dezembro/2026"

    def test_modo_todos_sem_mes_com_mes_fim_restringe_ao_intervalo(self, client, admin_headers, db_session, cliente_teste):
        """Caso usado pelo frontend: mes_fim = último mês com movimento (Jan-Mai)."""
        _seed_ano(db_session, cliente_teste.id)
        r = client.get(
            "/api/demonstrativos/fluxo-caixa/detalhe-comparativo",
            params={
                "cliente_id": cliente_teste.id, "ano": 2026, "mes_fim": 5,
                "agrupamento_slug": "vendas_dinheiro", "modo": "todos",
            },
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["atual"][0]["valor"] == 1000 + 1200 + 900 + 1100 + 800
        assert data["periodo_atual"] == "Janeiro a Maio/2026"

    def test_modo_todos_com_mes_continua_filtrando_por_mes(self, client, admin_headers, db_session, cliente_teste):
        """Clique numa coluna de mês específica (já funcionava antes) não pode regredir."""
        _seed_ano(db_session, cliente_teste.id)
        r = client.get(
            "/api/demonstrativos/fluxo-caixa/detalhe-comparativo",
            params={
                "cliente_id": cliente_teste.id, "ano": 2026, "mes": 2,
                "agrupamento_slug": "vendas_dinheiro", "modo": "todos",
            },
            headers=admin_headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["atual"][0]["valor"] == 1200
        assert data["periodo_atual"] == "Fevereiro/2026"

    def test_analista_de_outro_cliente_recebe_403(self, client, analista_headers, db_session, outro_cliente):
        """verificar_tenant continua em vigor no caminho corrigido."""
        _seed_ano(db_session, outro_cliente.id)
        r = client.get(
            "/api/demonstrativos/fluxo-caixa/detalhe-comparativo",
            params={
                "cliente_id": outro_cliente.id, "ano": 2026,
                "agrupamento_slug": "vendas_dinheiro", "modo": "todos",
            },
            headers=analista_headers,
        )
        assert r.status_code == 403
