import csv, io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
from database import SessionLocal
from models import Plano, PlanoItem, ClientePlano, Cliente
from auth import get_usuario_atual as get_current_user

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── Schemas ────────────────────────────────────────────────────────────────────

class PlanoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None

class PlanoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    ativo: Optional[bool] = None

class PlanoItemCreate(BaseModel):
    agrupamento: str
    descricao: str
    conta: Optional[str] = None
    tipo: Optional[str] = None
    modulo: Optional[str] = None
    movimento: Optional[str] = None
    ordem: Optional[int] = 0
    formula: Optional[str] = None
    nivel: Optional[int] = None

class PlanoItemUpdate(BaseModel):
    agrupamento: Optional[str] = None
    descricao: Optional[str] = None
    conta: Optional[str] = None
    tipo: Optional[str] = None
    modulo: Optional[str] = None
    movimento: Optional[str] = None
    ordem: Optional[int] = None
    formula: Optional[str] = None
    nivel: Optional[int] = None

# ── Helpers ────────────────────────────────────────────────────────────────────

def plano_to_dict(p: Plano, incluir_itens=False):
    modulos = set()
    for i in p.itens:
        if i.modulo:
            for m in i.modulo.replace(' ', '').split(','):
                if m: modulos.add(m.upper())
    d = {
        "id": p.id, "nome": p.nome, "descricao": p.descricao,
        "ativo": p.ativo, "criado_em": p.criado_em,
        "total_itens": len(p.itens),
        "modulos": sorted(modulos),
        "clientes_vinculados": [
            {"id": v.cliente_id, "razao_social": v.cliente.razao_social}
            for v in p.vinculos
        ],
    }
    if incluir_itens:
        d["itens"] = [item_to_dict(i) for i in p.itens]
    return d

def item_to_dict(i: PlanoItem):
    return {
        "id": i.id, "plano_id": i.plano_id,
        "agrupamento": i.agrupamento, "descricao": i.descricao,
        "conta": i.conta, "tipo": i.tipo, "modulo": i.modulo,
        "movimento": i.movimento, "ordem": i.ordem, "formula": i.formula,
        "nivel": i.nivel,
    }

def detectar_nivel(conta: str, tipo: str) -> int:
    """AN → 3 | TT/RES sem ponto → 1 | TT/RES com ponto → 2."""
    if (tipo or '').upper() == 'AN':
        return 3
    return 1 if '.' not in (conta or '') else 2

def _compute_niveis(plano_id: int, db: Session):
    """Recalcula nivel com base no formato do campo conta."""
    items = db.query(PlanoItem).filter(PlanoItem.plano_id == plano_id).order_by(PlanoItem.ordem).all()
    for it in items:
        it.nivel = detectar_nivel(it.conta or '', it.tipo or '')
    db.commit()

_KNOWN_HEADERS = {"agrupamento", "classificação", "classificacao", "descricao", "descrição",
                  "descricao da conta", "conta", "tipo", "modulo", "módulo", "movimento"}
# Mapeamento posicional quando o arquivo não tem cabeçalho
_POS_HEADERS = ["agrupamento", "descricao", "conta", "tipo", "modulo", "movimento"]

def _parse_file(content: bytes, filename: str) -> list:
    ext = filename.rsplit(".", 1)[-1].lower()
    rows = []
    if ext in ("csv", "txt"):
        text = content.decode("utf-8-sig", errors="replace")
        dialect = csv.Sniffer().sniff(text[:2048], delimiters=";,\t")
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        for r in reader:
            rows.append({k.strip().lower(): (v or "").strip() for k, v in r.items()})
    elif ext in ("xlsx", "xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active
        all_rows = [r for r in ws.iter_rows(values_only=True) if any(c for c in r if c is not None)]
        wb.close()
        if not all_rows:
            return []
        first = [str(c).strip().lower() if c else "" for c in all_rows[0]]
        has_headers = any(h in _KNOWN_HEADERS for h in first)
        if has_headers:
            headers = first
            data_rows = all_rows[1:]
        else:
            headers = _POS_HEADERS
            data_rows = all_rows
        for row in data_rows:
            if not any(c for c in row if c is not None):
                continue
            rows.append({headers[j]: str(row[j]).strip() if j < len(row) and row[j] is not None else ""
                         for j in range(min(len(headers), len(row)))})
    else:
        raise HTTPException(status_code=400, detail="Use XLSX, CSV ou TXT.")

    resultado = []
    _MOV = {"e": "Entrada", "s": "Saída", "r": "Receita", "d": "Despesa"}
    for r in rows:
        agrup = r.get("agrupamento") or r.get("classificação") or r.get("classificacao") or ""
        desc  = (r.get("descricao") or r.get("descrição") or r.get("descricao da conta") or "").strip()
        conta = r.get("conta") or ""
        tipo  = r.get("tipo") or ""
        mod   = r.get("modulo") or r.get("módulo") or ""
        mov_raw = (r.get("movimento") or "").strip()
        mov = _MOV.get(mov_raw.lower(), mov_raw) if mov_raw else None
        if desc:
            resultado.append({
                "agrupamento": agrup or "",
                "descricao": desc,
                "conta": conta or None,
                "tipo": tipo or None,
                "modulo": mod.upper() or None,
                "movimento": mov,
            })
    return resultado

# ── CRUD Planos ────────────────────────────────────────────────────────────────

@router.get("")
def listar_planos(db: Session = Depends(get_db), _=Depends(get_current_user)):
    planos = db.query(Plano).filter(Plano.ativo == True).order_by(Plano.nome).all()
    return [plano_to_dict(p) for p in planos]


@router.post("")
def criar_plano(data: PlanoCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = Plano(**data.model_dump())
    db.add(p); db.commit(); db.refresh(p)
    return plano_to_dict(p)


@router.get("/{plano_id}")
def obter_plano(plano_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Plano).filter(Plano.id == plano_id).first()
    if not p: raise HTTPException(404, "Plano não encontrado")
    return plano_to_dict(p, incluir_itens=True)


@router.put("/{plano_id}")
def atualizar_plano(plano_id: int, data: PlanoUpdate,
                    db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Plano).filter(Plano.id == plano_id).first()
    if not p: raise HTTPException(404, "Plano não encontrado")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    db.commit(); db.refresh(p)
    return plano_to_dict(p)


@router.delete("/{plano_id}")
def excluir_plano(plano_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Plano).filter(Plano.id == plano_id).first()
    if not p: raise HTTPException(404, "Plano não encontrado")
    db.delete(p); db.commit()
    return {"ok": True}

# ── Itens ──────────────────────────────────────────────────────────────────────

@router.post("/{plano_id}/itens")
def adicionar_item(plano_id: int, data: PlanoItemCreate,
                   db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not db.query(Plano).filter(Plano.id == plano_id).first():
        raise HTTPException(404, "Plano não encontrado")
    nivel_item = data.nivel or detectar_nivel(data.conta or '', data.tipo or '')
    if nivel_item == 1 and not (data.agrupamento or '').strip():
        raise HTTPException(422, "Totalizador Principal (N1) requer Agrupamento preenchido")
    item = PlanoItem(plano_id=plano_id, **data.model_dump())
    db.add(item); db.commit()
    _compute_niveis(plano_id, db)
    db.refresh(item)
    return item_to_dict(item)


@router.put("/{plano_id}/itens/{item_id}")
def atualizar_item(plano_id: int, item_id: int, data: PlanoItemUpdate,
                   db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(PlanoItem).filter(PlanoItem.id == item_id,
                                      PlanoItem.plano_id == plano_id).first()
    if not item: raise HTTPException(404, "Item não encontrado")
    updates = data.model_dump(exclude_none=True)
    for k, v in updates.items():
        setattr(item, k, v)
    nivel_final = detectar_nivel(item.conta or '', item.tipo or '')
    if nivel_final == 1 and not (item.agrupamento or '').strip():
        raise HTTPException(422, "Totalizador Principal (N1) requer Agrupamento preenchido")
    db.commit()
    if 'nivel' not in updates and ('tipo' in updates or 'ordem' in updates or 'conta' in updates):
        _compute_niveis(plano_id, db)
    db.refresh(item)
    return item_to_dict(item)


@router.delete("/{plano_id}/itens/{item_id}")
def excluir_item(plano_id: int, item_id: int,
                 db: Session = Depends(get_db), _=Depends(get_current_user)):
    item = db.query(PlanoItem).filter(PlanoItem.id == item_id,
                                      PlanoItem.plano_id == plano_id).first()
    if not item: raise HTTPException(404, "Item não encontrado")
    db.execute(text("DELETE FROM orcamento_unidade_valores WHERE plano_item_id = :id"), {"id": item_id})
    db.execute(text("DELETE FROM orcamento_valores WHERE plano_item_id = :id"), {"id": item_id})
    db.delete(item); db.commit()
    return {"ok": True}

# ── Importação ─────────────────────────────────────────────────────────────────

@router.post("/{plano_id}/importar")
async def importar_itens(plano_id: int, arquivo: UploadFile = File(...),
                         substituir: bool = True,
                         db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(Plano).filter(Plano.id == plano_id).first()
    if not p: raise HTTPException(404, "Plano não encontrado")
    content = await arquivo.read()
    linhas = _parse_file(content, arquivo.filename)
    if not linhas:
        raise HTTPException(400, "Nenhuma linha válida encontrada.")
    if substituir:
        db.query(PlanoItem).filter(PlanoItem.plano_id == plano_id).delete()
    for ordem, linha in enumerate(linhas):
        db.add(PlanoItem(plano_id=plano_id, ordem=ordem, **linha))
    db.commit()
    _compute_niveis(plano_id, db)
    db.refresh(p)
    return {"importados": len(linhas), "total_itens": len(p.itens)}

# ── Vínculos cliente ↔ plano ──────────────────────────────────────────────────

@router.get("/{plano_id}/clientes")
def clientes_do_plano(plano_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    todos = db.query(Cliente).filter(Cliente.ativo == True).order_by(Cliente.razao_social).all()
    vinculados = {v.cliente_id for v in db.query(ClientePlano).filter(ClientePlano.plano_id == plano_id).all()}
    return [{"id": c.id, "razao_social": c.razao_social, "vinculado": c.id in vinculados}
            for c in todos]


@router.put("/{plano_id}/clientes/{cliente_id}")
def vincular_cliente(plano_id: int, cliente_id: int,
                     db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not db.query(Plano).filter(Plano.id == plano_id).first():
        raise HTTPException(404, "Plano não encontrado")
    # Remove vínculo anterior deste cliente com outro plano
    db.query(ClientePlano).filter(ClientePlano.cliente_id == cliente_id).delete()
    db.add(ClientePlano(cliente_id=cliente_id, plano_id=plano_id))
    db.commit()
    return {"ok": True}


@router.delete("/{plano_id}/clientes/{cliente_id}")
def desvincular_cliente(plano_id: int, cliente_id: int,
                        db: Session = Depends(get_db), _=Depends(get_current_user)):
    db.query(ClientePlano).filter(ClientePlano.cliente_id == cliente_id,
                                  ClientePlano.plano_id == plano_id).delete()
    db.commit()
    return {"ok": True}


@router.get("/cliente/{cliente_id}/modulo/{modulo}")
def plano_por_cliente_modulo(cliente_id: int, modulo: str,
                              db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Retorna itens do plano do cliente filtrados pelo módulo (F, D ou O)."""
    vinculo = db.query(ClientePlano).filter(ClientePlano.cliente_id == cliente_id).first()
    if not vinculo:
        return {"plano": None, "itens": []}
    p = vinculo.plano
    mod_upper = modulo.upper()
    itens = [item_to_dict(i) for i in p.itens
             if i.modulo and mod_upper in [m.strip() for m in i.modulo.upper().split(",")]]
    return {"plano": {"id": p.id, "nome": p.nome}, "itens": itens}
