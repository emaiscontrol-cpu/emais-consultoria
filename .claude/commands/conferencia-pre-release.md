---
description: Conferência independente obrigatória antes de qualquer release. Use SEMPRE que o usuário mencionar rodar release, mandar/subir a versão, enviar para produção, fechar o dia, ou disser que terminou as implementações. Verifica testes, build, segurança e integridade — NUNCA executa o release por conta própria.
allowed-tools: [Read, Bash, Grep, Glob]
---

# Conferência Pré-Release — E Mais Consultoria

Execute TODAS as verificações, na ordem. Reporte cada item com ✅/❌ em português.
Skill somente-leitura + testes: PROIBIDO executar release, push, merge ou alterar arquivos.

## 1. Repositório
- git status limpo; branch main sincronizada com origin
- Listar commits desde a última tag (o que entra nesta versão)

## 2. Testes e build
- pytest tests/ -v — 100% verde obrigatório
- cd frontend && npm run build — sem erros

## 3. Segurança (regressões proibidas)
- grep -rn "eval(" backend/routers/ backend/*.py → só pode existir safe_eval; eval( cru = ❌ CRÍTICO
- /api/version em backend/main.py retorna somente version (sem db_url/paths/contagens)
- Endpoints novos com cliente_id chamam verificar_tenant (listar exceções)
- SECRET_KEY sem fallback inseguro novo em backend/security.py

## 4. Integridade
- grep -c "ÃƒÆ" backend/main.py = 0
- Valores digitados no frontend usam parseValorBR (nenhum parseFloat/replace inline novo)
- requirements.lock.txt sem python-jose; se requirements.txt mudou, lock regenerado

## 5. Banco
- Se models.py mudou desde a última tag: existe migração? AVISAR: release exigirá BACKUP prévio
- Se não mudou: informar que o release é seguro quanto a schema

## 6. Documentação
- CLAUDE.md com registro da sessão; ROADMAP_2.md atualizado

## Veredito (obrigatório, sempre um dos dois)
- "✅ GO — pronto para release. Próximo passo: [backup se item 5 exigir] + /release"
- "❌ NO-GO — corrigir antes: [lista objetiva]"
NUNCA prosseguir para o release automaticamente, mesmo com GO — a decisão é do usuário.
