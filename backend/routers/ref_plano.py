from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import requer_perfil, get_usuario_atual
import models, schemas

router = APIRouter()


def _build_tree(contas: list) -> list:
    """Monta hierarquia de contas a partir de lista plana."""
    by_id = {c.id: c for c in contas}
    raizes = []
    for c in contas:
        if c.pai_id is None or c.pai_id not in by_id:
            raizes.append(c)
    return raizes


@router.get("/", response_model=List[schemas.PlanoRefOut])
def listar(db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    return db.query(models.PlanoReferencial).filter(models.PlanoReferencial.ativo == True).all()


@router.post("/", response_model=schemas.PlanoRefOut)
def criar(data: schemas.PlanoRefCreate, db: Session = Depends(get_db),
          _=Depends(requer_perfil("admin", "consultor"))):
    p = models.PlanoReferencial(nome=data.nome)
    db.add(p); db.commit(); db.refresh(p)
    return p


@router.get("/{plano_id}/contas", response_model=List[schemas.ContaRefOut])
def listar_contas(plano_id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    contas = (
        db.query(models.ContaReferencial)
        .filter(models.ContaReferencial.plano_id == plano_id,
                models.ContaReferencial.ativo == True)
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
