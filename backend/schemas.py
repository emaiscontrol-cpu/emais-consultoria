from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from models import PerfilEnum, StatusTarefa, StatusFase, StatusProjeto, StatusSubtarefa


# ── AUTH ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    codigo: str
    senha: str
    cliente_id: Optional[int] = None
    is_interno: bool = False

# ── USUARIO ───────────────────────────────────────────
class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str
    perfil: PerfilEnum = PerfilEnum.consultor
    cliente_id: Optional[int] = None
    codigo_acesso: Optional[str] = None

class UsuarioOut(BaseModel):
    id: int
    nome: str
    email: str
    perfil: PerfilEnum
    ativo: bool
    ia_claude:     bool = False
    ia_gemini:     bool = False
    ia_openrouter: bool = False
    cliente_id: Optional[int]
    foto: Optional[str] = None
    codigo_acesso: Optional[str] = None
    class Config:
        from_attributes = True

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    perfil: Optional[PerfilEnum] = None
    ativo: Optional[bool] = None
    ia_claude:     Optional[bool] = None
    ia_gemini:     Optional[bool] = None
    ia_openrouter: Optional[bool] = None
    senha: Optional[str] = None
    cliente_id: Optional[int] = None
    remover_cliente: Optional[bool] = None
    codigo_acesso: Optional[str] = None
    remover_codigo: Optional[bool] = None

# ── UNIDADE SCHEMA ────────────────────────────────────
class UnidadeSchema(BaseModel):
    id: Optional[int] = None
    codigo: str
    nome: str
    cnpj: Optional[str] = None
    endereco_logradouro: Optional[str] = None
    endereco_numero: Optional[str] = None
    endereco_complemento: Optional[str] = None
    endereco_bairro: Optional[str] = None
    endereco_cidade: Optional[str] = None
    endereco_estado: Optional[str] = None
    endereco_cep: Optional[str] = None
    ativo: bool = True
    class Config:
        from_attributes = True

# ── CLIENTE ───────────────────────────────────────────
class ClienteCreate(BaseModel):
    razao_social: str
    cnpj: Optional[str] = None
    contato_nome: Optional[str] = None
    contato_email: Optional[str] = None
    contato_fone: Optional[str] = None
    modulo_projetos: bool = True
    modulo_inteligencia_mercado: bool = False
    modulo_analises_gerenciais: bool = False
    segmento_id: Optional[int] = None
    template_dre_padrao_id: Optional[int] = None
    unidades: Optional[List[UnidadeSchema]] = None

    @field_validator('cnpj', 'contato_nome', 'contato_email', 'contato_fone', mode='before')
    @classmethod
    def vazio_para_none(cls, v):
        return None if v == '' else v

class ClienteOut(BaseModel):
    id: int
    razao_social: str
    cnpj: Optional[str]
    contato_nome: Optional[str]
    contato_email: Optional[str]
    contato_fone: Optional[str]
    ativo: bool
    modulo_projetos: bool = True
    modulo_inteligencia_mercado: bool = False
    modulo_analises_gerenciais: bool = False
    segmento_id: Optional[int] = None
    template_dre_padrao_id: Optional[int] = None
    unidades: List[UnidadeSchema] = []
    class Config:
        from_attributes = True

# ── TIPO CONSULTORIA ──────────────────────────────────
class TipoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    nivel: int = 1
    pai_id: Optional[int] = None

class TipoOut(BaseModel):
    id: int
    nome: str
    nivel: int
    pai_id: Optional[int]
    filhos: List["TipoOut"] = []
    class Config:
        from_attributes = True

TipoOut.model_rebuild()

# ── PROJETO (Create/List) ──────────────────────────────
class ProjetoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    cliente_id: int
    tipo_id: Optional[int] = None
    data_inicio: Optional[datetime] = None
    data_fim_prev: Optional[datetime] = None

class ProjetoOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str]
    cliente_id: int
    tipo_id: Optional[int]
    status: StatusProjeto
    progresso: float
    data_inicio: Optional[datetime]
    data_fim_prev: Optional[datetime]
    data_fim_real: Optional[datetime]
    criado_em: datetime
    class Config:
        from_attributes = True

# ── RESPONSÁVEL TAREFA ────────────────────────────────
class ResponsavelTarefaCreate(BaseModel):
    nome: str
    funcao: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None

class ResponsavelTarefaOut(BaseModel):
    id: int
    tarefa_id: int
    nome: str
    funcao: Optional[str]
    email: Optional[str]
    telefone: Optional[str]
    class Config:
        from_attributes = True

# ── SUBTAREFA ─────────────────────────────────────────
class SubtarefaCreate(BaseModel):
    tarefa_id: int
    nome: str
    data_prazo: Optional[datetime] = None
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    responsavel_id: Optional[int] = None
    ordem: int = 0

class SubtarefaUpdate(BaseModel):
    status: Optional[StatusSubtarefa] = None
    nome: Optional[str] = None
    data_prazo: Optional[datetime] = None
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    responsavel_id: Optional[int] = None

class SubtarefaOut(BaseModel):
    id: int
    tarefa_id: int
    nome: str
    status: StatusSubtarefa
    data_prazo: Optional[datetime]
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    responsavel_id: Optional[int] = None
    responsavel: Optional[UsuarioOut] = None
    ordem: int
    class Config:
        from_attributes = True

# ── TAREFA ────────────────────────────────────────────
class TarefaCreate(BaseModel):
    fase_id: int
    nome: str
    descricao: Optional[str] = None
    ordem: int = 0
    responsavel_id: Optional[int] = None
    requer_validacao: bool = False
    data_prazo: Optional[datetime] = None

class TarefaUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    responsavel_id: Optional[int] = None
    status: Optional[StatusTarefa] = None
    percentual: Optional[float] = None
    requer_validacao: Optional[bool] = None
    data_prazo: Optional[datetime] = None
    confirmado_cliente: Optional[bool] = None
    ativo: Optional[bool] = None

class TarefaOut(BaseModel):
    id: int
    fase_id: int
    nome: str
    ordem: int
    status: StatusTarefa
    percentual: float
    requer_validacao: bool
    confirmado_cliente: bool
    ativo: bool = True
    responsavel_id: Optional[int]
    responsavel: Optional[UsuarioOut]
    data_prazo: Optional[datetime]
    data_inicio: Optional[datetime]
    data_conclusao: Optional[datetime]
    subtarefas: List[SubtarefaOut] = []
    responsaveis: List[ResponsavelTarefaOut] = []
    class Config:
        from_attributes = True

# ── COMENTÁRIO FASE ───────────────────────────────────
class ComentarioFaseCreate(BaseModel):
    texto: str

class ComentarioFaseOut(BaseModel):
    id: int
    fase_id: int
    texto: str
    criado_em: datetime
    autor: UsuarioOut
    class Config:
        from_attributes = True

# ── FASE ──────────────────────────────────────────────
class FaseCreate(BaseModel):
    projeto_id: int
    nome: str
    descricao: Optional[str] = None
    ordem: int
    perc_desbloqueio: float = 80.0
    bloqueado_por_anterior: bool = True
    data_inicio: Optional[datetime] = None
    data_fim_prev: Optional[datetime] = None
    responsavel_id: Optional[int] = None

class FaseUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    perc_desbloqueio: Optional[float] = None
    bloqueado_por_anterior: Optional[bool] = None
    status: Optional[StatusFase] = None
    data_inicio: Optional[datetime] = None
    data_fim_prev: Optional[datetime] = None
    responsavel_id: Optional[int] = None

class FaseOut(BaseModel):
    id: int
    projeto_id: int
    nome: str
    descricao: Optional[str] = None
    ordem: int
    status: StatusFase
    progresso: float
    perc_desbloqueio: float
    bloqueado_por_anterior: bool = True
    data_inicio: Optional[datetime]
    data_fim_prev: Optional[datetime]
    data_fim_real: Optional[datetime]
    responsavel_id: Optional[int] = None
    responsavel: Optional[UsuarioOut] = None
    class Config:
        from_attributes = True

class FaseDetalhe(FaseOut):
    tarefas: List[TarefaOut] = []
    comentarios_fase: List[ComentarioFaseOut] = []
    class Config:
        from_attributes = True

# ── PROJETO (Detalhe) ─────────────────────────────────
class ProjetoDetalhe(ProjetoOut):
    cliente: ClienteOut
    fases: List[FaseDetalhe] = []
    class Config:
        from_attributes = True

# ── COMENTÁRIO ────────────────────────────────────────
class ComentarioCreate(BaseModel):
    tarefa_id: int
    texto: str

class ComentarioOut(BaseModel):
    id: int
    tarefa_id: int
    texto: str
    criado_em: datetime
    autor: UsuarioOut
    class Config:
        from_attributes = True

# ── AUTH ──────────────────────────────────────────────
class AlterarSenha(BaseModel):
    senha_atual: str
    nova_senha: str

# ── DASHBOARD ─────────────────────────────────────────
class DashboardResumo(BaseModel):
    total_projetos: int
    projetos_ativos: int
    projetos_atrasados: int
    tarefas_em_andamento: int
    tarefas_concluidas_mes: int
    tarefas_atrasadas: int

# ── TOKEN ─────────────────────────────────────────────
class ModulosCliente(BaseModel):
    projetos: bool = True
    inteligencia_mercado: bool = False
    analises_gerenciais: bool = False

class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: UsuarioOut
    modulos: Optional[ModulosCliente] = None

# ── MODELOS DE PROJETO ─────────────────────────────────
class ModeloSubtarefaCreate(BaseModel):
    nome: str
    ordem: int = 0
    duracao_dias: Optional[int] = None

class ModeloSubtarefaOut(BaseModel):
    id: int
    tarefa_id: int
    nome: str
    ordem: int
    duracao_dias: Optional[int] = None
    class Config:
        from_attributes = True

class ModeloTarefaCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    ordem: int = 0
    requer_validacao: bool = False
    duracao_dias: Optional[int] = None

class ModeloTarefaOut(BaseModel):
    id: int
    fase_id: int
    nome: str
    descricao: Optional[str] = None
    ordem: int
    requer_validacao: bool
    duracao_dias: Optional[int] = None
    subtarefas: List[ModeloSubtarefaOut] = []
    class Config:
        from_attributes = True

class ModeloFaseCreate(BaseModel):
    nome: str
    ordem: int
    perc_desbloqueio: float = 80.0
    duracao_dias: Optional[int] = None

class ModeloFaseOut(BaseModel):
    id: int
    modelo_id: int
    nome: str
    ordem: int
    perc_desbloqueio: float
    duracao_dias: Optional[int] = None
    tarefas: List[ModeloTarefaOut] = []
    class Config:
        from_attributes = True

class ModeloCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None

class ModeloOut(BaseModel):
    id: int
    nome: str
    descricao: Optional[str] = None
    total_fases: int = 0
    total_tarefas: int = 0
    class Config:
        from_attributes = True

class ModeloDetalhe(ModeloOut):
    fases: List[ModeloFaseOut] = []
    class Config:
        from_attributes = True


# ── PLANO REFERENCIAL ─────────────────────────────────────────────────────────

class SegmentoCreate(BaseModel):
    nome: str

class SegmentoOut(BaseModel):
    id: int
    nome: str
    ativo: bool
    class Config:
        from_attributes = True

class PlanoRefCreate(BaseModel):
    nome: str = "Plano Referencial E Mais"

class ContaRefCreate(BaseModel):
    codigo: str
    descricao: str
    tipo: str = "analitica"       # 'sintetica' | 'analitica'
    natureza: Optional[str] = None  # 'soma' | 'subtrai'
    agrupamento: Optional[str] = None
    pai_id: Optional[int] = None

class ContaRefUpdate(BaseModel):
    codigo: Optional[str] = None
    descricao: Optional[str] = None
    tipo: Optional[str] = None
    natureza: Optional[str] = None
    agrupamento: Optional[str] = None
    pai_id: Optional[int] = None
    ativo: Optional[bool] = None

class ContaRefOut(BaseModel):
    id: int
    plano_id: int
    codigo: str
    descricao: str
    tipo: str
    natureza: Optional[str]
    agrupamento: Optional[str]
    pai_id: Optional[int]
    ativo: bool
    filhos: List["ContaRefOut"] = []
    class Config:
        from_attributes = True

ContaRefOut.model_rebuild()

class PlanoRefOut(BaseModel):
    id: int
    nome: str
    ativo: bool
    class Config:
        from_attributes = True

# ── CONTA CLIENTE REF ─────────────────────────────────────────────────────────

class ContaClienteRefOut(BaseModel):
    id: int
    cliente_id: int
    codigo_origem: str
    descricao_origem: str
    class Config:
        from_attributes = True

# ── DE-PARA REF ───────────────────────────────────────────────────────────────

class DeParaRefItem(BaseModel):
    conta_referencial_id: int
    percentual: float = 100.0

class DeParaConfirmarRequest(BaseModel):
    conta_cliente_id: int
    itens: List[DeParaRefItem]   # lista de (conta_ref, percentual) — suporta rateio
    vigente_a_partir_ano: int
    vigente_a_partir_mes: int

class DeParaRefOut(BaseModel):
    id: int
    conta_cliente_id: int
    conta_referencial_id: int
    percentual: float
    status: str
    confianca: float
    origem_vinculo: str
    vigente_a_partir: str        # ISO date string
    conta_cliente: Optional[ContaClienteRefOut] = None
    conta_referencial: Optional[ContaRefOut] = None
    class Config:
        from_attributes = True

class SugestaoDeParaOut(BaseModel):
    conta_referencial_id: int
    confianca: float
    origem_vinculo: str
    descricao: str
    codigo: str

# ── LANÇAMENTO REF ────────────────────────────────────────────────────────────

class LancamentoRefCreate(BaseModel):
    codigo_origem: str
    descricao_origem: str
    valor: float
    ano: int
    mes: int
    unidade: Optional[str] = None  # Nome (ex: Roosevelt) ou código de 3 dígitos (ex: 104)

class LancamentoRefBulkRequest(BaseModel):
    cliente_id: int
    lancamentos: List[LancamentoRefCreate]
    forcar_periodo_fechado: bool = False

class LancamentoRefOut(BaseModel):
    id: int
    conta_cliente_id: int
    unidade_codigo: Optional[str] = None
    valor: float
    ano: int
    mes: int
    class Config:
        from_attributes = True

# ── TEMPLATE REF ──────────────────────────────────────────────────────────────

class TemplateRefCreate(BaseModel):
    tipo: str       # 'dre' | 'fluxo_caixa' | 'orcamento'
    segmento_id: int
    nome: str

class TemplateRefUpdate(BaseModel):
    nome: Optional[str] = None
    tipo: Optional[str] = None
    segmento_id: Optional[int] = None

class TemplateLinhaCreate(BaseModel):
    rotulo: str
    ordem: int = 0
    negrito_totalizador: bool = False
    tipo: str = "agrupamento"
    modo_calculo: str = "agrupamento"   # 'agrupamento' | 'soma_filhos' | 'formula'
    nivel: int = 4                      # 1=A 2=C 3=D 4=E
    agrupamento_slug: Optional[str] = None
    formula_texto: Optional[str] = None

class TemplateLinhaUpdate(BaseModel):
    rotulo: Optional[str] = None
    ordem: Optional[int] = None
    negrito_totalizador: Optional[bool] = None
    tipo: Optional[str] = None
    modo_calculo: Optional[str] = None
    nivel: Optional[int] = None
    agrupamento_slug: Optional[str] = None
    formula_texto: Optional[str] = None

class TemplateLinhaOut(BaseModel):
    id: int
    template_id: int
    rotulo: str
    ordem: int
    negrito_totalizador: bool
    tipo: Optional[str]
    modo_calculo: str
    nivel: int
    agrupamento_slug: Optional[str]
    formula_texto: Optional[str]
    class Config:
        from_attributes = True

class TemplateRefOut(BaseModel):
    id: int
    tipo: str
    segmento_id: int
    nome: str
    ativo: bool
    linhas: List[TemplateLinhaOut] = []
    class Config:
        from_attributes = True

class DuplicarTemplateRequest(BaseModel):
    segmento_id: int
    nome: Optional[str] = None

# ── DEMONSTRATIVO ─────────────────────────────────────────────────────────────

class LinhaDemonstrativoOut(BaseModel):
    rotulo: str
    valor: float
    negrito_totalizador: bool
    tem_divisao_por_zero: bool = False
    valores_unidades: Optional[dict[str, float]] = None
    erro: Optional[str] = None
    erros_unidades: Optional[dict[str, Optional[str]]] = None

class DemonstrativoOut(BaseModel):
    cliente_id: int
    template_id: int
    ano: int
    mes: int
    linhas: List[LinhaDemonstrativoOut]
    periodo_fechado: bool = False

class ComparativoLinhaOut(BaseModel):
    rotulo: str
    realizado: float
    orcado: float
    desvio_percentual: Optional[float]   # None quando orcado == 0
    negrito_totalizador: bool

class ComparativoOut(BaseModel):
    cliente_id: int
    ano: int
    mes: int
    linhas: List[ComparativoLinhaOut]

# ── PERÍODO FECHADO ───────────────────────────────────────────────────────────

class PeriodoFechadoOut(BaseModel):
    id: int
    cliente_id: int
    ano: int
    mes: int
    data_fechamento: datetime
    class Config:
        from_attributes = True

# ── BENCHMARK ─────────────────────────────────────────────────────────────────

class BenchmarkLinhaOut(BaseModel):
    rotulo: str
    media: float
    minimo: float
    maximo: float
    qtd_clientes: int

class BenchmarkOut(BaseModel):
    segmento_id: int
    segmento_nome: str
    ano: int
    mes: int
    linhas: List[BenchmarkLinhaOut]
