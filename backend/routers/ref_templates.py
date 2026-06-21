from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from auth import requer_perfil, get_usuario_atual
import models, schemas
from ref_formula_engine import validar_formula, detectar_ciclo

router = APIRouter()


@router.get("/", response_model=List[schemas.TemplateRefOut])
def listar(tipo: str = None, segmento_id: int = None,
           db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    q = db.query(models.TemplateRef).filter(models.TemplateRef.ativo == True)
    if tipo:
        q = q.filter(models.TemplateRef.tipo == tipo)
    if segmento_id:
        q = q.filter(models.TemplateRef.segmento_id == segmento_id)
    return q.order_by(models.TemplateRef.nome).all()


@router.post("/", response_model=schemas.TemplateRefOut)
def criar(data: schemas.TemplateRefCreate, db: Session = Depends(get_db),
          _=Depends(requer_perfil("admin", "consultor"))):
    if data.tipo not in ("dre", "fluxo_caixa", "orcamento"):
        raise HTTPException(400, "tipo deve ser 'dre', 'fluxo_caixa' ou 'orcamento'")
    t = models.TemplateRef(**data.model_dump())
    db.add(t); db.commit(); db.refresh(t)
    return t


@router.get("/{id}", response_model=schemas.TemplateRefOut)
def detalhe(id: int, db: Session = Depends(get_db), _=Depends(get_usuario_atual)):
    t = db.query(models.TemplateRef).get(id)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    return t


@router.put("/{id}", response_model=schemas.TemplateRefOut)
def atualizar(id: int, data: schemas.TemplateRefUpdate, db: Session = Depends(get_db),
              _=Depends(requer_perfil("admin", "consultor"))):
    t = db.query(models.TemplateRef).get(id)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    db.commit(); db.refresh(t)
    return t


@router.delete("/{id}")
def deletar(id: int, db: Session = Depends(get_db),
            _=Depends(requer_perfil("admin", "consultor"))):
    t = db.query(models.TemplateRef).get(id)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    t.ativo = False
    db.commit()
    return {"ok": True}


def _validar_linhas_do_template(template_id: int, db: Session, excluir_id: int = None):
    """Valida fórmulas e detecta ciclos no template após uma mudança."""
    linhas = (
        db.query(models.TemplateLinhaRef)
        .filter(models.TemplateLinhaRef.template_id == template_id)
        .order_by(models.TemplateLinhaRef.ordem)
        .all()
    )
    if excluir_id:
        linhas = [l for l in linhas if l.id != excluir_id]
    ciclo = detectar_ciclo(linhas)
    if ciclo:
        raise HTTPException(422, f"Referência circular detectada entre: {' → '.join(ciclo)}")
    return linhas


@router.post("/{id}/linhas", response_model=schemas.TemplateLinhaOut)
def criar_linha(id: int, data: schemas.TemplateLinhaCreate, db: Session = Depends(get_db),
                _=Depends(requer_perfil("admin", "consultor"))):
    t = db.query(models.TemplateRef).get(id)
    if not t:
        raise HTTPException(404, "Template não encontrado")

    erro = validar_formula(data.formula_texto)
    if erro:
        raise HTTPException(422, erro)

    linha = models.TemplateLinhaRef(template_id=id, **data.model_dump())
    db.add(linha); db.flush()

    _validar_linhas_do_template(id, db)

    db.commit(); db.refresh(linha)
    return linha


@router.put("/{id}/linhas/{lid}", response_model=schemas.TemplateLinhaOut)
def atualizar_linha(id: int, lid: int, data: schemas.TemplateLinhaUpdate,
                    db: Session = Depends(get_db),
                    _=Depends(requer_perfil("admin", "consultor"))):
    linha = db.query(models.TemplateLinhaRef).filter(
        models.TemplateLinhaRef.id == lid,
        models.TemplateLinhaRef.template_id == id
    ).first()
    if not linha:
        raise HTTPException(404, "Linha não encontrada")

    if data.formula_texto is not None:
        erro = validar_formula(data.formula_texto)
        if erro:
            raise HTTPException(422, erro)

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(linha, k, v)
    db.flush()

    _validar_linhas_do_template(id, db)

    db.commit(); db.refresh(linha)
    return linha


@router.delete("/{id}/linhas/{lid}")
def deletar_linha(id: int, lid: int, db: Session = Depends(get_db),
                  _=Depends(requer_perfil("admin", "consultor"))):
    linha = db.query(models.TemplateLinhaRef).filter(
        models.TemplateLinhaRef.id == lid,
        models.TemplateLinhaRef.template_id == id
    ).first()
    if not linha:
        raise HTTPException(404, "Linha não encontrada")

    _validar_linhas_do_template(id, db, excluir_id=lid)

    db.delete(linha)
    db.commit()
    return {"ok": True}


@router.post("/{id}/duplicar", response_model=schemas.TemplateRefOut)
def duplicar(id: int, req: schemas.DuplicarTemplateRequest, db: Session = Depends(get_db),
             _=Depends(requer_perfil("admin", "consultor"))):
    """Duplica o template para outro segmento, copiando todas as linhas."""
    origem = db.query(models.TemplateRef).get(id)
    if not origem:
        raise HTTPException(404, "Template não encontrado")

    novo_nome = req.nome or f"{origem.nome} (cópia)"
    novo = models.TemplateRef(
        tipo=origem.tipo,
        segmento_id=req.segmento_id,
        nome=novo_nome,
    )
    db.add(novo); db.flush()

    for linha in origem.linhas:
        db.add(models.TemplateLinhaRef(
            template_id=novo.id,
            rotulo=linha.rotulo,
            ordem=linha.ordem,
            negrito_totalizador=linha.negrito_totalizador,
            formula_texto=linha.formula_texto,
        ))

    db.commit(); db.refresh(novo)
    return novo
