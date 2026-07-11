## CONTRATO DE SESSÃO — regras inegociáveis

> ⚠️ Esta seção existe em duas cópias: aqui e em `CLAUDE.md` (lido pelo Claude Code). As duas devem dizer exatamente a mesma coisa — ao mudar uma, atualizar a outra também.

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

---

# Padrões de Usabilidade de Teclado e Formulários

Este documento registra regras específicas de experiência do usuário (UX) para formulários e interações pelo teclado no sistema E Mais Consultoria.

## Regras de UX e Acessibilidade por Teclado

1. **Submissão com Tecla Enter**:
   - Em qualquer formulário, se todos os campos obrigatórios já estiverem preenchidos (seja automaticamente por carregamento de credenciais salvas ou manualmente pelo usuário), a tecla `Enter` em qualquer campo de texto ativo deve realizar a submissão direta do formulário.
   - Isso evita a necessidade de o usuário pressionar `Tab` repetidamente ou ter que clicar no botão de confirmação quando os dados já estão prontos.

2. **Navegação de Foco entre Campos**:
   - Em formulários com múltiplos campos vazios, a tecla `Enter` deve focar o próximo campo lógico vazio em vez de submeter o formulário diretamente, guiando o usuário no preenchimento passo a passo.
   - O último campo do formulário deve sempre submeter as informações ao pressionar `Enter`.

3. **Auto-foco em Campos de Tamanho Fixo**:
   - Campos de tamanho fixo conhecido (por exemplo, o Código de Acesso do usuário que possui exatamente 3 dígitos) devem focar automaticamente o próximo campo do fluxo assim que o número total de caracteres permitidos for inserido.
   - Isso impede que o cursor de texto continue piscando em um campo já concluído e agiliza o fluxo de interação do usuário.

## Organização de Documentos de Planejamento (IA)

1. **Localização de Planos, Tarefas e Validações**:
   - Todo plano de implementação (`implementation_plan.md`), checklist de tarefas (`task.md`), registro de validação final (`walkthrough.md`) e qualquer análise pontual gerada por agentes de IA devem ser **sempre** criados e mantidos em **`documentos/sessoes/`** — **nunca na raiz do repositório** (reorganizado na sessão 17, 11/07/2026).
   - Na raiz do repositório permanecem apenas os documentos permanentes do projeto: `CLAUDE.md`, `README.md`, `ROADMAP_2.md`, `SKILLS.md` e `DESIGN_SYSTEM.md`. Nenhum outro arquivo `.md` de trabalho deve ser criado na raiz.
   - Evitar mantê-los exclusivamente nas pastas locais de cache do agente (`.gemini/antigravity/`), garantindo que o histórico e o andamento das decisões fiquem sempre registrados no controle de versão (Git).
