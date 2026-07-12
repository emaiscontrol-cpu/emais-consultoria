# Instruções para o Claude — E Mais Consultoria

Este arquivo configura o comportamento do Claude Code neste projeto.

---

## CONTRATO DE SESSÃO — regras inegociáveis

> ⚠️ Esta seção existe em duas cópias: aqui e em `.agents/AGENTS.md` (lido pela Antigravity). As duas devem dizer exatamente a mesma coisa — ao mudar uma, atualizar a outra também.

- **Sincronizar antes de trabalhar:** `git checkout main && git pull` no início de toda sessão.
- **Arquivos de sessão** (`task.md`, `walkthrough.md`, `implementation_plan.md`, análises pontuais) em `documentos/sessoes/` — nunca na raiz.
- **NUNCA usar `eval()`** — fórmulas passam por `safe_eval()` de `backend/ref_formula_engine.py`.
- **Todo endpoint com `cliente_id`** chama `verificar_tenant` (`backend/security.py`).
- **Auth:** PyJWT + bcrypt direto — `python-jose`/`passlib` proibidos.
- **Dinheiro:** `Numeric(15,2)` no banco; `parseValorBR` no frontend.
- **Dependência nova** = `requirements.txt` + regenerar `requirements.lock.txt` a partir de venv limpo.
- **Release SOMENTE via `/conferencia-pre-release`** (GO explícito) → `/release` — nunca por conta própria.
- **Backlog vivo:** `ROADMAP_2.md`; registrar a sessão no CLAUDE.md ao final.
- **Mapa de leitura da arquitetura:** `documentos/ARQUITETURA*`, `DESIGN_SYSTEM.md`, `SKILLS.md`.
- **Botões de ação, ícones-botão e cards** — proibido montar manualmente; sempre `BotaoEditar`,
  `BotaoExcluir`, `BotaoNovo`, `IconButton`, `Card` ou `BadgeTag` de `frontend/src/components/ui.jsx`
  (tamanhos de ícone únicos permitidos: `sm`=16px, `md`=20px). Ver DESIGN_SYSTEM.md § 9b.
- **Gráficos** — proibido importar `recharts` (ou qualquer outra lib) direto numa tela; sempre
  `GraficoBarras`/`GraficoLinha`/`GraficoArea`/`GraficoRosca`/`GraficoProgresso`/`GraficoComposto`
  de `frontend/src/components/Graficos.jsx` (paleta e tokens em `chartTheme.js`). Ver DESIGN_SYSTEM.md § 11.

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

> ⚠️ **ANTES de qualquer ação no banco:** verificar contagem e integridade do banco no servidor via endpoint autenticado de admin `/api/admin/diagnostico` (expõe `clientes`, `usuarios`, `projetos`, `db_url` com senha mascarada, `admin_db_path`). Confirmar que `admin_db_path` == caminho esperado ANTES de qualquer restore.

> ⚠️ **O usuário (Luiz) é o DEV.** Os dados de produção existem no servidor independentemente da máquina local estar ligada ou não.

### Frontend
- **Framework:** React 19 + Vite
- **Build:** `frontend/dist/` — servido pelo próprio backend FastAPI
- **Cliente desktop:** Electron (`electron-client/`) — carrega direto da URL ngrok

### Deploy
- **Script:** `.\release.ps1` na raiz do projeto
- **Fluxo:** compila frontend → git add/commit/push → servidor puxa via git → `.github/workflows/deploy.yml` (self-hosted, no próprio servidor) para o serviço, roda `pip install -r requirements.lock.txt` no venv de produção e reinicia o `EmaisBackend`
- **Versão:** atualizar `app.version` em `backend/main.py` a cada release
- **Versão atual:** `2.6.2t` (em `backend/main.py` → `app.version`)
- **Padrão de versão:** `2.5.0a`, `2.5.0b`, ... `2.5.0z`, `2.5.1a`, etc.
- **ATENÇÃO:** novos arquivos backend não são commitados automaticamente pelo `release.ps1` — commitar explicitamente antes do release se necessário

### Infraestrutura
- **ngrok:** túnel público — o servidor de produção tem o ngrok rodando permanentemente
- **Máquina local:** também tem `EmaisNgrok` service, mas serve banco de desenvolvimento (diferente do servidor)
- **Teste correto:** sempre usar o **Electron** para testar com usuários reais (banco do servidor)
- **WinSW no servidor:** `C:\emals-service\emals-backend.exe` + `C:\emals-service\emals-backend.xml`
- **Logs do serviço no servidor:** `C:\emals-service\logs\emals-backend.err.log` (erros) e `emals-backend.out.log` (stdout)
- **Código rodando no servidor:** `C:\emals-app\backend\` (onde o git pull atualiza)
- **Fix emergencial direto no banco de produção:** a máquina local tem a porta 5432 do Supabase bloqueada (psycopg2 direto não conecta), mas `backend/.env` (gitignored) tem `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — dá para consultar/alterar via REST API do Supabase (PostgREST) por HTTPS (`GET/PATCH {SUPABASE_URL}/rest/v1/<tabela>?<filtro>` com headers `apikey`/`Authorization: Bearer <SERVICE_KEY>`). Sempre conferir o estado antes e depois da alteração. Preferir sempre o fluxo normal (código + release) quando não for uma emergência.

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

## Sidebar — Estrutura e Visibilidade

### GRUPO 1 — Módulos comerciais (visual: ícone colorido + fundo translúcido + título colorido)
Aparecem para **todos os usuários**. Quando o módulo não está contratado (cliente sem o módulo), o cabeçalho fica com cadeado e os itens são substituídos por `LockedItem` que navega para `/saiba-mais/<modulo>`.

| Módulo | Cor | Itens internos | Visibilidade dos itens |
|---|---|---|---|
| **Projetos** | `#5DCAA5` (teal) | Projetos (hero), Dashboards, Notificações, Anotações, Arquivos | Anotações: `isConsultor`; Arquivos: `isAdminConsultor`; demais: todos |
| **Inteligência de Mercado** | `#AFA9EC` (roxo) | Painel de Mercado, Benchmarks Setoriais, Indicadores | Todos com o módulo |
| **Análises Gerenciais** | `#EF9F27` (âmbar) | Fluxo de Caixa Executivo, DRE Gerencial, Balancete, Controle Orçamentário, Demonstrativo Ref., Benchmark Segmento | Todos com o módulo |

### GRUPO 2 — Internos (visual austero: SectionBtn com texto apagado, sem ícone colorido)
**Nunca visíveis para clientes** (analista, ger_projeto, ti), sem exceção.

```
Administração  → isAdminConsultor (admin + consultor) — colapsável
  ├── Relatórios, Histórico, Usuários, Clientes

Procedimentos  → isAdmin (admin apenas) — colapsável
  ├── Templates de Projeto
  ├── Backup
  ├── Importações
  └── Plano Referencial (Plano de Contas, Templates DRE/FC/Orç., Revisão De-Para)

Footer         → todos (foto, Manual, Alterar senha, Sair)
```

### Flags de visibilidade usadas no código
- `isAdmin` — perfil `admin` apenas
- `isAdminConsultor` — `admin` + `consultor`
- `isConsultor` — `admin`, `consultor`, `ger_projeto`, `ti`, ou (`analista`/`ger_projeto`/`ti` com `cliente_id` preenchido = `isRestrito`)
- `isCliente` — `analista`, `ger_projeto`, `ti` (perfis de cliente)
- `bloqueadoProjetos/Inteligencia/Analises` — `isCliente && !temModulo('...')`

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

### Arquivos de sessão
- Arquivos de trabalho de sessão (`task.md`, `walkthrough.md`, `implementation_plan.md` e análises pontuais) vivem em `documentos/sessoes/` — nunca na raiz.

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

O arquivo `ROADMAP_2.md` na raiz do projeto contém o backlog oficial.
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
- **Rodar localmente:** `pip install -r backend/requirements.lock.txt` (já inclui `pytest`/`pytest-cov`) e depois `pytest tests/ -v` na raiz.
- **Cobertura atual:** routers de controladoria, fluxo de caixa, orçamento, balancete, IA, importação DRE e admin/backup ainda **não** têm testes — extensão futura, não bloqueante.

### GitHub Actions (`.github/workflows/ci.yml`)
- Dispara em `pull_request` e `push` para `main`
- Job `test`: builda o frontend (`npm ci && npm run build` — garante `dist/` fresco antes do `test_frontend_build.py`), instala deps do backend, roda `pytest tests/`
- Job `ci-status`: depende de `test`; é o check que a branch protection deve exigir
- **Node.js:** versão lida de `frontend/.nvmrc` (`node-version-file`), alinhada com `frontend/package.json` → `engines.node`. Sempre que atualizar o Node local, atualizar os dois arquivos juntos — é a causa mais provável de falha de build no CI (binding nativo do rolldown/Vite é compilado por versão de Node)
- Existe também `.github/workflows/deploy.yml` (self-hosted, dispara só em push para `main`) — não roda testes, só faz o deploy em produção

### Branch protection — ✅ ATIVA (desde 2026-06-19)
- A regra exige `ci-status` (que depende do job `test`) antes de qualquer merge na `main`
- Push direto na `main` é rejeitado pelo GitHub — todo deploy passa pelo fluxo `release.ps1` → branch `release/vX` → PR → CI → merge automático
- `release.ps1` aguarda 30s para o CI registrar, monitora com `gh pr checks --watch`, depois faz `gh pr merge`

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
6. **Banco local é SQLite isolado (NÃO produção):** o `backend/.env` tem a linha `DATABASE_URL` **comentada**, então `database.py` cai no default → SQLite local (`C:\emals-service\emais_consultoria.db`). Testar no localhost é seguro inclusive para escrita — não toca no Supabase de produção. (As sessões 6/7 do histórico afirmavam o contrário; ficou desatualizado — confirmado na sessão 12, 2026-07-07.) O `.env` só mantém `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` para fixes emergenciais via REST API, que não afetam a seleção do banco. **ngrok pooling:** ainda assim, se precisar chamar endpoints contra o banco do *servidor*, parar o serviço `EmaisBackend` local antes.
7. **Geração de PDF usa `reportlab`, não `weasyprint`:** weasyprint precisa de bibliotecas nativas GTK/Pango que não existem no Windows (dev nem produção) nem no runner do CI — falha no import mesmo após `pip install` bem-sucedido (erro `cannot load library 'libgobject-2.0-0'`). `backend/services/pdf_service.py` usa reportlab (puro Python, sem dependência nativa). Não tentar trocar para weasyprint sem antes instalar o runtime GTK3 em todas as máquinas envolvidas.
8. **Nunca hard-delete em `Tarefa`, `Fase` ou `Projeto`:** todos têm coluna `ativo` — exclusão é sempre `t.ativo = False; db.commit()`. `log_tarefas`, `comentarios`, `subtarefas` e `responsaveis_tarefa` referenciam `tarefas.id` sem `ON DELETE CASCADE`; um `db.delete()` direto quebra com FK violation no Postgres de produção (SQLite local não pega, pois não valida FK por padrão — testar sempre pensando em Postgres). Toda query de listagem desses registros deve filtrar `ativo == True` explicitamente (a relationship do SQLAlchemy carrega tudo, inclusive inativos).
9. **Nova dependência em `backend/requirements.txt` = risco de derrubar produção:** Toda nova dependência deve ser adicionada no arquivo `backend/requirements.txt` e o lock deve ser atualizado via `pip freeze` salvando em `backend/requirements.lock.txt`. O deploy e o CI instalam a partir de `requirements.lock.txt` para garantir as mesmas versões em homologação e produção. O startup importa todos os routers incondicionalmente, portanto, dependências não instaladas derrubarão o uvicorn (WinSW desiste de reiniciar após 3x).

---

## Estrutura de Arquivos Importante

```
emals_consultoria/
├── backend/
│   ├── main.py                  # Startup, routers, versão, migrações
│   ├── models.py                # Todos os modelos SQLAlchemy
│   ├── schemas.py               # Todos os schemas Pydantic
│   ├── security.py              # JWT, hash de senha, get_usuario_atual
│   ├── database.py              # Engine, SessionLocal, Base, _is_sqlite
│   ├── helpers.py               # Função log() para LogAtividade
│   ├── xlsx_parser.py           # Leitura de planilhas .xlsx
│   ├── nivel_detector.py        # Detecção de nível em planos de conta
│   ├── ref_formula_engine.py    # Motor de fórmulas do Plano Referencial (topological sort + AST eval)
│   ├── depara_service.py        # Sugestão de De-Para via rapidfuzz WRatio
│   ├── migrar_para_supabase.py  # Script de migração SQLite → Supabase (já executado)
│   ├── services/
│   │   └── pdf_service.py       # Geração genérica de PDF (reportlab) — usada por qualquer demonstrativo
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
│       ├── fluxo_caixa.py       # Fluxo de caixa (apenas agrupadores_fc agora)
│       ├── dre_import.py        # Importação de DRE (layouts e logs; DE-PARA e fórmulas removidos)
│       ├── orcamento.py         # Orçamento (valores orçados, edição, auditoria, sugestões de IA)
│       ├── balancete.py         # Balancete
│       ├── ref.py               # Plano de Contas Referencial (/api/ref/...)
│       ├── fc_exec.py           # Demonstrativo FC Executivo (/api/demonstrativos/fluxo-caixa)
│       ├── ia.py                # IA (Claude)
│       ├── gemini.py            # IA (Gemini)
│       ├── openrouter.py        # IA (OpenRouter)
│       ├── pdf.py               # POST /api/pdf/demonstrativo — exportação PDF genérica
│       └── admin.py             # Backup e administração
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Rotas React + aviso de nova versão
│   │   ├── components/
│   │   │   ├── Sidebar.jsx      # Navegação principal
│   │   │   ├── shared.jsx       # Modal, Avatar, Badge, Progress, LoadingPage
│   │   │   ├── BuscaGlobal.jsx  # Busca global (Ctrl+K)
│   │   │   ├── FloatingAI.jsx   # Widget de IA flutuante (Claude/Gemini/OpenRouter)
│   │   │   ├── BotaoExportarPDF.jsx  # Botão genérico de exportação PDF (POST /api/pdf/demonstrativo)
│   │   │   └── PainelDetalheAgrupamento.jsx  # Painel de detalhe (lista + rosca animada) por agrupamento — genérico
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
│   │   │       ├── PlanoReferencial.jsx / RevisaoDepara.jsx / TemplatesRef.jsx
│   │   │       ├── Demonstrativo.jsx / BenchmarkSegmento.jsx
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

## Histórico de Sessões

### 2026-07-11 (sessão 17)
**O que foi feito:** Sessão de integração — mescladas na `main` as 6 branches de correções que a Antigravity vinha preparando em paralelo (trabalho retomado de onde a outra ferramenta parou, confirmado via ETAPA 0 de diagnóstico: nenhum rebase pendente, 6 branches locais não mescladas identificadas por reconstrução já que a lista original da mensagem do usuário chegou cortada). Ordem definida pelo usuário — segurança primeiro, migração de schema por último: (1) `fix/seguranca-superficie-publica` — PR #109: elimina o vazamento de `db_url`/credenciais em `/api/version`, restringe CORS, substitui `eval()` cru por `safe_eval` (AST) em `fc_exec.py` (RCE), centraliza `verificar_tenant`, impede boot com `SECRET_KEY` default em produção; (2) `fix/corrupcao-de-dados` — PR #110: captura `IntegrityError` de CNPJ duplicado, corrige importador de orçamento (transação única) e padroniza parse monetário no frontend; (3) `feature/erros-de-formula-visiveis` — PR #111: propaga erros de fórmula (`ref_inexistente`, `div_zero`, `erro_calculo`) em vez de silenciar, suporte a `;`/`%`, detecção de ciclo em templates; (4) `chore/higiene-codigo-e-docs` — PR #112: renomeia `backend/auth.py` → `backend/security.py`, `.gitattributes` para EOL, guards nos scripts de seed; (5) `chore/modernizacao-dependencias` — PR #113: troca `python-jose`+`passlib` por `PyJWT`+`bcrypt` direto, `.query().get()` → `db.get()` (SQLAlchemy 2.0), logging estruturado (`backend/logger.py`); (6) `feature/dinheiro-numeric` — PR #114: campos monetários `Float` → `Numeric(15,2)` nos modelos + migração SQLite/Postgres + coerção Decimal→float na API. Cada branch passou por rebase manual na `main` (não merge), com conflitos resolvidos etapa por etapa: `task.md`/`walkthrough.md`/`implementation_plan.md` sempre `--theirs`; `frontend/dist/` sempre descartado (rebuild no final); imports duplicados de routers em `tests/conftest.py` combinados (união, não escolha de lado); 20+ imports remanescentes de `from auth import` (sobreviventes ao rebase em arquivos não tocados por todas as branches) corrigidos manualmente para `from security import`. **Dois bugs reais de produção encontrados e corrigidos durante a integração** (não existiam antes de combinar as branches): (a) `safe_eval()` em `ref_formula_engine.py` usava `ast.parse(expr, ...)` sem `.strip()` — diferente do `eval()` builtin, `ast.parse` lança `IndentationError` com espaço em branco à esquerda, quebrando silenciosamente fórmulas IF/IFERROR do Fluxo de Caixa após a troca de `eval` por `safe_eval`; corrigido com `.strip()`. (b) O teste `test_invariante_soma_centavos` (soma de 10× R$0,10 deveria dar R$1,00) passava localmente (Python 3.14) mas falhava no CI (Python 3.11) — `sum()` do Python só ganhou soma compensada (Neumaier) a partir da 3.12, escondendo o erro clássico de ponto flutuante; corrigido arredondando `receitas`/`despesas`/`resultado` para 2 casas decimais em `backend/routers/controladoria.py` (`resumo()`), eliminando a dependência de versão do interpretador — padrão correto para valores monetários de qualquer forma. Também corrigidas 16 linhas de comentários com mojibake pré-existente em `backend/main.py` (PR #115, item 5 do checklist final pedido pelo usuário) e mesclado o novo bloco "Evolução Pós-Fases 1-7" no `ROADMAP_2.md` (PR #116, seções Tema 1 Segurança/Multi-tenant, Tema 2 Escalabilidade/Infra em 2 estágios, Tema 3 Automações Headless). Checklist final de 8 itens confirmado 100% na `main` antes do release: zero `eval(` cru, `/api/version` só retorna `version`, `verificar_tenant` em uso (20 ocorrências), `security.py` existe e `auth.py` não, mojibake zerado, `.gitattributes` presente, `requirements.lock.txt` sem `python-jose`, `models.py` com `Numeric(15,2)`. Release `v2.6.2t` publicado via `.\release.ps1` (PR #117) após backup manual de produção confirmado plausível pelo usuário via Electron (274.6 KB vs 276.1 KB do backup automático anterior, sem queda abrupta) — verificação pós-deploy em 4 passos: `/api/version` retorna só `{"version":"2.6.2t"}`; migração `Numeric(15,2)` aplicada nas 7 tabelas monetárias confirmada pelo usuário via `information_schema` no pgAdmin; login real em produção confirmado pelo usuário via log (`/api/auth/me` 200 pós-release, validando a troca PyJWT/bcrypt); acentuação correta no schema OpenAPI que alimenta `/docs` (Autenticação, Usuários, Notificações, Relatórios, Histórico — todos corretos).
**Decisões tomadas:** Toda a integração seguiu rebase (não merge) de cada branch na `main` antes do PR, com `push --force-with-lease` — mantém histórico linear e evita commits de merge desnecessários. Verificações de segurança tratadas como bloqueantes: parada explícita programada (e nunca acionada, pois não houve `eval(` cru remanescente) caso sobrasse qualquer `eval(` cru no `fc_exec.py` pós-resolução de conflito. Backup de produção via UI do Electron (não via chamada direta da API local) — a máquina de dev não tem acesso de rede à porta 5432 do Supabase, e rodar a lógica de backup localmente seria contra o SQLite de dev, dando falsa sensação de segurança; identificado e evitado antes de executar. Verificações pós-deploy que exigiam acesso ao servidor de produção (logs do boot, teste de login) delegadas ao usuário em vez de simuladas ou assumidas — `C:\emals-service` na máquina local é o ambiente de DEV (contém o SQLite local), não o servidor real, então não havia como o Claude Code confirmar esses itens sozinho.
**Próximo passo:** Usuário vai trazer um novo bloco de evolução para adicionar ao `ROADMAP_2.md`. Lembrar o usuário do **Ctrl+Shift+R** no Electron para pegar o build novo do frontend (`v2.6.2t`), embora ele já tenha validado login e boot via logs/pgAdmin diretamente.

### 2026-07-09 (sessão 16)
**O que foi feito:** Correções de UX no cadastro de clientes (aba "Unidades" do modal) e release de produção da `v2.6.2s`, incluindo o merge inédito de todo o módulo DRE Multi-Unidades (Fases 1-4) para a `main` (branch `feature/dre-multi-unidades`, nunca antes mesclada). Corrigido o ícone de excluir cliente sem ação (`abrirExcluirCliente` era chamada no JSX sem nunca ter sido definida) e reorganizado o modal em abas ("Geral"/"Unidades") para eliminar o scroll duplo. Adicionada edição inline (duplo-clique) de Código/Nome direto na célula da tabela de unidades. Diagnosticados dois bugs reais no cadastro de clientes: (1) "Erro ao salvar cliente" é um `IntegrityError` de CNPJ duplicado não tratado em `backend/routers/clientes.py`, virando 500 genérico — **ainda não corrigido**, decisão adiada para sessão futura; (2) unidades gravando com 0 registros ao criar cliente novo — causa raiz **não** era ordem de criação (backend já faz `db.flush()` antes de vincular `Unidade.cliente_id`, testado e confirmado funcionando), e sim o mini-formulário separado de "Adicionar Unidade" descartando silenciosamente o texto digitado quando o usuário ia direto no "Salvar" do modal sem clicar em "Adicionar Unidade" antes. Corrigido substituindo o mini-formulário por uma linha de adição inline na própria tabela (Código+Nome, com Enter navegando entre campos, validação em tempo real e rede de segurança no "Salvar" do modal). Por fim, unificado o fluxo de gravação: renomeado o antigo botão "Salvar na Lista" (do formulário completo de edição de unidade, aberto pelo lápis) para "Concluir", confirmando que ele nunca chamou a API — só o "Salvar" azul do rodapé do modal grava no servidor.
**Decisões tomadas:** Merge de PR #106 (feature/dre-multi-unidades → main, todo o módulo DRE Multi-Unidades + correções de UX) e PR #107 (release/v2.6.2s, bump de versão) autorizados explicitamente pelo usuário mesmo cientes de que (a) era um merge grande de uma vez só e (b) o Bug 1 (CNPJ duplicado) ficaria sem correção neste release — ambos aceitos conscientemente via pergunta direta ao usuário antes do merge. Diagnóstico de bugs sempre validado empiricamente (log de traceback real via uvicorn de debug em porta separada, captura de rede via Playwright) em vez de suposição, a pedido explícito do usuário.
**Próximo passo:** Implementar o fix do Bug 1 (CNPJ duplicado) em sessão futura — capturar `IntegrityError` em `criar()`/`atualizar()` (`backend/routers/clientes.py`), fazer rollback e retornar mensagem clara em vez do 500 genérico. Usuário vai validar a v2.6.2s no Electron (já tem o instalador, não precisou gerar novo).

### 2026-07-08 (sessão 15)
**O que foi feito:** Ajustes finais e homologação do módulo DRE Multi-Unidades (versão `2.6.2r`). Backend: adicionada a coluna `template_dre_padrao_id` na classe `Cliente` e na migração de banco local (SQLite) e de produção (Postgres/Supabase); adicionada a validação do `modulo_analises_gerenciais` no demonstrativo; corrigido o bug de valor zero na grade implementando cálculo automático de fórmulas implícitas por `agrupamento_slug`. Frontend: readequação da Sidebar para mapear a rota `/controladoria/dre` ("DRE Referencial") diretamente ao novo demonstrativo avançado, removendo a tela clássica antiga e a duplicada "Demonstrativo Ref"; na tela do demonstrativo, o template padrão do cliente selecionado é carregado e pré-selecionado automaticamente; na tela de Clientes, foi injetado um modal CRUD completo de gestão de filiais/unidades (código e nome) e o seletor de template de DRE padrão no cadastro do cliente.
**Decisões tomadas:** Manter as naturezas contábeis das contas analíticas de Deduções, CMV e Despesas como `"soma"` no seed local do Leal-MG, fazendo com que sejam exibidas como valores brutos positivos na DRE Referencial enquanto as fórmulas cuidam das respectivas subtrações.
**Próximo passo:** Submeter os arquivos revisados para validação do usuário em localhost e, em seguida, rodar o `.\release.ps1` para release de produção.

### 2026-07-08 (sessão 14)
**O que foi feito:** Conclusão das Fases 1, 2, 3 e 4 do módulo DRE Multi-Unidades (`2.6.2q`) na branch `feature/dre-multi-unidades`. Backend: criada a tabela de `Unidades` com código de 3 dígitos e nome amigável com CRUD completo (`ref_unidades.py`); atualizada a tabela de `LancamentoRef` para quebrar lançamentos por `unidade_codigo` e adicionada migração automática SQLite/Postgres. Turbinado o parser XLSX (`xlsx_parser.py`) para ler os 3 modos de quebra de filiais (incluindo o modo tabular multiloja em colunas), e implementada lógica resiliente de auto-cadastro de novas filiais a partir de códigos sequenciais contábeis auto-incrementados a partir de `100`. Atualizado o motor de demonstrativo contábil (`ref_demonstrativos.py`) para agrupar e calcular fórmulas matemáticas do template de forma paralela e isolada para cada filial e para o consolidado, com retorno aberto em `valores_unidades`. Adicionado o endpoint `/editar-celula` para atualizar lançamentos de agrupamentos contábeis a partir de edições manuais nas células da DRE. Frontend: atualizados `api.js` (adicionados `refUnidadesAPI` e `editarCelula`) e a tela `Demonstrativo.jsx`, implementando a renderização dinâmica de colunas multilojas (filiais exibidas lado a lado) e o grid interativo de edição in-line com blur/enter e recálculo instantâneo na tela.
**Decisões tomadas:** Manter isolamento de cálculos contábeis do motor de formulas por filial, gerando a correta margem/taxa consolidada sem somas simples. Edição manual em células de agrupamento busca/cria De-Para ativo e conta cliente virtual de ajustes se necessário.
**Próximo passo:** Prosseguir para o teste final de homologação do usuário na máquina de desenvolvimento e deploy para produção.

### 2026-07-08 (sessão 13)
**O que foi feito:** Ajuste completo do painel de detalhe do Fluxo de Caixa Executivo baseando-se em Perfis (`2.6.2o`) na branch `fix/fc-detalhe-perfis`. Implementados os 4 perfis de visualização das linhas em negrito: Padrão (3 blocos com rosca baseada em magnitude), Derivada (2 blocos sem rosca, props-based sem fetch), Destaque (2 blocks props-based com cabeçalho avermelhado de realce) e Especial (Margem operacional % baseada na receita correspondente, comparativo e tendência). Gráficos de barras comparativas do painel de detalhe passam a plotar magnitudes absolutas (barras crescendo para cima), com cores dinâmicas no BarChart (vermelho para despesas/saídas, roxo para receitas/entradas). Ajuste crítico no frontend para totalizadores de perfis não-padrão (EBITDA, Lucro Líquido, etc.) para passarem `dadosLocais = null`, ativando o fallback local correto no painel de detalhes (corrigido bug de decomposição que impedia o painel de abrir). Clique no rótulo de totalizadores de perfil não-padrão agora abre o painel gráfico em vez de tentar expandir/recolher.
**Decisões tomadas:** Perfis não-padrão são 100% props-based e não realizam requisição ao backend (evitando erros). Carga e fallback unificados para as linhas em negrito a partir de `valores_mensais` e `realizado` da própria linha. O uvicorn foi reiniciado e serve a versão atualizada com bundle index `index-DbFZdErz.js`.
**Próximo passo:** Realizar o release para produção.

### 2026-07-07 (sessão 12)
**O que foi feito:** Confirmado e corrigido um ponto que estava **desatualizado** nas sessões 6/7 deste histórico: o `backend/.env` local **NÃO aponta mais para o Supabase de produção**. Verificado direto no arquivo — a linha `DATABASE_URL=postgresql://...supabase...` está **comentada** (`#`). Como `backend/database.py` faz `os.getenv("DATABASE_URL", "sqlite:///C:/emals-service/emais_consultoria.db")`, sem a variável no ambiente o backend cai no **default → SQLite local**. O `.env` mantém apenas `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, que servem só para os fixes emergenciais via REST API (PostgREST) e **não** influenciam qual banco o backend usa. **Conclusão: testar no localhost é seguro inclusive para escrita** — grava no SQLite local, isolado da produção. Isso encerra o item "Investigar por que `backend/.env` local aponta para produção" que aparecia como próximo passo nas sessões 6 e 7. Também confirmado o estado real do repo (estava mais adiantado que este histórico sugeria): backend em **v2.6.2n**, `electron-client/package.json` **já alinhado** em `2.6.2n` (a pendência de desalinhamento da sessão 11 está resolvida), últimos merges FC "% de participação em linhas de soma" (#103) e padronização de tabelas de demonstrativos (#101). O `git status` mostra ~98 arquivos "modificados", mas é **ruído de fim de linha (CRLF↔LF do OneDrive)** — `git diff -w` volta vazio; **não commitar**.
**Decisões tomadas:** Validação da sessão 11 confirmada pelo usuário no Electron (fix do código de acesso multi-tenant OK). Fluxo de trabalho preferido do usuário reafirmado: **mexer → testar no localhost → depois validar no Electron** (agora seguro, pois o localhost usa SQLite isolado). Próxima fila de trabalho definida a partir do `ROADMAP_2.md`: FC-5 (alerta de variação anormal), FC-6 (sparkline de tendência 6 meses), FC-7 (copiar valor/linha) — os três são frontend-only na v1 e usam `valores_mensais` já retornado pelo endpoint no modo "todos".
**Próximo passo:** Implementar FC-7 primeiro (mais simples, valida o ciclo localhost→Electron), depois FC-6 e FC-5. Pendências ainda abertas de sessões anteriores: (1) `/api/version` expõe `db_url`/credenciais sem autenticação — risco de segurança a corrigir; (2) avaliar normalizar fim de linha via `.gitattributes` para acabar com o ruído de CRLF no `git status`; (3) `ROADMAP.md` (referenciado na seção "## ROADMAP" acima) não existe mais — decidir remover a seção ou recriar o arquivo (o backlog vivo é o `ROADMAP_2.md`).

### 2026-07-06 (sessão 11)
**O que foi feito:** Corrigido bug de produção "Erro ao salvar usuário" (HTTP 500) ao criar usuário no Electron — v2.6.2h. Causa raiz: no bloco de migração Postgres de `backend/main.py` (`if not _is_sqlite`), a lista de statements dropava `idx_usuarios_codigo_acesso` mas em seguida **recriava** o mesmo índice como único GLOBAL sobre `usuarios.codigo_acesso`, quebrando o design multi-tenant (o código de 3 dígitos deve ser único por cliente, não globalmente). Quando um admin criava um usuário com um código já usado por outro cliente, a checagem do endpoint passava (só olha o mesmo cliente) mas o índice global disparava `IntegrityError` → 500 → frontend mostrava o fallback genérico. Corrigido em 3 arquivos: `backend/main.py` (removida a recriação do índice global; o `DROP INDEX IF EXISTS` que já roda a cada startup limpa o legado de produção sozinho), `backend/routers/usuarios.py` (POST e PUT passam a capturar `IntegrityError`, fazem rollback e retornam 400 com mensagem clara em vez de 500 genérico) e `tests/test_api.py` (2 testes de regressão: código repetido entre clientes diferentes deve salvar OK; código repetido no mesmo cliente deve dar 400).
**Decisões tomadas:** PR (#97) aberto a partir de `fix/codigo-acesso-indice-global`, CI verde (`test` + `ci-status`) e merge feito na `main`. Como o `deploy.yml` já dispara automaticamente em todo push para `main`, o deploy para produção ocorreu no próprio merge — decidido **não** rodar `release.ps1` depois, pois ele sempre bumpa a versão (geraria `2.6.2i` sem nenhuma mudança de código nova) e faria um segundo deploy redundante; confirmado via `/api/version` que a produção já respondia `2.6.2h`. Teste manual no Electron ficou por conta do usuário (bug é específico do Postgres de produção — o SQLite local não valida esse índice global da mesma forma, então rodar o backend local não reproduziria/validaria o fix).
**Próximo passo:** Usuário vai validar no Electron: criar usuário com código de acesso já usado por OUTRO cliente deve salvar normalmente; repetir o código no MESMO cliente deve mostrar mensagem clara (400), não erro genérico. `electron-client/package.json` segue em `2.6.2g` (desalinhado do backend) — só precisa ser sincronizado no próximo release que gerar um novo instalador. Observado: `ROADMAP.md` não existe mais no repositório (removido no commit da Release v2.6.1t, 2026-07-03) — a seção "## ROADMAP" deste arquivo referencia um arquivo que não existe mais; avaliar se deve ser removida ou se o arquivo deve ser recriado.

### 2026-07-04 (sessão 10)
**O que foi feito:** Implementação da funcionalidade de Edição Manual de Orçamento (versão `2.6.2a`). Backend: novos endpoints GET `/editavel` (com histórico do ano anterior), PUT `/mes/{mes}/conta/{agrupamento_slug}` (com upsert, trava de tenant e auditoria via `LogAtividade`) e POST `/sugerir-ia` (copiloto de projeção por IA via Gemini/Claude/OpenRouter). Frontend: nova página `EditarOrcamento.jsx` (grade interativa, salvamento automático via blur/enter, tooltips de referência histórica e modal de preenchimento inteligente com reajuste de inflação, distribuição linear/sazonal e sugestões por IA). Atalho adicionado na barra lateral de `Orcamento.jsx` e rota mapeada no `App.jsx`.
**Decisões tomadas:** Manter as edições de orçamento auditadas via `helpers.log` na tabela `LogAtividade` existente, aparecendo automaticamente no Histórico de Atividades global. Travar a edição de orçamento por `cliente_id` no backend para usuários restritos (tenant isolation), mesmo que o perfil tenha acesso à tela.
**Próximo passo:** Realizar o deploy da versão `v2.6.2a` usando `release.ps1` e validar a nova interface diretamente no Electron.

### 2026-07-03 (sessão 9)
**O que foi feito:** Publicação da versão `v2.6.1t` com o Módulo de Controle Orçamentário (`DEMO-7`/`DEMO-8`), importador local (`backend/importar_orcamento_planilha.py`), painel com gráficos Recharts e velocímetro SVG (`PainelDetalheOrcamento.jsx`). Lançamento da `v2.6.1u`/`v2.6.1v` (hotfix): adicionada aba "Orçamento" na página de "Importações" para permitir o upload direto da planilha de orçamento (`FC - 2025 - ORÇAMENTO_A1.xlsx`) no servidor de produção (Supabase) via Electron, com correção na configuração de headers de multipart/form-data do Axios (removido header fixo de Content-Type que omitia a boundary). O orçamento de 2026 de Rio das Pedras (684 registros) foi importado com sucesso na produção via conexão pooler.
**Decisões tomadas:** Executar carga inicial de produção diretamente via connection string do pooler de produção que é liberado localmente (ao contrário da porta psycopg2 direta), e corrigir o helper do Axios para garantir que futuras importações via UI também funcionem perfeitamente.
**Próximo passo:** Acessar o Electron em produção e conferir os dados populados na tela de Controle Orçamentário de Rio das Pedras para 2026.

### 2026-06-30 (sessão 8)
**O que foi feito:** Dois ajustes no `PainelDetalheAgrupamento.jsx` (v2.6.1k). Bug: rosca não aparecia no modo "Todos os meses" ao clicar numa célula de mês. Causa raiz **não** era `mes` chegando null (confirmado via chamada direta da função `detalhe_agrupamento()` contra o Supabase de produção — mesmos parâmetros retornam os mesmos 6 itens em ambos os modos); era **layout**: `colSpanAll = 14` no modo "todos" faz a `<td>` do painel herdar a largura das 12 colunas de mês (~1400px); o container flex do painel (sem `maxWidth`) se esticava até essa largura total, empurrando a coluna fixa de 170px da rosca para fora da área visível sem rolagem horizontal — no modo Mensal/Acumulado (`colSpanAll = 3`, ~520px) isso nunca acontecia. Corrigido com `maxWidth: 640` no container externo do painel. Paleta de cores trocada para a escala baseada em `var(--module-projetos)` (`#1D9E75 → #2DB88A → #5DCAA5 → #8EDCC0 → #B8ECD8`), 1ª conta (maior valor, painel ordena por magnitude decrescente) sempre com o tom mais escuro; track da rosca e das barras alinhado em `#D8D6CF`. Corrigido de passagem: cálculo de `total` usava `totalAgrupamento || fallback` (bug latente — `||` trata `0` como falsy, disparando recálculo incorreto em meses com total zerado); trocado para checagem explícita `!= null && !== 0`.
**Decisões tomadas:** Diagnóstico feito chamando a função do endpoint diretamente em Python (`from routers.fc_exec import detalhe_agrupamento`, sessão com `SessionLocal()` real) em vez de via HTTP — evita precisar de JWT e evita qualquer escrita, só leitura contra produção. Esse padrão (chamar router function direto com `db=SessionLocal(), usuario=FakeUser()`) é reaproveitável para futuros bugs "os dados parecem certos mas a tela não mostra".
**Próximo passo:** Confirmar no Electron: modo "Todos os meses" com rosca visível ao clicar em qualquer mês de "Pessoal - Salário"; conferir nova paleta de cores. ~~Investigar por que `backend/.env` local aponta para produção~~ — **REFUTADO na sessão 12 (2026-07-07):** o local usa SQLite isolado (a linha `DATABASE_URL` no `.env` está comentada); nunca foi produção nesta configuração.

### 2026-06-30 (sessão 7)
**O que foi feito:** Painel de detalhamento sofisticado ao expandir lançamentos por agrupamento — v2.6.1j. Novo componente genérico `frontend/src/components/PainelDetalheAgrupamento.jsx`: coluna esquerda com lista de contas (bolinha colorida + nome + barra de progresso animada + % + valor) e coluna direita com rosca SVG animada em cascata (stroke-dasharray por fatia, delay de 150ms entre arcos) + legenda; header com nome do agrupamento/período e total/contagem. Paleta de 5 cores fixas por posição (`#0F6E56` → `#C8E8DE`), ordenado por magnitude decrescente. Linhas com 1 lançamento mostram só a lista (sem rosca); com 0, painel não renderiza. `FluxoCaixa.jsx` foi simplificado: removida a tabela de detalhe inline e o cache manual (`detalheCache`/`detalheLoading`) — o novo componente busca seus próprios dados via `useEffect` e anima via `key={cacheKey}` no componente pai, que força remount (e reanimação) toda vez que uma célula diferente é clicada. Gate `isClickable` mudou de `conta_count > 1` para `conta_count > 0`, habilitando o painel simples em agrupamentos de conta única.
**Decisões tomadas:** Animação em duas fases (`requestAnimationFrame` duplo) para garantir que o navegador pinte o estado inicial em 0 antes de disparar a transição CSS para os valores reais — sem isso a barra/rosca já nasceriam preenchidas. Rosca usa a técnica de dasharray fixo por fatia + `stroke-dashoffset` negativo acumulado (não anima o offset, anima o próprio dasharray de `0 CIRC` até `fatia (CIRC-fatia)`) para crescer a partir de um ponto fixo, com `rotate(-90 50 50)` no grupo pra começar às 12h. ~~**Achado durante a validação:** o backend local está com `DATABASE_URL` apontando para o Supabase de produção~~ — **ESSA AFIRMAÇÃO ESTAVA ERRADA (refutada na sessão 12, 2026-07-07):** o local usa SQLite isolado; testar via `localhost:8000` NÃO mexe em dados de produção. Foi um diagnóstico incorreto que se propagou por várias sessões e induziu ao erro de tratar o localhost como produção — ver Ponto de Atenção #6.
**Próximo passo:** Confirmar no Electron, expandindo "Pessoal - Salário" de Rio das Pedras/Janeiro-2026 (Ctrl+Shift+R). ~~Investigar por que `backend/.env` local aponta para produção~~ — **RESOLVIDO/REFUTADO na sessão 12:** local é SQLite isolado, não produção (ver Ponto de Atenção #6). Reutilizar `PainelDetalheAgrupamento` em DRE/Orçamento/Balancete quando esses demonstrativos ganharem endpoint `/detalhe` próprio.

### 2026-06-30 (sessão 6)
**O que foi feito:** Incidente de produção — Electron mostrando tela de erro ("não foi possível conectar ao servidor") após o deploy do PR #73. Diagnóstico via `curl` na URL ngrok: HTTP 502, `ERR_NGROK_8012` ("conexão recusada" em `localhost:8000`) — o backend não estava de pé, não era problema de frontend/dist como se suspeitava inicialmente. Causa raiz: `backend/requirements.txt` ganhou `reportlab` no PR #73, mas `.github/workflows/deploy.yml` (self-hosted, roda no servidor) sempre fez só `git pull` + restart do serviço, **nunca `pip install`**. Como `main.py` importa todos os routers incondicionalmente no startup, a dependência faltante derrubou o `uvicorn` inteiro (WinSW tentou reiniciar 3x e desistiu). Corrigido via PR #75 (hotfix, mergeado com urgência): novo passo `pip install -r requirements.txt` no venv de produção (`C:\emals-app\backend\venv\Scripts\pip.exe`) entre parar e iniciar o serviço. Log do deploy confirmou que **`rapidfuzz` também estava faltando** (de uma feature anterior, v2.5.0w) — o gap existia havia tempo, silenciosamente, porque nenhum router que o usa direto no import quebrou o startup até agora. Produção confirmada restaurada: `/api/version` voltou a responder (200), e o Electron foi aberto de fato (via driver Playwright `_electron`, screenshot conferido) mostrando a tela de login normalmente.
**Decisões tomadas:** `deploy.yml` agora tem 4 passos: atualizar código → parar backend → instalar dependências → iniciar backend (antes eram 2: atualizar + reiniciar). Documentado como Ponto de Atenção #9 — toda dependência nova em `requirements.txt` é candidata a derrubar produção se esse passo for removido ou o venv for recriado sem essa etapa. Confirmação de "app funciona" feita executando o Electron de verdade (não só checando a API) — instalado `playwright-core` temporariamente em `electron-client/node_modules` (`npm install --no-save`, não fica no git) para o driver `_electron.launch()`; screenshot conferido visualmente antes de prosseguir com qualquer merge.
**Próximo passo:** ⚠️ **Observado mas não corrigido:** `/api/version` expõe a `DATABASE_URL` completa (usuário/senha do Postgres em texto puro) para qualquer chamada não autenticada — risco de segurança real, precisa de correção em sessão futura (remover `db_url` do payload público ou exigir autenticação admin no endpoint). Confirmar manualmente no Electron os fluxos afetados pelos PRs #73/#74/#75 (exportar PDF, editar usuário, login) na próxima sessão.

### 2026-06-30 (sessão 5)
**O que foi feito:** Correção urgente de produção: `luiz@emaiscontrol.com.br` (id=2) havia perdido o perfil `admin` (estava `consultor`) por alteração acidental. Restaurado via `UPDATE` direto no Supabase usando a REST API (PostgREST) com `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` de `backend/.env` — conexão psycopg2 direta (porta 5432) segue bloqueada nesta máquina, então o fix foi feito por HTTPS, confirmando o estado antes e depois da alteração. Havia 3 outros admins ativos (Elder, Hernandes, Deusangelo) no momento do incidente. Implementada proteção em `PUT /api/usuarios/{id}` (`backend/routers/usuarios.py`) — v2.6.1i: (1) usuário não pode alterar o próprio campo `perfil`, mesmo sendo admin; (2) não é possível rebaixar um admin quando ele é o único com `perfil=admin` e `ativo=True` no sistema (erro 400 "Não é possível remover o único administrador do sistema").
**Decisões tomadas:** a regra (2) é defesa em profundidade — na prática é inalcançável via HTTP com o modelo de auth atual, porque `get_usuario_atual` já rejeita (401) tokens de usuários com `ativo=False`, e qualquer ator diferente do alvo que consiga chamar o endpoint (exige perfil admin) já eleva a contagem de admins ativos para ≥2. Mantida mesmo assim por ser barata e proteger contra mudanças futuras no modelo de permissão. Teste dessa regra chama `atualizar()` diretamente (bypassando a dependency de auth) para exercitar o guard isoladamente — ver `test_nao_pode_rebaixar_unico_admin_ativo`. Regra (1) e (2) usam `db.query(models.Usuario).get(id)` e count por `perfil == PerfilEnum.admin` + `ativo == True`.
**Próximo passo:** Investigar a causa raiz da "alteração acidental" que rebaixou o admin principal (log de atividades / histórico de quem editou) para não depender só da proteção de código. DEMO-6, REL-1 permanecem na fila.

### 2026-06-30 (sessão 4)
**O que foi feito:** Exportação em PDF como padrão global do sistema — v2.6.1h. `backend/services/pdf_service.py` (novo, `gerar_pdf_demonstrativo()`) gera PDF paisagem A4 com cabeçalho (logo + título + cliente/período), tabela com linhas titulo/agrupamento/totalizador (zebra, negativos em vermelho) e rodapé com "Página X de Y" em todas as páginas. Endpoint genérico `POST /api/pdf/demonstrativo` (`backend/routers/pdf.py`) recebe `{titulo, cliente_nome, periodo, colunas, linhas}` já calculados pela tela e devolve o PDF via `StreamingResponse` (mesmo padrão do Excel em `relatorios.py`). Componente `frontend/src/components/BotaoExportarPDF.jsx` (genérico, reutilizável) integrado no cabeçalho de `FluxoCaixa.jsx` — primeiro uso; DRE/Orçamento/Balancete reutilizam sem alteração no componente.
**Decisões tomadas:** weasyprint foi avaliado e descartado — exige GTK3/Pango nativo, ausente no Windows (dev e produção) e no CI; **reportlab é o padrão do projeto para PDF** (ver `Pontos de Atenção #7`). `_NumberedCanvas` (subclasse de `reportlab.pdfgen.canvas.Canvas`) faz duas passadas para numerar página X de Y. Logo resolvido internamente pelo `pdf_service.py` via path relativo (`frontend/src/assets/icon.png`) — endpoint não recebe `logo_path` do frontend. `FluxoCaixa.jsx` monta `dadosExportacao` (colunas/linhas no formato genérico) via `useMemo` dependente de `modo` — nos modos mensal/acumulado exporta `[Realizado, %Vendas]`; no modo "todos", 12 meses + Total.
