---
description: Diagnostica e corrige problemas de permissão no E Mais Consultoria — perfil sem acesso a endpoint, página invisível na sidebar, filtro multi-tenant incorreto ou dado vazando entre clientes
argument-hint: <sintoma> (ex: "analista não vê botão X", "endpoint retorna 403", "cliente A vê dados do cliente B")
allowed-tools: [Read, Edit, Grep, Glob, Bash]
---

# Fix de Permissão — E Mais Consultoria

Diagnostica e corrige problemas de acesso. Sintoma relatado: $ARGUMENTS

## Perfis e suas regras (referência rápida)

| Perfil | Acesso |
|---|---|
| `admin` | Total |
| `consultor` | Projetos, clientes, controladoria, templates — sem backup |
| `ger_projeto` | Projeto específico do cliente vinculado |
| `analista` | Somente dados do próprio `cliente_id` |
| `ti` | Somente dados do próprio `cliente_id` |

**Regra multi-tenant:** perfis `analista`, `ger_projeto` e `ti` com `cliente_id` preenchido enxergam **somente** dados daquele cliente.

---

## Diagnóstico 1 — Endpoint retornando 403 ou 401

Verificar o decorator do endpoint no router:

```bash
grep -n "requer_perfil\|get_usuario_atual\|perfil" backend/routers/<router>.py
```

Causas comuns:
- `requer_perfil("admin")` quando deveria incluir `"consultor"`
- Verificação inline com `if usuario.perfil not in (...)` com lista incompleta
- Endpoint sem `Depends(get_usuario_atual)` (sem autenticação alguma)

**Correção padrão:**
```python
# Restrito a admin e consultor:
from auth import requer_perfil
usuario = Depends(requer_perfil("admin", "consultor"))

# Ou verificação inline:
if usuario.perfil not in ("admin", "consultor", "ger_projeto"):
    raise HTTPException(status_code=403, detail="Sem permissão")
```

---

## Diagnóstico 2 — Dado de um cliente aparecendo para outro (vazamento multi-tenant)

Verificar todos os endpoints de listagem do router suspeito:

```bash
grep -n "query\|filter\|cliente_id" backend/routers/<router>.py
```

Todo endpoint que retorna dados de cliente **deve** ter:

```python
if usuario.perfil in ("analista", "ger_projeto", "ti") and usuario.cliente_id:
    return db.query(models.<Modelo>).filter_by(cliente_id=usuario.cliente_id).all()
return db.query(models.<Modelo>).all()
```

Se o filtro existir mas ainda vazar, verificar se o modelo tem o campo `cliente_id` mapeado corretamente em `backend/models.py`.

---

## Diagnóstico 3 — Botão / seção invisível na Sidebar

Ler `frontend/src/components/Sidebar.jsx` e localizar as flags:

```bash
grep -n "isAdmin\|isConsultor\|isControladoria\|isAdminConsultor\|isRestrito" frontend/src/components/Sidebar.jsx | head -20
```

Flags disponíveis (definidas na Sidebar):
```js
const isAdmin          = ['admin'].includes(usuario?.perfil)
const isAdminConsultor = ['admin', 'consultor'].includes(usuario?.perfil)
const isRestrito       = ['analista', 'ger_projeto', 'ti'].includes(usuario?.perfil) && !!usuario?.cliente_id
const isConsultor      = isRestrito || ['admin', 'consultor', 'ger_projeto', 'ti'].includes(usuario?.perfil)
const isControladoria  = isRestrito || ['admin', 'consultor', 'ger_projeto', 'ti'].includes(usuario?.perfil)
```

Localizar o NavLink do item suspeito e ajustar a flag condicional:

```jsx
{isConsultor && (
  <NavLink to="/modulo">...</NavLink>
)}
```

---

## Diagnóstico 4 — Componente / botão invisível dentro de uma página

Procurar onde a página verifica o perfil:

```bash
grep -n "perfil\|isCliente\|isConsultor\|isAdmin" frontend/src/pages/<Pagina>.jsx
```

Causas comuns:
- `perfil === 'cliente'` — nome antigo, deve ser `'analista'` desde v2.3.0v
- Lista de perfis incompleta: faltando `'ger_projeto'` ou `'ti'`
- Condição invertida: `!isConsultor` quando deveria ser `isConsultor`

**Correção do rename antigo:**
```js
// ❌ Errado (nome antigo)
const isCliente = usuario?.perfil === 'cliente'

// ✅ Correto
const isCliente = usuario?.perfil === 'analista'
```

---

## Diagnóstico 5 — Permissão funciona no backend mas não no frontend (ou vice-versa)

Verificar se backend e frontend estão em sincronia:

1. **Backend permite, frontend esconde** — usuário tem acesso mas não vê o botão: corrigir a flag no frontend
2. **Frontend mostra, backend bloqueia** — usuário vê o botão mas recebe erro: corrigir o decorator no backend
3. **Ambos corretos mas dado não aparece** — verificar filtro multi-tenant na query do banco

---

## Fluxo de correção

1. Identificar onde está o bloqueio (backend / frontend sidebar / frontend página)
2. Ler o arquivo relevante com `Read`
3. Aplicar a correção mínima necessária — não alterar lógica não relacionada
4. Verificar se outros endpoints / componentes do mesmo módulo têm o mesmo problema
5. Rodar `pytest tests/ -v` se a mudança tocou backend
6. Lembrar o usuário: **Ctrl+Shift+R** no Electron após recarregar
