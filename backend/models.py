from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class PerfilEnum(str, enum.Enum):
    admin        = "admin"
    consultor    = "consultor"
    ger_projeto  = "ger_projeto"
    cliente      = "cliente"
    ti           = "ti"

class StatusTarefa(str, enum.Enum):
    pendente     = "pendente"
    em_andamento = "em_andamento"
    aguard_valid = "aguard_validacao"
    concluida    = "concluida"
    atrasada     = "atrasada"

class StatusSubtarefa(str, enum.Enum):
    a_fazer   = "a_fazer"
    pendente  = "pendente"
    concluida = "concluida"

class StatusFase(str, enum.Enum):
    bloqueada    = "bloqueada"
    pendente     = "pendente"
    em_andamento = "em_andamento"
    concluida    = "concluida"

class StatusProjeto(str, enum.Enum):
    planejamento = "planejamento"
    em_andamento = "em_andamento"
    pausado      = "pausado"
    concluido    = "concluido"
    atrasado     = "atrasado"


class Usuario(Base):
    __tablename__ = "usuarios"
    id            = Column(Integer, primary_key=True, index=True)
    nome          = Column(String(120), nullable=False)
    email         = Column(String(120), unique=True, index=True, nullable=False)
    senha_hash    = Column(String(256), nullable=False)
    perfil        = Column(Enum(PerfilEnum), default=PerfilEnum.consultor)
    ativo         = Column(Boolean, default=True)
    criado_em     = Column(DateTime(timezone=True), server_default=func.now())
    # se for cliente, vincula a um cliente
    cliente_id    = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    cliente       = relationship("Cliente", back_populates="usuarios", foreign_keys=[cliente_id])
    tarefas       = relationship("Tarefa", back_populates="responsavel")
    comentarios   = relationship("Comentario", back_populates="autor")


class Cliente(Base):
    __tablename__ = "clientes"
    id            = Column(Integer, primary_key=True, index=True)
    razao_social  = Column(String(200), nullable=False)
    cnpj          = Column(String(20), unique=True, nullable=True)
    contato_nome  = Column(String(120), nullable=True)
    contato_email = Column(String(120), nullable=True)
    contato_fone  = Column(String(30), nullable=True)
    ativo         = Column(Boolean, default=True)
    criado_em     = Column(DateTime(timezone=True), server_default=func.now())
    projetos      = relationship("Projeto", back_populates="cliente")
    usuarios      = relationship("Usuario", back_populates="cliente", foreign_keys=[Usuario.cliente_id])


class TipoConsultoria(Base):
    """Hierarquia: Área > Módulo > Especialidade"""
    __tablename__ = "tipos_consultoria"
    id            = Column(Integer, primary_key=True, index=True)
    nome          = Column(String(200), nullable=False)
    descricao     = Column(Text, nullable=True)
    nivel         = Column(Integer, default=1)   # 1=Área, 2=Módulo, 3=Especialidade
    pai_id        = Column(Integer, ForeignKey("tipos_consultoria.id"), nullable=True)
    filhos        = relationship("TipoConsultoria", back_populates="pai")
    pai           = relationship("TipoConsultoria", back_populates="filhos", remote_side=[id])
    projetos      = relationship("Projeto", back_populates="tipo_consultoria")


class Projeto(Base):
    __tablename__ = "projetos"
    id              = Column(Integer, primary_key=True, index=True)
    nome            = Column(String(200), nullable=False)
    descricao       = Column(Text, nullable=True)
    cliente_id      = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    tipo_id         = Column(Integer, ForeignKey("tipos_consultoria.id"), nullable=True)
    status          = Column(Enum(StatusProjeto), default=StatusProjeto.planejamento)
    progresso       = Column(Float, default=0.0)   # 0-100
    data_inicio     = Column(DateTime(timezone=True), nullable=True)
    data_fim_prev   = Column(DateTime(timezone=True), nullable=True)
    data_fim_real   = Column(DateTime(timezone=True), nullable=True)
    criado_em       = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em   = Column(DateTime(timezone=True), onupdate=func.now())
    cliente         = relationship("Cliente", back_populates="projetos")
    tipo_consultoria= relationship("TipoConsultoria", back_populates="projetos")
    fases           = relationship("Fase", back_populates="projeto", order_by="Fase.ordem")


class Fase(Base):
    __tablename__ = "fases"
    id                    = Column(Integer, primary_key=True, index=True)
    projeto_id            = Column(Integer, ForeignKey("projetos.id"), nullable=False)
    nome                  = Column(String(200), nullable=False)
    descricao             = Column(Text, nullable=True)
    ordem                 = Column(Integer, nullable=False)
    status                = Column(Enum(StatusFase), default=StatusFase.bloqueada)
    progresso             = Column(Float, default=0.0)
    perc_desbloqueio      = Column(Float, default=80.0)  # % mínima para desbloquear a próxima
    bloqueado_por_anterior= Column(Boolean, default=True)  # False = fase sempre acessível
    data_inicio           = Column(DateTime(timezone=True), nullable=True)
    data_fim_prev         = Column(DateTime(timezone=True), nullable=True)
    data_fim_real         = Column(DateTime(timezone=True), nullable=True)
    projeto               = relationship("Projeto", back_populates="fases")
    tarefas               = relationship("Tarefa", back_populates="fase", order_by="Tarefa.ordem")
    comentarios_fase      = relationship("ComentarioFase", back_populates="fase", order_by="ComentarioFase.criado_em")


class Tarefa(Base):
    __tablename__ = "tarefas"
    id                  = Column(Integer, primary_key=True, index=True)
    fase_id             = Column(Integer, ForeignKey("fases.id"), nullable=False)
    nome                = Column(String(300), nullable=False)
    descricao           = Column(Text, nullable=True)
    ordem               = Column(Integer, nullable=False, default=0)
    responsavel_id      = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    status              = Column(Enum(StatusTarefa), default=StatusTarefa.pendente)
    percentual          = Column(Float, default=0.0)
    requer_validacao    = Column(Boolean, default=False)  # cliente confirma → consultor valida
    data_prazo          = Column(DateTime(timezone=True), nullable=True)
    data_inicio         = Column(DateTime(timezone=True), nullable=True)
    data_conclusao      = Column(DateTime(timezone=True), nullable=True)
    confirmado_cliente  = Column(Boolean, default=False)
    criado_em           = Column(DateTime(timezone=True), server_default=func.now())
    atualizado_em       = Column(DateTime(timezone=True), onupdate=func.now())
    ativo               = Column(Boolean, nullable=False, default=True, server_default='1')
    fase                = relationship("Fase", back_populates="tarefas")
    responsavel         = relationship("Usuario", back_populates="tarefas")
    comentarios         = relationship("Comentario", back_populates="tarefa")
    subtarefas          = relationship("Subtarefa", back_populates="tarefa", order_by="Subtarefa.ordem")
    responsaveis        = relationship("ResponsavelTarefa", back_populates="tarefa", order_by="ResponsavelTarefa.id")


class ResponsavelTarefa(Base):
    __tablename__ = "responsaveis_tarefa"
    id        = Column(Integer, primary_key=True, index=True)
    tarefa_id = Column(Integer, ForeignKey("tarefas.id"), nullable=False)
    nome      = Column(String(200), nullable=False)
    funcao    = Column(String(200), nullable=True)
    email     = Column(String(200), nullable=True)
    telefone  = Column(String(50), nullable=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    tarefa    = relationship("Tarefa", back_populates="responsaveis")


class Subtarefa(Base):
    __tablename__ = "subtarefas"
    id             = Column(Integer, primary_key=True, index=True)
    tarefa_id      = Column(Integer, ForeignKey("tarefas.id"), nullable=False)
    nome           = Column(String(300), nullable=False)
    status         = Column(Enum(StatusSubtarefa), default=StatusSubtarefa.a_fazer)
    data_prazo     = Column(DateTime(timezone=True), nullable=True)
    data_inicio    = Column(DateTime(timezone=True), nullable=True)
    data_fim       = Column(DateTime(timezone=True), nullable=True)
    responsavel_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    ordem          = Column(Integer, default=0)
    criado_em      = Column(DateTime(timezone=True), server_default=func.now())
    tarefa         = relationship("Tarefa", back_populates="subtarefas")
    responsavel    = relationship("Usuario", foreign_keys=[responsavel_id])


class Comentario(Base):
    __tablename__ = "comentarios"
    id          = Column(Integer, primary_key=True, index=True)
    tarefa_id   = Column(Integer, ForeignKey("tarefas.id"), nullable=False)
    autor_id    = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    texto       = Column(Text, nullable=False)
    criado_em   = Column(DateTime(timezone=True), server_default=func.now())
    tarefa      = relationship("Tarefa", back_populates="comentarios")
    autor       = relationship("Usuario", back_populates="comentarios")


class ComentarioFase(Base):
    __tablename__ = "comentarios_fase"
    id          = Column(Integer, primary_key=True, index=True)
    fase_id     = Column(Integer, ForeignKey("fases.id"), nullable=False)
    autor_id    = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    texto       = Column(Text, nullable=False)
    criado_em   = Column(DateTime(timezone=True), server_default=func.now())
    fase        = relationship("Fase", back_populates="comentarios_fase")
    autor       = relationship("Usuario")


class ModeloProjeto(Base):
    """Templates reutilizáveis de fases+tarefas por tipo de consultoria"""
    __tablename__ = "modelos_projeto"
    id          = Column(Integer, primary_key=True, index=True)
    nome        = Column(String(200), nullable=False)
    tipo_id     = Column(Integer, ForeignKey("tipos_consultoria.id"), nullable=True)
    descricao   = Column(Text, nullable=True)
    fases       = relationship("ModeloFase", back_populates="modelo", order_by="ModeloFase.ordem")


class ModeloFase(Base):
    __tablename__ = "modelos_fases"
    id               = Column(Integer, primary_key=True, index=True)
    modelo_id        = Column(Integer, ForeignKey("modelos_projeto.id"), nullable=False)
    nome             = Column(String(200), nullable=False)
    ordem            = Column(Integer, nullable=False)
    perc_desbloqueio = Column(Float, default=80.0)
    duracao_dias     = Column(Integer, nullable=True)
    modelo           = relationship("ModeloProjeto", back_populates="fases")
    tarefas          = relationship("ModeloTarefa", back_populates="fase", order_by="ModeloTarefa.ordem")


class LogAtividade(Base):
    __tablename__ = "log_atividades"
    id          = Column(Integer, primary_key=True, index=True)
    usuario_id  = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    projeto_id  = Column(Integer, ForeignKey("projetos.id"), nullable=True)
    acao        = Column(String(100), nullable=False)
    descricao   = Column(Text, nullable=False)
    criado_em   = Column(DateTime(timezone=True), server_default=func.now())
    usuario     = relationship("Usuario")
    projeto     = relationship("Projeto")


class ModeloTarefa(Base):
    __tablename__ = "modelos_tarefas"
    id               = Column(Integer, primary_key=True, index=True)
    fase_id          = Column(Integer, ForeignKey("modelos_fases.id"), nullable=False)
    nome             = Column(String(300), nullable=False)
    descricao        = Column(Text, nullable=True)
    ordem            = Column(Integer, nullable=False, default=0)
    requer_validacao = Column(Boolean, default=False)
    duracao_dias     = Column(Integer, nullable=True)
    fase             = relationship("ModeloFase", back_populates="tarefas")


# ─── MÓDULO CONTROLADORIA ────────────────────────────────────────────────────

class CategoriaFinanceira(Base):
    __tablename__ = "categorias_financeiras"
    id        = Column(Integer, primary_key=True, index=True)
    nome      = Column(String(200), nullable=False)
    tipo      = Column(String(20), nullable=False)   # 'receita' | 'despesa'
    pai_id    = Column(Integer, ForeignKey("categorias_financeiras.id"), nullable=True)
    ativo     = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    pai       = relationship("CategoriaFinanceira", remote_side="CategoriaFinanceira.id", back_populates="filhos")
    filhos    = relationship("CategoriaFinanceira", back_populates="pai")
    lancamentos = relationship("Lancamento", back_populates="categoria")


class Lancamento(Base):
    __tablename__ = "lancamentos"
    id           = Column(Integer, primary_key=True, index=True)
    tipo         = Column(String(20), nullable=False)   # 'receita' | 'despesa'
    descricao    = Column(String(500), nullable=False)
    valor        = Column(Float, nullable=False)
    data         = Column(Date, nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias_financeiras.id"), nullable=True)
    projeto_id   = Column(Integer, ForeignKey("projetos.id"), nullable=True)
    cliente_id   = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    usuario_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    observacao   = Column(Text, nullable=True)
    criado_em    = Column(DateTime(timezone=True), server_default=func.now())
    categoria    = relationship("CategoriaFinanceira", back_populates="lancamentos")
    projeto      = relationship("Projeto")
    cliente      = relationship("Cliente")
    usuario      = relationship("Usuario")


# ─── FLUXO DE CAIXA ──────────────────────────────────────────────────────────

class AgrupadorFC(Base):
    __tablename__ = "agrupadores_fc"
    id        = Column(Integer, primary_key=True, index=True)
    nome      = Column(String(200), nullable=False, unique=True)
    padrao    = Column(Boolean, default=True)
    ativo     = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())



class PlanoContas(Base):
    __tablename__ = "planos_contas"
    id         = Column(Integer, primary_key=True, index=True)
    nome       = Column(String(200), nullable=False)
    descricao  = Column(Text, nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    ativo      = Column(Boolean, default=True)
    criado_em  = Column(DateTime(timezone=True), server_default=func.now())
    cliente    = relationship("Cliente")
    contas     = relationship("ContaFC", back_populates="plano", order_by="ContaFC.ordem")


class ContaFC(Base):
    __tablename__ = "contas_fc"
    id       = Column(Integer, primary_key=True, index=True)
    plano_id = Column(Integer, ForeignKey("planos_contas.id"), nullable=False)
    codigo   = Column(String(50), nullable=True)
    nome     = Column(String(300), nullable=False)
    tipo     = Column(String(20), nullable=False)   # 'entrada' | 'saida'
    classe       = Column(String(100), nullable=True)   # legado
    agrupador_id = Column(Integer, ForeignKey("agrupadores_fc.id"), nullable=True)
    agrupador    = relationship("AgrupadorFC")
    pai_id   = Column(Integer, ForeignKey("contas_fc.id"), nullable=True)
    nivel    = Column(Integer, default=1)
    ordem    = Column(Integer, default=0)
    ativo    = Column(Boolean, default=True)
    plano    = relationship("PlanoContas", back_populates="contas")
    pai      = relationship("ContaFC", remote_side="ContaFC.id", back_populates="filhos", foreign_keys="ContaFC.pai_id")
    filhos   = relationship("ContaFC", back_populates="pai", foreign_keys="ContaFC.pai_id")


class ValorMensalFC(Base):
    __tablename__ = "valores_mensais_fc"
    id       = Column(Integer, primary_key=True, index=True)
    conta_id = Column(Integer, ForeignKey("contas_fc.id"), nullable=False)
    ano      = Column(Integer, nullable=False)
    mes      = Column(Integer, nullable=False)
    valor    = Column(Float, default=0.0)
    conta    = relationship("ContaFC")


class SaldoInicialFC(Base):
    __tablename__ = "saldos_iniciais_fc"
    id       = Column(Integer, primary_key=True, index=True)
    plano_id = Column(Integer, ForeignKey("planos_contas.id"), nullable=False)
    ano      = Column(Integer, nullable=False)
    mes      = Column(Integer, nullable=False)
    valor    = Column(Float, default=0.0)
    plano    = relationship("PlanoContas")


class OrcamentoLinha(Base):
    __tablename__ = "orcamento_linhas"
    id              = Column(Integer, primary_key=True, index=True)
    categoria_id    = Column(Integer, ForeignKey("categorias_financeiras.id"), nullable=False)
    cliente_id      = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    projeto_id      = Column(Integer, ForeignKey("projetos.id"), nullable=True)
    ano             = Column(Integer, nullable=False)
    mes             = Column(Integer, nullable=True)
    valor_previsto  = Column(Float, nullable=False)
    criado_em       = Column(DateTime(timezone=True), server_default=func.now())
    categoria       = relationship("CategoriaFinanceira")
    cliente         = relationship("Cliente")
    projeto         = relationship("Projeto")


# ─── PLANOS DE CONTAS (templates reutilizáveis) ───────────────────────────────

class Plano(Base):
    __tablename__ = "planos"
    id        = Column(Integer, primary_key=True, index=True)
    nome      = Column(String(200), nullable=False)
    descricao = Column(Text, nullable=True)
    ativo     = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    itens     = relationship("PlanoItem", back_populates="plano",
                             order_by="PlanoItem.ordem", cascade="all, delete-orphan")
    vinculos  = relationship("ClientePlano", back_populates="plano", cascade="all, delete-orphan")


class PlanoItem(Base):
    __tablename__ = "planos_itens"
    id          = Column(Integer, primary_key=True, index=True)
    plano_id    = Column(Integer, ForeignKey("planos.id"), nullable=False)
    agrupamento = Column(String(60), nullable=False)
    descricao   = Column(String(300), nullable=False)
    conta       = Column(String(30), nullable=True)    # código contábil ex: 111101
    tipo        = Column(String(20), nullable=True)    # TT, CX, CS, CB, etc.
    modulo      = Column(String(20), nullable=True)    # F | D | O | F,D | F,D,O etc.
    movimento   = Column(String(50), nullable=True)    # Entrada/Saída ou Receita/Despesa
    ordem       = Column(Integer, default=0)
    plano       = relationship("Plano", back_populates="itens")


class BalanceteLancamento(Base):
    """Valor mensal de uma conta contábil para um cliente."""
    __tablename__ = "balancete_lancamentos"
    __table_args__ = (UniqueConstraint("cliente_id", "ano", "mes", "conta"),)
    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    ano        = Column(Integer, nullable=False)
    mes        = Column(Integer, nullable=False)   # 1-12
    conta      = Column(String(30), nullable=False) # chave → PlanoItem.conta
    valor      = Column(Float, default=0.0)
    cliente    = relationship("Cliente")


class Anotacao(Base):
    """Anotações de consultores por cliente."""
    __tablename__ = "anotacoes"
    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    usuario    = Column(String(120), nullable=False)
    data       = Column(Date, nullable=False)
    texto      = Column(Text, nullable=False)
    criado_em  = Column(DateTime(timezone=True), server_default=func.now())
    cliente    = relationship("Cliente")


class ClientePlano(Base):
    """Um cliente tem no máximo um plano."""
    __tablename__ = "cliente_plano"
    __table_args__ = (UniqueConstraint("cliente_id"),)
    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False, unique=True)
    plano_id   = Column(Integer, ForeignKey("planos.id"), nullable=False)
    cliente    = relationship("Cliente")
    plano      = relationship("Plano", back_populates="vinculos")
