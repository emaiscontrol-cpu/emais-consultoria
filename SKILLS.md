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

## `/novo-modulo-cliente`

Adiciona um novo módulo comercial vendável ao sistema — coluna de contratação em `clientes`, schemas, propagação em `_modulos_do_cliente()` (auth), seção na Sidebar com locking (cadeado + tela "Saiba mais" quando o cliente não tem o módulo) e toggle no cadastro de clientes.

**Quando usar:** ao criar um novo módulo comercial que pode ser contratado ou não por cada cliente (como Projetos, Inteligência de Mercado, Análises Gerenciais).

**Uso:**
```
/novo-modulo-cliente inteligencia_mercado "Inteligência de Mercado"
```

**O que é criado:**
- Coluna `modulo_<nome>` em `models.py` (`Cliente`) + migração SQLite e PostgreSQL
- Campo em `ModulosCliente`, `ClienteCreate`, `ClienteOut` (`schemas.py`)
- Propagação em `_modulos_do_cliente()` (`routers/auth.py`)
- Seção na Sidebar com prop `bloqueado`, sempre visível (cadeado quando não contratado)
- Entrada em `SaibaMais.jsx` (tela de apresentação do módulo bloqueado)
- Entrada em `Clientes.jsx` — toggle de contratação no cadastro

**Exemplo de sessão:**
```
você: /novo-modulo-cliente auditoria "Auditoria Digital"
Claude: Qual cor identificadora e ícone Lucide? [...]
        [cria coluna, schemas, sidebar, SaibaMais e toggle em Clientes.jsx]
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

## `/novo-plano-referencial`

Cria o módulo completo de Plano de Contas Referencial — o núcleo financeiro do sistema: plano de contas único compartilhado por todos os clientes, De-Para inteligente (fuzzy matching + aprendizado entre clientes), templates de demonstrativos (DRE/Fluxo de Caixa/Orçamento) com fórmulas em cascata por segmento, controle de período/competência e benchmark anônimo por segmento.

**Quando usar:** apenas para a implementação inicial deste módulo (skill de escopo grande, não recorrente) ou como referência de arquitetura ao estender o Plano Referencial.

**Uso:**
```
/novo-plano-referencial
```

**O que é criado:**
- Modelagem: `PlanoReferencial`, `ContaReferencial`, `Segmento`, `ContaCliente`, `DePara` (com rateio e versionamento por vigência), `Lancamento`, `Template`, `TemplateLinha`, `PeriodoFechado`
- Motor de sugestão de De-Para (fuzzy matching + reforço por vínculos já confirmados em outros clientes)
- Endpoints de CRUD, importação de lançamentos, revisão de De-Para, cálculo de demonstrativo (com detecção de ciclo e ordenação automática de dependências entre linhas), comparativo realizado vs orçado e benchmark de segmento (agregado, anônimo)
- Telas: plano de contas hierárquico, revisão de De-Para (lista + drag-and-drop lado a lado), editor de templates estilo planilha, visualização de demonstrativo, benchmark de segmento
- Permissões: administração do plano restrita a `admin`/`consultor`; demonstrativos calculados visíveis ao cliente conforme módulo "Análises Gerenciais" contratado

**Exemplo de sessão:**
```
você: /novo-plano-referencial
Claude: [lê CLAUDE.md, implementa modelagem, motor de De-Para, endpoints e telas em ordem,
         ao final lista arquivos criados e pergunta se quer popular dados de teste]
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

## `/padrao-relatorios`

Aplica (ou corrige) o padrão visual compartilhado pelas tabelas de demonstrativos — Fluxo de Caixa Executivo, Controle Orçamentário e futuros DRE/Balancete/Demonstrativo Ref. Cobre slot de % com largura fixa, formatação numérica única (`tabular-nums`, regra de vazio/zero), destaque de linha por slug e o padrão visual de totalizador/título.

**Quando usar:** ao criar uma nova tela de demonstrativo ou corrigir desalinhamento visual (ex.: totalizador desalinhado dos números normais, % faltando em linha de soma) numa tela existente.

**Uso:**
```
/padrao-relatorios frontend/src/pages/controladoria/DRE.jsx corrigir alinhamento do totalizador
```

**Regras aplicadas** (documentadas em `DESIGN_SYSTEM.md` § "Padrão de tabelas de demonstrativos"):
- Slot de % sempre via `<CelulaValorPct />` — nunca construído manualmente
- Um único helper de vazio/zero por arquivo (`—` para nulo/zero em linha normal, `0,00` para zero em linha em negrito)
- Destaque de linha por slug via `SLUGS_DESTAQUE_TITULO`, sem mudar `tipo` da linha
- Só ajusta alinhamento/apresentação — nunca mexe em lógica de negócio (colunas, cálculos) da tela

**Exemplo de sessão:**
```
você: /padrao-relatorios corrigir % faltando na linha de EBITDA do Balancetes.jsx
Claude: [lê DESIGN_SYSTEM.md e FluxoCaixa.jsx como referência, aplica CelulaValorPct
         na linha de totalizador, roda npm run build]
```

---

## `/conferencia-pre-release`

Conferência independente obrigatória antes de qualquer release — testes, build, segurança (regressões proibidas como `eval()` cru ou vazamento em `/api/version`), integridade (encoding, parse monetário, lock de dependências), schema de banco e documentação. Skill somente-leitura: nunca executa release, push, merge ou altera arquivos.

**Quando usar:** sempre que o usuário mencionar rodar release, subir/mandar a versão, enviar para produção, fechar o dia, ou disser que terminou as implementações. É o **Passo 0** automático do `/release` — nunca pular.

**Uso:**
```
/conferencia-pre-release
```

**O que verifica:**
1. Repositório limpo e sincronizado com origin; commits desde a última tag
2. `pytest tests/ -v` 100% verde + `npm run build` sem erros
3. Segurança: zero `eval(` cru, `/api/version` sem vazamento, `verificar_tenant` nos endpoints com `cliente_id`, sem fallback inseguro novo de `SECRET_KEY`
4. Integridade: zero mojibake em `main.py`, parse monetário via `parseValorBR`, `requirements.lock.txt` sem `python-jose`
5. Banco: se `models.py` mudou, avisa que o release exige backup prévio
6. Documentação: `CLAUDE.md` e `ROADMAP_2.md` atualizados

**Veredito:** sempre termina em "✅ GO — pronto para release" ou "❌ NO-GO — corrigir antes: [lista]". Nunca prossegue para o release sozinha, mesmo com GO — a decisão é do usuário.

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

0. Executa `/conferencia-pre-release` — só prossegue com GO explícito
1. Verifica branch e estado do working tree
2. Lê versão atual em `backend/main.py` e sugere o próximo incremento
3. Atualiza `app.version` no `main.py`
4. Roda `npm run build` no frontend
5. Commita `backend/main.py` + `frontend/dist/`
6. Atualiza `ROADMAP_2.md` — move itens implementados para "✅ CONCLUÍDO"
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
