---
description: Adiciona um novo módulo comercial vendável ao E Mais Consultoria — colunas no banco, schemas, autenticação, sidebar com locking, página SaibaMais e toggle no cadastro de clientes
argument-hint: <nome-do-modulo> <label-exibição> (ex: inteligencia_mercado "Inteligência de Mercado")
allowed-tools: [Read, Edit, Write, Glob, Grep, Bash, PowerShell]
---

# Novo Módulo Comercial — E Mais Consultoria

Adiciona um módulo que pode ser contratado ou não por cada cliente.
Padrão implementado em v2.5.0u. Argumento: $ARGUMENTS

## Passo 1 — Entender o escopo

- Qual o `snake_case` do módulo? (ex: `inteligencia_mercado`)
- Qual o label exibido na UI? (ex: `Inteligência de Mercado`)
- Qual cor identificadora? (hex, ex: `#7c3aed`)
- Qual ícone Lucide React?
- Quais telas/funcionalidades compõem o módulo?
- O módulo já tem telas implementadas ou é futuro?

## Passo 2 — Banco: coluna em `clientes`

Em `backend/models.py`, adicionar campo na classe `Cliente`:
```python
modulo_<nome> = Column(Boolean, default=False)
```

## Passo 3 — Migração SQLite (`backend/main.py`)

No bloco de migrações SQLite (lista de strings `ALTER TABLE`):
```python
"ALTER TABLE clientes ADD COLUMN modulo_<nome> BOOLEAN NOT NULL DEFAULT 0",
```

No bloco PostgreSQL (`if not _is_sqlite`):
```python
"ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modulo_<nome> BOOLEAN NOT NULL DEFAULT FALSE",
```

## Passo 4 — Schema (`backend/schemas.py`)

Em `ModulosCliente`, adicionar campo:
```python
<nome>: bool = False
```

Em `ClienteCreate` e `ClienteOut`, adicionar:
```python
modulo_<nome>: bool = False
```

## Passo 5 — Auth (`backend/routers/auth.py`)

Em `_modulos_do_cliente()`, adicionar no retorno de `ModulosCliente`:
```python
<nome>=bool(cliente.modulo_<nome>),
```

## Passo 6 — Sidebar (`frontend/src/components/Sidebar.jsx`)

**6a.** Criar a seção do módulo seguindo o padrão das existentes:
- Se for seção colapsável: usar `SectionBtn` com prop `bloqueado`
- Items desbloqueados: `NavLink` normais
- Items bloqueados: `LockedItem` apontando para `/saiba-mais/<nome>`
- Forçar `open = true` quando `bloqueado`

**6b.** No componente `Sidebar`, calcular:
```jsx
const bloqueado<NomeModulo> = isCliente && !temModulo('<nome>')
```

**6c.** Renderizar a seção sempre (sem guard de `temModulo`):
```jsx
<NomeModuloSection bloqueado={bloqueado<NomeModulo>} />
```

## Passo 7 — Página SaibaMais (`frontend/src/pages/SaibaMais.jsx`)

Adicionar entrada no objeto `MODULOS`:
```js
<nome>: {
  icon: <IconeLucide>,
  cor: '<hex>',
  nome: 'Módulo <Label>',
  descricao: '<descrição do que o módulo oferece>',
  funcionalidades: ['item 1', 'item 2', 'item 3'],
},
```

## Passo 8 — Toggle em Clientes.jsx (`frontend/src/pages/Clientes.jsx`)

Adicionar entrada no array `MODULOS`:
```js
{
  key:   'modulo_<nome>',
  label: '<Label>',
  desc:  '<descrição curta para o admin>',
  icon:  <IconeLucide>,
  cor:   '<hex>',
},
```

Adicionar no `FORM_VAZIO`:
```js
modulo_<nome>: false,
```

Adicionar no `abrirEditar`:
```js
modulo_<nome>: c.modulo_<nome> ?? false,
```

## Passo 9 — Build e testes

```bash
pytest tests/ -v          # backend deve passar
npm run build             # frontend deve compilar sem erro
```

## Passo 10 — Verificação final

- [ ] Coluna adicionada em `models.py`
- [ ] Migração SQLite no bloco da lista
- [ ] Migração PostgreSQL no bloco `if not _is_sqlite`
- [ ] Campo em `ModulosCliente`, `ClienteCreate`, `ClienteOut`
- [ ] Campo em `_modulos_do_cliente()` no auth
- [ ] Seção na sidebar com prop `bloqueado`, sempre visível
- [ ] Entrada em `SaibaMais.jsx` → objeto `MODULOS`
- [ ] Entrada em `Clientes.jsx` → array `MODULOS` + `FORM_VAZIO` + `abrirEditar`
- [ ] `pytest tests/ -v` passando
- [ ] `npm run build` sem erros
- [ ] Lembrar: **Ctrl+Shift+R** no Electron após deploy
