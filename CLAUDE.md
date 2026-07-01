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
- **Fluxo:** compila frontend → git add/commit/push → servidor puxa via git → `.github/workflows/deploy.yml` (self-hosted, no próprio servidor) para o serviço, roda `pip install -r requirements.txt` no venv de produção e reinicia o `EmaisBackend`
- **Versão:** atualizar `app.version` em `backend/main.py` a cada release
- **Versão atual:** `2.6.1k` (em `backend/main.py` → `app.version`)
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
6. **ngrok pooling:** ao testar localmente, parar o serviço `EmaisBackend` local antes de chamar endpoints que dependem do banco do servidor
7. **Geração de PDF usa `reportlab`, não `weasyprint`:** weasyprint precisa de bibliotecas nativas GTK/Pango que não existem no Windows (dev nem produção) nem no runner do CI — falha no import mesmo após `pip install` bem-sucedido (erro `cannot load library 'libgobject-2.0-0'`). `backend/services/pdf_service.py` usa reportlab (puro Python, sem dependência nativa). Não tentar trocar para weasyprint sem antes instalar o runtime GTK3 em todas as máquinas envolvidas.
8. **Nunca hard-delete em `Tarefa`, `Fase` ou `Projeto`:** todos têm coluna `ativo` — exclusão é sempre `t.ativo = False; db.commit()`. `log_tarefas`, `comentarios`, `subtarefas` e `responsaveis_tarefa` referenciam `tarefas.id` sem `ON DELETE CASCADE`; um `db.delete()` direto quebra com FK violation no Postgres de produção (SQLite local não pega, pois não valida FK por padrão — testar sempre pensando em Postgres). Toda query de listagem desses registros deve filtrar `ativo == True` explicitamente (a relationship do SQLAlchemy carrega tudo, inclusive inativos).
9. **Nova dependência em `backend/requirements.txt` = risco de derrubar produção:** `main.py` importa todos os routers incondicionalmente na inicialização — se um router novo importar um pacote que não está instalado no venv de produção, o `uvicorn` falha ao subir e o `EmaisBackend` fica down (WinSW tenta reiniciar 3x e desiste). Isso já aconteceu (reportlab, v2.6.1h) porque `deploy.yml` só fazia `git pull` + restart, sem `pip install`. Corrigido: `deploy.yml` agora roda `pip install -r requirements.txt` no venv de produção antes de reiniciar o serviço — mas se o nome do pacote mudar ou o venv for recriado, confirmar que esse passo continua funcionando.

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
│       ├── orcamento.py         # Orçamento (todos os endpoints retornam 410 — módulo substituído)
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
- Máximo de **10 entradas** — remover as mais antigas quando ultrapassar (janela deslizante)
- **Decisões arquiteturais importantes não ficam só no histórico** — devem ser propagadas para a seção permanente correspondente (Arquitetura, Sidebar, Convenções, Pontos de Atenção, Estrutura de Arquivos). O histórico é para "o que mudou recentemente"; as seções permanentes são o contexto técnico duradouro.
- Ser objetivo: 1–3 linhas por campo, sem repetir o que já está no `ROADMAP.md`
- Commitar junto com as demais mudanças da sessão (não criar commit separado só para o histórico)

---

## Histórico de Sessões

### 2026-06-30 (sessão 8)
**O que foi feito:** Dois ajustes no `PainelDetalheAgrupamento.jsx` (v2.6.1k). Bug: rosca não aparecia no modo "Todos os meses" ao clicar numa célula de mês. Causa raiz **não** era `mes` chegando null (confirmado via chamada direta da função `detalhe_agrupamento()` contra o Supabase de produção — mesmos parâmetros retornam os mesmos 6 itens em ambos os modos); era **layout**: `colSpanAll = 14` no modo "todos" faz a `<td>` do painel herdar a largura das 12 colunas de mês (~1400px); o container flex do painel (sem `maxWidth`) se esticava até essa largura total, empurrando a coluna fixa de 170px da rosca para fora da área visível sem rolagem horizontal — no modo Mensal/Acumulado (`colSpanAll = 3`, ~520px) isso nunca acontecia. Corrigido com `maxWidth: 640` no container externo do painel. Paleta de cores trocada para a escala baseada em `var(--module-projetos)` (`#1D9E75 → #2DB88A → #5DCAA5 → #8EDCC0 → #B8ECD8`), 1ª conta (maior valor, painel ordena por magnitude decrescente) sempre com o tom mais escuro; track da rosca e das barras alinhado em `#D8D6CF`. Corrigido de passagem: cálculo de `total` usava `totalAgrupamento || fallback` (bug latente — `||` trata `0` como falsy, disparando recálculo incorreto em meses com total zerado); trocado para checagem explícita `!= null && !== 0`.
**Decisões tomadas:** Diagnóstico feito chamando a função do endpoint diretamente em Python (`from routers.fc_exec import detalhe_agrupamento`, sessão com `SessionLocal()` real) em vez de via HTTP — evita precisar de JWT e evita qualquer escrita, só leitura contra produção. Esse padrão (chamar router function direto com `db=SessionLocal(), usuario=FakeUser()`) é reaproveitável para futuros bugs "os dados parecem certos mas a tela não mostra".
**Próximo passo:** Confirmar no Electron: modo "Todos os meses" com rosca visível ao clicar em qualquer mês de "Pessoal - Salário"; conferir nova paleta de cores. Investigar ainda pendente: por que `backend/.env` local aponta para produção em vez de SQLite.

### 2026-06-30 (sessão 7)
**O que foi feito:** Painel de detalhamento sofisticado ao expandir lançamentos por agrupamento — v2.6.1j. Novo componente genérico `frontend/src/components/PainelDetalheAgrupamento.jsx`: coluna esquerda com lista de contas (bolinha colorida + nome + barra de progresso animada + % + valor) e coluna direita com rosca SVG animada em cascata (stroke-dasharray por fatia, delay de 150ms entre arcos) + legenda; header com nome do agrupamento/período e total/contagem. Paleta de 5 cores fixas por posição (`#0F6E56` → `#C8E8DE`), ordenado por magnitude decrescente. Linhas com 1 lançamento mostram só a lista (sem rosca); com 0, painel não renderiza. `FluxoCaixa.jsx` foi simplificado: removida a tabela de detalhe inline e o cache manual (`detalheCache`/`detalheLoading`) — o novo componente busca seus próprios dados via `useEffect` e anima via `key={cacheKey}` no componente pai, que força remount (e reanimação) toda vez que uma célula diferente é clicada. Gate `isClickable` mudou de `conta_count > 1` para `conta_count > 0`, habilitando o painel simples em agrupamentos de conta única.
**Decisões tomadas:** Animação em duas fases (`requestAnimationFrame` duplo) para garantir que o navegador pinte o estado inicial em 0 antes de disparar a transição CSS para os valores reais — sem isso a barra/rosca já nasceriam preenchidas. Rosca usa a técnica de dasharray fixo por fatia + `stroke-dashoffset` negativo acumulado (não anima o offset, anima o próprio dasharray de `0 CIRC` até `fatia (CIRC-fatia)`) para crescer a partir de um ponto fixo, com `rotate(-90 50 50)` no grupo pra começar às 12h. **Achado durante a validação:** o backend local (`backend/.env`) está com `DATABASE_URL` apontando direto para o Supabase de produção (não para o SQLite local) — qualquer teste via `localhost:8000` mexe em dados reais; por isso a validação interativa (login + clique no painel) ficou para o usuário confirmar manualmente no Electron, não foi possível testar localmente de forma seguramente isolada.
**Próximo passo:** Confirmar no Electron, expandindo "Pessoal - Salário" de Rio das Pedras/Janeiro-2026 (Ctrl+Shift+R). Investigar por que `backend/.env` local aponta para produção em vez de ficar sem `DATABASE_URL` (SQLite) — decidir se isso é intencional ou desalinhamento a corrigir. Reutilizar `PainelDetalheAgrupamento` em DRE/Orçamento/Balancete quando esses demonstrativos ganharem endpoint `/detalhe` próprio.

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
**Próximo passo:** Testar exportação no Electron com Rio das Pedras/Janeiro-2026 (Ctrl+Shift+R). Reutilizar `BotaoExportarPDF` em DRE/Orçamento/Balancete quando essas telas forem trabalhadas. REL-1 (PDF de projeto) e DEMO-6 (orçado no demonstrativo) permanecem na fila.

### 2026-06-30 (sessão 3)
**O que foi feito:** Ícones reais de IA na sidebar "Assistente IA" e no seletor de modelos do OpenRouter (Claude/Gemini/ChatGPT/DeepSeek/Llama/Nemotron), v2.6.1d (PR #69) e v2.6.1e (PR #70, troca de arquivos + badge branco arredondado no ícone do OpenRouter para contrastar com o fundo escuro da sidebar). Bug fix: exclusão de tarefa retornava "Erro ao excluir tarefa" mesmo sem subtarefas — v2.6.1f (PR #71). Causa: `DELETE /api/tarefas/{id}` fazia hard delete, mas `log_tarefas` (histórico gerado a cada edição de campo), `comentarios`, `subtarefas` e `responsaveis_tarefa` referenciam `tarefas.id` sem CASCADE; no Postgres de produção isso violava FK (SQLite local não detecta, não valida FK por padrão). `Tarefa` já tinha coluna `ativo` (mesmo padrão de `Fase`/`Projeto`) e `recalcular_fase`/`reordenar`/`busca` já respeitavam o filtro — só o endpoint de exclusão ficou para trás. Corrigido para soft delete, preservando histórico/comentários. Dois ajustes visuais na sidebar — v2.6.1g: badge "Trabalho" restaurado ao lado do hero item "Projetos"; rótulo "MÓDULO" (9px, `var(--text-3)`) adicionado dentro do `ModuleHeader` (aparece só nos 3 módulos comerciais, pois é o único ponto onde esse componente é usado).
**Decisões tomadas:** soft delete de `Tarefa` é agora documentado como regra permanente (`Pontos de Atenção #7`) para não regredir; filtro `ativo == True` adicionado em `listar_por_fase` e no resumo do dashboard; `ProjetoDetalhe.jsx` ganhou filtro client-side `t.ativo !== false` na lista principal de tarefas (mesmo padrão já usado em `DashboardTarefas`/`DashboardFases`); novo teste `test_deletar_tarefa_e_soft_delete_preserva_historico` cobre o cenário. Rótulo "MÓDULO" embutido no `ModuleHeader` (não replicado manualmente em cada seção) — garante que nunca apareça em Administração/Procedimentos/Assistente IA sem precisar de flag extra.
**Próximo passo:** DEMO-6 (coluna orçado no demonstrativo), REL-1 (PDF de projeto) permanecem na fila.

### 2026-06-30 (sessão 2)
**O que foi feito:** Clique em célula de valor para detalhar lançamentos — v2.6.1b (PR #64). Mensal: célula única clicável, abre painel do mês selecionado. Acumulado: célula única clicável, abre painel Jan a mês selecionado (`mes=1&mes_fim=X` no backend). Todos os meses: cada coluna de mês clicável, abre painel só daquele mês. Cabeçalho do painel identifica o período ("Detalhamento — Acumulado Jan a Mai"). Texto das contas: 13px/weight 500 em `var(--text)`. Cursor pointer + sublinhado pontilhado em células clicáveis; nenhum indicador em células não clicáveis. Painel fecha ao clicar na mesma célula; clicar em outra substitui o painel (só um por vez). Backend: `/detalhe` ganhou `mes_fim` para range acumulado e filtragem por mês no modo todos. Chevron de detalhe removido do rótulo — agora só totalizadores têm chevron (expand/collapse seção).
**Decisões tomadas:** `activeDetail = { ordem, cacheKey, label }` (estado único para o painel ativo, substitui `detailOpen` por row); no modo "todos" ao clicar coluna M, o frontend chama `modo='mensal'&mes=M` reutilizando o filtro existente do backend sem código extra; `makeValueCell` helper extrai a lógica repetida das células clicáveis em todos/mensal/acumulado; `detalheLoading` é booleano global (uma chamada por vez).
**Próximo passo:** Testar no Electron com Rio das Pedras nos três modos (Ctrl+Shift+R ~30s). Próximas: DEMO-6 (coluna orçado no demonstrativo), REL-1 (PDF de projeto).

### 2026-06-30
**O que foi feito:** Três melhorias no demonstrativo de Fluxo de Caixa — v2.6.1a (PR #62). MELHORIA 1: totalizadores ganham chevron ChevronDown/ChevronRight para expand/collapse dos agrupamentos da seção; botões "Expandir tudo" / "Colapsar tudo" no cabeçalho; estado por `Set` de ordens colapsadas. MELHORIA 2: toggle "% participação" no modo "Todos os meses" — % inline ao lado do valor (font 10px, var(--text-muted)), relativo ao totalizador que fecha a seção do agrupamento. MELHORIA 3: linhas de agrupamento com `conta_count > 1` exibem chevron de detalhe; clique abre painel inline com tabela `conta_origem | valor` ordenada DESC, scroll quando > 6 itens; novo endpoint `GET /api/demonstrativos/fluxo-caixa/detalhe` suporta mensal/acumulado/todos. Design system aplicado: bordas 0.5px, fontes 10.5px/12px, Lucide React exclusivo.
**Decisões tomadas:** `buildGroupings()` pré-computa `parentOf` (agrup → totalizador para collapse) e `sectionRefOrdem` (agrup → totalizador para %) em um único pass; `slug_counts` obtido com query separada para modo "todos" (agrupado por slug+mes inviabiliza COUNT DISTINCT) e embutido na query existente para mensal/acumulado; IN clause do endpoint `/detalhe` usa `slug_ph = ':s0,:s1,...'` + `slug_params` — safe string formatting, não SQL injection.
**Próximo passo:** Testar no Electron com Rio das Pedras Todos/2026 (Ctrl+Shift+R ~30s). Próximas: DEMO-6 (coluna orçado no demonstrativo), REL-1 (PDF de projeto).

### 2026-06-29 (sessão 3)
**O que foi feito:** DEMO-4 finalizado: tabela `fc_slug_depara` (De-Para slug extrato → agrupamento_id), 85 mapeamentos para Rio das Pedras (id=10), 8 novos agrupamentos, versões v2.6.0w (PR #57) e v2.6.0x (PR #58). DEMO-5: novo router `fc_exec.py` (`GET /api/demonstrativos/fluxo-caixa`) com motor de cálculo em 2 fases (agrupamentos → totalizadores com forward refs via multi-pass até 10x); `FluxoCaixa.jsx` completamente reescrito como demonstrativo read-only com seletor cliente/ano/mês, segmented control Mensal/Acumulado/Todos, tabela com linhas titulo/agrupamento/totalizador e coluna %Vendas; PR #59 (v2.6.0y) mergeado e em produção.
**Decisões tomadas:** Forward refs em fórmulas FC (ex: linha 61 usa D62-D63) resolvidos por multi-pass convergente (máx 10 iterações, converge em 3); De-Para usa `.lower()` nos slugs do extrato para tratar variações de case sem duplicar entradas; agrupamentos compostos (`slug1+slug2-slug3`) deduplica por `agrupamento_id` evitando double-counting.
**Próximo passo:** Testar no Electron com Rio das Pedras Jan/2025 (Ctrl+Shift+R). Próximas: outros clientes com De-Para, DEMO-6 (orçado no demonstrativo), REL-1 (PDF) na fila.

### 2026-06-29 (sessão 2)
**O que foi feito:** Login.jsx (v2.6.0t PR #53): ícone `eIcon` real no card, checkbox "Lembrar" sem wrapper `isElectron`, Enter avança código→senha→submit via `useRef`. Credenciais via localStorage (v2.6.0u PR #54): `saved_codigo`/`saved_senha`/`remember_credentials` persistidos no login; restaurados no mount; "Trocar usuário" limpa tudo — substitui IPC `window.electronAPI` que não funcionava sem restart do Electron. DEMO-3 (v2.6.0v PR #55): modelo `LancamentoFC` (`fc_lancamentos`), `TemplateRef.segmento_id` nullable (templates universais), `TemplateLinhaRef` + colunas `tipo`/`agrupamento_slug`; migrações PostgreSQL/SQLite aplicadas. Carga de dados no Supabase (script `importar_fc_supabase.py`): Prátiko Supermercados criado (id=9), 1 template "Fluxo de Caixa" (79 linhas: 57 agrupamentos, 17 totalizadores, 5 títulos), 810 lançamentos Jan–Mai/2025, 0 erros.
**Decisões tomadas:** localStorage é o mecanismo primário de credenciais (funciona em Electron e browser); `window.electronAPI?.setCredentials()` é chamado como bonus com `.catch(()=>{})`. `UniqueConstraint` em `fc_lancamentos` inclui `conta_origem` nullable — PostgreSQL trata NULL != NULL, sem violação com múltiplos NULLs. Carga de dados de produção via script one-off (não via release, não commitado no git).
**Próximo passo:** Construir página de Fluxo de Caixa que leia `fc_lancamentos` e `ref_template_linhas` para exibir o extrato real do Prátiko. REL-1 (PDF) permanece na fila.
