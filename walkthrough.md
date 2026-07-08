# Walkthrough — Edição e Detalhe de Totalizadores Baseados em Perfis (v2.6.2p)

Este documento resume as implementações efetuadas na controladoria do E Mais Consultoria (Fluxo de Caixa Executivo) para introduzir detalhamentos por perfil e robustez total contra erros.

---

## 1. O que foi Implementado

### A. Lógica de Detalhe Baseada em Perfis (Frontend-only)
Criamos um sistema robusto de detecção de perfil no frontend baseado no rótulo da linha (limpo de acentos e caixa), mapeando cada linha em negrito (`bold`) a um comportamento visual específico:

* **PERFIL PADRÃO (3 quadros: Rosca ABC + Comparativo + Evolução Anual):**
  - Aplicado a: *Vendas - Totais*, *Custos Operacionais*, *Sub Total de Fornecedores*, *Entradas* e *Saídas*.
  - Comportamento: Realiza o fetch na API pelo slug correspondente. Se o fetch falhar ou retornar vazio, aciona o **Fallback Local** (a linha representa 100% de si mesma) para evitar mensagens vermelhas de erro.
* **PERFIL DERIVADA (2 quadros: Comparativo + Evolução Anual):**
  - Aplicado a: *Vendas Líquidas Recebidas*, *Margens de Venda 1 e 2*, *Lucro Líquido*, *Movimento Financeiro*, *Sócios*, *Coligadas*, *NCG 1*, *NCG 2*, etc.
  - Comportamento: Props-based (sem fetch na API). A própria linha é tratada como única filha e desenhada imediatamente. A coluna do gráfico de rosca é omitida, fazendo com que os outros dois quadros expandam.
* **PERFIL DESTAQUE (2 quadros: Comparativo + Evolução Anual + Realce Visual):**
  - Aplicado a: *( - ) Compras*, *Lucro Bruto*, *Empréstimos*.
  - Comportamento: Props-based (sem fetch) com realce visual avermelhado no cabeçalho e borda superior vermelha (`#E24B4A`).
* **PERFIL ESPECIAL (3 quadros: KPI Margem Operacional % + Comparativo + Evolução Anual):**
  - Aplicado a: *Lucro das Operações (EBITDA)*.
  - Comportamento: No lugar da rosca, exibe um quadro dedicado com a **Margem Operacional (%)** calculada dinamicamente (`EBITDA / Vendas Totais`) para o mês ou período clicado.

---

## 2. Ajustes Visuais e de Usabilidade nos Gráficos

1. **Magnitudes Absolutas:**
   - **PieChart (Rosca ABC):** As fatias e percentuais são sempre calculados pelo valor absoluto (`Math.abs`), garantindo que despesas e saídas negativas desenhem arcos normais e não sumam do gráfico.
   - **BarChart (Comparativo):** Os valores das barras são plotados em valor absoluto, fazendo com que cresçam para cima. O sinal negativo é visível pela cor e no tooltip.
2. **Cores Dinâmicas (Natureza da Conta):**
   - No `BarChart` comparativo, as barras mudam de cor item a item de acordo com a sua origem: contas de despesas/negativas ficam em vermelho (`#E24B4A` no Atual, `#ECA4A4` no Anterior) e as positivas/receitas em roxo (`#534AB7` / `#C5C2EC`).
3. **Clique no Rótulo Dinâmico:**
   - Nas linhas totalizadoras de perfis derivados/destaque/especial (como EBITDA), o clique na coluna de texto (rótulo) agora **abre o painel gráfico diretamente** (em vez de tentar colapsar/expandir, já que não possuem filhos reais recolhíveis).

---

## 3. Correção de Bugs Resolvidos

* **Scope Bug (isOutflow):** A função `isOutflow` foi movida para fora de `renderRows` no escopo do módulo para resolver a falha de referência não definida ao clicar nas células.
* **Bug do Detalhe EBITDA/Derivadas que não abriam:** Por serem totalizadores, o código antigo forçava a chamada a `obterDadosLocaisTotalizador`. Como EBITDA não tem contas-filhas diretas no `parentOf`, a decomposição retornava um array vazio, fazendo o painel abortar a renderização. Ajustado para decompor apenas totalizadores do perfil `'padrao'`.

---

## 4. Publicação da Versão v2.6.2p

* O script oficial `release.ps1` executou com sucesso:
  1. Incrementou a versão para **`2.6.2p`** em `backend/main.py` e `electron-client/package.json`.
  2. Compilou o frontend gerando o script principal **`index-DbFZdErz.js`**.
  3. Criou a branch de release e abriu o PR **#105**.
  4. Aguardou o CI passar (`test` e `ci-status` com status `pass`).
  5. Efetuou o merge automático e atualizou a branch `main` no GitHub.
* O deploy automático no servidor de produção está ativo e finalizará em instantes.
