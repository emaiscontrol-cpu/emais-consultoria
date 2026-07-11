import csv, io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import SessionLocal
from models import BalanceteLancamento
from security import get_usuario_atual as get_current_user

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

MESES_MAP = {
    'jan':1,'janeiro':1,'fev':2,'fevereiro':2,'mar':3,'março':3,'marco':3,
    'abr':4,'abril':4,'mai':5,'maio':5,'jun':6,'junho':6,
    'jul':7,'julho':7,'ago':8,'agosto':8,'set':9,'setembro':9,
    'out':10,'outubro':10,'nov':11,'novembro':11,'dez':12,'dezembro':12,
}

class LancamentoUpsert(BaseModel):
    valor: float

def _parse_balancete(content: bytes, filename: str) -> list:
    """Retorna lista de {conta, valor}. Aceita XLSX ou CSV."""
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
        KNOWN = {"conta", "valor", "saldo", "debito", "credito", "débito", "crédito"}
        has_headers = any(h in KNOWN for h in first)
        if has_headers:
            headers = first
            data_rows = all_rows[1:]
        else:
            headers = ["conta", "valor"]
            data_rows = all_rows
        for row in data_rows:
            if not any(c for c in row if c is not None):
                continue
            rows.append({headers[j]: str(row[j]).strip() if j < len(row) and row[j] is not None else ""
                         for j in range(min(len(headers), len(row)))})
    else:
        raise HTTPException(400, "Use XLSX, CSV ou TXT.")

    resultado = []
    for r in rows:
        conta = r.get("conta") or ""
        # aceita coluna valor, saldo, debito, credito
        val_raw = r.get("valor") or r.get("saldo") or r.get("débito") or r.get("debito") or r.get("crédito") or r.get("credito") or "0"
        if not conta:
            continue
        try:
            val = float(str(val_raw).replace(".", "").replace(",", ".").replace("R$", "").strip())
        except ValueError:
            val = 0.0
        resultado.append({"conta": conta, "valor": val})
    return resultado


@router.post("/importar")
async def importar_balancete(
    cliente_id: int,
    ano: int,
    mes: int,
    arquivo: UploadFile = File(...),
    substituir: bool = True,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    if not (1 <= mes <= 12):
        raise HTTPException(400, "Mês inválido (1-12)")
    content = await arquivo.read()
    linhas = _parse_balancete(content, arquivo.filename)
    if not linhas:
        raise HTTPException(400, "Nenhuma linha válida encontrada.")
    if substituir:
        db.query(BalanceteLancamento).filter(
            BalanceteLancamento.cliente_id == cliente_id,
            BalanceteLancamento.ano == ano,
            BalanceteLancamento.mes == mes
        ).delete()
    for linha in linhas:
        db.add(BalanceteLancamento(
            cliente_id=cliente_id, ano=ano, mes=mes,
            conta=linha["conta"], valor=linha["valor"]
        ))
    db.commit()
    return {"importados": len(linhas)}


@router.get("/cliente/{cliente_id}/periodos")
def listar_periodos(
    cliente_id: int,
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    from sqlalchemy import func
    rows = (
        db.query(
            BalanceteLancamento.ano,
            BalanceteLancamento.mes,
            func.count(BalanceteLancamento.id).label("qtd_contas"),
            func.sum(BalanceteLancamento.valor).label("soma_valores"),
        )
        .filter(BalanceteLancamento.cliente_id == cliente_id)
        .group_by(BalanceteLancamento.ano, BalanceteLancamento.mes)
        .order_by(BalanceteLancamento.ano.desc(), BalanceteLancamento.mes.desc())
        .all()
    )
    return [{"ano": r.ano, "mes": r.mes, "qtd_contas": r.qtd_contas, "soma_valores": r.soma_valores or 0} for r in rows]


@router.delete("/cliente/{cliente_id}/ano/{ano}/mes/{mes}")
def deletar_periodo(
    cliente_id: int, ano: int, mes: int,
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    deleted = db.query(BalanceteLancamento).filter(
        BalanceteLancamento.cliente_id == cliente_id,
        BalanceteLancamento.ano == ano,
        BalanceteLancamento.mes == mes
    ).delete()
    db.commit()
    return {"removidos": deleted}


@router.get("/cliente/{cliente_id}/ano/{ano}/mes/{mes}")
def obter_lancamentos(
    cliente_id: int, ano: int, mes: int,
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    itens = db.query(BalanceteLancamento).filter(
        BalanceteLancamento.cliente_id == cliente_id,
        BalanceteLancamento.ano == ano,
        BalanceteLancamento.mes == mes
    ).all()
    return {i.conta: i.valor for i in itens}


@router.put("/cliente/{cliente_id}/ano/{ano}/mes/{mes}/conta/{conta}")
def upsert_lancamento(
    cliente_id: int, ano: int, mes: int, conta: str,
    data: LancamentoUpsert,
    db: Session = Depends(get_db), _=Depends(get_current_user)
):
    item = db.query(BalanceteLancamento).filter(
        BalanceteLancamento.cliente_id == cliente_id,
        BalanceteLancamento.ano == ano,
        BalanceteLancamento.mes == mes,
        BalanceteLancamento.conta == conta
    ).first()
    if item:
        item.valor = data.valor
    else:
        db.add(BalanceteLancamento(
            cliente_id=cliente_id, ano=ano, mes=mes,
            conta=conta, valor=data.valor
        ))
    db.commit()
    return {"ok": True}
