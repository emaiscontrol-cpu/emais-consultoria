# Checklist de Tarefas — Fórmulas Estruturadas e Controle Visual de DRE

- [x] Backend: Atualizar o motor de fórmulas (`backend/ref_formula_engine.py`) para suportar multi-linhas, atribuições locais, variáveis diretas (sem `{}`) e funções nativas.
- [x] Backend: Adequar a validação de fórmulas e detecção de dependências (`backend/routers/ref_templates.py` e `ref_formula_engine.py`).
- [x] Frontend: Remover inputs de Modo de Cálculo, Nível e Ordem dos formulários de linha (`frontend/src/pages/controladoria/TemplatesRef.jsx`).
- [x] Frontend: Adicionar botões de movimentação (Subir/Descer) e recuo (Avançar/Recuar Nível) na grade de linhas.
- [x] Frontend: Exibir indicador de "Soma de: X filhas" com exibição das contas subordinadas para os títulos.
- [x] Frontend: Atualizar botões de variáveis para inserir apenas o nome limpo no editor de fórmulas.
- [x] Validação: Recompilar frontend (`npm run build`) e rodar pytest (100% verde).
