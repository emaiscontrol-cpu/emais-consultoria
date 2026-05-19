"""
Script para popular o banco com dados iniciais.
Execute: python seed.py
"""
from database import SessionLocal, engine, Base
from auth import hash_senha
import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()

# ── USUÁRIOS ─────────────────────────────────────────
admin = models.Usuario(
    nome="Administrador E Mais",
    email="admin@emais.com.br",
    senha_hash=hash_senha("admin123"),
    perfil=models.PerfilEnum.admin
)
consultor = models.Usuario(
    nome="Consultor Principal",
    email="consultor@emais.com.br",
    senha_hash=hash_senha("consultor123"),
    perfil=models.PerfilEnum.consultor
)
db.add_all([admin, consultor])
db.commit()

# ── TIPOS DE CONSULTORIA ─────────────────────────────
fin = models.TipoConsultoria(nome="Consultoria Financeira", nivel=1)
db.add(fin); db.commit()

ctrl = models.TipoConsultoria(nome="Controles Financeiros", nivel=2, pai_id=fin.id)
db.add(ctrl); db.commit()

db.add_all([
    models.TipoConsultoria(nome="Contas a Pagar / Receber",                     nivel=3, pai_id=ctrl.id),
    models.TipoConsultoria(nome="Conciliações e Contratos Bancários",            nivel=3, pai_id=ctrl.id),
    models.TipoConsultoria(nome="Fechamentos de PDV e Tesouraria",               nivel=3, pai_id=ctrl.id),
    models.TipoConsultoria(nome="Controles de Caixa Central",                    nivel=3, pai_id=ctrl.id),
])

cont = models.TipoConsultoria(nome="Consultoria Contábil e Fiscal",   nivel=1)
esto = models.TipoConsultoria(nome="Consultoria de Controle de Estoques", nivel=1)
db.add_all([cont, esto]); db.commit()

# ── CLIENTE ──────────────────────────────────────────
rede_forte = models.Cliente(
    razao_social="Rede Forte Comércio Ltda",
    cnpj="12.345.678/0001-90",
    contato_nome="João da Silva",
    contato_email="joao@redeforte.com.br",
    contato_fone="(82) 99999-0001"
)
db.add(rede_forte); db.commit()

# Usuário cliente vinculado
cliente_user = models.Usuario(
    nome="João da Silva",
    email="joao@redeforte.com.br",
    senha_hash=hash_senha("cliente123"),
    perfil=models.PerfilEnum.cliente,
    cliente_id=rede_forte.id
)
db.add(cliente_user); db.commit()

# ── PROJETO ───────────────────────────────────────────
from datetime import datetime
projeto = models.Projeto(
    nome="Implantação de Sistema ERP",
    descricao="Projeto completo de implantação do sistema ERP na Rede Forte.",
    cliente_id=rede_forte.id,
    status=models.StatusProjeto.em_andamento,
    data_inicio=datetime(2026, 3, 1),
    data_fim_prev=datetime(2026, 6, 30),
)
db.add(projeto); db.commit()

# ── FASES ─────────────────────────────────────────────
fase1 = models.Fase(projeto_id=projeto.id, nome="Março — Cadastros e Plano Contábil",
    ordem=1, status=models.StatusFase.concluida, progresso=100.0,
    perc_desbloqueio=80.0,
    data_inicio=datetime(2026,3,1), data_fim_prev=datetime(2026,3,31))

fase2 = models.Fase(projeto_id=projeto.id, nome="Abril — Validação Documentos e Financeiro",
    ordem=2, status=models.StatusFase.em_andamento, progresso=48.0,
    perc_desbloqueio=80.0,
    data_inicio=datetime(2026,4,1), data_fim_prev=datetime(2026,4,30))

fase3 = models.Fase(projeto_id=projeto.id, nome="Maio — Validações e Treinamentos",
    ordem=3, status=models.StatusFase.bloqueada, progresso=0.0,
    perc_desbloqueio=100.0,
    data_inicio=datetime(2026,5,1), data_fim_prev=datetime(2026,5,31))

fase4 = models.Fase(projeto_id=projeto.id, nome="Junho — Importação e Go-Live",
    ordem=4, status=models.StatusFase.bloqueada, progresso=0.0,
    perc_desbloqueio=100.0,
    data_inicio=datetime(2026,6,1), data_fim_prev=datetime(2026,6,30))

db.add_all([fase1, fase2, fase3, fase4]); db.commit()

# ── TAREFAS fase 1 (concluídas) ───────────────────────
tarefas_f1 = [
    "Tabela do Plano e Cadastro", "Tabela de Documentos e Cadastros",
    "Tabela Plano Contábil", "Validação Plano Gerencial/Contábil",
    "Vinculação — Plano Gerencial", "Vinculação — Plano Contábil",
    "Vinculação de Históricos", "Ativar Comportamentos em Contas",
    "Impressos Plano de Contas", "Revisão DOCUMENTOS"
]
for i, nome in enumerate(tarefas_f1, 1):
    db.add(models.Tarefa(
        fase_id=fase1.id, nome=nome, ordem=i,
        responsavel_id=consultor.id,
        status=models.StatusTarefa.concluida, percentual=100.0,
        requer_validacao=False,
        data_conclusao=datetime(2026,3,28)
    ))

# ── TAREFAS fase 2 (em andamento) ────────────────────
tarefas_f2 = [
    ("Validação FFR (Cód. Fechamento PDV)",      True,  "concluida"),
    ("Validação Documentos FDE",                 True,  "concluida"),
    ("Validação Documentos FEB; FEC; FTC",       False, "concluida"),
    ("Validação Demais Documentos Financeiros",  False, "concluida"),
    ("Validação Documentos EAQ",                 False, "pendente"),
    ("Validação Documentos EBR",                 False, "pendente"),
    ("Configuração de Centros de Custos",        True,  "atrasada"),
    ("Contabilização CONTBNAFT",                 False, "em_andamento"),
    ("Cadastros de Espécies",                    False, "concluida"),
    ("Cadastros Financeiros",                    True,  "concluida"),
    ("Vinculação de Espécies",                   False, "pendente"),
    ("Config. Geradores Relatórios SQL",         True,  "em_andamento"),
]
for i, (nome, req_val, st) in enumerate(tarefas_f2, 1):
    db.add(models.Tarefa(
        fase_id=fase2.id, nome=nome, ordem=i,
        responsavel_id=consultor.id,
        status=getattr(models.StatusTarefa, st),
        percentual=100.0 if st == "concluida" else 30.0 if st == "em_andamento" else 0.0,
        requer_validacao=req_val
    ))

db.commit()
projeto.progresso = 37.0
db.commit()

print("✅ Banco populado com sucesso!")
print("\nUsuários criados:")
print("  admin@emais.com.br       → senha: admin123      (Administrador)")
print("  consultor@emais.com.br   → senha: consultor123  (Consultor)")
print("  joao@redeforte.com.br    → senha: cliente123    (Cliente — Rede Forte)")

db.close()
