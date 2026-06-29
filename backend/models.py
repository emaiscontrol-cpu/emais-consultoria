from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, Enum, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class PerfilEnum(str, enum.Enum):
    admin        = "admin"
    consultor    = "consultor"
    ger_projeto  = "ger_projeto"
    analista     = "analista"
    ti           = "ti"

class StatusTarefa(str, enum.Enum):
    pendente     = "pendente"
    em_andamento = "em_andamento"
    aguard_validacao = "aguard_validacao"
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
    ia_claude     = Column(Boolean, default=False)
    ia_gemini     = Column(Boolean, default=False)
    ia_openrouter = Column(Boolean, default=False)
    foto          = Column(Text, nullable=True)
    codigo_acesso = Column(String(3), unique=True, nullable=True)
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
    ativo                      = Column(Boolean, default=True)
    modulo_projetos            = Column(Boolean, default=True)
    modulo_inteligencia_mercado = Column(Boolean, default=False)
    modulo_analises_gerenciais = Column(Boolean, default=False)
    segmento_id   = Column(Integer, ForeignKey("ref_segmentos.id"), nullable=True)
    criado_em     = Column(DateTime(timezone=True), server_default=func.now())
    projetos      = relationship("Projeto", back_populates="cliente")
    usuarios      = relationship("Usuario", back_populates="cliente", foreign_keys=[Usuario.cliente_id])
    segmento      = relationship("Segmento", back_populates="clientes", foreign_keys="Cliente.segmento_id")


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
    ativo           = Column(Boolean, default=True)
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
    responsavel_id        = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    ativo                 = Column(Boolean, default=True)
    responsavel           = relationship("Usuario", foreign_keys=[responsavel_id])
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


class NotificacaoMencao(Base):
    __tablename__ = "notificacoes_mencao"
    id                 = Column(Integer, primary_key=True, index=True)
    usuario_destino_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    de_usuario_id      = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    mensagem           = Column(Text, nullable=False)
    projeto_id         = Column(Integer, ForeignKey("projetos.id"), nullable=True)
    lida               = Column(Boolean, default=False)
    criado_em          = Column(DateTime(timezone=True), server_default=func.now())
    usuario_destino    = relationship("Usuario", foreign_keys=[usuario_destino_id])
    de_usuario         = relationship("Usuario", foreign_keys=[de_usuario_id])


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
    subtarefas       = relationship("ModeloSubtarefa", back_populates="tarefa",
                                    order_by="ModeloSubtarefa.ordem", cascade="all, delete-orphan")


class ModeloSubtarefa(Base):
    __tablename__ = "modelos_subtarefas"
    id           = Column(Integer, primary_key=True, index=True)
    tarefa_id    = Column(Integer, ForeignKey("modelos_tarefas.id"), nullable=False)
    nome         = Column(String(300), nullable=False)
    ordem        = Column(Integer, default=0)
    duracao_dias = Column(Integer, nullable=True)
    tarefa       = relationship("ModeloTarefa", back_populates="subtarefas")


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


# ─── AGRUPAMENTOS (compartilhados entre DRE, FC e Orçamento) ─────────────────

class Agrupamento(Base):
    __tablename__ = "agrupamentos"
    id             = Column(Integer, primary_key=True, index=True)
    nome           = Column(String(200), nullable=False, unique=True)
    slug           = Column(String(100), nullable=True)
    demonstrativos = Column(Text, nullable=True, server_default='["fluxo_caixa"]')
    padrao         = Column(Boolean, default=True)
    ativo          = Column(Boolean, default=True)
    criado_em      = Column(DateTime(timezone=True), server_default=func.now())





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




class BalanceteLancamento(Base):
    """Valor mensal de uma conta contábil para um cliente."""
    __tablename__ = "balancete_lancamentos"
    __table_args__ = (UniqueConstraint("cliente_id", "ano", "mes", "conta"),)
    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    ano        = Column(Integer, nullable=False)
    mes        = Column(Integer, nullable=False)   # 1-12
    conta      = Column(String(30), nullable=False)
    valor      = Column(Float, default=0.0)
    cliente    = relationship("Cliente")


class Bandeira(Base):
    """Agrupamento nomeado de unidades para análise comparativa."""
    __tablename__ = "bandeiras"
    id            = Column(Integer, primary_key=True, index=True)
    cliente_id    = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    nome          = Column(Text, nullable=False)
    unidades_json = Column(Text, default="[]")


class Anotacao(Base):
    """Anotações de consultores por cliente."""
    __tablename__ = "anotacoes"
    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    usuario    = Column(String(120), nullable=False)          # legado: nome em texto
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)  # DB-1: FK
    data       = Column(Date, nullable=False)
    texto      = Column(Text, nullable=False)
    criado_em  = Column(DateTime(timezone=True), server_default=func.now())
    cliente    = relationship("Cliente")
    autor      = relationship("Usuario", foreign_keys=[usuario_id])




class LogTarefa(Base):
    """Histórico de alterações por tarefa (UX-7)."""
    __tablename__ = "log_tarefas"
    id           = Column(Integer, primary_key=True, index=True)
    tarefa_id    = Column(Integer, ForeignKey("tarefas.id"), nullable=False)
    usuario_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    campo        = Column(String(60), nullable=False)
    valor_antes  = Column(Text, nullable=True)
    valor_depois = Column(Text, nullable=True)
    criado_em    = Column(DateTime(timezone=True), server_default=func.now())
    usuario      = relationship("Usuario")


class MensagemChat(Base):
    """Mensagens de chat por projeto (UX-10)."""
    __tablename__ = "mensagens_chat"
    id         = Column(Integer, primary_key=True, index=True)
    projeto_id = Column(Integer, ForeignKey("projetos.id"), nullable=False)
    autor_id   = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    texto      = Column(Text, nullable=False)
    criado_em  = Column(DateTime(timezone=True), server_default=func.now())
    projeto    = relationship("Projeto")
    autor      = relationship("Usuario")


class SolicitacaoReset(Base):
    """Solicitações de redefinição de senha (esqueci minha senha)."""
    __tablename__ = "solicitacoes_reset"
    id         = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    criado_em  = Column(DateTime(timezone=True), server_default=func.now())
    usuario    = relationship("Usuario")


class Arquivo(Base):
    """Arquivos e documentos por cliente (visível apenas para admin/consultor)."""
    __tablename__ = "arquivos"
    id             = Column(Integer, primary_key=True, index=True)
    cliente_id     = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    nome_original  = Column(String(255), nullable=False)
    nome_arquivo   = Column(String(255), nullable=False)  # nome no disco (UUID)
    tamanho        = Column(Integer, nullable=False)
    tipo_mime      = Column(String(120), nullable=True)
    categoria      = Column(String(50), nullable=False, server_default='Outros')
    enviado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    criado_em      = Column(DateTime(timezone=True), server_default=func.now())
    cliente        = relationship("Cliente")
    enviado_por    = relationship("Usuario")


# ─── IMPORTAÇÃO ───────────────────────────────────────────────────────────────

class ImportLayout(Base):
    """Configuração de como ler um XLSX do ERP (realizado ou plano de contas)."""
    __tablename__ = "import_layouts"
    id                 = Column(Integer, primary_key=True, index=True)
    cliente_id         = Column(Integer, ForeignKey("clientes.id"), nullable=True)  # None = global
    categoria          = Column(String(20), default="REALIZADO")  # REALIZADO | PLANO
    nome               = Column(String(200), nullable=False)
    linha_inicio       = Column(Integer, default=2)   # 1-based
    coluna_conta       = Column(Integer, default=0)   # 0-based
    coluna_descricao   = Column(Integer, nullable=True)
    tipo_estrutura     = Column(String(30), default="COLUNAS_MESES")
    # JSON: [{"mes":1,"coluna":3}, {"mes":2,"coluna":4}, ...]
    mapa_colunas_meses = Column(Text, default="[]")
    coluna_mes         = Column(Integer, nullable=True)
    coluna_valor       = Column(Integer, nullable=True)
    formato_mes        = Column(String(20), default="MM/YYYY")
    prefixos_ignorar   = Column(Text, default="[]")  # JSON lista de strings
    linhas_ignorar     = Column(Text, default="[]")  # JSON lista de ints
    ativo              = Column(Boolean, default=True)
    criado_em          = Column(DateTime(timezone=True), server_default=func.now())
    cliente            = relationship("Cliente", foreign_keys=[cliente_id])


class ImportacaoLog(Base):
    """Histórico de cada importação de realizado."""
    __tablename__ = "importacao_logs"
    id            = Column(Integer, primary_key=True, index=True)
    cliente_id    = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    layout_id     = Column(Integer, ForeignKey("import_layouts.id"), nullable=True)
    ano           = Column(Integer, nullable=False)
    mes           = Column(Integer, default=0)   # 0 = múltiplos meses
    unidade       = Column(String(60), nullable=False)
    total_linhas  = Column(Integer, default=0)
    direto        = Column(Integer, default=0)
    via_depara    = Column(Integer, default=0)
    pendencias    = Column(Integer, default=0)
    criado_em     = Column(DateTime(timezone=True), server_default=func.now())
    criado_por_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    cliente       = relationship("Cliente")
    itens_pendentes = relationship("ImportacaoPendencia", back_populates="log",
                                   cascade="all, delete-orphan")


class ImportacaoPendencia(Base):
    """Conta do ERP que veio sem mapeamento em uma importação."""
    __tablename__ = "importacao_pendencias"
    id          = Column(Integer, primary_key=True, index=True)
    log_id      = Column(Integer, ForeignKey("importacao_logs.id"), nullable=False)
    codigo_erp  = Column(String(60), nullable=False)
    descricao   = Column(String(300), default="")
    valor       = Column(Float, default=0.0)
    mes         = Column(Integer, default=0)
    resolvido   = Column(Boolean, default=False)
    log         = relationship("ImportacaoLog", back_populates="itens_pendentes")


# ─── PLANO DE CONTAS REFERENCIAL ─────────────────────────────────────────────

class Segmento(Base):
    """Segmento de mercado do cliente (ex: Varejo Alimentar, Drogarias)."""
    __tablename__ = "ref_segmentos"
    id        = Column(Integer, primary_key=True, index=True)
    nome      = Column(String(200), nullable=False, unique=True)
    ativo     = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    clientes  = relationship("Cliente", back_populates="segmento", foreign_keys="Cliente.segmento_id")
    templates = relationship("TemplateRef", back_populates="segmento")


class PlanoReferencial(Base):
    """Plano de contas único e centralizado (praticamente singleton)."""
    __tablename__ = "ref_planos"
    id        = Column(Integer, primary_key=True, index=True)
    nome      = Column(String(200), nullable=False, default="Plano Referencial E Mais")
    ativo     = Column(Boolean, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=func.now())
    contas    = relationship("ContaReferencial", back_populates="plano", order_by="ContaReferencial.codigo")


class ContaReferencial(Base):
    """Conta do plano referencial (sintética ou analítica)."""
    __tablename__ = "ref_contas"
    id          = Column(Integer, primary_key=True, index=True)
    plano_id    = Column(Integer, ForeignKey("ref_planos.id"), nullable=False)
    codigo      = Column(String(50), nullable=False)
    descricao   = Column(String(300), nullable=False)
    tipo        = Column(String(20), nullable=False, default="analitica")   # 'sintetica' | 'analitica'
    natureza    = Column(String(20), nullable=True)                         # 'soma' | 'subtrai' — só analíticas
    agrupamento = Column(String(60), nullable=True)                         # código usado em fórmulas
    pai_id      = Column(Integer, ForeignKey("ref_contas.id"), nullable=True)
    ativo       = Column(Boolean, default=True)
    criado_em   = Column(DateTime(timezone=True), server_default=func.now())
    plano       = relationship("PlanoReferencial", back_populates="contas")
    pai         = relationship("ContaReferencial", remote_side="ContaReferencial.id",
                               back_populates="filhos", foreign_keys="ContaReferencial.pai_id")
    filhos      = relationship("ContaReferencial", back_populates="pai",
                               foreign_keys="ContaReferencial.pai_id")
    vinculos    = relationship("ContaAgrupamento", back_populates="conta", lazy="select")
    __table_args__ = (UniqueConstraint("plano_id", "codigo"),)


class ContaAgrupamento(Base):
    """Vínculo entre uma conta referencial e um agrupamento (DRE, FC ou Orçamento)."""
    __tablename__ = "ref_conta_agrupamento"
    id                   = Column(Integer, primary_key=True, index=True)
    conta_referencial_id = Column(Integer, ForeignKey("ref_contas.id"), nullable=False)
    agrupamento_id       = Column(Integer, ForeignKey("agrupamentos.id"), nullable=False)
    demonstrativo        = Column(String(30), nullable=False)   # 'fluxo_caixa' | 'dre' | 'orcamento'
    herdado              = Column(Boolean, nullable=False, default=False)
    criado_em            = Column(DateTime(timezone=True), server_default=func.now())
    conta       = relationship("ContaReferencial", back_populates="vinculos")
    agrupamento = relationship("Agrupamento")
    __table_args__ = (UniqueConstraint("conta_referencial_id", "agrupamento_id", "demonstrativo"),)


class ContaClienteRef(Base):
    """Conta do ERP do cliente (origem) usada no plano referencial."""
    __tablename__ = "ref_contas_cliente"
    id               = Column(Integer, primary_key=True, index=True)
    cliente_id       = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    codigo_origem    = Column(String(60), nullable=False)
    descricao_origem = Column(String(300), nullable=False)
    criado_em        = Column(DateTime(timezone=True), server_default=func.now())
    cliente          = relationship("Cliente")
    de_paras         = relationship("DeParaRef", back_populates="conta_cliente",
                                    order_by="DeParaRef.vigente_a_partir")
    lancamentos      = relationship("LancamentoRef", back_populates="conta_cliente")
    __table_args__ = (UniqueConstraint("cliente_id", "codigo_origem"),)


class DeParaRef(Base):
    """Mapeamento de conta do cliente → conta referencial, com versionamento por data."""
    __tablename__ = "ref_de_para"
    id                   = Column(Integer, primary_key=True, index=True)
    conta_cliente_id     = Column(Integer, ForeignKey("ref_contas_cliente.id"), nullable=False)
    conta_referencial_id = Column(Integer, ForeignKey("ref_contas.id"), nullable=False)
    percentual           = Column(Float, default=100.0)   # 0-100; soma por conta_cliente deve ser ≤100
    status               = Column(String(20), default="pendente_revisao")   # 'confirmado' | 'pendente_revisao'
    confianca            = Column(Float, default=0.0)     # 0.0–1.0
    origem_vinculo       = Column(String(50), default="sugestao_automatica")
    # 'sugestao_automatica' | 'manual' | 'aprendido_de_outro_cliente'
    vigente_a_partir     = Column(Date, nullable=False)   # ao criar novo, não apaga o anterior
    criado_em            = Column(DateTime(timezone=True), server_default=func.now())
    conta_cliente        = relationship("ContaClienteRef", back_populates="de_paras")
    conta_referencial    = relationship("ContaReferencial")


class LancamentoRef(Base):
    """Lançamento do cliente vinculado a uma conta do ERP (para o plano referencial)."""
    __tablename__ = "ref_lancamentos"
    id               = Column(Integer, primary_key=True, index=True)
    conta_cliente_id = Column(Integer, ForeignKey("ref_contas_cliente.id"), nullable=False)
    valor            = Column(Float, nullable=False)
    ano              = Column(Integer, nullable=False)
    mes              = Column(Integer, nullable=False)   # 1–12
    data_importacao  = Column(DateTime(timezone=True), server_default=func.now())
    conta_cliente    = relationship("ContaClienteRef", back_populates="lancamentos")
    __table_args__ = (UniqueConstraint("conta_cliente_id", "ano", "mes"),)


class TemplateRef(Base):
    """Template de demonstrativo (DRE, Fluxo de Caixa, Orçamento) por segmento."""
    __tablename__ = "ref_templates"
    id          = Column(Integer, primary_key=True, index=True)
    tipo        = Column(String(20), nullable=False)   # 'dre' | 'fluxo_caixa' | 'orcamento'
    segmento_id = Column(Integer, ForeignKey("ref_segmentos.id"), nullable=False)
    nome        = Column(String(200), nullable=False)
    ativo       = Column(Boolean, default=True)
    criado_em   = Column(DateTime(timezone=True), server_default=func.now())
    segmento    = relationship("Segmento", back_populates="templates")
    linhas      = relationship("TemplateLinhaRef", back_populates="template",
                               order_by="TemplateLinhaRef.ordem", cascade="all, delete-orphan")


class TemplateLinhaRef(Base):
    """Linha de um template referencial com fórmula."""
    __tablename__ = "ref_template_linhas"
    id                   = Column(Integer, primary_key=True, index=True)
    template_id          = Column(Integer, ForeignKey("ref_templates.id"), nullable=False)
    rotulo               = Column(String(300), nullable=False)
    ordem                = Column(Integer, nullable=False, default=0)
    negrito_totalizador  = Column(Boolean, default=False)
    # ex: '( {agrupamento:receita_bruta} - {agrupamento:cmv} ) / {agrupamento:receita_bruta} * 100'
    formula_texto        = Column(Text, nullable=True)
    template             = relationship("TemplateRef", back_populates="linhas")


class PeriodoFechado(Base):
    """Competência fechada: bloqueia nova importação de lançamentos para cliente/mês."""
    __tablename__ = "ref_periodos_fechados"
    id               = Column(Integer, primary_key=True, index=True)
    cliente_id       = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    ano              = Column(Integer, nullable=False)
    mes              = Column(Integer, nullable=False)
    data_fechamento  = Column(DateTime(timezone=True), server_default=func.now())
    usuario_id       = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    cliente          = relationship("Cliente")
    usuario          = relationship("Usuario")
    __table_args__ = (UniqueConstraint("cliente_id", "ano", "mes"),)
