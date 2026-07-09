# Plano de Implementação — Exibição Visível de Erros de Fórmula (feature/erros-de-formula-visiveis)

Este plano descreve a reestruturação dos motores de fórmulas do Plano Referencial e Fluxo de Caixa para propagar e exibir visualmente erros de cálculo nos demonstrativos, rejeitando typos e ciclos diretamente na persistência de templates.

## Proposed Changes

### [Componente Backend] - Motor de Fórmulas e Diagnóstico

#### [MODIFY] [ref_formula_engine.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/ref_formula_engine.py)
* Renomear a função `_safe_eval` para `safe_eval` e expor como pública. Adicionar alias `_safe_eval = safe_eval`.
* Alterar assinatura de `calcular_linha` para `calcular_linha(formula: str, val_agr: dict, val_lin: dict) -> tuple[float, str | None]`.
* Caso a fórmula referencie agrupamento ou linha que não exista nos dicionários `val_agr` / `val_lin`, retornar erro `"ref_inexistente:<slug>"`.
* Retornar `"div_zero"` em vez de booleano no erro de divisão por zero.
* Estender `validar_formula(formula: str, refs_validas: set | None = None) -> str | None` para validar e listar referências inexistentes caso `refs_validas` seja fornecido.

#### [MODIFY] [ref_demonstrativos.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/ref_demonstrativos.py)
* Chamar `detectar_ciclo` antes de ordenar/calcular o demonstrativo. Se houver ciclo, marcar as linhas pertencentes com erro `"ciclo"` e valor `0.0`.
* Atualizar a iteração de cálculo de linha para capturar a tupla de retorno de `calcular_linha` e propagar o erro por unidade no mapa de erros.
* Adicionar os campos `erro` e `erros_unidades` no retorno da listagem de demonstrativos.

#### [MODIFY] [ref_templates.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/ref_templates.py)
* No endpoint de criação/atualização de linhas de template, obter o conjunto de referências válidas (slugs de agrupamento cadastrados e rótulos de linhas do mesmo template).
* Chamar `validar_formula` fornecendo as referências válidas e rejeitar com HTTP 400 em caso de typos.
* Chamar `detectar_ciclo` e, caso detectado, rejeitar a criação/edição com HTTP 400 listando os rótulos envolvidos.

#### [MODIFY] [fc_exec.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/routers/fc_exec.py)
* Ajustar `_eval_formula` para normalizar separadores (converter `;` para `,` fora de strings de aspas) e literal de porcentagem (converter `N%` em `(N/100)`).
* Alterar a assinatura de retorno para `tuple[float, bool]` (retornando `True` no erro).
* Atualizar `_compute_fc` para inicializar as chaves `"erro"` e `"erros_mensais"` em todas as linhas e preencher os erros capturados nos totalizadores.

---

### [Componente Schemas] - Payload dos Demonstrativos

#### [MODIFY] [schemas.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/backend/schemas.py)
* Adicionar `erro: Optional[str] = None` e `erros_unidades: Optional[dict[str, Optional[str]]] = None` na classe `LinhaDemonstrativoOut`.

---

### [Componente Frontend] - Tooltips e Design System de Erros

#### [MODIFY] [Demonstrativo.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/pages/controladoria/Demonstrativo.jsx)
* Renderizar células de demonstrativos com erro exibindo `"—"` com destaque visual discreto em tom de perigo (`var(--danger)` ou similar) e tooltip detalhada descrevendo o erro.

#### [MODIFY] [FluxoCaixa.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/pages/controladoria/FluxoCaixa.jsx)
* Replicar a mesma exibição para células mensais e totalizadores com erro.

---

### [Componente Testes] - Testes Unitários e de Regressão

#### [MODIFY] [test_formulas.py](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/tests/test_formulas.py)
* Adicionar testes para IF com `;`, literal de porcentagem `%`, referência inexistente retornando `ref_inexistente`, ciclo A->B->A falhando com HTTP 400, e divisão por zero.

## Verification Plan

### Automated Tests
* Executar toda a suíte de testes do Pytest: `.\backend\venv\Scripts\pytest.exe tests/ -p no:warnings`.
* Garantir que o build de produção do frontend compila perfeitamente: `npm run build` na pasta `frontend/`.
