# Checklist de Tarefas — feature/erros-de-formula-visiveis

- [x] TAREFA 1: backend/ref_formula_engine.py e routers/ref_templates.py
  - [x] Renomear `_safe_eval` para `safe_eval` e expor no `ref_formula_engine.py`
  - [x] Alterar assinatura de `calcular_linha` para retornar `tuple[float, str | None]`
  - [x] Implementar validação de referências inexistentes no `calcular_linha`
  - [x] Atualizar `validar_formula` para receber `refs_validas` e retornar erros
  - [x] Chamar `validar_formula` com referências reais nos endpoints de `ref_templates.py` (criação e edição de linhas de template)
  - [x] Ajustar `ordenar_linhas` e propagar erro `"ciclo"` caso detectado

- [x] TAREFA 2: backend/routers/fc_exec.py e ref_demonstrativos.py
  - [x] Atualizar `_eval_formula` no `fc_exec.py` para suportar separador `;` e porcentagem `%`
  - [x] Mudar assinatura de `_eval_formula` para `tuple[float, bool]` e propagar erro nas totalizadoras
  - [x] Atualizar `_calcular_template` no `ref_demonstrativos.py` para capturar os erros e preencher o payload com `"ciclo"` se houver ciclo
  - [x] Mapear o payload com os novos campos `erro` e `erros_unidades` no schemas e routers

- [x] TAREFA 3: Propagação no Frontend e UI
  - [x] Adicionar os campos `erro` e `erros_unidades` no `LinhaDemonstrativoOut` de `schemas.py`
  - [x] Exibir tooltip e estilo de erro visual em `Demonstrativo.jsx`
  - [x] Exibir tooltip e estilo de erro visual em `FluxoCaixa.jsx`
  - [x] Garantir que o build de produção do frontend compila perfeitamente (`npm run build`)

- [x] Testes e Validação Final
  - [x] Adicionar testes de regressão no `test_formulas.py` cobrindo os novos cenários
  - [x] Executar toda a suíte de testes do pytest (`pytest tests/ -p no:warnings`) obtendo 100% verde
