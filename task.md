# Checklist de Tarefas — chore/higiene-codigo-e-docs

- [x] TAREFA 1: Deletar código morto perigoso e testar `_limpar_val`
  - [x] Deletar a função `_val` em `backend/xlsx_parser.py`
  - [x] Criar `tests/test_xlsx_parser.py` cobrindo cenários com `_limpar_val`
  - [x] Executar o teste unitário isolado e garantir sucesso

- [x] TAREFA 2: Colisão de nome de módulo auth
  - [x] Renomear `backend/auth.py` para `backend/security.py`
  - [x] Atualizar todos os imports de `from auth import ...` para `from security import ...`
  - [x] Atualizar imports de `import auth` para `import security`
  - [x] Atualizar referências no `CLAUDE.md`
  - [x] Executar pytest para testar a correção e imports corretos

- [x] TAREFA 3: Corrigir mojibake de encoding em `backend/main.py`
  - [x] Reescrever as strings corrompidas de `backend/main.py` (título, descrição, tags do swagger e comentários)
  - [x] Garantir salvamento de `backend/main.py` como UTF-8 sem BOM
  - [x] Criar o arquivo `.gitattributes` na raiz
  - [x] Executar `git add --renormalize .` e comitar isoladamente

- [x] TAREFA 4: Sincronizar CLAUDE.md e versionamento do app
  - [x] Corrigir descrição do router `orcamento.py` no `CLAUDE.md`
  - [x] Ajustar referência do ROADMAP na seção `## ROADMAP` do `CLAUDE.md`
  - [x] Reordenar cronologicamente o histórico de sessões no `CLAUDE.md`
  - [x] Declarar `APP_VERSION` no topo de `backend/main.py` e ajustar FastAPI e `app.version`
  - [x] Ajustar leitura/escrita de versão no `release.ps1` com base em `APP_VERSION`

- [x] TAREFA 5: Guards nos scripts de seed
  - [x] Adicionar guard de SQLite em `backend/seed.py`
  - [x] Adicionar guard de SQLite em `backend/seed_controladoria.py`
  - [x] Adicionar guard de SQLite em `backend/seed_local_leal.py`
  - [x] Adicionar guard de SQLite em `backend/seed_ref_plano.py`

- [x] VALIDAÇÃO FINAL
  - [x] Rodar pytest com 100% verde
  - [x] Rodar npm run build do frontend com sucesso
