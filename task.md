# Checklist de Tarefas — fix/corrupcao-de-dados

- [x] TAREFA 1: Parse monetário da célula editável do DRE
  - [x] Criar helper `parseValorBR(str)` em `frontend/src/components/shared.jsx`
  - [x] Substituir parse inline no `DRE.jsx` pelo helper `parseValorBR`
  - [x] Substituir parse inline no `Demonstrativo.jsx` pelo helper `parseValorBR`
  - [x] Substituir parse inline no `ModuloBase.jsx` pelo helper `parseValorBR`
  - [x] Substituir parse inline no `EditarOrcamento.jsx` pelo helper `parseValorBR`
  - [x] Executar `npm run build` no frontend para garantir que compila sem erros

- [ ] TAREFA 2: Transação do importador de orçamento
  - [ ] Reordenar `importar_orcamento` em `backend/routers/orcamento.py` para fazer DELETE + INSERT na mesma transação com try/except e rollback em caso de falha
  - [ ] Ajustar `backend/importar_orcamento_planilha.py` com o mesmo padrão transacional seguro
  - [ ] Auditar e confirmar que os demais importadores (`ref_lancamentos.py`, `dre_import.py`) não apresentam o bug
  - [ ] Adicionar teste de regressão em `tests/test_api.py` para garantir que erros a meio da importação do orçamento não deletam os dados pré-existentes

- [ ] TAREFA 3: IntegrityError de CNPJ duplicado
  - [ ] Tratar `IntegrityError` com try/except, db.rollback() e retornar HTTP 400 em `criar` no `backend/routers/clientes.py`
  - [ ] Tratar `IntegrityError` com try/except, db.rollback() e retornar HTTP 400 em `atualizar` no `backend/routers/clientes.py`
  - [ ] Adicionar testes de regressão em `tests/test_api.py` validando as respostas HTTP 400 e mensagens para CNPJ repetido na criação e atualização

- [ ] Validação Final
  - [ ] Executar toda a suíte do Pytest (`pytest tests/ -p no:warnings`) e obter 100% verde
  - [ ] Gerar walkthrough final de homologação
