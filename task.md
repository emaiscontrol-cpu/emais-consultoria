# Checklist de Tarefas — chore/higiene-codigo-e-docs

- [ ] TAREFA 1: Deletar código morto perigoso e testar `_limpar_val`
  - [ ] Deletar a função `_val` em `backend/xlsx_parser.py`
  - [ ] Criar `tests/test_xlsx_parser.py` cobrindo cenários com `_limpar_val`
  - [ ] Executar o teste unitário isolado e garantir sucesso

- [ ] TAREFA 2: Colisão de nome de módulo auth
  - [ ] Renomear `backend/auth.py` para `backend/security.py`
  - [ ] Atualizar todos os imports de `from auth import ...` para `from security import ...`
  - [ ] Atualizar imports de `import auth` para `import security`
  - [ ] Atualizar referências no `CLAUDE.md`
  - [ ] Executar pytest para testar a correção e imports corretos

- [ ] TAREFA 3: Corrigir mojibake de encoding em `backend/main.py`
  - [ ] Reescrever as strings corrompidas de `backend/main.py` (título, descrição, tags do swagger e comentários)
  - [ ] Garantir salvamento de `backend/main.py` como UTF-8 sem BOM
  - [ ] Criar o arquivo `.gitattributes` na raiz
  - [ ] Executar `git add --renormalize .` e comitar isoladamente

- [ ] TAREFA 4: Sincronizar CLAUDE.md e versionamento do app
  - [ ] Corrigir descrição do router `orcamento.py` no `CLAUDE.md`
  - [ ] Ajustar referência do ROADMAP na seção `## ROADMAP` do `CLAUDE.md`
  - [ ] Reordenar cronologicamente o histórico de sessões no `CLAUDE.md`
  - [ ] Declarar `APP_VERSION` no topo de `backend/main.py` e ajustar FastAPI e `app.version`
  - [ ] Ajustar leitura/escrita de versão no `release.ps1` com base em `APP_VERSION`

- [ ] TAREFA 5: Guards nos scripts de seed
  - [ ] Adicionar guard de SQLite em `backend/seed.py`
  - [ ] Adicionar guard de SQLite em `backend/seed_controladoria.py`
  - [ ] Adicionar guard de SQLite em `backend/seed_local_leal.py`
  - [ ] Adicionar guard de SQLite em `backend/seed_ref_plano.py`

- [ ] VALIDAÇÃO FINAL
  - [ ] Rodar pytest com 100% verde
  - [ ] Rodar npm run build do frontend com sucesso
