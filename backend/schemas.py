from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from models import PerfilEnum, StatusTarefa, StatusFase, StatusProjeto, StatusSubtarefa


# ── AUTH ──────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    senha: str

# ── USUARIO ───────────────────────────────────────────
class UsuarioCreate(BaseModel):
    nome: str
    email: str
    senha: str
    perfil: PerfilEnum = PerfilEnum.consultor
    cliente_id: Optional[int] = None

class UsuarioOut(BaseModel):
    id: int
    nome: str
    email: str
    perfil: PerfilEnum
    ativo: bool
    cliente_id: Optional[int]
    foto: Optional[str] = None
    class Config:
        from_attributes = True

class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    perfil: Optional[PerfilEnum] = None
    ativo: Optional[bool] = None
    senha: Optional[str] = None
    cliente_id: Optional[int] = None
    remover_cliente: Optional[bool] = None  # True = desvincula o cliente

# ── CLIENTE ───────────────────────────────────────────
class ClienteCreate(BaseModel):
    razao_social: str
    cnpj: Optional[str] = None
    contato_nome: Optional[str] = None
    contato_email: Optional[str] = None
    contato_fone: Optional[str] = None

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
class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: UsuarioOut

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
