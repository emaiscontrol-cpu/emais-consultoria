---
description: Cria um novo módulo completo no projeto E Mais Consultoria (router backend + página frontend + rota + sidebar + API)
argument-hint: <nome-do-modulo> [descrição curta]
allowed-tools: [Read, Edit, Write, Glob, Grep, Bash]
---

# Novo Módulo — E Mais Consultoria

Cria um módulo completo seguindo as convenções do projeto. O argumento é o nome do módulo: $ARGUMENTS

## Passo 1 — Entender o escopo

Antes de criar qualquer arquivo, pergunte ao usuário (se não estiver claro nos argumentos):
- Qual o nome do módulo? (ex: `bandeiras`, `relatorios`, `chat`)
- Quais perfis terão acesso? (`admin`, `consultor`, `ger_projeto`, `analista`, `ti`)
- O módulo aparece na Sidebar? Em qual seção? (Principal / Controladoria / Administração / Procedimentos)
- Precisa de modelos no banco? (novos campos ou nova tabela?)

## Passo 2 — Backend: Router

Crie `backend/routers/<nome>.py` seguindo este padrão:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_usuario_atual
import models, schemas

router = APIRouter(prefix="/<nome>", tags=["<Nome>"])

@router.get("/")
def listar(db: Session = Depends(get_db), usuario = Depends(get_usuario_atual)):
    # Filtro multi-tenant: analista/ger_projeto/ti só veem seu cliente
    if usuario.perfil in ("analista", "ger_projeto", "ti") and usuario.cliente_id:
        return db.query(models.<Modelo>).filter_by(cliente_id=usuario.cliente_id).all()
    return db.query(models.<Modelo>).all()
```

**Regras obrigatórias:**
- Sempre usar `Depends(get_usuario_atual)` para proteger endpoints
- Filtro multi-tenant em TODOS os endpoints que retornam dados de cliente
- Retornar sempre o objeto atualizado após salvar (não apenas `{"ok": True}`)
- Usar `requer_perfil("admin", "consultor")` para endpoints restritos

## Passo 3 — Registrar o router em `backend/main.py`

Adicionar na linha de imports dos routers e no `app.include_router(...)`:

```python
# No import (linha ~7):
from routers import ..., <nome>

# No corpo (após os outros include_router):
app.include_router(<nome>.router)
```

## Passo 4 — Modelos e Schemas (se necessário)

Se o módulo precisar de nova tabela, adicionar em `backend/models.py`:

```python
class <Modelo>(Base):
    __tablename__ = "<tabela>"
    id         = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id"))
    nome       = Column(String, nullable=False)
    criado_em  = Column(DateTime, server_default=func.now())
```

Adicionar schema em `backend/schemas.py`:

```python
class <Modelo>Base(BaseModel):
    nome: str

class <Modelo>Criar(<Modelo>Base):
    cliente_id: int

class <Modelo>Out(<Modelo>Base):
    id: int
    cliente_id: int
    class Config:
        from_attributes = True
```

## Passo 5 — Migração de banco (SQLite apenas)

Se adicionou coluna em tabela existente, incluir no bloco de migrações em `backend/main.py`:

```python
"ALTER TABLE <tabela> ADD COLUMN <coluna> <TIPO> DEFAULT <valor>",
```

O bloco já é tolerante a erros (coluna já existe = silencioso). **Não** adicionar migração para Supabase — ele usa `create_all`.

## Passo 6 — Frontend: Endpoint na API

Adicionar em `frontend/src/services/api.js`:

```js
export const <nome>API = {
  listar:   ()      => api.get('/<nome>/'),
  criar:    (d)     => api.post('/<nome>/', d),
  atualizar:(id, d) => api.put(`/<nome>/${id}`, d),
  deletar:  (id)    => api.delete(`/<nome>/${id}`),
}
```

## Passo 7 — Frontend: Página

Criar `frontend/src/pages/<Nome>.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { <nome>API } from '../services/api'
import { LoadingPage, Modal } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function <Nome>() {
  const { usuario } = useAuth()
  const [itens,    setItens]    = useState([])
  const [loading,  setLoading]  = useState(true)

  const carregar = async () => {
    try {
      const { data } = await <nome>API.listar()
      setItens(data)
    } catch { toast.error('Erro ao carregar') }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  if (loading) return <LoadingPage />

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title"><Nome></h1>
      </div>
      {/* conteúdo */}
    </div>
  )
}
```

**Regras obrigatórias do frontend:**
- Ícones: exclusivamente **Lucide React** — nunca emoji, nunca outra lib
- Cores: exclusivamente **CSS variables** (`var(--brand)`, `var(--text)`, `var(--border)`, `var(--card)`, `var(--bg)`, `var(--text-2)`, `var(--text-3)`, `var(--red)`, `var(--green)`, `var(--amber)`) — nunca hex hardcoded
- API: sempre via `api.js` — nunca `fetch` direto
- Toasts: `toast.success()` / `toast.error()` — nunca `alert()`
- Componentes reutilizáveis: `Modal`, `Avatar`, `Badge`, `Progress`, `LoadingPage` de `../components/shared`

## Passo 8 — Rota em `frontend/src/App.jsx`

Adicionar import e rota dentro de `<ProtectedLayout>`:

```jsx
import <Nome> from './pages/<Nome>'

// Dentro de <Routes>:
<Route path="/<nome>" element={<Nome />} />
```

## Passo 9 — Sidebar em `frontend/src/components/Sidebar.jsx`

Adicionar o link na seção correta, respeitando as flags de visibilidade:

```jsx
// Exemplo para seção principal (todos os perfis com acesso):
{ isConsultor && (
  <NavLink to="/<nome>" className={navClass}>
    <IconeEscolhido size={15} />
    <span><Nome></span>
  </NavLink>
)}
```

Flags de visibilidade disponíveis:
- `isAdmin` — apenas `admin`
- `isAdminConsultor` — `admin` + `consultor`
- `isConsultor` — todos exceto analista restrito sem cliente
- `isControladoria` — mesmo que `isConsultor` (equivalentes atualmente)
- `isRestrito` — analista/ger_projeto/ti com `cliente_id` preenchido

## Passo 10 — Verificação final

Antes de reportar concluído:
- [ ] Router criado e registrado no `main.py`
- [ ] Filtro multi-tenant em todos os endpoints de listagem
- [ ] Endpoint adicionado em `api.js`
- [ ] Página criada sem cores hardcoded e sem ícones de outra lib
- [ ] Rota adicionada no `App.jsx`
- [ ] Link adicionado na Sidebar com a flag correta
- [ ] Se backend tocado: rodar `pytest tests/ -v` antes de commitar
- [ ] Lembrar o usuário: **Ctrl+Shift+R** no Electron após recarregar o servidor
