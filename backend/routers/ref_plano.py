from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload, joinedload
from typing import List, Optional
from pydantic import BaseModel
from database import get_db
from security import requer_perfil, get_usuario_atual
import models, schemas

router = APIRouter()

DEMOS_VALIDOS = {"fluxo_caixa", "dre", "orcamento"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_vinculo(v: models.ContaAgrupamento) -> dict:
    return {
        "id": v.id,
        "agrupamento_id": v.agrupamento_id,
        "agrupamento_nome": v.agrupamento.nome if v.agrupamento else "",
        "demonstrativo": v.demonstrativo,
        "herdado": v.herdado,
    }


def _fmt_conta(c: models.ContaReferencial) -> dict:
    return {
        "id": c.id,
        "plano_id": c.plano_id,
        "codigo": c.codigo,
        "descricao": c.descricao,
        "tipo": c.tipo,
        "natureza": c.natureza,
        "agrupamento": c.agrupamento,
        "pai_id": c.pai_id,
        "ativo": c.ativo,
        "vinculos": [_fmt_vinculo(v) for v in c.vinculos],
        "filhos": [],
    }


def _build_tree(contas: list) -> list:
    nodes = {c.id: _fmt_conta(c) for c in contas}
    raizes = []
    for c in contas:
        node = nodes[c.id]
        if c.pai_id and c.pai_id in nodes:
            nodes[c.pai_id]["filhos"].append(node)
        else:
            raizes.append(node)
    return raizes


# ── Planos ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[schemas.PlanoRefOut])
def listar(db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.PlanoReferencial).filter(models.PlanoReferencial.ativo == True).all()


@router.post("/", response_model=schemas.PlanoRefOut)
def criar(data: schemas.PlanoRefCreate, db: Session = Depends(get_db),
          _=Depends(requer_perfil("admin", "consultor"))):
    p = models.PlanoReferencial(nome=data.nome)
    db.add(p); db.commit(); db.refresh(p)
    return p


# ── Contas ────────────────────────────────────────────────────────────────────

@router.get("/{plano_id}/contas")
def listar_contas(plano_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    contas = (
        db.query(models.ContaReferencial)
        .filter(models.ContaReferencial.plano_id == plano_id,
                models.ContaReferencial.ativo == True)
        .options(
            selectinload(models.ContaReferencial.vinculos)
            .joinedload(models.ContaAgrupamento.agrupamento)
        )
        .order_by(models.ContaReferencial.codigo)
        .all()
    )
    return _build_tree(contas)


@router.post("/{plano_id}/contas", response_model=schemas.ContaRefOut)
def criar_conta(plano_id: int, data: schemas.ContaRefCreate, db: Session = Depends(get_db),
                _=Depends(requer_perfil("admin", "consultor"))):
    plano = db.query(models.PlanoReferencial).get(plano_id)
    if not plano:
        raise HTTPException(404, "Plano não encontrado")
    existe = (
        db.query(models.ContaReferencial)
        .filter(models.ContaReferencial.plano_id == plano_id,
                models.ContaReferencial.codigo == data.codigo)
        .first()
    )
    if existe:
        raise HTTPException(400, f"Código '{data.codigo}' já existe neste plano")
    conta = models.ContaReferencial(plano_id=plano_id, **data.model_dump())
    db.add(conta); db.commit(); db.refresh(conta)
    return conta


@router.post("/contas/{id}/subcontas", response_model=schemas.ContaRefOut)
def criar_subconta(id: int, data: schemas.ContaRefCreate, db: Session = Depends(get_db),
                   _=Depends(requer_perfil("admin", "consultor"))):
    pai = db.query(models.ContaReferencial).get(id)
    if not pai:
        raise HTTPException(404, "Conta pai não encontrada")
    existe = (
        db.query(models.ContaReferencial)
        .filter(models.ContaReferencial.plano_id == pai.plano_id,
                models.ContaReferencial.codigo == data.codigo)
        .first()
    )
    if existe:
        raise HTTPException(400, f"Código '{data.codigo}' já existe neste plano")
    payload = data.model_dump()
    payload["pai_id"] = pai.id
    payload["plano_id"] = pai.plano_id
    conta = models.ContaReferencial(**payload)
    db.add(conta); db.commit(); db.refresh(conta)
    return conta


@router.put("/contas/{id}", response_model=schemas.ContaRefOut)
def atualizar_conta(id: int, data: schemas.ContaRefUpdate, db: Session = Depends(get_db),
                    _=Depends(requer_perfil("admin", "consultor"))):
    conta = db.query(models.ContaReferencial).get(id)
    if not conta:
        raise HTTPException(404, "Conta não encontrada")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(conta, k, v)
    db.commit(); db.refresh(conta)
    return conta


@router.delete("/contas/{id}")
def deletar_conta(id: int, db: Session = Depends(get_db),
                  _=Depends(requer_perfil("admin", "consultor"))):
    conta = db.query(models.ContaReferencial).get(id)
    if not conta:
        raise HTTPException(404, "Conta não encontrada")
    if db.query(models.ContaReferencial).filter(
            models.ContaReferencial.pai_id == id,
            models.ContaReferencial.ativo == True).count():
        raise HTTPException(400, "Conta possui sub-contas ativas. Remova-as primeiro.")
    conta.ativo = False
    db.commit()
    return {"ok": True}


# ── Vínculos de Agrupamento ───────────────────────────────────────────────────

class VinculoIn(BaseModel):
    agrupamento_id: int
    demonstrativo: str
    propagar: bool = False


@router.get("/contas/{id}/agrupamentos")
def listar_vinculos(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    vinculos = (
        db.query(models.ContaAgrupamento)
        .filter(models.ContaAgrupamento.conta_referencial_id == id)
        .options(joinedload(models.ContaAgrupamento.agrupamento))
        .all()
    )
    return [_fmt_vinculo(v) for v in vinculos]


@router.post("/contas/{id}/agrupamentos", status_code=201)
def criar_vinculo(id: int, data: VinculoIn, db: Session = Depends(get_db),
                  _=Depends(requer_perfil("admin", "consultor"))):
    conta = db.query(models.ContaReferencial).get(id)
    if not conta:
        raise HTTPException(404, "Conta não encontrada")
    if data.demonstrativo not in DEMOS_VALIDOS:
        raise HTTPException(400, f"demonstrativo inválido; use: {', '.join(DEMOS_VALIDOS)}")
    agrup = db.query(models.Agrupamento).get(data.agrupamento_id)
    if not agrup:
        raise HTTPException(404, "Agrupamento não encontrado")

    # Upsert: remove TODOS os vínculos existentes (herdado ou não) para este conta+demo
    existentes = db.query(models.ContaAgrupamento).filter(
        models.ContaAgrupamento.conta_referencial_id == id,
        models.ContaAgrupamento.demonstrativo == data.demonstrativo,
    ).all()
    for e in existentes:
        db.delete(e)
    if existentes:
        db.flush()

    v = models.ContaAgrupamento(
        conta_referencial_id=id,
        agrupamento_id=data.agrupamento_id,
        demonstrativo=data.demonstrativo,
        herdado=False,
    )
    db.add(v)
    db.flush()

    propagados = 0
    if data.propagar:
        filhas = db.query(models.ContaReferencial).filter(
            models.ContaReferencial.pai_id == id,
            models.ContaReferencial.ativo == True,
        ).all()
        for filha in filhas:
            # Não sobrescreve vínculo direto existente para o mesmo demonstrativo
            direto = db.query(models.ContaAgrupamento).filter(
                models.ContaAgrupamento.conta_referencial_id == filha.id,
                models.ContaAgrupamento.demonstrativo == data.demonstrativo,
                models.ContaAgrupamento.herdado == False,
            ).first()
            if direto:
                continue
            ja_herdado = db.query(models.ContaAgrupamento).filter(
                models.ContaAgrupamento.conta_referencial_id == filha.id,
                models.ContaAgrupamento.agrupamento_id == data.agrupamento_id,
                models.ContaAgrupamento.demonstrativo == data.demonstrativo,
            ).first()
            if not ja_herdado:
                db.add(models.ContaAgrupamento(
                    conta_referencial_id=filha.id,
                    agrupamento_id=data.agrupamento_id,
                    demonstrativo=data.demonstrativo,
                    herdado=True,
                ))
                propagados += 1

    db.commit()
    db.refresh(v)
    v.agrupamento  # trigger load
    return {**_fmt_vinculo(v), "propagados": propagados}


@router.delete("/contas/{id}/agrupamentos/{vinculo_id}")
def remover_vinculo(id: int, vinculo_id: int, db: Session = Depends(get_db),
                    _=Depends(requer_perfil("admin", "consultor"))):
    v = db.query(models.ContaAgrupamento).filter(
        models.ContaAgrupamento.id == vinculo_id,
        models.ContaAgrupamento.conta_referencial_id == id,
    ).first()
    if not v:
        raise HTTPException(404, "Vínculo não encontrado")
    db.delete(v)
    db.commit()
    return {"ok": True}


@router.post("/contas/{id}/propagar-agrupamento")
def propagar_agrupamento(id: int, db: Session = Depends(get_db),
                         _=Depends(requer_perfil("admin", "consultor"))):
    """Propaga os vínculos diretos (herdado=False) do pai para suas filhas diretas."""
    conta = db.query(models.ContaReferencial).get(id)
    if not conta:
        raise HTTPException(404, "Conta não encontrada")

    vinculos_pai = db.query(models.ContaAgrupamento).filter(
        models.ContaAgrupamento.conta_referencial_id == id,
        models.ContaAgrupamento.herdado == False,
    ).all()
    if not vinculos_pai:
        raise HTTPException(400, "Conta não possui vínculos diretos para propagar")

    filhas = db.query(models.ContaReferencial).filter(
        models.ContaReferencial.pai_id == id,
        models.ContaReferencial.ativo == True,
    ).all()

    propagados = 0
    for filha in filhas:
        for v in vinculos_pai:
            direto = db.query(models.ContaAgrupamento).filter(
                models.ContaAgrupamento.conta_referencial_id == filha.id,
                models.ContaAgrupamento.demonstrativo == v.demonstrativo,
                models.ContaAgrupamento.herdado == False,
            ).first()
            if direto:
                continue
            ja_existe = db.query(models.ContaAgrupamento).filter(
                models.ContaAgrupamento.conta_referencial_id == filha.id,
                models.ContaAgrupamento.agrupamento_id == v.agrupamento_id,
                models.ContaAgrupamento.demonstrativo == v.demonstrativo,
            ).first()
            if not ja_existe:
                db.add(models.ContaAgrupamento(
                    conta_referencial_id=filha.id,
                    agrupamento_id=v.agrupamento_id,
                    demonstrativo=v.demonstrativo,
                    herdado=True,
                ))
                propagados += 1

    db.commit()
    return {"propagados": propagados, "filhas": len(filhas)}


@router.get("/contas/{id}/sugerir-agrupamento")
def sugerir_agrupamento(id: int, db: Session = Depends(get_db),
                        _=Depends(requer_perfil("admin", "consultor"))):
    """Retorna top 3 agrupamentos mais similares à descrição da conta (rapidfuzz)."""
    conta = db.query(models.ContaReferencial).get(id)
    if not conta:
        raise HTTPException(404, "Conta não encontrada")

    agrupamentos = db.query(models.Agrupamento).filter(models.Agrupamento.ativo == True).all()
    if not agrupamentos:
        return []

    try:
        from rapidfuzz import fuzz
        def _sim(a, b): return fuzz.WRatio(a, b) / 100.0
    except ImportError:
        def _sim(a, b):
            sa, sb = set(a.split()), set(b.split())
            return len(sa & sb) / max(len(sa), len(sb)) if sa and sb else 0.0

    desc = conta.descricao.strip().lower()
    resultados = sorted(
        [{"id": a.id, "nome": a.nome, "confianca": round(_sim(desc, a.nome.strip().lower()), 3)}
         for a in agrupamentos],
        key=lambda x: x["confianca"],
        reverse=True,
    )
    return resultados[:3]


@router.post("/auto-sugerir-agrupamentos")
def auto_sugerir_agrupamentos(
    plano_id: int = 1,
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin", "consultor")),
):
    """
    Primeira passagem automática: vincula contas analíticas sem vínculo
    ao agrupamento mais similar (rapidfuzz). >= 80% → cria vínculo; < 80% → pendente.
    """
    agrupamentos = db.query(models.Agrupamento).filter(models.Agrupamento.ativo == True).all()
    if not agrupamentos:
        raise HTTPException(400, "Nenhum agrupamento cadastrado")

    try:
        from rapidfuzz import fuzz
        def _sim(a, b): return fuzz.WRatio(a, b) / 100.0
    except ImportError:
        def _sim(a, b):
            sa, sb = set(a.split()), set(b.split())
            return len(sa & sb) / max(len(sa), len(sb)) if sa and sb else 0.0

    # Contas analíticas sem nenhum vínculo de agrupamento
    contas_sem_vinculo = (
        db.query(models.ContaReferencial)
        .outerjoin(
            models.ContaAgrupamento,
            models.ContaAgrupamento.conta_referencial_id == models.ContaReferencial.id,
        )
        .filter(
            models.ContaReferencial.plano_id == plano_id,
            models.ContaReferencial.tipo == "analitica",
            models.ContaReferencial.ativo == True,
            models.ContaAgrupamento.id == None,
        )
        .all()
    )

    vinculados = 0
    pendentes = []

    for conta in contas_sem_vinculo:
        desc = conta.descricao.strip().lower()
        melhor = max(agrupamentos, key=lambda a: _sim(desc, a.nome.strip().lower()))
        score = _sim(desc, melhor.nome.strip().lower())

        if score >= 0.80:
            db.add(models.ContaAgrupamento(
                conta_referencial_id=conta.id,
                agrupamento_id=melhor.id,
                demonstrativo="fluxo_caixa",
                herdado=False,
            ))
            vinculados += 1
        else:
            pendentes.append({
                "conta_id": conta.id,
                "codigo": conta.codigo,
                "descricao": conta.descricao,
                "melhor_agrupamento": melhor.nome,
                "confianca": round(score, 3),
            })

    db.commit()

    pendentes.sort(key=lambda x: x["confianca"])
    return {
        "total_sem_vinculo": len(contas_sem_vinculo),
        "vinculados": vinculados,
        "pendentes": len(pendentes),
        "top_menor_confianca": pendentes[:10],
    }


# ── Agrupamentos legacy (mantido para compatibilidade com TemplatesRef) ───────

@router.get("/agrupamentos/{plano_id}", response_model=List[str])
def listar_agrupamentos(plano_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    """Retorna lista de agrupamentos únicos usados no plano (para sugestão em fórmulas)."""
    rows = (
        db.query(models.ContaReferencial.agrupamento)
        .filter(models.ContaReferencial.plano_id == plano_id,
                models.ContaReferencial.agrupamento != None,
                models.ContaReferencial.ativo == True)
        .distinct()
        .all()
    )
    return [r[0] for r in rows if r[0]]
