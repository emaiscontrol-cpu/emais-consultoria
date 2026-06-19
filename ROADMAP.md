# Roadmap — E Mais Consultoria

> Marque com `[x]` quando concluído. Adicione novas ideias na seção correspondente.
> Última atualização: 2026-06-18

---

## 🔴 CORREÇÕES CRÍTICAS (segurança e estabilidade)

- [x] **SEC-1** — Remover default da `SECRET_KEY` em `backend/auth.py:13`. Se `.env` não existir, lançar erro no startup em vez de usar valor fraco. — `v2.3.1a`
- [x] **SEC-2** — Adicionar validação de tamanho de foto em `PUT /api/auth/foto` (limite ~375 KB / `len(base64) <= 500_000`). — `v2.3.1a`
- [x] **SEC-3** — Adicionar rate limiting no `POST /api/auth/login` para impedir brute force (ex: máximo 10 tentativas por IP por minuto). — `v2.3.1a`
- [x] **SEC-4** — Mover credenciais hardcoded de usuários (Luiz, Hernandes, Deusangelo) do `backend/main.py` para um script de seed separado, fora do repositório git. — `v2.3.1a`
- [x] **SEC-5** — Remover `DB_PATH` hardcoded (`C:/emals-service/...`) de `backend/routers/admin.py` e mover para variável de ambiente `.env`. — `v2.3.1a`
- [x] **BUG-1** — `threading.Timer` de backup automático cria timer duplicado ao recarregar uvicorn. Implementar guard com `_auto_timer.cancel()` antes de recriar. — `v2.3.1a`
- [x] **BUG-2** — Token JWT expira em 8h sem refresh silencioso. Implementar renovação automática no frontend antes de redirecionar para login. — `v2.3.1a`
- [x] **BUG-3** — `StatusTarefa` tinha enum `aguard_valid` com valor `"aguard_validacao"` — nome inconsistente. Renomeado para `aguard_validacao`. — `v2.3.1a`

---

## 🟡 MELHORIAS DE DADOS E BACKEND

- [x] **DB-1** — `Anotacao` recebeu `usuario_id FK` para `usuarios.id`. Migração popula FK para registros existentes. — `v2.4.1a`
- [x] **DB-2** — Soft delete implementado em `Projeto` e `Fase` (campo `ativo`). Delete passa a ocultar em vez de remover. `Tarefa` já tinha soft delete. — `v2.4.1a`
- [x] **DB-3** — Paginação adicionada nos endpoints de projetos (`skip/limit`) e histórico (`skip/limit`, máx 500). — `v2.4.1a`
- [x] **DB-4** — Índices criados em `log_atividades.criado_em` e `tarefas.data_prazo`. — `v2.4.1a`
- [x] **DB-5** — `Bandeira.unidades_json` validado como lista de strings nas operações criar e atualizar. — `v2.4.1a`

---

## 🟢 FEATURES INCOMPLETAS (framework já existe no banco)

- [x] **FEAT-1** — **Templates de Projeto** ⭐ — Implementado em `v2.3.0w`: router completo `/api/modelos`, tela em Procedimentos > Templates de Projeto, seletor no modal "Novo projeto" com aplicação automática de fases e tarefas com cálculo de prazos.

---

## 🔵 MELHORIAS DE PRODUTO (alto impacto)

- [x] **UX-1** — **Busca Global `Ctrl+K`** ⭐ — `v2.4.0c`
- [x] **UX-2** — **Dashboard Executivo** ⭐ — `v2.4.0c`
- [x] **UX-3** — **Portal Simplificado para Analista** — `v2.4.0c`
- [x] **UX-4** — **Indicadores de SLA por tarefa** — `v2.4.0c`
- [x] **UX-5** — **Kanban de tarefas** — `v2.4.0c`
- [x] **UX-6** — **Reordenar fases e tarefas** — `v2.4.0c`
- [x] **UX-7** — **Histórico detalhado por tarefa** — `v2.4.0c`
- [x] **UX-8** — **Comentários com menções `@usuario`** — `v2.4.0c`
- [ ] **UX-9** — **Versões do Orçamento** — Salvar revisões (Original, Rev.1, Rev.2) e comparar colunas lado a lado na tela de Orçamento.
- [x] **UX-10** — **Chat interno por projeto** — `v2.4.0c`

---

## 📧 COMUNICAÇÃO E NOTIFICAÇÕES

- [ ] **NOTIF-1** — **Email ao atribuir tarefa** — Ao salvar `responsavel_id` em uma tarefa, enviar email para o responsável com link direto.
- [ ] **NOTIF-2** — **Email de prazo próximo** — Job diário (pode usar o mesmo timer do backup) que envia email para responsáveis com tarefas vencendo em 3 dias.
- [ ] **NOTIF-3** — **Email de aguardando validação** — Ao cliente confirmar tarefa com `requer_validacao=True`, notificar o consultor responsável da fase por email.
- [ ] **NOTIF-4** — **Notificações push no Electron** — Usar a API de notificações nativas do Electron para alertas mesmo com o app em segundo plano.

---

## 📄 EXPORTAÇÃO E RELATÓRIOS

- [ ] **REL-1** — **Relatório de projeto em PDF** — Usando `weasyprint` (Python): progresso, fases, tarefas, responsáveis, formatado com logo da E Mais.
- [ ] **REL-2** — **DRE em PDF** — Exportar a visualização atual da DRE em PDF formatado para envio ao cliente.
- [ ] **REL-3** — **Estimativa vs. Realizado** — Cruzar `duracao_dias` das tarefas (estimado) com `data_inicio` e `data_conclusao` (realizado) para mostrar desvio de prazo.
- [ ] **REL-4** — **Relatório de rentabilidade por cliente** — Cruzar horas trabalhadas (subtarefas com data_inicio/data_fim) com receitas da Controladoria para calcular margem por cliente.

---

## 🚀 INOVAÇÕES COM IA (diferencial competitivo)

- [ ] **IA-1** — **Importação de Balancete por PDF via IA** ⭐⭐ — Enviar PDF de balancete contábil; backend usa API do Claude para extrair contas e valores automaticamente e preencher a tela de Balancetes. Elimina digitação manual do contador.
- [ ] **IA-2** — **Geração de Relatório Narrativo** ⭐ — Após coletar dados do projeto, chamar Claude para gerar um parágrafo executivo em português: "O projeto X está 72% concluído. A fase 3 apresenta risco de atraso...". Exporta junto com o PDF.
- [ ] **IA-3** — **Sugestão de prazo por histórico** — Ao criar uma tarefa, com base em tarefas similares já concluídas no sistema, sugerir prazo realista automaticamente.
- [ ] **IA-4** — **Alertas preditivos de risco** — Cruzar velocidade histórica de progresso + prazo restante + % atual e identificar projetos que **vão atrasar** antes que o atraso aconteça. Badge de risco preventivo.
- [ ] **IA-5** — **Análise de sentimento em comentários** — Identificar comentários com urgência ou insatisfação e destacar no painel do consultor.

---

## 🔧 INFRAESTRUTURA E DEVOPS

- [x] **INF-1** — Migrar banco de SQLite para Supabase PostgreSQL. 40 tabelas, 90.034 registros, backup automático `.sql.gz`. — `v2.5.0s`
- [x] **INF-2** — Implementar CI com GitHub Actions: testes automatizados (`pytest`) a cada PR/push para `main`. — `2026-06-16`
- [ ] **INF-2b** — **Branch protection na `main`** — Configurar em Settings → Branches a regra exigindo o check `ci-status` antes de permitir merge. Ação manual no GitHub, ainda pendente.
- [ ] **INF-3** — Criar arquivo `.env.example` com todas as variáveis necessárias documentadas.
- [ ] **INF-4** — Adicionar versionamento automático via git tag (script lê a tag mais recente e injeta em `app.version`).
- [ ] **INF-5** — Armazenar fotos de usuário em disco (pasta `/uploads`) em vez de base64 no banco. Servir via endpoint estático.
- [ ] **INF-6** — **GitHub Secrets para DATABASE_URL** — Automatizar credenciais do Supabase via GitHub Secrets/Actions, eliminando edição manual do `.env` via RDP.
- [x] **INF-7** — **UI de Backup para PostgreSQL** — Tela Backup adaptada: textos e `accept` do input mudam dinamicamente quando `postgres=true`. — `v2.5.0t`
- [ ] **INF-8** — **Estender cobertura de testes** — `tests/test_api.py` cobre auth/clientes/projetos/fases/tarefas/usuarios/dashboard/anotações/subtarefas. Faltam: controladoria, fluxo de caixa, orçamento, balancete, IA (claude/gemini/openrouter), importação DRE, admin/backup.

---

## 💡 IDEIAS FUTURAS (backlog)

> Adicione aqui ideias que ainda não foram analisadas

- [ ] Integração com Google Calendar (sincronizar prazos de tarefas)
- [ ] App mobile (PWA ou wrapper React Native)
- [ ] Modo offline para o Electron (Service Worker)
- [ ] Multi-idioma (português / inglês / espanhol)
- [ ] Temas de cor por cliente (logo + cor primária personalizados)
- [ ] Assinatura digital de relatórios (HashDoc ou DocuSign)

---

## ✅ CONCLUÍDO

> Mova os itens para cá quando implementados, com a versão em que foram entregues.

---

### 🤖 Módulo de IA — 2026-06-11 (v2.4.0s → v2.4.0y)

- [x] **IA-INFRA-1** — **DashboardCliente: tela branca corrigida** — `createPlotlyComponent` no nível de módulo causava crash no bundle React. Substituído por `PlotChart` com `import()` dinâmico dentro de `useEffect`. Bundle reduzido de 5.7 MB para 1.07 MB app + 4.6 MB Plotly (lazy). — `v2.4.0i`
- [x] **IA-INFRA-2** — **Sidebar refatorada** — Emojis em todos os títulos, `SectionBtn` unificado (fonte, estado ativo, colapsável), sem duplicatas (Análises Gerenciais, Administração, Procedimentos), seção CLIENTES removida, Fluxo de Caixa recebeu emoji 💲. — `v2.4.0n`
- [x] **IA-BTN-1** — **Botões de IA flutuantes — Claude + Gemini** — `FloatingAI.jsx` com dois botões fixos (fundo da tela, direita), painéis laterais de 420 px, renderizador de markdown, contexto da tela via `aiContext.js` (`setAIContext / getAIContext`), suporte a pergunta livre (Ctrl+Enter envia). Backends em `routers/ia.py` (Anthropic) e `routers/gemini.py` (Google). `ANTHROPIC_API_KEY` e `GEMINI_API_KEY` no `.env` do servidor. — `v2.4.0p`
- [x] **IA-BTN-2** — **Logo oficial Claude (Anthropic)** — Substituída aproximação por path SVG oficial do Simple Icons. Correção do bug `id="gem-g"` duplicado no Gemini (gradient ID único via `useId()`). — `v2.4.0s`
- [x] **IA-BTN-3** — **OpenRouter integrado como 3º botão** — Gateway multi-modelo com seletor de chips: GPT-4o, Claude 4.5, Gemini Flash, Llama 3.3, DeepSeek e Nemotron 70B (free). Backend em `routers/openrouter.py`, whitelist de modelos, `OPENROUTER_API_KEY` no `.env`. — `v2.4.0u`
- [x] **IA-PERM-1** — **Controle de acesso à IA por usuário** — Coluna `ia_habilitado` na tabela `usuarios`. Admin habilita/desabilita por usuário no modal de edição. `admin` tem acesso automático. Botões ocultados para usuários sem permissão. — `v2.4.0w`
- [x] **IA-PERM-2** — **Permissões granulares por provedor** — Substituiu `ia_habilitado` por `ia_claude`, `ia_gemini`, `ia_openrouter` (colunas independentes). Admin controla acesso a cada IA separadamente. Logos oficiais (Simple Icons: Anthropic, Google Gemini, OpenRouter). Botões discretos: 38 px, 50 % opacidade → 100 % no hover. Posicionamento dinâmico sem gaps. Badges coloridos na lista de usuários (C / G / OR). — `v2.4.0y`

---

- [x] Correções críticas SEC-1 a SEC-5 e BUG-1 a BUG-3 — segurança e estabilidade — `v2.3.1a`
- [x] Templates de Projeto — CRUD completo + aplicação automática ao criar projeto — `v2.3.0w`
- [x] Renomear perfil `cliente` → `analista` em todo o sistema — `v2.3.0v`
- [x] Modelos & Contas movido para seção Procedimentos (admin only) — `v2.3.0v`
- [x] Upload de foto de perfil (base64 no banco) — `v2.3.0v`
- [x] Manual movido para rodapé da sidebar — `v2.3.0v`
- [x] Seção Administração colapsável (apenas admin/consultor) — `v2.3.0`
- [x] Notificação de nova versão disponível no topo do app — `v2.3.0`
- [x] Backup automático diário configurável — `v2.3.0`
- [x] Restaurar banco via upload — `v2.3.0`
- [x] Export do banco via API (`GET /api/admin/db/export`) — `v2.3.0`
- [x] UX-1 Busca Global Ctrl+K — modal unificado por projetos, tarefas, clientes e comentários — `v2.4.0c`
- [x] UX-2 Dashboard Executivo — grade de clientes com KPIs, progresso e tarefas atrasadas — `v2.4.0c`
- [x] UX-3 Portal Simplificado para Analista — visão limpa com confirmação de tarefas — `v2.4.0c`
- [x] UX-4 Indicadores de SLA por tarefa — crachá verde/amarelo/vermelho por prazo — `v2.4.0c`
- [x] UX-5 Kanban de tarefas — aba alternativa com 4 colunas por status + mover cards — `v2.4.0c`
- [x] UX-6 Reordenar fases e tarefas — botões ↑↓ que atualizam campo `ordem` via API — `v2.4.0c`
- [x] UX-7 Histórico detalhado por tarefa — tabela de mudanças por campo na aba histórico — `v2.4.0c`
- [x] UX-8 Comentários com menções @usuario — autocomplete + log de menção — `v2.4.0c`
- [x] UX-10 Chat interno por projeto — canal de mensagens com polling de 8s — `v2.4.0c`

---

### 🗄️ Migração SQLite → Supabase PostgreSQL — 2026-06-15 (v2.5.0s)

- [x] **INF-1** — **Migração SQLite → Supabase PostgreSQL** — 40 tabelas criadas via `create_all`, 90.034 registros migrados com conversão de booleanos e filtro de colunas legadas (`ia_habilitado`). — `v2.5.0s`
- [x] **INF-1b** — **Backup automático PostgreSQL** — `admin.py` reescrito com suporte dual SQLite/PostgreSQL. Backups gzip (`.sql.gz`) com `TRUNCATE + INSERT`, `SET session_replication_role = 'replica'` no restore. Agendamento diário às 03:00 via `threading.Timer`. — `v2.5.0s`
- [x] **INF-1c** — **UPLOADS_DIR e BACKUP_DIR via env** — Removidos paths hardcoded de Windows. Ambos os diretórios configuráveis via variáveis de ambiente com fallback sensato. — `v2.5.0s`
- [x] **INF-1d** — **Pooler IPv4 para servidor sem IPv6** — Host direto `db.xxx.supabase.co` retorna apenas AAAA (IPv6); servidor de produção não tem IPv6. Solução: pooler `aws-1-sa-east-1.pooler.supabase.com:5432` com usuário `postgres.jlnipsscnsanfklfmbin`. — `v2.5.0s`

---

### 🧪 Testes automatizados e CI/CD — 2026-06-16

- [x] **INF-2** — **Suíte de testes (`tests/`) + GitHub Actions** — `tests/conftest.py` (FastAPI mínimo + SQLite isolado em arquivo temporário, nunca toca no Supabase), `tests/test_api.py` (38 testes de endpoints críticos: auth, clientes, projetos, fases, tarefas, usuários, dashboard, anotações, subtarefas — inclui isolamento multi-tenant e regras de permissão por perfil), `tests/test_frontend_build.py` (valida `frontend/dist/`). `.github/workflows/ci.yml` roda tudo a cada PR/push para `main`.
- [x] **INF-2a** — **Node.js alinhado no CI** — `node-version-file: frontend/.nvmrc` + `engines.node` no `package.json`, corrigindo falha de binding nativo do rolldown/Vite por divergência de versão entre local e runner.
- [x] **INF-2c** — **`package-lock.json` ressincronizado** — `npm install` para registrar `plotly.js-dist-min@3.6.0`, que estava no `package.json` mas faltava no lock (causava falha de `npm ci` no CI).
- [x] **INF-2d** — **Arquivos fonte órfãos resgatados** — `DashboardExecutivo.jsx`, `Procedimentos.jsx`, `Modelos.jsx`, `BuscaGlobal.jsx`, `AIButton.jsx` existiam localmente e eram importados pelo app, mas nunca tinham sido commitados (não eram ignorados pelo git — só esquecidos). Causavam falha de build no CI por import inexistente no repositório remoto.
- [x] **INF-2e** — **Varredura geral de untracked + `.gitignore` revisado** — Auditoria de todo o projeto (não só frontend): docs de arquitetura, assets do Electron, scripts de dev/ops e `CLAUDE.md` passaram a ser rastreados; `.gitignore` ganhou regra genérica para `__pycache__/`/`*.pyc` (cobria só `backend/`) e `backend/backup/` (backups gerados localmente).
