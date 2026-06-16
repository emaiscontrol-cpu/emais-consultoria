# Instruções para o Claude — E Mais Consultoria

Este arquivo configura o comportamento do Claude Code neste projeto.

---

## Idioma

Sempre responder em **português do Brasil (pt-BR)**, sem exceção.

---

## Arquitetura do Sistema

### Backend
- **Framework:** FastAPI + SQLAlchemy + SQLite
- **Porta:** 8000
- **Reload automático:** `uvicorn --reload` — detecta mudanças de arquivo automaticamente

### Dois ambientes — NÃO CONFUNDIR

| | Máquina do Desenvolvedor (Luiz) | Servidor de Produção |
|---|---|---|
| Código | `emals_consultoria\backend\` | `C:\emals-app\backend\` |
| **Banco de dados** | `C:\emals-service\emais_consultoria.db` | **`C:\emals-app\backend\emais_consultoria.db`** |
| DATABASE_URL | padrão (sem .env) | `sqlite:///./emais_consultoria.db` (via `.env`) |
| Serviço WinSW | `EmaisBackend` (local, porta 8000) | `EmaisBackend` (produção, porta 8000) |
| ngrok | `EmaisNgrok` (local) | processo separado |
| Dados | desenvolvimento / testes | **PRODUÇÃO — dados reais dos clientes** |

> ⚠️ **REGRA CRÍTICA:** O banco local (`C:\emals-service\`) é de desenvolvimento e está SEMPRE desatualizado em relação à produção. NUNCA enviar o banco local para o servidor. Os dados reais ficam no servidor em `C:\emals-app\backend\emais_consultoria.db`.

> ⚠️ **ANTES de qualquer ação no banco:** verificar contagem via `/api/version` (expõe `clientes`, `usuarios`, `projetos`, `db_url`, `admin_db_path`). Confirmar que `admin_db_path` == caminho esperado ANTES de qualquer restore.

> ⚠️ **O usuário (Luiz) é o DEV.** Os dados de produção existem no servidor independentemente da máquina local estar ligada ou não.

### Frontend
- **Framework:** React 19 + Vite
- **Build:** `frontend/dist/` — servido pelo próprio backend FastAPI
- **Cliente desktop:** Electron (`electron-client/`) — carrega direto da URL ngrok

### Deploy
- **Script:** `.\release.ps1` na raiz do projeto
- **Fluxo:** compila frontend → git add/commit/push → servidor puxa via git → uvicorn recarrega
- **Versão:** atualizar `app.version` em `backend/main.py` a cada release
- **Padrão de versão:** `2.3.0a`, `2.3.0b`, ... `2.3.0z`, `2.3.1a`, etc.
- **ATENÇÃO:** novos arquivos backend não são commitados automaticamente pelo `release.ps1` — commitar explicitamente antes do release se necessário

### Infraestrutura
- **ngrok:** túnel público — o servidor de produção tem o ngrok rodando permanentemente
- **Máquina local:** também tem `EmaisNgrok` service, mas serve banco de desenvolvimento (diferente do servidor)
- **Teste correto:** sempre usar o **Electron** para testar com usuários reais (banco do servidor)

---

## Perfis de Usuário (PerfilEnum)

| Perfil       | Descrição              | Restrições                              |
|-------------|------------------------|------------------------------------------|
| `admin`     | Administrador total    | Acesso completo                          |
| `consultor` | Consultor E Mais       | Gerencia projetos e controladoria        |
| `ger_projeto`| Gerente de Projeto    | Gerencia projeto específico do cliente   |
| `analista`  | Analista (cliente)     | Vê apenas dados do seu `cliente_id`      |
| `ti`        | T.I. do cliente        | Vê apenas dados do seu `cliente_id`      |

**Regra multi-tenant:** perfis `analista`, `ger_projeto` e `ti` com `cliente_id` preenchido só enxergam dados daquele cliente.

---

## Sidebar — Visibilidade por Perfil

```
Principal           → todos
Controladoria       → isControladoria (todos exceto analista/ger_projeto/ti sem cliente)
Clientes (Anotações)→ isConsultor
Administração       → isAdminConsultor (admin + consultor) — colapsável
Procedimentos       → isAdmin (admin apenas) — colapsável
  ├── Templates de Projeto
  ├── Modelos & Contas
  └── Backup
Footer              → todos (foto, Manual, Alterar senha, Sair)
```

---

## Convenções de Código

### Backend
- Migrações de banco via bloco `with engine.connect()` em `main.py` (padrão `ALTER TABLE ... ADD COLUMN`, tolerante a erros)
- Novos routers: criar em `backend/routers/`, registrar em `main.py`
- Permissões: usar `requer_perfil("admin", "consultor")` ou verificação inline com `usuario.perfil`
- Padrão de resposta: retornar sempre o objeto atualizado após salvar

### Frontend
- Componentes compartilhados: `frontend/src/components/shared.jsx` (`Modal`, `Avatar`, `Badge`, `Progress`, `LoadingPage`)
- Ícones: exclusivamente **Lucide React**
- Chamadas à API: sempre via `frontend/src/services/api.js` — nunca `fetch` direto (exceto `/api/version`)
- Estilos: CSS variables (`var(--brand)`, `var(--border)`, `var(--text-muted)`, etc.) — não usar cores hardcoded
- Notificações: `react-hot-toast` (`toast.success`, `toast.error`)

---

## Padrões de Nomenclatura

- `analista` — tipo de usuário do cliente (era `cliente` até v2.3.0v)
- `Atividade` — nome na UI para subtarefas (o campo no banco continua `subtarefas`)
- `Template de Projeto` — nome na UI para `ModeloProjeto`

---

## Após Cada Modificação

Sempre lembrar o usuário de:
1. Fazer **Ctrl+Shift+R** no Electron após o servidor recarregar
2. Aguardar ~30s para uvicorn recarregar após o git push

---

## ROADMAP

O arquivo `ROADMAP.md` na raiz do projeto contém o backlog oficial.
- Marcar `[x]` quando implementado
- Mover para seção "✅ Concluído" com a versão
- Atualizar após cada release

---

## Pontos de Atenção (Não Quebrar)

1. **Migração no startup:** o bloco `with engine.connect()` em `main.py` roda a cada inicialização — deve ser tolerante a erros (coluna já existe = silencioso)
2. **Frontend servido pelo backend:** `frontend/dist/` é servido estático — sempre fazer build antes do release
3. **JWT sem refresh:** token expira em 8h; não há renovação automática ainda
4. **Foto em base64:** armazenada como TEXT no banco — sem validação de tamanho ainda (limite recomendado: 500KB)
5. **Backup automático:** usa `threading.Timer` global — cuidado com múltiplas instâncias
6. **ngrok pooling:** ao testar localmente, parar o serviço `EmaisBackend` local antes de chamar endpoints que dependem do banco do servidor

---

## Estrutura de Arquivos Importante

```
emals_consultoria/
├── backend/
│   ├── main.py              # Startup, routers, versão, migrações
│   ├── models.py            # Todos os modelos SQLAlchemy
│   ├── schemas.py           # Todos os schemas Pydantic
│   ├── auth.py              # JWT, hash de senha, get_usuario_atual
│   ├── database.py          # Engine, SessionLocal, Base
│   ├── helpers.py           # Função log() para LogAtividade
│   └── routers/             # Um arquivo por domínio
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Rotas React
│   │   ├── components/
│   │   │   ├── Sidebar.jsx  # Navegação principal
│   │   │   └── shared.jsx   # Componentes reutilizáveis
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/           # Uma página por rota
│   │   └── services/
│   │       └── api.js       # Todos os endpoints da API
│   └── dist/                # Build de produção (commitado no git)
├── electron-client/         # App desktop
├── release.ps1              # Script de deploy
├── ROADMAP.md               # Backlog de features e correções
└── CLAUDE.md                # Este arquivo
```
