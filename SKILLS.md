# Skills do Projeto — E Mais Consultoria

Skills são comandos personalizados do Claude Code que automatizam tarefas recorrentes deste projeto. São invocados digitando `/nome-da-skill` no prompt do Claude Code.

Os arquivos ficam em `.claude/commands/` e seguem as convenções documentadas no `CLAUDE.md`.

---

## `/novo-modulo`

Cria um módulo completo do zero: router backend, modelos, schemas, endpoint na API, página React, rota no App.jsx e link na Sidebar — tudo seguindo as convenções do projeto.

**Quando usar:** ao implementar uma funcionalidade nova que precisa de tela própria e endpoints dedicados.

**Uso:**
```
/novo-modulo bandeiras
/novo-modulo relatorios-pdf Relatórios em PDF por projeto
```

**O que é criado:**
- `backend/routers/<nome>.py` — CRUD completo com filtro multi-tenant
- Registro do router em `backend/main.py`
- Modelo em `backend/models.py` e schema em `backend/schemas.py` (se necessário)
- Migração SQLite no bloco de startup do `main.py` (se necessário)
- Endpoint em `frontend/src/services/api.js`
- Página em `frontend/src/pages/<Nome>.jsx`
- Rota em `frontend/src/App.jsx`
- Link na `frontend/src/components/Sidebar.jsx` com a flag de visibilidade correta

**Exemplo de sessão:**
```
você: /novo-modulo ocorrencias
Claude: Qual perfil terá acesso? (admin, consultor, ger_projeto, analista, ti)
você: consultor e admin
Claude: Aparece na Sidebar? Em qual seção?
você: sim, seção Principal
Claude: [cria todos os arquivos e mostra o checklist final]
```

---

## `/novo-router`

Cria apenas o router backend. Use quando a página já existe ou quando só precisa de novos endpoints, sem interface gráfica.

**Quando usar:** ao adicionar endpoints a um módulo existente, ao criar uma API consumida pelo Electron ou por integrações externas, ou ao separar responsabilidades de um router que cresceu demais.

**Uso:**
```
/novo-router exportacao
/novo-router webhooks /webhooks/entrada
```

**O que é criado:**
- `backend/routers/<nome>.py` com estrutura CRUD completa
- Registro em `backend/main.py`
- Modelos e schemas (se necessário)
- Migração SQLite (se necessário)

**Exemplo de sessão:**
```
você: /novo-router integracao-erp
Claude: O router precisa de nova tabela no banco?
você: não, só lê dados de projetos e clientes existentes
Claude: [cria backend/routers/integracao_erp.py e registra no main.py]
```

---

## `/fix-permissao`

Diagnostica e corrige problemas de acesso — desde endpoints retornando 403 até botões sumidos na tela ou dados de um cliente aparecendo para outro.

**Quando usar:** sempre que um usuário relatar que não consegue acessar algo que deveria, ou que está vendo dados que não deveria ver.

**Uso:**
```
/fix-permissao analista não consegue ver o botão de adicionar atividade
/fix-permissao endpoint /fases/ retorna 403 para ger_projeto
/fix-permissao cliente A está vendo projetos do cliente B
```

**Diagnósticos cobertos:**

| Sintoma | Causa comum | Onde corrigir |
|---|---|---|
| Endpoint retorna 403 | `requer_perfil` com lista incompleta | `backend/routers/<nome>.py` |
| Dado de outro cliente aparece | Filtro multi-tenant ausente | Query no router |
| Seção sumiu da Sidebar | Flag de visibilidade errada | `Sidebar.jsx` |
| Botão sumiu na página | `perfil === 'cliente'` (nome antigo) | Página `.jsx` |
| Backend permite, tela bloqueia | Condição invertida no frontend | Página `.jsx` |

**Exemplo de sessão:**
```
você: /fix-permissao o perfil ger_projeto não vê a seção de Controladoria
Claude: [lê Sidebar.jsx, identifica que isControladoria não inclui ger_projeto,
         mostra a linha e aplica a correção]
```

---

## `/release`

Executa o fluxo completo de publicação de uma nova versão — da atualização do número de versão até a confirmação no servidor.

**Quando usar:** após mergear um PR na `main` e querer publicar para os usuários.

**Uso:**
```
/release
/release 2.5.1a
```

**Fluxo executado:**

1. Verifica branch e estado do working tree
2. Lê versão atual em `backend/main.py` e sugere o próximo incremento
3. Atualiza `app.version` no `main.py`
4. Roda `npm run build` no frontend
5. Commita `backend/main.py` + `frontend/dist/`
6. Atualiza `ROADMAP.md` — move itens implementados para "✅ Concluído"
7. Faz `git push origin main`
8. Executa `.\release.ps1`
9. Verifica `/api/version` no servidor para confirmar o deploy
10. Lembra o usuário do **Ctrl+Shift+R** no Electron

**Exemplo de sessão:**
```
você: /release
Claude: Versão atual: 2.5.0s. Próxima sugerida: 2.5.0t. Confirma?
você: sim
Claude: [build, commit, push, release.ps1...]
        ✅ Release v2.5.0t publicado. Pressione Ctrl+Shift+R no Electron.
```

**Padrão de versão:** `2.5.0a` → `2.5.0b` → ... → `2.5.0z` → `2.5.1a`

---

## Convenções aplicadas por todas as skills

As skills conhecem e aplicam automaticamente as regras do `CLAUDE.md`:

- **Multi-tenant:** filtro `cliente_id` obrigatório em toda listagem para perfis `analista`, `ger_projeto` e `ti`
- **Ícones:** exclusivamente Lucide React
- **Cores:** exclusivamente CSS variables (`var(--brand)`, `var(--border)`, etc.)
- **API:** sempre via `frontend/src/services/api.js`, nunca `fetch` direto
- **Notificações:** `toast.success()` / `toast.error()` do react-hot-toast
- **Componentes:** `Modal`, `Avatar`, `Badge`, `Progress`, `LoadingPage` de `shared.jsx`
- **Migração:** `ALTER TABLE` somente para SQLite; Supabase usa `create_all`
- **Testes:** `pytest tests/ -v` antes de commitar se backend for tocado

---

## Adicionando novas skills

Crie um arquivo `.claude/commands/<nome>.md` com o frontmatter:

```markdown
---
description: Descrição do que a skill faz e quando usar
argument-hint: <argumento-obrigatorio> [argumento-opcional]
allowed-tools: [Read, Edit, Write, Glob, Grep, Bash]
---

# Título da Skill
...
```

O arquivo é automaticamente reconhecido pelo Claude Code como `/nome` e aparece no `/help`.
