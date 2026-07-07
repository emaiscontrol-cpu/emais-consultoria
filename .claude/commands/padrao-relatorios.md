---
description: Aplica o padrão visual de tabelas de demonstrativos (FC/Orçamento/DRE/Balancete) — slot de % fixo, tabular-nums, regra de vazio/zero, destaque de linha por slug
argument-hint: <arquivo-da-tela> [o que corrigir/criar]
allowed-tools: [Read, Edit, Write, Grep, Bash]
---

# Padrão de Tabelas de Demonstrativos — E Mais Consultoria

Aplica (ou corrige) o padrão visual compartilhado por Fluxo de Caixa Executivo, Controle
Orçamentário e futuros DRE/Balancete/Demonstrativo Ref. Argumento: $ARGUMENTS

Referência completa: `DESIGN_SYSTEM.md` § "Padrão de tabelas de demonstrativos". Implementações
de referência: `frontend/src/pages/controladoria/FluxoCaixa.jsx` (modo "Todos os meses") e
`frontend/src/pages/controladoria/Orcamento.jsx`. Componente compartilhado:
`frontend/src/components/CelulaValorPct.jsx`.

## Antes de mexer

1. Ler `DESIGN_SYSTEM.md` § "Padrão de tabelas de demonstrativos" — não reimplementar as regras
   de cabeça, elas já estão especificadas lá com os motivos.
2. Ler a tela que já segue o padrão corretamente (`FluxoCaixa.jsx` ou `Orcamento.jsx`) antes de
   copiar qualquer trecho para a tela nova/corrigida — o objetivo é reuso, não reinvenção.
3. Se a tela alvo já tem lógica de negócio própria (colunas diferentes, cálculos diferentes),
   **não mexer nela** — este comando é só sobre alinhamento/apresentação da célula, nunca dados.

## Regra 1 — Slot de % com largura fixa

Toda célula de valor que pode ter uma % de participação ao lado usa `<CelulaValorPct />`:

```jsx
import CelulaValorPct from '../../components/CelulaValorPct'

<CelulaValorPct
  value={fmtCelula(v, bold)}
  pct={pctValor}        // número (0-100) ou null
  showPct={showPct}     // true = reserva o slot de 42px sempre, mesmo com pct null
  pctColor="#534AB7"    // opcional
  color={corValor(v)}   // opcional
  fontWeight={bold ? 700 : 400}  // opcional
  underline={isClickable}        // opcional
/>
```

**Nunca** construir o nó de % manualmente com `pct != null ? <span/> : null` fora do
componente — isso é exatamente o bug que faz totalizador/título desalinhar dos números das
linhas normais (o slot só existe quando há valor, então a célula sem % perde os 42px+6px de
gap que as outras têm). Se `showPct` vier do toggle da tela, TODA célula de valor daquele modo
recebe o mesmo `showPct`, independente do `tipo` da linha — só o valor de `pct` varia (`null`
quando a linha não participa do cálculo).

Se a tela não deve reservar o slot quando não há % (comportamento do Orçamento — cada célula
decide por si, sem afetar as colunas vizinhas), passar `showPct={pctValor !== null}` em vez do
estado do toggle.

## Regra 2 — Formatação numérica única

- `fontVariantNumeric: 'tabular-nums'` em **toda** célula de valor — incluindo colunas de
  Total/Acumulado (é o ponto mais fácil de esquecer; elas costumam ter estilo próprio separado
  das colunas de mês).
- Um único helper de vazio/zero por arquivo, usado em toda célula de valor daquele arquivo:
  ```js
  const fmtCelula = (v, boldRow) => (v == null || (v === 0 && !boldRow)) ? '—' : fmt(v)
  ```
  sem dado → `"—"`; zero numa linha normal → `"—"`; zero numa linha em negrito (totalizador ou
  destaque) → `"0,00"`. Não resolver isso inline em mais de um lugar do componente.

## Regra 3 — Destaque de linha por slug (aparência de título sem ser título)

Quando uma conta específica precisa se destacar visualmente (like um título) mas tem que
continuar mostrando valores e %:

```js
const SLUGS_DESTAQUE_TITULO = ['compras']  // no topo do componente — fácil de estender depois

const isDestaqueTitulo = tipo === 'agrupamento' && (
  SLUGS_DESTAQUE_TITULO.includes(agrupamento_slug) ||
  (!agrupamento_slug && SLUGS_DESTAQUE_TITULO.some(s => new RegExp(s, 'i').test(rotulo)))
)
```

- `tipo` **nunca muda** para `'titulo'` — a linha continua sendo dado real (`colSpan` esconderia
  os valores).
- Visual: `fontWeight: 800` no rótulo + fundo sutil já usado no arquivo para linhas em destaque
  (reaproveitar a cor existente, nunca criar uma nova) + `borderTop: '1.5px solid var(--border)'`
  na linha inteira.
- Para promover outra conta no futuro: só adicionar o slug na constante.

## Regra 4 — Totalizador e título

- `tipo === 'totalizador'`: chevron (`ChevronDown`/`ChevronRight` do Lucide) no rótulo,
  colapsa/expande as linhas `agrupamento` da seção ao clicar.
- Linhas filhas (`agrupamento` normal): conector tracejado 12x12px em vez do chevron.
- `tipo === 'titulo'`: uma única `<td colSpan={...}>` cobrindo a tabela inteira — sem células de
  valor, sem slot de %. `fontWeight: 800`, `uppercase`, borda superior mais grossa que o padrão
  para servir de divisor de seção.

## Regras gerais do projeto (não específicas deste padrão)

- Bordas sempre `0.5px` (exceto os casos já documentados acima com espessura maior — divisores
  intencionais, não a regra geral).
- Nunca cor hardcoded nova — reaproveitar `var(--brand)`, `var(--border)`, `var(--text-muted)` ou
  os valores hex já usados no mesmo arquivo (ex.: `#534AB7` para % de participação).
- Ícones exclusivamente Lucide React.
- Ao terminar, rodar `npm run build` em `frontend/` para garantir que não há erro de sintaxe, e
  revisar visualmente no Electron (Ctrl+Shift+R após o deploy) — build verde não garante
  alinhamento correto, é só checagem de sintaxe.

## Checklist

- [ ] Slot de % reservado em toda célula de valor quando o toggle está ligado, mesmo sem % a
      exibir (totalizador/título/linha sem base de cálculo)
- [ ] `fontVariantNumeric: 'tabular-nums'` em toda célula de valor, incluindo Total/Acumulado
- [ ] Um único helper de vazio/zero, reaproveitado em toda célula do arquivo
- [ ] Destaque por slug implementado via `SLUGS_DESTAQUE_TITULO`, sem mudar `tipo`
- [ ] Nenhuma cor hardcoded nova introduzida
- [ ] `npm run build` sem erros
- [ ] Comportamento com o toggle desligado e modos que não usam este padrão (ex.: mensal/
      acumulado com % em coluna própria) permanecem inalterados
