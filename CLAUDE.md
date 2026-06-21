# Instruções para o Claude — E Mais Consultoria

Este arquivo configura o comportamento do Claude Code neste projeto.

---

## Idioma

Sempre responder em **português do Brasil (pt-BR)**, sem exceção.

---

## Arquitetura do Sistema

### Backend
- **Framework:** FastAPI + SQLAlchemy
- **Banco local (dev):** SQLite (`C:\emals-service\emais_consultoria.db`)
- **Banco produção:** PostgreSQL via **Supabase** (migrado na v2.5.0s)
- **Porta:** 8000
- **Reload automático:** `uvicorn --reload` — detecta mudanças de arquivo automaticamente

### Dois ambientes — NÃO CONFUNDIR

| | Máquina do Desenvolvedor (Luiz) | Servidor de Produção |
|---|---|---|
| Código | `emals_consultoria\backend\` | `C:\emals-app\backend\` |
| **Banco de dados** | SQLite: `C:\emals-service\emais_consultoria.db` | **PostgreSQL — Supabase (pooler IPv4)** |
| DATABASE_URL | padrão sem `.env` → SQLite local | `postgresql://...` via `.env` no servidor |
| Serviço WinSW | `EmaisBackend` (local, porta 8000) | `EmaisBackend` (produção, porta 8000) |
| ngrok | `EmaisNgrok` (local) | processo separado |
| Dados | desenvolvimento / testes | **PRODUÇÃO — dados reais dos clientes** |

> ⚠️ **REGRA CRÍTICA:** Banco local é SQLite e produção é PostgreSQL (Supabase) — são engines diferentes. NUNCA tentar copiar ou restaurar o banco local para o servidor. Os dados reais ficam exclusivamente no Supabase de produção.

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
- **Versão atual:** `2.5.0s` (em `backend/main.py` → `app.version`)
- **Padrão de versão:** `2.5.0a`, `2.5.0b`, ... `2.5.0z`, `2.5.1a`, etc.
- **ATENÇÃO:** novos arquivos backend não são commitados automaticamente pelo `release.ps1` — commitar explicitamente antes do release se necessário

### Infraestrutura
- **ngrok:** túnel público — o servidor de produção tem o ngrok rodando permanentemente
- **Máquina local:** também tem `EmaisNgrok` service, mas serve banco de desenvolvimento (diferente do servidor)
- **Teste correto:** sempre usar o **Electron** para testar com usuários reais (banco do servidor)
- **WinSW no servidor:** `C:\emals-service\emals-backend.exe` + `C:\emals-service\emals-backend.xml`
- **Logs do serviço no servidor:** `C:\emals-service\logs\emals-backend.err.log` (erros) e `emals-backend.out.log` (stdout)
- **Código rodando no servidor:** `C:\emals-app\backend\` (onde o git pull atualiza)

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
Controladoria       → isControladoria: admin, consultor, ger_projeto, ti
                       + analista/ger_projeto/ti com cliente_id preenchido (isRestrito)
Clientes/Anotações  → isConsultor: admin, consultor, ger_projeto, ti
                       + analista/ger_projeto/ti com cliente_id preenchido (isRestrito)
Administração       → isAdminConsultor (admin + consultor) — colapsável
Procedimentos       → isAdmin (admin apenas) — colapsável
  ├── Templates de Projeto
  ├── Modelos & Contas
  └── Backup
Footer              → todos (foto, Manual, Alterar senha, Sair)
```

> Nota: `isControladoria` e `isConsultor` são equivalentes no código atual (ambos incluem `ger_projeto` e `ti`). Não confundir com o perfil `consultor` — são flags de visibilidade compostas.

---

## Convenções de Código

### Backend
- Migrações de banco via bloco `with engine.connect()` em `main.py` — **somente SQLite** (`if _is_sqlite`); Supabase começa limpo via `create_all`. Tolerante a erros (coluna já existe = silencioso).
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

## Testes Automatizados e CI/CD (configurado em 2026-06-16)

### Infraestrutura de testes
- **Local:** `tests/` na raiz do projeto (fora de `backend/`, cobre integração backend ↔ frontend)
- **`tests/conftest.py`** — monta um FastAPI mínimo só com os routers cobertos (auth, usuarios, clientes, projetos, fases, tarefas, dashboard, anotacoes, subtarefas). NÃO importa `backend/main.py` diretamente (evita disparar seeds, migrações e o timer de backup automático). Usa SQLite em arquivo temporário, recriado do zero (`drop_all`+`create_all`) antes de cada teste — **nunca toca no Supabase de produção**. Variáveis `DATABASE_URL` e `SECRET_KEY` são sobrescritas antes de qualquer import do backend.
- **`tests/test_api.py`** — testes de integração dos endpoints críticos: login/auth, CRUD de clientes/projetos/fases/tarefas/usuários, isolamento multi-tenant (analista só vê o próprio cliente), regras de permissão por perfil, dashboard.
- **`tests/test_frontend_build.py`** — garante que `frontend/dist/` existe, tem `index.html` + assets `.js`, e que o HTML não referencia arquivos inexistentes. A checagem de "dist desatualizado" (mtime) só roda fora do CI.
- **Rodar localmente:** `pip install -r backend/requirements.txt` (já inclui `pytest`/`pytest-cov`) e depois `pytest tests/ -v` na raiz.
- **Cobertura atual:** routers de controladoria, fluxo de caixa, orçamento, balancete, IA, importação DRE e admin/backup ainda **não** têm testes — extensão futura, não bloqueante.

### GitHub Actions (`.github/workflows/ci.yml`)
- Dispara em `pull_request` e `push` para `main`
- Job `test`: builda o frontend (`npm ci && npm run build` — garante `dist/` fresco antes do `test_frontend_build.py`), instala deps do backend, roda `pytest tests/`
- Job `ci-status`: depende de `test`; é o check que a branch protection deve exigir
- **Node.js:** versão lida de `frontend/.nvmrc` (`node-version-file`), alinhada com `frontend/package.json` → `engines.node`. Sempre que atualizar o Node local, atualizar os dois arquivos juntos — é a causa mais provável de falha de build no CI (binding nativo do rolldown/Vite é compilado por versão de Node)
- Existe também `.github/workflows/deploy.yml` (self-hosted, dispara só em push para `main`) — não roda testes, só faz o deploy em produção

### Branch protection — ⚠️ AINDA NÃO CONFIGURADA
- O check `ci-status` existe e funciona, mas **ninguém configurou a regra no GitHub** para exigi-lo antes do merge
- Pendente: Settings → Branches → regra para `main` → "Require status checks to pass before merging" → selecionar `ci-status`
- Até isso ser feito, é possível mergear PRs com CI vermelho — não assumir que está bloqueando

### Regras do `.gitignore`
- `backend/.env`, `backend/seed_usuarios.py` — segredos, nunca commitar
- `__pycache__/`, `*.pyc` — bytecode Python, regra genérica (cobre qualquer pasta, não só `backend/`)
- `backend/*.db*`, `backend/backup/` — banco local e backups gerados, nunca commitar
- `frontend/node_modules/`, `electron-client/node_modules/`, `electron-client/dist/` — gerados por `npm install`/build
- `frontend/dist/` **fica fora do gitignore de propósito** — é commitado para servir em produção sem precisar de Node no servidor
- Antes de adicionar uma pasta nova ao projeto, checar se ela deveria estar aqui (build output, cache, dado sensível) — esquecer isso já causou CI falhar por import de arquivo nunca commitado

### Fluxo de trabalho padrão a partir de agora

Para **toda nova implementação** (feature, fix, refactor):

1. **Nunca commitar direto na `main`.** Criar uma branch a partir dela: `git checkout main && git pull && git checkout -b <tipo>/<nome-curto>` (ex.: `feature/relatorio-pdf`, `fix/upload-arquivos`)
2. Implementar e testar localmente — se a mudança tocar endpoints do backend, rodar `pytest tests/ -v` antes de comitar
3. Comitar com mensagens no padrão `tipo: descrição` (`feat:`, `fix:`, `chore:`, `docs:`) — sempre granular, nunca misturar mudanças não relacionadas no mesmo commit
4. `git push -u origin <branch>` — o link do PR aparece automaticamente no terminal
5. Abrir o PR no GitHub e aguardar o `ci-status` do GitHub Actions ficar verde antes de mergear
6. Após o merge na `main`: build do frontend + commit do `dist/` atualizado (se ainda não estiver no PR) → `release.ps1` para deploy → atualizar `app.version` em `backend/main.py` → atualizar `ROADMAP.md` movendo o item para "✅ Concluído" com a versão
7. Lembrar o usuário do **Ctrl+Shift+R** no Electron e dos ~30s de reload do uvicorn (regra já existente acima)

---

## Pontos de Atenção (Não Quebrar)

1. **Migração no startup:** o bloco `with engine.connect()` em `main.py` roda a cada inicialização, **mas somente em SQLite** (`_is_sqlite`). No Supabase de produção, `create_all` é suficiente — deve ser tolerante a erros (coluna já existe = silencioso)
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
│   ├── main.py                  # Startup, routers, versão, migrações
│   ├── models.py                # Todos os modelos SQLAlchemy
│   ├── schemas.py               # Todos os schemas Pydantic
│   ├── auth.py                  # JWT, hash de senha, get_usuario_atual
│   ├── database.py              # Engine, SessionLocal, Base, _is_sqlite
│   ├── helpers.py               # Função log() para LogAtividade
│   ├── dre_engine.py            # Cálculo e consolidação do DRE
│   ├── importacao_service.py    # Pipeline de importação de extratos
│   ├── plano_import_service.py  # Importação de planos de conta
│   ├── plano_parser.py          # Parser de estrutura de planos
│   ├── xlsx_parser.py           # Leitura de planilhas .xlsx
│   ├── formula_generator.py     # Geração de fórmulas para itens do plano
│   ├── agrupamento_suggester.py # Sugestão de agrupamento de contas
│   ├── nivel_detector.py        # Detecção de nível em planos de conta
│   ├── migrar_para_supabase.py  # Script de migração SQLite → Supabase (já executado)
│   └── routers/                 # Um arquivo por domínio:
│       ├── auth.py              # Login, token JWT
│       ├── usuarios.py          # CRUD de usuários
│       ├── clientes.py          # CRUD de clientes
│       ├── projetos.py          # CRUD de projetos
│       ├── fases.py             # Fases dos projetos
│       ├── tarefas.py           # Tarefas das fases
│       ├── subtarefas.py        # Atividades (subtarefas)
│       ├── dashboard.py         # Dados do dashboard principal
│       ├── anotacoes.py         # Anotações por cliente
│       ├── arquivos.py          # Upload e gestão de arquivos
│       ├── notificacoes.py      # Notificações de usuário
│       ├── historico.py         # Histórico de atividades
│       ├── relatorios.py        # Geração de relatórios
│       ├── busca.py             # Busca global (Ctrl+K)
│       ├── chat.py              # Chat interno
│       ├── modelos.py           # Templates de projeto
│       ├── bandeiras.py         # Bandeiras/unidades de clientes
│       ├── controladoria.py     # Módulo de controladoria
│       ├── fluxo_caixa.py       # Fluxo de caixa
│       ├── dre_import.py        # Importação de DRE
│       ├── orcamento.py         # Orçamento
│       ├── balancete.py         # Balancete
│       ├── planos.py            # Planos de conta
│       ├── plano_import.py      # Importação de planos
│       ├── ia.py                # IA (Claude)
│       ├── gemini.py            # IA (Gemini)
│       ├── openrouter.py        # IA (OpenRouter)
│       └── admin.py             # Backup e administração
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Rotas React + aviso de nova versão
│   │   ├── components/
│   │   │   ├── Sidebar.jsx      # Navegação principal
│   │   │   ├── shared.jsx       # Modal, Avatar, Badge, Progress, LoadingPage
│   │   │   ├── BuscaGlobal.jsx  # Busca global (Ctrl+K)
│   │   │   └── FloatingAI.jsx   # Widget de IA flutuante (Claude/Gemini/OpenRouter)
│   │   ├── contexts/
│   │   │   └── AuthContext.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DashboardExecutivo.jsx
│   │   │   ├── DashboardCliente.jsx
│   │   │   ├── DashboardFases.jsx
│   │   │   ├── DashboardTarefas.jsx
│   │   │   ├── DashboardSubtarefas.jsx
│   │   │   ├── Projetos.jsx / ProjetoDetalhe.jsx
│   │   │   ├── Clientes.jsx
│   │   │   ├── Usuarios.jsx
│   │   │   ├── Anotacoes.jsx
│   │   │   ├── Arquivos.jsx
│   │   │   ├── Notificacoes.jsx
│   │   │   ├── HistoricoAtividades.jsx
│   │   │   ├── Relatorios.jsx
│   │   │   ├── Procedimentos.jsx / Modelos.jsx
│   │   │   ├── Manual.jsx
│   │   │   └── controladoria/
│   │   │       ├── Index.jsx / ModuloBase.jsx
│   │   │       ├── FluxoCaixa.jsx
│   │   │       ├── DRE.jsx / DreDashboard2.jsx
│   │   │       ├── Orcamento.jsx
│   │   │       ├── Planos.jsx
│   │   │       ├── Balancetes.jsx
│   │   │       └── Importacoes.jsx / ImportacaoRealizado.jsx
│   │   └── services/
│   │       └── api.js           # Todos os endpoints da API
│   └── dist/                    # Build de produção (commitado no git)
├── tests/
│   ├── conftest.py              # Fixture: FastAPI mínimo + SQLite temporário
│   ├── test_api.py              # Testes de integração dos endpoints críticos
│   └── test_frontend_build.py  # Verifica integridade do dist/
├── deploy/                      # Configurações de deploy no servidor
├── documentos/                  # Diagramas de arquitetura (drawio, svg)
├── electron-client/             # App desktop (carrega URL ngrok)
├── .github/workflows/
│   ├── ci.yml                   # CI: testa em todo PR e push para main
│   └── deploy.yml               # Deploy: self-hosted, só push para main
├── release.ps1                  # Script de deploy
├── ROADMAP.md                   # Backlog de features e correções
└── CLAUDE.md                    # Este arquivo
```

---

## Instrução para o Claude — Histórico de Sessões

**Ao final de cada sessão de trabalho**, antes de encerrar, o Claude deve atualizar a seção `## Histórico de Sessões` abaixo com uma entrada no seguinte formato:

```
### YYYY-MM-DD
**O que foi feito:** resumo objetivo do que foi implementado, corrigido ou decidido.
**Decisões tomadas:** escolhas de arquitetura, convenção ou fluxo que impactam sessões futuras.
**Próximo passo:** o que ficou pendente ou o que deve ser feito na próxima sessão.
```

Regras:
- Entradas mais recentes ficam no **topo** da lista
- Máximo de **10 entradas** — remover as mais antigas quando ultrapassar
- Ser objetivo: 1–3 linhas por campo, sem repetir o que já está no `ROADMAP.md`
- Commitar junto com as demais mudanças da sessão (não criar commit separado só para o histórico)

---

## Histórico de Sessões

### 2026-06-21
**O que foi feito:** implementação completa do módulo Plano de Contas Referencial — 8 novos modelos SQLAlchemy (`Segmento`, `PlanoReferencial`, `ContaReferencial`, `ContaClienteRef`, `DeParaRef`, `LancamentoRef`, `TemplateRef`, `TemplateLinhaRef`, `PeriodoFechado`), `segmento_id` adicionado a `Cliente`, schemas Pydantic, 2 módulos utilitários (`ref_formula_engine.py` com topological sort + safe eval + ciclo DFS; `depara_service.py` com rapidfuzz WRatio + cross-client boost), seed de 5 segmentos + 1 plano singleton, 7 routers FastAPI (`/api/ref/...`), 5 páginas React (`PlanoReferencial`, `RevisaoDepara`, `TemplatesRef`, `Demonstrativo`, `BenchmarkSegmento`), sidebar e rotas atualizadas. Versão bump para `2.5.0w`. Build do frontend passou limpo.
**Decisões tomadas:** `rapidfuzz.fuzz.WRatio` escolhido para similaridade (melhor para nomes de contas contábeis); threshold 80% para auto-confirmar vs pendente_revisao; fórmulas com sintaxe `{agrupamento:CODE}` e `{linha:ROTULO}` avaliadas via `ast` sem eval() aberto; versionamento De-Para por `vigente_a_partir` (sem deletar histórico); detecção de ciclo por DFS antes de salvar qualquer linha de template; benchmark agrega por segmento sem expor clientes; todas as novas tabelas prefixadas com `ref_`.
**Próximo passo:** criar branch `feature/plano-referencial`, rodar pytest, abrir PR e fazer release após validação no Electron. Pendente também: REL-1 (relatório PDF) da sessão anterior.

### 2026-06-19 (sessão 2)
**O que foi feito:** módulos contratados por cliente (`modulo_projetos`, `modulo_inteligencia_mercado`, `modulo_analises_gerenciais`) — colunas no banco (SQLite + PostgreSQL), schemas, auth (`ModulosCliente` no Token, `_modulos_do_cliente` no login/refresh), AuthContext (`modulos` + `temModulo`), sidebar reorganizada (Projetos em destaque, Dashboards colapsável, círculo "E"), visibilidade de seções por módulo, toggle UI em Clientes.jsx, dica discreta no rodapé para usuários com módulos parciais. PRs #12–14 consolidados em `release/v2.5.0u` (PR #15) + bump `v2.5.0v` (PR #16), ambos mergeados e em produção. Branch protection confirmada ativa — push direto na `main` rejeitado pelo GitHub (INF-2b concluído).
**Decisões tomadas:** migração PostgreSQL adicionada com `ADD COLUMN IF NOT EXISTS` em bloco separado (`if not _is_sqlite`) — `create_all` não altera tabelas existentes no Supabase; footer hint usa `temModulo` (não localStorage) pois AuthContext já tem o helper; `release.ps1` não funciona quando main tem proteção + commits à frente — usar sempre o fluxo PR.
**Próximo passo:** REL-1 — relatório de projeto em PDF com `weasyprint`.

### 2026-06-19
**O que foi feito:** revisão do ROADMAP e plano de ação; tela de Backup corrigida para PostgreSQL/Supabase — textos, `accept` do input e descrição adaptados dinamicamente via campo `postgres` da API (PR #10); discutido e descartado Supabase DEV separado (custo sem benefício para 1 dev); sequência de próximas features definida: REL-1 (PDF), NOTIF-1/2 (email), IA-1 (balancete PDF).
**Decisões tomadas:** ROADMAP revisado — próximas prioridades são REL-1 (relatório PDF), depois NOTIF-1/2 (requer SMTP), depois IA-1 (maior diferencial); INF-2b (branch protection manual no GitHub) ainda pendente de ação manual.
**Próximo passo:** implementar REL-1 — relatório de projeto em PDF com `weasyprint`.

### 2026-06-18 (sessão 2)
**O que foi feito:** corrigido bug 500 em `/api/version` no PostgreSQL (PR #4); CLAUDE.md atualizado com caminhos reais do servidor e seção de histórico (PR #5); `@` menção adicionada ao ChatPanel que usava input simples (PR #6); notificação no sino ao ser mencionado — nova tabela `notificacoes_mencao`, helper `notificar_mencoes`, integrado em chat e comentários de tarefa (PR #7); badge vermelho de mensagens não lidas no botão Chat com polling 30s e localStorage por projeto (PR #8).
**Decisões tomadas:** SQLite mantido no dev local (criar Supabase DEV avaliado e descartado — custo sem benefício proporcional para time de 1 dev); menção `@` só funciona para perfis com permissão de listar usuários (`admin/consultor/ger_projeto`); badge de não lidas rastreia por `localStorage` sem tabela extra no banco; para diagnosticar 500 no servidor sempre verificar `C:\emals-service\logs\emals-backend.err.log`.
**Próximo passo:** consultar ROADMAP.md para próxima feature — sistema estável em produção.

### 2026-06-18
**O que foi feito:** atualização completa do CLAUDE.md (banco Supabase, 28 routers, todas as páginas, sidebar corrigida); commits organizados da branch `feature/testes-automatizados`; PR #2 mergeado; skills criadas (`/novo-modulo`, `/novo-router`, `/fix-permissao`, `/release`) em `.claude/commands/`; `SKILLS.md` criado; PR #3 (`release/v2.5.0t`) mergeado; diagnóstico e correção do 500 em `/api/version` pós-deploy (`_admin_db_path.exists()` quebrava com Supabase); PR #4 mergeado; Electron funcionando.
**Decisões tomadas:** branch protection na `main` ativa — releases via branch `release/vX` + PR + CI; `gh` CLI em `C:\Program Files\GitHub CLI\gh.exe`; WinSW do servidor em `C:\emals-service\emals-backend.exe`, logs em `C:\emals-service\logs\emals-backend.err.log`, código em `C:\emals-app\backend\`; para diagnosticar erros no servidor, sempre ler `emals-backend.err.log`.
**Próximo passo:** sistema estável em produção — consultar ROADMAP.md para próxima feature.
