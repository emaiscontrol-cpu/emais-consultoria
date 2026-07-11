# Checklist de Tarefas — feature/dinheiro-numeric

- [ ] TAREFA 2: Alterar modelos e migração
  - [ ] Importar Numeric em backend/models.py
  - [ ] Alterar colunas de dinheiro para Numeric(15, 2) em backend/models.py
  - [ ] Criar scripts de migração PostgreSQL no startup em backend/main.py
  - [ ] Implementar helpers/coerção Decimal -> float para cálculos de demonstrativos
- [ ] TAREFA 3: Testes e Validação
  - [ ] Adicionar teste de invariante de soma de centavos em tests/test_api.py
  - [ ] Rodar suíte de testes com pytest (100% verde)
  - [ ] Rodar uvicorn e validar com planilha local
