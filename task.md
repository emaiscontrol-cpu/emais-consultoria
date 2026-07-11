# Checklist de Tarefas — feature/dinheiro-numeric

- [x] TAREFA 2: Alterar modelos e migração
  - [x] Importar Numeric em backend/models.py
  - [x] Alterar colunas de dinheiro para Numeric(15, 2) em backend/models.py
  - [x] Criar scripts de migração PostgreSQL no startup em backend/main.py
  - [x] Implementar helpers/coerção Decimal -> float para cálculos de demonstrativos
- [x] TAREFA 3: Testes e Validação
  - [x] Adicionar teste de invariante de soma de centavos em tests/test_api.py
  - [x] Rodar suíte de testes com pytest (100% verde)
  - [x] Rodar uvicorn e validar com planilha local
