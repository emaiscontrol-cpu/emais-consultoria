from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_usuario_atual, requer_perfil, verificar_tenant
from models import Unidade, Cliente
import schemas

router = APIRouter()


@router.get("/cliente/{cliente_id}")
def listar_unidades(
    cliente_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(get_usuario_atual)
):
    verificar_tenant(usuario, cliente_id)
    
    unidades = db.query(Unidade).filter(Unidade.cliente_id == cliente_id).order_by(Unidade.codigo).all()
    return [{"id": u.id, "codigo": u.codigo, "nome": u.nome, "ativo": u.ativo} for u in unidades]


@router.post("/cliente/{cliente_id}", status_code=201)
def criar_unidade(
    cliente_id: int,
    body: dict,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor"))
):
    verificar_tenant(usuario, cliente_id)
    codigo = str(body.get("codigo", "")).strip()
    nome = str(body.get("nome", "")).strip()
    
    if len(codigo) != 3 or not codigo.isdigit():
        raise HTTPException(400, "O código da unidade deve ter exatamente 3 dígitos numéricos")
    if not nome:
        raise HTTPException(400, "O nome da unidade é obrigatório")
        
    # Verificar duplicidade de código ou nome para o mesmo cliente
    dup_cod = db.query(Unidade).filter(Unidade.cliente_id == cliente_id, Unidade.codigo == codigo).first()
    if dup_cod:
        raise HTTPException(400, f"Código de unidade '{codigo}' já cadastrado para este cliente")
        
    dup_nome = db.query(Unidade).filter(Unidade.cliente_id == cliente_id, Unidade.nome == nome).first()
    if dup_nome:
        raise HTTPException(400, f"Nome de unidade '{nome}' já cadastrado para este cliente")
        
    u = Unidade(cliente_id=cliente_id, codigo=codigo, nome=nome, ativo=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    
    return {"id": u.id, "codigo": u.codigo, "nome": u.nome, "ativo": u.ativo}


@router.put("/{unidade_id}")
def atualizar_unidade(
    unidade_id: int,
    body: dict,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor"))
):
    u = db.query(Unidade).filter(Unidade.id == unidade_id).first()
    if not u:
        raise HTTPException(404, "Unidade não encontrada")
        
    if "codigo" in body:
        codigo = str(body["codigo"]).strip()
        if len(codigo) != 3 or not codigo.isdigit():
            raise HTTPException(400, "O código da unidade deve ter exatamente 3 dígitos numéricos")
        # Verificar duplicado
        dup = db.query(Unidade).filter(Unidade.cliente_id == u.cliente_id, Unidade.codigo == codigo, Unidade.id != u.id).first()
        if dup:
            raise HTTPException(400, f"Código de unidade '{codigo}' já está em uso por outra filial")
        u.codigo = codigo
        
    if "nome" in body:
        nome = str(body["nome"]).strip()
        if not nome:
            raise HTTPException(400, "O nome da unidade é obrigatório")
        # Verificar duplicado
        dup = db.query(Unidade).filter(Unidade.cliente_id == u.cliente_id, Unidade.nome == nome, Unidade.id != u.id).first()
        if dup:
            raise HTTPException(400, f"Nome de unidade '{nome}' já está em uso por outra filial")
        u.nome = nome
        
    if "ativo" in body:
        u.ativo = bool(body["ativo"])
        
    db.commit()
    return {"id": u.id, "codigo": u.codigo, "nome": u.nome, "ativo": u.ativo}


@router.delete("/{unidade_id}")
def deletar_unidade(
    unidade_id: int,
    db: Session = Depends(get_db),
    usuario=Depends(requer_perfil("admin", "consultor"))
):
    u = db.query(Unidade).filter(Unidade.id == unidade_id).first()
    if not u:
        raise HTTPException(404, "Unidade não encontrada")
        
    db.delete(u)
    db.commit()
    return {"ok": True}
