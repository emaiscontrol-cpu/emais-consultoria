# Varredura linha-por-linha — coluna TOTAL (fix/detalhe-coluna-total)

Cliente: Rio das Pedras (id=10) · Ano 2026 · Grade "Todos os meses" (dados reais de dev:
Jan-Mai com movimento, Jun-Dez sem lançamento — ano em andamento).

## Metodologia

1. **57 linhas filha** (tipo `agrupamento`, perfil `padrão`) testadas via chamada direta ao
   endpoint real `GET /api/demonstrativos/fluxo-caixa/detalhe-comparativo` com os MESMOS
   parâmetros que o clique na coluna TOTAL envia (`modo=todos`, `mes` ausente) — mesmo
   contrato HTTP da UI, sem `mes_fim` (para isolar exclusivamente o fix do backend). Nessa
   configuração o backend agrega o ano inteiro (`Janeiro a Dezembro/2026`), não restrito aos
   meses com movimento — daí a tabela abaixo mostrar esse período. O frontend real também
   envia `mes_fim=5` (último mês com movimento), e nesse caso o período correto
   "Janeiro a Maio/2026" foi confirmado tanto via API direta quanto ao vivo no navegador
   (ver seção seguinte e screenshots anexos).
2. **Casos representativos ao vivo no navegador** (Playwright/claude-in-chrome), cobrindo
   os 3 caminhos de código distintos que não passam pelo endpoint de filhas (totalizador via
   cálculo local, e os 3 perfis especiais — destaque/especial/derivada — via fallback local),
   mais 2 colunas de mês (controle negativo, não deveriam regredir).

## 1. Linhas filha (57 de 57) — via API direta

| # | Linha | main (antes) | branch (depois) |
|---|---|---|---|
| 1 | Vendas - Dinheiro | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 2 | Vendas - Crédito | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 3 | Vendas - Débito | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 4 | Vendas - Clientes | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 5 | Vendas - Private | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 6 | Vendas - Pix | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 7 | Vendas - Cheques | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 8 | Vendas - Delivery | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 9 | ( - ) Devolução de Vendas | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 10 | ( - ) Extra - Caixa | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 11 | ( - ) Repasse Private | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 12 | ( - ) Compras | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 13 | ( - ) Impostos Sobre Vendas | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 14 | ( + ) Crédito Operacionais | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 15 | ( + ) Acordos Comerciais | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 16 | ( + ) Devoluções | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 17 | ( +/- ) Mvto Chq. Devolvidos | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 18 | ( - ) Pessoal - Salário | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 19 | ( - ) Pessoal - Férias | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 20 | ( - ) Pessoal - 13º | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 21 | ( - ) Pessoal - Encargos Socias | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 22 | ( - ) Pessoal - Recisões | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 23 | ( - ) Pessoal - Benefícios | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 24 | ( - ) Pessoal - PJ | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 25 | ( - ) Pessoal - Outros Pagamentos | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 26 | ( - ) Tributária | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 27 | ( - ) Energia Elétrica | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 28 | ( - ) Utilidades e Serviços | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 29 | ( - ) Manutenções | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 30 | ( - ) Veículos | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 31 | ( - ) Manutenção Imóveis | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 32 | ( - ) Propaganda/Marketing | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 33 | ( - ) Informática | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 34 | ( - ) Corporativo | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 35 | ( - ) Ligadas | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 36 | ( - ) Prestadores de Serviços Operacionais | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 37 | ( - ) Viagens | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 38 | ( - ) Expediente | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 39 | ( - ) Embalagens | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 40 | ( - ) Fretes | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 41 | ( - ) Indedutiveis | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 42 | ( - ) Almoxarifado | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 43 | ( - ) Cheques Compensandos | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 44 | ( - ) Taxas Adm de Cartões | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 45 | ( - ) Aluguel | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 46 | ( - ) Seguros | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 47 | ( + ) Ganhos Financeiros | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 48 | ( - ) Gastos Financeiros | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 49 | ( - ) Despesa de Imposto de Renda | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 50 | ( - ) Empréstimos | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 51 | ( - ) Investimentos/Imobilizado | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 52 | ( - ) Juros/IOF S/ Empréstimos | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 53 | ( - ) Adiantamentos Efetuados | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 54 | ( - ) Sócios | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 55 | ( - ) Coligadas | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 56 | Terceiros | ERRO 422 | abriu (Janeiro a Dezembro/2026) |
| 57 | (+/-) Mvto Transitório | ERRO 422 | abriu (Janeiro a Dezembro/2026) |

## 2. Casos representativos — ao vivo no navegador (coluna TOTAL)

| Linha | Tipo / caminho de código | main (antes) | branch (depois) |
|---|---|---|---|
| Vendas - Dinheiro | filha, perfil padrão (API) | ❌ "Erro ao carregar lançamentos." | ✅ abriu — "ACUMULADO JAN–MAI/2026" (screenshot 1) |
| Vendas - Totais | totalizador, perfil padrão (cálculo local, nunca chamava a API) | ✅ abriu — rótulo "Ano 2026" | ✅ abriu — "ACUMULADO JAN–MAI/2026" (screenshot 2) |
| ( - ) Compras | perfil destaque (fallback local) | ✅ abriu — rótulo "Ano 2026" | ✅ abriu — "ACUMULADO JAN–MAI/2026" |
| Lucro das operações (EBITDA) | perfil especial (fallback local) | ✅ abriu — rótulo "Ano 2026" | ✅ abriu — "ACUMULADO JAN–MAI/2026" |
| ( = ) Vendas Líquidas Recebidas | totalizador, perfil derivada (fallback local) | ✅ abriu — rótulo "Ano 2026" | ✅ abriu — "ACUMULADO JAN–MAI/2026" |

## 3. Colunas de mês — controle negativo (não deveriam regredir)

| Coluna | main (antes) | branch (depois) |
|---|---|---|
| Janeiro/2026 (com movimento) | ✅ abriu — "JANEIRO/2026" | ✅ abriu — "JANEIRO/2026" (sem alteração) |
| Julho/2026 (sem lançamento) | painel não abre (sem erro — 0 contas no período) | painel não abre (sem erro — sem alteração) |

## Conclusão

- **57/57 linhas filha**: 0% abrindo em `main` → 100% abrindo em `fix/detalhe-coluna-total`.
- **Totalizadores e perfis especiais**: já abriam antes (não sofriam o bug relatado), mas com
  rótulo genérico "Ano 2026"; agora mostram o mesmo rótulo acumulado das filhas
  ("Acumulado Jan–Mai/2026") — comportamento uniforme em toda a grade, conforme pedido.
- **Colunas de mês**: nenhuma regressão — com movimento abre normalmente, vazia não mostra
  erro (comportamento pré-existente preservado).
