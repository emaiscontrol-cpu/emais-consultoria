# Roadmap — E Mais Consultoria
Mantido pelo chat de planejamento (Claude.ai Project). Última atualização: 2026-07-04.
Marque com [x] quando concluído. Mova para a seção ✅ CONCLUÍDO com a versão de entrega.

> **Como ler as prioridades**
> 🔴 Crítico — risco ou bloqueio imediato
> 🟡 Alta — entrega de valor direto ao cliente
> 🟢 Média — melhoria relevante, não urgente
> 🔵 Futura — inovação e diferencial competitivo

---

## 🔴 FASE ATUAL — Fluxo de Caixa: refinamento e diferenciais

### Melhorias em implementação
> FC-1 a FC-4 concluídas — ver seção ✅ CONCLUÍDO ("Fluxo de Caixa — refinamentos v2.6.1a a v2.6.1h")

### Diferenciais analíticos — rápido impacto
- [ ] FC-5 — Sinalização automática de variação anormal (ícone de alerta quando valor foge da média histórica)
- [ ] FC-6 — Mini-gráfico de tendência (sparkline) por linha — últimos 6 meses
- [ ] FC-7 — Copiar valor/linha com um clique (hover mostra ícone)

### Diferenciais analíticos — esforço médio
- [ ] FC-8 — Anotação por linha/período (nota do consultor explicando uma variação)
- [ ] FC-9 — Drill-down até o lançamento original (data + descrição completa, além do detalhamento por conta)
- [ ] FC-10 — Semáforo de saúde nas linhas-chave (Lucro Bruto, EBITDA, Lucro Líquido vs metas)

### Validação de dados
- [ ] DEMO-5b — Validar Total de Custos Operacionais após soma EXTRATO+DESPESA
- [ ] DEMO-5c — Validar seção Investimentos e Financiamentos (Adiantamentos, Empréstimos)
- [ ] DEMO-5d — Validar NCG 1, NCG 2 e Variação de Saldos finais

---

## 🟡 PRÓXIMA FASE — Outros demonstrativos

- [ ] DEMO-6 — Template DRE (estrutura própria, agrupamentos compartilhados com FC quando aplicável)
- [ ] DEMO-9 — Benchmark Segmento (anônimo, só admin/consultor)

> DEMO-7, DEMO-8 e extensões (importação via UI, edição manual, copiloto IA) concluídas — ver seção ✅ CONCLUÍDO ("Módulo de Controle Orçamentário — v2.6.1t a v2.6.2c")

---

## 🟡 PRÓXIMA FASE — Financeiro avançado

### Acordos Comerciais
- [ ] AC-1 — Modelagem: contrato por cliente com vigência, valor, condições e marcos de pagamento
- [ ] AC-2 — Tela de cadastro e acompanhamento de acordos
- [ ] AC-3 — Alertas de vencimento de acordo (email + notificação no app)
- [ ] AC-4 — Vincular acordos ao DRE (receita contratada vs realizada)

### Gerenciamento de Endividamento Bancário
- [ ] END-1 — Modelagem: dívidas por banco, modalidade (CCB, cheque especial, leasing...), taxa, parcelas, vencimento
- [ ] END-2 — Tela de cadastro e acompanhamento por cliente
- [ ] END-3 — Cronograma de amortização com projeção de saldo devedor
- [ ] END-4 — Integração com Fluxo de Caixa (parcelas projetadas como saídas)
- [ ] END-5 — Dashboard de endividamento: índice de cobertura, relação dívida/receita

### Balancete (módulo futuro, separado de DRE/Fluxo)
- [ ] BAL-1 — Modelagem de Balanço Patrimonial (Ativo, Passivo, PL) separada do plano referencial atual
- [ ] BAL-2 — Validação de balanceamento contábil (débito = crédito) — intencionalmente fora do plano referencial
- [ ] BAL-3 — Tela de Balanço Patrimonial formatada

---

## 🟡 MELHORIAS DE PRODUTO — alto impacto imediato

### Plano de Contas Referencial — manutenção fina
- [ ] PLN-1 — Filtro tipo Excel na coluna Agrupamento (dropdown com valores distintos, incluindo "Vazio")
- [ ] PLN-2 — Continuar vinculação manual conta → agrupamento (405+ pendentes)
- [ ] PLN-3 — Considerar rodar sugestão automática após volume de vinculação manual reduzir o risco

### Projetos Inteligentes com IA ⭐⭐
- [ ] PROJ-IA-1 — Geração de projeto a partir de arquivo: contrato, escopo ou imagem → Claude sugere fases, tarefas e prazos
- [ ] PROJ-IA-2 — Biblioteca de modelos inteligentes por segmento (aplicar com um clique)
- [ ] PROJ-IA-3 — Aprendizado por histórico: sugere modelo mais aderente a partir de projetos similares
- [ ] PROJ-IA-4 — Ajuste fino por cliente (IA adapta modelo ao contexto específico)

### Exportação e Relatórios
- [ ] REL-1 — Relatório de projeto em PDF (weasyprint: progresso, fases, tarefas, responsáveis, logo E Mais)
- [ ] REL-2 — DRE em PDF (exportar demonstrativo formatado para envio ao cliente)
- [ ] REL-3 — Estimativa vs Realizado (desvio de prazo por tarefa)
- [ ] REL-4 — Relatório de rentabilidade por cliente (horas × receita = margem)
- [ ] REL-5 — Envio automático de relatório por email
- [ ] REL-6 — Histórico de relatórios enviados por cliente

### Comunicação e Notificações
- [ ] NOTIF-1 — Email ao atribuir tarefa
- [ ] NOTIF-2 — Email de prazo próximo (job diário, 3 dias antes)
- [ ] NOTIF-3 — Email de aguardando validação
- [ ] NOTIF-4 — Notificações push no Electron
- [ ] NOTIF-5 — Digest semanal por email para o cliente
- [ ] NOTIF-6 — Notificação quando demonstrativo financeiro for publicado

### UX e Usabilidade
- [ ] UX-9 — Versões do Orçamento (Original, Rev.1, Rev.2 — comparar lado a lado)
- [ ] UX-11 — Modo leitura para cliente no demonstrativo
- [ ] UX-13 — Comparativo entre períodos (ex: maio 2026 vs maio 2025)
- [ ] UX-14 — Favoritos/atalhos personalizados por usuário
- [ ] UX-15 — Tour guiado para novos clientes

---

## 🟢 INOVAÇÕES COM IA — diferencial competitivo

### Já implementado
> IA flutuante (Claude + Gemini + OpenRouter) com controle de acesso por usuário e provedor — v2.4.0y

### Demonstrativos com IA
- [ ] IA-1 — Importação de dados por PDF via IA ⭐⭐ — Claude extrai contas e valores automaticamente
- [ ] IA-2 — Geração de Relatório Narrativo ⭐ — Resumo executivo automático no topo do demonstrativo
- [ ] IA-3 — Sugestão de prazo por histórico
- [ ] IA-4 — Alertas preditivos de risco de atraso
- [ ] IA-5 — Análise de sentimento em comentários
- [ ] IA-6 — Assistente de montagem de template
- [ ] IA-7 — Diagnóstico financeiro automático (3 pontos de atenção + ações sugeridas)
- [ ] IA-8 — Geração de apresentação executiva (DRE + KPIs → PDF)
- [ ] IA-9 — Chat contextual por demonstrativo (pergunta com contexto da tela já injetado)
- [ ] IA-10 — Sugestão de De-Para por IA generativa (complemento ao fuzzy matching)

---

## 🟢 INFRAESTRUTURA E QUALIDADE

### Segurança
> SEC-6 concluída — ver seção ✅ CONCLUÍDO ("Fluxo de Caixa — refinamentos v2.6.1a a v2.6.1h", entrada v2.6.1i)

### Testes e cobertura
- [ ] INF-8 — Estender cobertura de testes
- [ ] INF-9 — Testes E2E (Playwright/Cypress)
- [ ] INF-10 — Cobertura de testes para o módulo Plano Referencial

### Infraestrutura
- [ ] INF-3 — Criar .env.example documentado
- [ ] INF-4 — Versionamento automático via git tag
- [ ] INF-5 — Fotos de usuário em disco em vez de base64
- [ ] INF-6 — GitHub Secrets para DATABASE_URL
- [ ] INF-11 — Monitoramento de erros em produção (Sentry)
- [ ] INF-12 — Health check endpoint (/api/health)
- [ ] INF-13 — Log estruturado em produção

---

## 🔵 FUTURO — Módulos e expansão

### Inteligência de Mercado (escopo a definir)
- [ ] IM-1 a IM-4 — Painel de indicadores setoriais, concorrentes, alertas

### Portal do cliente
- [ ] PORT-1 — App mobile (PWA)
- [ ] PORT-2 — Temas por cliente
- [ ] PORT-3 — Assinatura digital de relatórios
- [ ] PORT-4 — Área de documentos por competência

### Integrações externas
- [ ] INT-1 — Google Calendar
- [ ] INT-2 — Open finance
- [ ] INT-3 — WhatsApp Business
- [ ] INT-4 — Webhook de saída

### Outros
- [ ] OUT-1 — Multi-idioma
- [ ] OUT-2 — Modo offline (Service Worker)
- [ ] OUT-3 — Auditoria completa de alterações
- [ ] OUT-4 — Multi-empresa

---

## ✅ CONCLUÍDO

### Fluxo de Caixa — refinamentos v2.6.1a a v2.6.1h (30/06 a 02/07/2026)
- FC-1: Expandir/colapsar totalizadores (chevron + botões "Expandir tudo"/"Colapsar tudo") — `v2.6.1a`
- FC-2: Coluna de Participação % opcional no modo "Todos os meses" — `v2.6.1a`
- FC-3: Detalhamento de lançamentos por agrupamento — painel ABC + rosca animada + comparativo vs mês anterior, componente genérico `PainelDetalheAgrupamento.jsx` — `v2.6.1j` a `v2.6.1p`
- FC-4: Exportar Fluxo de Caixa em PDF — botão genérico `BotaoExportarPDF.jsx` + endpoint `POST /api/pdf/demonstrativo`, reaproveitável por qualquer demonstrativo — `v2.6.1h` (⚠️ implementado com **reportlab**, não weasyprint como o roadmap original previa — weasyprint exige GTK3/Pango nativo, ausente no Windows dev/produção e no runner do CI; ver `Pontos de Atenção #7` no CLAUDE.md)
- SEC-6: Proteção contra remoção acidental do único admin ativo (usuário não pode alterar o próprio `perfil`; não é possível rebaixar o último admin ativo do sistema) — `v2.6.1i` *(fora do roadmap original; motivado por incidente real de produção — ver Histórico de Sessões, sessão 5)*

### Módulo de Controle Orçamentário — v2.6.1t a v2.6.2c (02-04/07/2026)
- DEMO-7: Template de Orçamento (mesma estrutura de linhas do FC), importador local (`importar_orcamento_planilha.py`) e painel com gráficos Recharts + velocímetro SVG (`PainelDetalheOrcamento.jsx`)
- DEMO-8: Comparativo realizado vs orçado (desvio % por linha)
- DEMO-7b: Upload da planilha de orçamento direto pela UI (aba "Orçamento" em Importações), com fix no header multipart/form-data do Axios
- DEMO-7c: Edição Manual de Orçamento — grade interativa mês × conta (`EditarOrcamento.jsx`), histórico do ano anterior como referência, salvamento automático, auditoria via `LogAtividade`, trava de tenant por `cliente_id`
- DEMO-7d: Modal de preenchimento inteligente — reajuste de inflação, distribuição linear/sazonal e copiloto de projeção por IA (Gemini/Claude/OpenRouter)
- Orçamento de 2026 de Rio das Pedras (684 registros) importado com sucesso em produção via pooler Supabase

### Fluxo de Caixa funcionando ponta a ponta — v2.6.0x (29-30/06/2026)
- DEMO-1: 62 agrupamentos importados (depois 70 com novos criados no DEMO-4)
- DEMO-2: Estrutura de vinculação conta→agrupamento com herança do pai, sem campo natureza
- DEMO-3: Template FC (79 linhas: 57 agrupamentos, 17 totalizadores, 5 títulos) + 615 lançamentos reais (Jan-Mai/2026, cliente Rio das Pedras id=10)
- DEMO-4: Tabela fc_slug_depara com 87 mapeamentos (slugs EXTRATO+DESPESA → agrupamentos), incluindo 8 novos agrupamentos criados (Vendas Cheques/Extra Caixa Saída, Outras Entradas/Saídas Operacionais, Acordos Saída, Recarga Entrada/Saída, Recuperação de Pessoal)
- DEMO-4b: Importação da aba DESPESA como segunda fonte (fonte="despesa"), somada automaticamente com EXTRATO por agrupamento
- DEMO-5: Endpoint de cálculo + tela FluxoCaixaExecutivo.jsx renderizando os 79 linhas com fórmulas corretas (incluindo totalizadores com ordem de subtração respeitando a fórmula original do Excel)
- Validação linha a linha contra a planilha Excel original: valores batendo até Lucro Bruto confirmados; demais seções em ajuste fino

### Login simplificado — v2.6.0t/v2.6.0u
- Código de 3 dígitos numéricos substituindo email na tela (email mantido internamente)
- Checkbox "Lembrar credenciais" funcionando via localStorage no Electron
- Navegação por Enter entre campos (padrão adotado em todo o sistema)
- Logo real da empresa (icon.png) substituindo placeholder
- Migração segura — usuários sem código continuam funcionando pelo email

### Design System — v2.6.0m
- Arquivo DESIGN_SYSTEM.md criado e commitado na raiz do projeto + Project Knowledge
- 12 novas CSS variables (módulos, demonstrativos, text-muted, surface-hover)
- Cores hardcoded substituídas por CSS variables em Sidebar, PlanoReferencial, Arquivos, FluxoCaixa

### Arquivos de clientes — Supabase Storage — v2.6.0d
- Migração de disco local para Supabase Storage (bucket "arquivos-clientes")
- Upload com signed URL, visualização de PDF em nova aba, download de DOCX/XLSX
- Categorias de arquivo com badge colorido e filtro
- Fix de sequence dessincronizada em todas as tabelas
- Fix de popup blocker no Electron para abertura de PDF

### Sidebar reorganizada — v2.5.0y
- 3 módulos comerciais com ícone colorido: Projetos (teal), Inteligência de Mercado (roxo), Análises Gerenciais (âmbar)
- 2 seções internas: Administração e Procedimentos (invisíveis ao cliente)
- Módulos bloqueados visíveis com cadeado + tela "Saiba mais"

### Plano de Contas Referencial — v2.5.0y a v2.6.0i
- 916 contas importadas (sintética/analítica, hierarquia por código)
- Coluna Demonstrativo (FC/DRE/ORC) substituindo Natureza
- Painel de vinculação com tabs por demonstrativo + busca + propagação para filhas
- Limpeza completa do modelo antigo "Modelos & Contas"

### Skills de desenvolvimento — 2026-06-21
- /novo-modulo, /novo-modulo-cliente, /novo-router, /fix-permissao, /release, /novo-plano-referencial

### Módulo de IA — v2.4.0y
- IA flutuante: Claude + Gemini + OpenRouter com controle granular por usuário

### Migração e infraestrutura — v2.5.0s / v2.5.0v
- SQLite → Supabase PostgreSQL (40 tabelas, 90.034 registros)
- CI com GitHub Actions + branch protection na main (53+ testes)

### Features de produto — v2.4.0c
- Dashboard Executivo, Busca Global Ctrl+K, Kanban, Chat interno, Comentários @menção

### Correções críticas — v2.3.1a
- SEC-1 a SEC-5 (segurança) e BUG-1 a BUG-3 (estabilidade)
