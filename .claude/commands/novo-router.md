---
description: Cria apenas o router backend no E Mais Consultoria — sem frontend. Use quando já existe página ou quando só precisa de novos endpoints.
argument-hint: <nome-do-router> [prefixo-url]
allowed-tools: [Read, Edit, Write, Grep, Bash]
---

# Novo Router Backend — E Mais Consultoria

Cria um router FastAPI seguindo as convenções do projeto. Argumento: $ARGUMENTS

Use `/novo-modulo` se precisar também de página, rota e sidebar. Este comando cobre **somente o backend**.

## Passo 1 — Verificar se já existe

```bash
ls backend/routers/
grep -n "from routers import" backend/main.py
```

Se já existir um router com nome próximo, ler o arquivo existente antes de criar um novo — pode ser extensão, não criação.

## Passo 2 — Criar `backend/routers/<nome>.py`

Estrutura mínima com os padrões do projeto:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_usuario_atual
import models

router = APIRouter(prefix="/<nome>", tags=["<Nome>"])


@router.get("/")
def listar(
    db: Session = Depends(get_db),
    usuario = Depends(get_usuario_atual),
):
    # Multi-tenant: analista/ger_projeto/ti só veem seu cliente
    if usuario.perfil in ("analista", "ger_projeto", "ti") and usuario.cliente_id:
        return db.query(models.<Modelo>).filter_by(cliente_id=usuario.cliente_id).all()
    return db.query(models.<Modelo>).all()


@router.post("/")
def criar(
    dados: schemas.<ModeloBase>,
    db: Session = Depends(get_db),
    usuario = Depends(get_usuario_atual),
):
    if usuario.perfil not in ("admin", "consultor"):
        raise HTTPException(status_code=403, detail="Sem permissão")
    item = models.<Modelo>(**dados.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item  # sempre retornar o objeto atualizado


@router.put("/{id}")
def atualizar(
    id: int,
    dados: schemas.<ModeloBase>,
    db: Session = Depends(get_db),
    usuario = Depends(get_usuario_atual),
):
    item = db.query(models.<Modelo>).filter_by(id=id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Não encontrado")
    for k, v in dados.dict(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{id}")
def deletar(
    id: int,
    db: Session = Depends(get_db),
    usuario = Depends(get_usuario_atual),
):
    if usuario.perfil not in ("admin", "consultor"):
        raise HTTPException(status_code=403, detail="Sem permissão")
    item = db.query(models.<Modelo>).filter_by(id=id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Não encontrado")
    db.delete(item)
    db.commit()
    return {"ok": True}
```

**Regras obrigatórias:**
- Todo endpoint deve ter `Depends(get_usuario_atual)` — sem exceção
- Endpoints de escrita (POST/PUT/DELETE) devem verificar o perfil
- Listagens com dados de cliente **sempre** têm filtro multi-tenant
- Retornar sempre o objeto após salvar (não apenas `{"ok": True}` em POST/PUT)

## Passo 3 — Registrar em `backend/main.py`

Localizar a linha de imports dos routers (linha ~7):

```bash
grep -n "from routers import" backend/main.py
```

Adicionar o novo router na importação e no `include_router`:

```python
# Importação (adicionar ao final da linha existente):
from routers import ..., <nome>

# Registro (adicionar após os outros app.include_router):
app.include_router(<nome>.router)
```

## Passo 4 — Modelos em `backend/models.py` (se necessário)

Se o router precisar de nova tabela:

```python
class <Modelo>(Base):
    __tablename__ = "<tabela>"
    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=True)
    nome       = Column(String, nullable=False)
    criado_em  = Column(DateTime, server_default=func.now())
    # Relacionamento (opcional):
    cliente    = relationship("Cliente", back_populates="<tabela>")
```

## Passo 5 — Schemas em `backend/schemas.py` (se necessário)

```python
class <Modelo>Base(BaseModel):
    nome: str
    cliente_id: Optional[int] = None

class <Modelo>Criar(<Modelo>Base):
    pass

class <Modelo>Out(<Modelo>Base):
    id: int
    criado_em: datetime
    class Config:
        from_attributes = True
```

## Passo 6 — Migração SQLite (se adicionou coluna em tabela existente)

Adicionar no bloco de migrações em `backend/main.py` — **somente** para SQLite, o bloco já filtra por `_is_sqlite`:

```python
"ALTER TABLE <tabela_existente> ADD COLUMN <coluna> <TIPO> DEFAULT <valor>",
```

Nova tabela **não precisa** de migração — `create_all` já cria no startup.

## Passo 7 — Verificação

```bash
# Verificar que o router foi importado corretamente
grep "<nome>" backend/main.py

# Rodar testes (se o router tocar endpoints cobertos pelos testes)
pytest tests/ -v
```

Testar manualmente subindo o backend:

```
GET  http://localhost:8000/<nome>/
POST http://localhost:8000/<nome>/
```

## Checklist

- [ ] `backend/routers/<nome>.py` criado
- [ ] Router registrado em `backend/main.py` (import + include_router)
- [ ] Filtro multi-tenant em todos os GETs que retornam dados de cliente
- [ ] Verificação de perfil em POST / PUT / DELETE
- [ ] Modelos e schemas adicionados (se necessário)
- [ ] Migração adicionada apenas para colunas em tabelas existentes
- [ ] `pytest tests/ -v` passou (se endpoints cobertos pelos testes foram afetados)
- [ ] Sem `print()` ou `logging.debug()` esquecidos no código
