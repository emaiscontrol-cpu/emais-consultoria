# Registro de Homologação Final — Visibilidade de Erros de Fórmula

Este documento registra as implementações para tornar os erros de fórmula visíveis e seguros no backend e frontend do Plano Referencial e Fluxo de Caixa Executivo.

---

## 1. Modificações Efetuadas

### A. Motor de Fórmulas e Seguranças
* **`calcular_linha` (Plano Referencial):** Modificado em `backend/ref_formula_engine.py` para retornar `tuple[float, str | None]`. Erros são mapeados para `"div_zero"` e `"ref_inexistente:<slug>"`.
* **Validação de Fórmulas no Save:** A função `validar_formula` agora aceita referências válidas (slugs e rótulos ativos) e rejeita typos e ciclos com **HTTP 400** na criação e edição de linhas de templates (`backend/routers/ref_templates.py`).
* **Propagação de Ciclo:** Demonstrativos com loops de referências circulares (`detectar_ciclo`) são calculados com valor `0.0` e marcados com erro `"ciclo"`.

### B. Normalização e Erros no Fluxo de Caixa Executivo (`fc_exec.py`)
* **Separador pt-BR:** Normalização de `;` para `,` fora de strings de aspas no `_eval_formula`.
* **Literais de Porcentagem:** Regex substitui `N%` por `(N/100.0)` de forma automática antes da avaliação.
* **Propagação de Erros:** Erros na avaliação retornam `(0.0, True)` e propagam-se ativamente pelas totalizadoras dependentes.

### C. UI e Frontend
* **Demonstrativo & Fluxo de Caixa:** Células com erros de cálculo exibem `"—"` em vez de `0,00` silencioso.
* **Tooltips de Erro:** Passar o cursor sobre a célula de erro exibe um title/tooltip amigável detalhando o erro (ex: `Erro: Divisão por zero na fórmula` ou `Fórmula referencia elemento inexistente: 'XYZ'`).
* **Estilo Visual:** As células com erro utilizam destaque discreto usando o token semântico `var(--danger)` do Design System.

---

## 2. Testes de Regressão e Validação
* Criado o arquivo `tests/test_formulas.py` cobrindo:
  - Equivalência de IF com `;` e `,`.
  - Suporte a literais de porcentagem (`D5*10%`).
  - Lançamento de erro de referência inexistente (`ref_inexistente`).
  - Lançamento de divisão por zero (`div_zero`).
  - Rejeição de ciclos com HTTP 400 no save de template.
* Executada a suíte de testes com sucesso absoluto: **74/74 testes passados (100% verde)**.
* Build de produção do frontend (`npm run build`) validado sem erros de compilação.
