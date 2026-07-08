# Plano de Implementação — Painel de Detalhes Baseado em Perfis no Fluxo de Caixa Executivo

Este plano detalha a reestruturação técnica do painel de detalhe do Fluxo de Caixa Executivo (linhas em negrito / totalizadores), introduzindo 4 perfis de visualização (Padrão, Derivada, Destaque e Especial), tratamento de gráficos pela magnitude absoluta e cálculo 100% no frontend para evitar erros de lançamentos.

---

## 1. Mapeamento de Perfis de Linhas

No arquivo [FluxoCaixa.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/pages/controladoria/FluxoCaixa.jsx), criaremos um mapa robusto de detecção de perfil (agnóstico a acentuação e caixa alta/baixa):

* **PERFIL PADRÃO (3 quadros: Rosca ABC + Comparativo + Evolução):**
  - Identificação: `"entradas"`, `"saidas"`, `"sub total de fornecedores"`, `"total de custos operacionais"`, `"vendas - totais"`, `"vendas totais"`.
  - Comportamento: Tenta fazer fetch na API (se for totalizador, usa o slug composto do `totalizadorChildSlugs`). Se o fetch retornar vazio ou falhar, aplica o **Fallback Local** (100% de si mesma como única filha, baseada em `valores_mensais`).
* **PERFIL DERIVADA (2 quadros: Comparativo + Evolução; sem rosca):**
  - Identificação: `"vendas liquidas recebidas"`, `"vendas liquidas"`, `"margem de venda 1"`, `"margem de venda 2"`, `"movimento financeiro"`, `"mvto financeiro"`, `"lucro antes do imposto de renda"`, `"lucro antes do ir"`, `"lucro liquido"`, `"investimentos e financiamentos"`, `"ncg 1"`, `"ncg 2"`, `"ncg1"`, `"ncg2"`, `"socios"`, `"coligadas"`.
  - Comportamento: 100% props-based (dadosLocais pré-calculados), não faz fetch na API. Trata a própria linha como única filha.
* **PERFIL DESTAQUE (2 quadros: Comparativo + Evolução; sem rosca + realce de cabeçalho):**
  - Identificação: `"compras"`, `"lucro bruto"`, `"emprestimos"`.
  - Comportamento: Props-based (dadosLocais), com realce visual no cabeçalho (ex.: borda ou cor de fundo diferenciada).
* **PERFIL ESPECIAL (3 quadros: Comparativo + Evolução + Margem Operacional %):**
  - Identificação: `"lucro das operacoes (ebitda)"`, `"lucro das operacoes"`.
  - Comportamento: Exibe o Comparativo + Evolução e, no lugar da rosca, um bloco dedicado para o KPI **Margem Operacional (%)**, calculado como `(lucro do periodo / receita do periodo) * 100`.

---

## 2. Modificações Propostas

### A. [PainelDetalheAgrupamento.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/components/PainelDetalheAgrupamento.jsx)

* **Props adicionadas:** `perfilLinha`, `isBold`, `valoresMensaisLinha`, `realizadoLinha`, `rotuloLinha`, `receitaPeriodo` (receita de vendas correspondente ao período clicado).
* **Quadro 1 (Coluna 2) — Condicional por Perfil:**
  - Se `perfilLinha === 'padrao'`: Renderiza a **Rosca (PieChart)** normal (Distribuição ABC).
  - Se `perfilLinha === 'especial'`: Renderiza o bloco **Margem Operacional (%)** com um número gigante em roxo (`#534AB7`) e a indicação `EBITDA / Vendas Totais`.
  - Se `perfilLinha === 'derivada'` ou `'destaque'`: O quadro é omitido (o painel exibe apenas os outros 2 blocos, que se expandem para ocupar o espaço).
* **Ajustes Visuais nos Gráficos:**
  - **Rosca ABC:** Fatias calculadas pela magnitude absoluta das porcentagens (`Math.abs(pct)`). Sinais negativos aparecem apenas em texto e rótulos `( - )`.
  - **Comparativo (BarChart):** Plota magnitude absoluta (`Math.abs(it.valor)` e `Math.abs(anteriorVal)`), fazendo com que as barras cresçam para cima. No Tooltip, exibe os valores originais com sinal e calcula a variação correta.
  - **Cores:** Roxo `#534AB7` para positivos; vermelho `#E24B4A` para barras de saídas/negativos, e `#A32D2D` para valores negativos em texto.
* **Cabeçalho Realçado:**
  - Se `perfilLinha === 'destaque'`, adiciona um realce de borda ou fundo dourado/diferenciado no título do detalhamento.

### B. [FluxoCaixa.jsx](file:///c:/Users/luiz/OneDrive/Anexos/Administrador/Documentos/Projetos/emals_consultoria/frontend/src/pages/controladoria/FluxoCaixa.jsx)

* **Mapeamento do Perfil:** Implementação de `getPerfilLinha(rotulo)`.
* **Cálculo da Receita de Vendas (`receitaPeriodo`):**
  - Localizar a linha de receita ("Vendas - Totais" ou "Vendas Totais").
  - Extrair o valor correspondente ao clique (o respectivo mês no modo todos, o total anual ou o realizado no acumulado/mensal).
* **Pré-cálculo de Dados Locais:**
  - Para perfis `'derivada'`, `'destaque'` e `'especial'` (ou como fallback em `'padrao'`), gerar um objeto `dadosLocais` baseado na própria linha.
* **handleCellClick:**
  - Mapear e repassar `perfilLinha`, `isBold`, `valoresMensaisLinha`, `realizadoLinha`, `rotuloLinha`, `receitaPeriodo` e `dadosLocais` no objeto de detalhe clicado.

---

## 3. Validação e Entrega

1. **Build do Frontend:** Rodar `npm run build` em `frontend/` e certificar-se de que compila corretamente.
2. **Execução Local:** Executar o uvicorn em `http://localhost:8000`.
3. **Checklist de Teste Visual no Navegador (nos 3 modos):**
   - Clicar em totalizadores padrão (ex. "Custos Operacionais", "Vendas - Totais") -> 3 blocos (Rosca ABC + Comparativo + Evolução).
   - Clicar em derivadas (ex. "Vendas Líquidas Recebidas", "Margem de Venda 1") -> 2 blocos (sem rosca).
   - Clicar no especial ("Lucro das operações EBITDA") -> 3 blocos (Margem Operacional % + Comparativo + Evolução).
   - Clicar em destaques (ex. "( - ) Compras") -> 2 blocos com cabeçalho realçado.
   - Confirmar que nenhuma linha em negrito (incluindo "( - ) Devolução de Vendas" no acumulado) exibe mais "Erro ao carregar lançamentos".
4. **Git Delivery:** Commitar o código modificado e a pasta `frontend/dist/` compilada na branch `fix/fc-detalhe-perfis`. Abrir PR e aguardar CI verde.
