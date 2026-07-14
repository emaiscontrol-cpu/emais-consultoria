"""
Testes do Preparo DE-PARA (Fase B — Projeto Referencial): normalização de texto,
classificação em 3 camadas (auto_vinculada/ambigua/sem_match), tratativa "incluir
nova conta" e isolamento multi-tenant. Ver documentos/PROJETO_REFERENCIAL.md.
"""
import models
import depara_service


def _plano(db):
    plano = models.PlanoReferencial(nome="Plano Teste Fase B")
    db.add(plano); db.commit(); db.refresh(plano)
    return plano


def _conta_ref(db, plano, codigo, descricao, pai_id=None, tipo="analitica"):
    cr = models.ContaReferencial(
        plano_id=plano.id, codigo=codigo, descricao=descricao, tipo=tipo, pai_id=pai_id,
    )
    db.add(cr); db.commit(); db.refresh(cr)
    return cr


def _conta_cliente(db, cliente_id, codigo_origem, descricao_origem):
    cc = models.ContaClienteRef(
        cliente_id=cliente_id, codigo_origem=codigo_origem, descricao_origem=descricao_origem,
    )
    db.add(cc); db.commit(); db.refresh(cc)
    return cc


class TestNormalizacao:
    def test_normalizar_texto_ignora_acento_e_caixa(self):
        assert depara_service.normalizar_texto("Água") == depara_service.normalizar_texto("agua")
        assert depara_service.normalizar_texto("MERCADORIAS") == depara_service.normalizar_texto("mercadorias")
        assert depara_service.normalizar_texto("  Vendas à Vista  ") == "vendas a vista"

    def test_match_forte_ignora_acento_na_classificacao(self, db_session, cliente_teste):
        plano = _plano(db_session)
        _conta_ref(db_session, plano, "1.01", "Vendas à Vista")
        cc = _conta_cliente(db_session, cliente_teste.id, "COD1", "VENDAS A VISTA")

        resultado = depara_service.classificar(db_session, cc)
        assert resultado["situacao"] == "auto_vinculada"
        assert resultado["candidatos"][0]["confianca"] >= 0.80


class TestSemMatch:
    def test_conta_sem_match_nao_cria_vinculo_automatico(self, db_session, cliente_teste):
        plano = _plano(db_session)
        _conta_ref(db_session, plano, "1.01", "Vendas à Vista")
        _conta_ref(db_session, plano, "1.02", "Custo das Mercadorias Vendidas")
        cc = _conta_cliente(db_session, cliente_teste.id, "COD_X", "Xyzptlk Abracadabra Zzzz Qwfp")

        resultado = depara_service.classificar(db_session, cc)
        assert resultado["situacao"] == "sem_match"

        # nenhum De-Para deve existir para essa conta — classificar() é read-only
        vinculos = db_session.query(models.DeParaRef).filter(
            models.DeParaRef.conta_cliente_id == cc.id
        ).count()
        assert vinculos == 0


class TestAmbigua:
    def test_dois_candidatos_identicos_sem_pai_ficam_ambiguos(self, db_session, cliente_teste):
        plano = _plano(db_session)
        cr1 = _conta_ref(db_session, plano, "4.01", "Despesas com Pessoal")
        cr2 = _conta_ref(db_session, plano, "4.02", "Despesas com Pessoal")
        cc = _conta_cliente(db_session, cliente_teste.id, "COD_AMB", "Despesas com Pessoal")

        resultado = depara_service.classificar(db_session, cc)
        assert resultado["situacao"] == "ambigua"
        ids = {c["conta_referencial_id"] for c in resultado["candidatos"]}
        assert cr1.id in ids and cr2.id in ids

    def test_desambiguacao_por_grupo_resolve_automaticamente(self, db_session, cliente_teste):
        plano = _plano(db_session)
        pai_padaria = _conta_ref(db_session, plano, "1", "Padaria", tipo="sintetica")
        pai_acougue = _conta_ref(db_session, plano, "2", "Açougue", tipo="sintetica")
        _conta_ref(db_session, plano, "1.01", "Despesas com Pessoal", pai_id=pai_padaria.id)
        _conta_ref(db_session, plano, "2.01", "Despesas com Pessoal", pai_id=pai_acougue.id)

        cc = _conta_cliente(db_session, cliente_teste.id, "COD_PAD", "Despesas com Pessoal Padaria")

        resultado = depara_service.classificar(db_session, cc)
        assert resultado["situacao"] == "auto_vinculada"
        assert resultado.get("resolvido_por") == "grupo"


class TestFluxoPreparoEndToEnd:
    def test_preparar_classifica_e_progresso_conta_resolvidas(self, client, admin_headers, db_session, cliente_teste):
        plano = _plano(db_session)
        _conta_ref(db_session, plano, "1.01", "Vendas à Vista")

        r = client.post(
            f"/api/ref/depara/cliente/{cliente_teste.id}/plano-de-contas",
            json={"contas": [
                {"codigo_origem": "COD1", "descricao_origem": "Vendas a Vista"},
                {"codigo_origem": "COD2", "descricao_origem": "Xyzptlk Abracadabra Zzzz"},
            ]},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["criadas"] == 2

        # idempotente — reenviar não duplica
        r2 = client.post(
            f"/api/ref/depara/cliente/{cliente_teste.id}/plano-de-contas",
            json={"contas": [{"codigo_origem": "COD1", "descricao_origem": "Vendas a Vista"}]},
            headers=admin_headers,
        )
        assert r2.json()["criadas"] == 0

        r3 = client.post(f"/api/ref/depara/cliente/{cliente_teste.id}/preparar", headers=admin_headers)
        assert r3.status_code == 200
        body = r3.json()
        assert body["total"] == 2
        assert body["resolvidas"] == 0
        assert len(body["auto_vinculadas"]) == 1
        assert len(body["sem_match"]) == 1

    def test_tratativa_incluir_nova_conta_cria_e_vincula(self, client, admin_headers, db_session, cliente_teste):
        plano = _plano(db_session)
        cc = _conta_cliente(db_session, cliente_teste.id, "COD_NOVA", "Conta Totalmente Nova Sem Par")

        # 1. Incluir nova conta no PR (reusa o endpoint de "Nova Conta" existente)
        r_conta = client.post(
            f"/api/ref/plano/{plano.id}/contas",
            json={"codigo": "9.99", "descricao": "Conta Totalmente Nova Sem Par", "tipo": "analitica"},
            headers=admin_headers,
        )
        assert r_conta.status_code == 200
        nova_conta_id = r_conta.json()["id"]

        # 2. Vincular (reaproveita /confirmar)
        r_confirmar = client.post(
            "/api/ref/depara/confirmar",
            json={
                "conta_cliente_id": cc.id,
                "itens": [{"conta_referencial_id": nova_conta_id, "percentual": 100.0}],
                "vigente_a_partir_ano": 2026,
                "vigente_a_partir_mes": 1,
            },
            headers=admin_headers,
        )
        assert r_confirmar.status_code == 200

        dp = db_session.query(models.DeParaRef).filter(
            models.DeParaRef.conta_cliente_id == cc.id
        ).first()
        assert dp is not None
        assert dp.conta_referencial_id == nova_conta_id
        assert dp.status == "confirmado"
        assert dp.origem_vinculo == "manual"

    def test_ignorar_conta_remove_do_preparo(self, client, admin_headers, db_session, cliente_teste):
        plano = _plano(db_session)
        cc = _conta_cliente(db_session, cliente_teste.id, "COD_IGN", "Conta Sem Par Nenhum Xyz")

        r = client.put(
            f"/api/ref/depara/contas-cliente/{cc.id}/ignorar",
            json={"ignorar": True},
            headers=admin_headers,
        )
        assert r.status_code == 200
        assert r.json()["ignorada"] is True

        r_preparo = client.post(f"/api/ref/depara/cliente/{cliente_teste.id}/preparar", headers=admin_headers)
        body = r_preparo.json()
        assert body["total"] == 1
        assert body["resolvidas"] == 1
        assert len(body["sem_match"]) == 0
        assert len(body["ambiguas"]) == 0
        assert len(body["auto_vinculadas"]) == 0


class TestTenantIsolado:
    def test_analista_de_outro_cliente_recebe_403_no_preparo(self, client, analista_headers, outro_cliente):
        r = client.post(f"/api/ref/depara/cliente/{outro_cliente.id}/preparar", headers=analista_headers)
        assert r.status_code == 403

    def test_analista_de_outro_cliente_recebe_403_ao_listar_por_cliente(self, client, analista_headers, outro_cliente):
        r = client.get(f"/api/ref/depara/cliente/{outro_cliente.id}", headers=analista_headers)
        assert r.status_code == 403

    def test_analista_do_proprio_cliente_acessa_normalmente(self, client, analista_headers, cliente_teste):
        r = client.get(f"/api/ref/depara/cliente/{cliente_teste.id}", headers=analista_headers)
        assert r.status_code == 200
