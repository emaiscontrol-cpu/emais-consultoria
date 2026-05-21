from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import PlanoContas, ContaFC, ValorMensalFC, SaldoInicialFC, AgrupadorFC
from auth import get_usuario_atual
from schemas import UsuarioOut
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

PERFIS = {"admin", "consultor", "ger_projeto"}

def check(u):
    if u.perfil not in PERFIS:
        raise HTTPException(403, "Acesso negado")


# ── Schemas ───────────────────────────────────────────────────────────────────

class PlanoIn(BaseModel):
    nome: str
    cliente_id: int
    descricao: Optional[str] = None

class ContaIn(BaseModel):
    plano_id: int
    codigo: Optional[str] = None
    nome: str
    tipo: str           # 'entrada' | 'saida'
    classe: Optional[str] = None
    agrupador_id: Optional[int] = None
    pai_id: Optional[int] = None
    nivel: int = 1
    ordem: int = 0

class ContaUpdate(BaseModel):
    codigo: Optional[str] = None
    nome: Optional[str] = None
    tipo: Optional[str] = None
    classe: Optional[str] = None
    agrupador_id: Optional[int] = None
    pai_id: Optional[int] = None
    ordem: Optional[int] = None

class ValorIn(BaseModel):
    conta_id: int
    ano: int
    mes: int
    valor: float

class SaldoIn(BaseModel):
    plano_id: int
    ano: int
    mes: int
    valor: float

class ImportContaItem(BaseModel):
    codigo: Optional[str] = None
    nome: str
    tipo: str
    classe: Optional[str] = None
    codigo_pai: Optional[str] = None
    ordem: int = 0

class AgrupadorIn(BaseModel):
    nome: str
    padrao: bool = False


# ── Agrupadores ───────────────────────────────────────────────────────────────

@router.get("/agrupadores")
def listar_agrupadores(db: Session = Depends(get_db),
                       u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    return [{"id": a.id, "nome": a.nome, "padrao": a.padrao}
            for a in db.query(AgrupadorFC).filter(AgrupadorFC.ativo == True).order_by(AgrupadorFC.nome).all()]

@router.post("/agrupadores", status_code=201)
def criar_agrupador(data: AgrupadorIn, db: Session = Depends(get_db),
                    u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    if db.query(AgrupadorFC).filter(AgrupadorFC.nome == data.nome, AgrupadorFC.ativo == True).first():
        raise HTTPException(400, "Agrupador já existe")
    a = AgrupadorFC(nome=data.nome, padrao=data.padrao)
    db.add(a); db.commit(); db.refresh(a)
    return {"id": a.id, "nome": a.nome, "padrao": a.padrao}

@router.delete("/agrupadores/{id}")
def deletar_agrupador(id: int, db: Session = Depends(get_db),
                      u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    a = db.get(AgrupadorFC, id)
    if not a: raise HTTPException(404, "Agrupador não encontrado")
    a.ativo = False; db.commit()
    return {"ok": True}


# ── Planos de Contas ──────────────────────────────────────────────────────────

def _plano_out(p):
    return {"id": p.id, "nome": p.nome, "descricao": p.descricao,
            "cliente_id": p.cliente_id,
            "cliente": p.cliente.razao_social if p.cliente else None}

@router.get("/planos")
def listar_planos(cliente_id: Optional[int] = None,
                  db: Session = Depends(get_db),
                  u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    q = db.query(PlanoContas).filter(PlanoContas.ativo == True)
    if cliente_id:
        q = q.filter(PlanoContas.cliente_id == cliente_id)
    return [_plano_out(p) for p in q.all()]

@router.post("/planos", status_code=201)
def criar_plano(data: PlanoIn, db: Session = Depends(get_db),
                u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    p = PlanoContas(**data.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return _plano_out(p)

@router.put("/planos/{id}")
def atualizar_plano(id: int, data: PlanoIn, db: Session = Depends(get_db),
                    u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    p = db.get(PlanoContas, id)
    if not p: raise HTTPException(404, "Plano não encontrado")
    for k, v in data.model_dump().items(): setattr(p, k, v)
    db.commit()
    return _plano_out(p)

@router.delete("/planos/{id}")
def deletar_plano(id: int, db: Session = Depends(get_db),
                  u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    p = db.get(PlanoContas, id)
    if not p: raise HTTPException(404, "Plano não encontrado")
    p.ativo = False; db.commit()
    return {"ok": True}


# ── Contas ────────────────────────────────────────────────────────────────────

def _conta_out(c):
    return {
        "id": c.id, "plano_id": c.plano_id, "codigo": c.codigo,
        "nome": c.nome, "tipo": c.tipo, "classe": c.classe,
        "agrupador_id": c.agrupador_id,
        "agrupador": c.agrupador.nome if c.agrupador else None,
        "pai_id": c.pai_id, "nivel": c.nivel, "ordem": c.ordem,
        "tem_filhos": len(c.filhos) > 0,
    }

@router.get("/planos/{plano_id}/contas")
def listar_contas(plano_id: int, db: Session = Depends(get_db),
                  u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    contas = db.query(ContaFC).filter(
        ContaFC.plano_id == plano_id, ContaFC.ativo == True
    ).order_by(ContaFC.ordem).all()
    return [_conta_out(c) for c in contas]

@router.post("/contas", status_code=201)
def criar_conta(data: ContaIn, db: Session = Depends(get_db),
                u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    if data.tipo not in ("entrada", "saida"):
        raise HTTPException(400, "tipo deve ser 'entrada' ou 'saida'")
    c = ContaFC(**data.model_dump())
    db.add(c); db.commit(); db.refresh(c)
    return _conta_out(c)

@router.put("/contas/{id}")
def atualizar_conta(id: int, data: ContaUpdate, db: Session = Depends(get_db),
                    u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    c = db.get(ContaFC, id)
    if not c: raise HTTPException(404, "Conta não encontrada")
    for k, v in data.model_dump(exclude_none=True).items(): setattr(c, k, v)
    db.commit()
    return _conta_out(c)

@router.delete("/contas/{id}")
def deletar_conta(id: int, db: Session = Depends(get_db),
                  u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    c = db.get(ContaFC, id)
    if not c: raise HTTPException(404, "Conta não encontrada")
    c.ativo = False; db.commit()
    return {"ok": True}

@router.post("/planos/{plano_id}/template", status_code=201)
def aplicar_template(plano_id: int, db: Session = Depends(get_db),
                     u: UsuarioOut = Depends(get_usuario_atual)):
    """Importa o plano de contas padrão para um plano vazio."""
    check(u)
    p = db.get(PlanoContas, plano_id)
    if not p: raise HTTPException(404, "Plano não encontrado")
    tem_contas = db.query(ContaFC).filter(ContaFC.plano_id == plano_id, ContaFC.ativo == True).count()
    if tem_contas > 0:
        raise HTTPException(400, "Plano já possui contas. Exclua-as antes de aplicar o template.")
    from seed_controladoria import seed_plano_template, PLANO_PADRAO, AGRUPADORES
    # garante agrupadores
    from seed_controladoria import seed_agrupadores
    seed_agrupadores(db)
    agrup_map = {a.nome: a.id for a in db.query(AgrupadorFC).filter(AgrupadorFC.ativo == True).all()}
    from seed_controladoria import PLANO_PADRAO
    codigo_map = {}
    for ordem, (codigo, nome, tipo, agrup_nome, codigo_pai) in enumerate(PLANO_PADRAO):
        pai_id       = codigo_map.get(codigo_pai) if codigo_pai else None
        agrupador_id = agrup_map.get(agrup_nome)
        c = ContaFC(plano_id=plano_id, codigo=codigo, nome=nome, tipo=tipo,
                    agrupador_id=agrupador_id, pai_id=pai_id,
                    nivel=2 if pai_id else 1, ordem=ordem)
        db.add(c); db.flush()
        codigo_map[codigo] = c.id
    db.commit()
    return {"importadas": len(PLANO_PADRAO)}

@router.post("/planos/{plano_id}/importar", status_code=201)
def importar_contas(plano_id: int, contas: list[ImportContaItem],
                    db: Session = Depends(get_db),
                    u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    p = db.get(PlanoContas, plano_id)
    if not p: raise HTTPException(404, "Plano não encontrado")

    # Desativa contas existentes do plano
    db.query(ContaFC).filter(ContaFC.plano_id == plano_id).update({"ativo": False})
    db.commit()

    # Cria mapa codigo → id para resolver pai_id
    criados = {}
    for item in contas:
        pai_id = criados.get(item.codigo_pai) if item.codigo_pai else None
        c = ContaFC(
            plano_id=plano_id, codigo=item.codigo, nome=item.nome,
            tipo=item.tipo, classe=item.classe, pai_id=pai_id,
            nivel=2 if pai_id else 1, ordem=item.ordem,
        )
        db.add(c); db.flush()
        if item.codigo:
            criados[item.codigo] = c.id
    db.commit()
    return {"importadas": len(contas)}


# ── Valores Mensais ───────────────────────────────────────────────────────────

@router.get("/valores/{plano_id}/{ano}")
def get_valores(plano_id: int, ano: int, db: Session = Depends(get_db),
                u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    conta_ids = [c.id for c in db.query(ContaFC).filter(
        ContaFC.plano_id == plano_id, ContaFC.ativo == True).all()]
    vals = db.query(ValorMensalFC).filter(
        ValorMensalFC.conta_id.in_(conta_ids),
        ValorMensalFC.ano == ano,
    ).all()
    return [{"conta_id": v.conta_id, "mes": v.mes, "valor": v.valor} for v in vals]

@router.post("/valores")
def salvar_valor(data: ValorIn, db: Session = Depends(get_db),
                 u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    existing = db.query(ValorMensalFC).filter(
        ValorMensalFC.conta_id == data.conta_id,
        ValorMensalFC.ano == data.ano,
        ValorMensalFC.mes == data.mes,
    ).first()
    if existing:
        existing.valor = data.valor
    else:
        db.add(ValorMensalFC(**data.model_dump()))
    db.commit()
    return {"ok": True}


# ── Saldos Iniciais ───────────────────────────────────────────────────────────

@router.get("/saldos/{plano_id}/{ano}")
def get_saldos(plano_id: int, ano: int, db: Session = Depends(get_db),
               u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    saldos = db.query(SaldoInicialFC).filter(
        SaldoInicialFC.plano_id == plano_id,
        SaldoInicialFC.ano == ano,
    ).all()
    return [{"mes": s.mes, "valor": s.valor} for s in saldos]

@router.post("/saldos")
def salvar_saldo(data: SaldoIn, db: Session = Depends(get_db),
                 u: UsuarioOut = Depends(get_usuario_atual)):
    check(u)
    existing = db.query(SaldoInicialFC).filter(
        SaldoInicialFC.plano_id == data.plano_id,
        SaldoInicialFC.ano == data.ano,
        SaldoInicialFC.mes == data.mes,
    ).first()
    if existing:
        existing.valor = data.valor
    else:
        db.add(SaldoInicialFC(**data.model_dump()))
    db.commit()
    return {"ok": True}
