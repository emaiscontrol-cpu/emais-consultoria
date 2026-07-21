# Plano de Implementação — Fórmulas Estruturadas e Hierarquia Visual na DRE

Este plano propõe uma reestruturação completa da usabilidade e do motor de cálculo de DRE/templates no sistema **E Mais Consultoria**:
1. **Hierarquia Visual Direta (Grid Control):** Remoção de controles manuais e caóticos de Nível, Modo de Cálculo e Ordem de dentro do formulário de edição de linha. Passa a ser controlado por ações diretas na grade (botões de Subir ⬆️, Descer ⬇️, Recuar/Outdent ⬅️, Avançar/Indent ➡️).
2. **Resolução de Soma Automática (Títulos):** As linhas de nível superior (1, 2, 3) sem fórmulas são automaticamente consideradas `soma_filhos`. Suas filhas são inferidas a partir do layout visual e podem ser consultadas através de um botão ou área informativa ("Ver Filhas"), sem abrir campos de fórmula.
3. **Fórmulas Matemáticas Simples:** Contas de resultado matemático (Fórmulas) são as únicas com editor de fórmula. Elas passam a aceitar referências diretas a outras linhas e blocos multi-linhas com atribuição (ex: `margem = receita - custos`).
4. **Melhorias de UI:** Botões de variáveis inserem o nome direto sem chaves (`{}`).

---

## Proposta de Alterações

### 1. Backend: Evolução do Motor de Fórmulas (`backend/ref_formula_engine.py`)

* **Parse AST em modo de bloco (`mode='exec'`):**
  * Habilita a escrita de múltiplas instruções, incluindo atribuições locais (`var = expression`) e expressões simples. O resultado final da fórmula é a última instrução executada.
* **Resolução de Nomes Diretos:**
  * O motor de avaliação (`safe_eval`) resolverá referências a variáveis consultando um dicionário de variáveis de contexto (que une todos os valores de outras linhas do demonstrativo na mesma competência/unidade).
* **Varredura Inteligente (`extrair_refs`):**
  * Em vez de depender exclusivamente de Regex para chaves `{linha:xyz}`, analisaremos a árvore AST coletando todos os `Name` nodes que não sejam funções nativas (`max`, `min`, `sum`) ou variáveis locais declaradas no escopo, garantindo a ordenação topológica precisa e a detecção de ciclos.
* **Funções e Condicionais Suportados:**
  * `max(a, b)`, `min(a, b)`, `sum(a, b, ...)`
  * Ternários nativos de comparação: `x if condicao else y` (ex: `reais if reais > 10 else 10`).

---

### 2. Frontend: Grade de Controle e Ações Estruturais (`frontend/src/pages/controladoria/TemplatesRef.jsx`)

* **Remoção de Inputs de Edição de Linha:**
  * Retirar os campos **Modo de cálculo**, **Nível** e **Ordem** do formulário de edição de linha e do formulário de inserção de nova linha.
* **Ações Estruturais Diretas (Grade):**
  * Na própria linha da tabela, exibir botões rápidos para controle de layout:
    * ⬆️ **Subir (Up):** Troca a ordem da linha atual com a linha imediatamente acima dela.
    * ⬇️ **Descer (Down):** Troca a ordem da linha atual com a linha imediatamente abaixo dela.
    * ⬅️ **Recuar Nível (Outdent):** Reduz o nível lógico da linha (`nivel = max(1, nivel - 1)`).
    * ➡️ **Avançar Nível (Indent):** Aumenta o nível lógico da linha (`nivel = min(4, nivel + 1)`).
* **Modo de Cálculo Automático:**
  * A atribuição do tipo de cálculo será implícita:
    * Se a linha tiver a opção **"Conta de Resultado (Fórmula)"** ativada e preenchida, o tipo é `formula`.
    * Caso contrário, se o nível for menor que 4, é considerado `soma_filhos`.
    * Se o nível for igual a 4, é considerado `agrupamento` (conta-folha contábil).
* **Solução Visual para "Ver Filhas":**
  * Para linhas de título (`soma_filhos`), exibir na coluna Fórmula o rótulo `"Soma de: (N filhas)"` ou um ícone/botão clicável `[👁️ Ver filhas]`.
  * Ao clicar, expande-se uma área de exibição ou popover que lista de forma clara os nomes das linhas filhas associadas àquele título, conforme determinado pela hierarquia atual do layout.
* **Inserção Direta de Variáveis:**
  * Os botões de variáveis disponíveis na UI passarão a inserir a variável direto pelo nome limpo (ex: `venda_avista`), sem chaves `{linha:venda_avista}`.

---

## Plano de Validação

### Testes Automatizados
* Atualizaremos a suíte de testes em `tests/test_ref_dre_vinculo_direto.py` e `tests/test_formulas.py` para garantir que:
  * Expressões com variáveis diretas e atribuições de múltiplas linhas calculem corretamente.
  * O grafo de dependências seja detectado com sucesso a partir de nomes de variáveis diretas.

### Verificação Manual na UI
* Validaremos visualmente o editor de templates no navegador para garantir que o recuo (Indent/Outdent) e reordenação (Up/Down) funcionem em tempo real, atualizando as linhas no banco de dados e reorganizando a planilha adequadamente.
