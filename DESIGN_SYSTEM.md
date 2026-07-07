# Design System — E Mais Consultoria

> Arquivo de referência visual para o Claude Code. Leia antes de criar ou alterar qualquer componente de interface.
> Última atualização: 2026-07-06

---

## 1. Identidade Visual

| Elemento                   | Valor                          |
| -------------------------- | ------------------------------ |
| Nome do produto            | E Mais Consultoria             |
| Logo                       | `frontend/src/assets/logo.png` |
| Símbolo no topo da sidebar | Círculo com letra "E" em teal  |
| Fonte principal            | Sistema (sans-serif nativo)    |
| Fonte código/mono          | Monospace nativo               |

---

## 2. Paleta de Cores

### Módulos comerciais (sidebar e badges)

| Módulo                  | Cor principal | CSS var                   | Hex       |
| ----------------------- | ------------- | ------------------------- | --------- |
| Projetos                | Teal          | `--color-module-projetos` | `#1D9E75` |
| Inteligência de Mercado | Roxo          | `--color-module-mercado`  | `#7F77DD` |
| Análises Gerenciais     | Âmbar         | `--color-module-analises` | `#EF9F27` |

### Demonstrativos (badges FC/DRE/ORC)

| Demonstrativo       | Cor   | Badge                     |
| ------------------- | ----- | ------------------------- |
| Fluxo de Caixa (FC) | Âmbar | `#BA7517` fundo `#FAEEDA` |
| DRE                 | Roxo  | `#534AB7` fundo `#EEEDFE` |
| Orçamento (ORC)     | Azul  | `#1a6eb5` fundo `#E3F0FB` |

### CSS Variables globais (definidas em `frontend/src/index.css`)

```css
var(--brand)        /* cor principal da marca */
var(--border)       /* cor de bordas */
var(--text-muted)   /* texto secundário/apagado */
```

> ⚠️ Nunca usar cores hardcoded — sempre usar CSS variables ou as cores da paleta acima.

### Cores de status

| Status       | Cor                | Uso                   |
| ------------ | ------------------ | --------------------- |
| Sucesso      | `#1D9E75`          | Concluído, confirmado |
| Atenção      | `#EF9F27`          | Pendente, revisão     |
| Erro         | `#C0392B`          | Falha, excluir        |
| Info         | `#1a6eb5`          | Informativo, neutro   |
| Desabilitado | `rgba(0,0,0,0.25)` | Bloqueado, sem acesso |

---

## 3. Sidebar

### Estrutura

```
[Logo E Mais]
[Busca Ctrl+K]

── MÓDULOS COMERCIAIS (expansíveis/colapsáveis) ──
[Ícone colorido] Projetos          ← teal
  [hero] Projetos
  DASHBOARDS ˅
    Geral / Por Fase / Por Tarefa / Por Atividade / Por Cliente
  Notificações
  Anotações
  Arquivos

[Ícone colorido] Inteligência de Mercado   ← roxo
[Ícone colorido] Análises Gerenciais       ← âmbar
  Fluxo de Caixa Executivo
  DRE Gerencial
  Balancete
  Controle Orçamentário
  Demonstrativo Ref.
  Benchmark Segmento

── INTERNOS (só admin/consultor) ──
ADMINISTRAÇÃO ˅
PROCEDIMENTOS ˅
  Templates de Projeto
  Backup
  Plano de Contas Referencial
  Templates DRE/FC/Orç
  Revisão De-Para

── RODAPÉ ──
Manual / Alterar senha / Sair
[Avatar] Nome / Perfil
```

### Regras visuais da sidebar

- Módulos comerciais: ícone colorido com fundo translúcido (25% opacidade) na cor do módulo
- Módulos não contratados: ícone vira cadeado, itens apagados, clique leva para `/saiba-mais/<modulo>`
- Administração e Procedimentos: sem cor, texto apagado `rgba(255,255,255,0.25)`, invisíveis para cliente
- Hero item (Projetos): fundo `rgba(255,255,255,0.09)`, borda esquerda teal 2px
- Item ativo: fundo `rgba(255,255,255,0.09)`, borda esquerda azul `#4db8ff` 2px
- Fundo da sidebar: `#0b1e30`

---

## 4. Componentes

### Badges

```jsx
// Tipo de conta
<span className="badge-sintetica">Sintética</span>  // fundo #EEEDFE cor #3C3489
<span className="badge-analitica">Analítica</span>  // fundo #D3D1C7 cor #2C2C2A

// Demonstrativo
<span className="badge-fc">FC</span>    // fundo #FAEEDA cor #633806
<span className="badge-dre">DRE</span> // fundo #EEEDFE cor #534AB7
<span className="badge-orc">ORC</span> // fundo #E3F0FB cor #1a6eb5

// Status de tarefa
// verde=concluída, amarelo=em andamento, vermelho=atrasada, cinza=pendente
```

### Botões

```jsx
// Primário
<button className="btn-primary">Ação principal</button>
// Azul, texto branco, hover escurece 10%

// Secundário
<button className="btn-secondary">Ação secundária</button>
// Borda cinza, fundo transparente

// Perigo
<button className="btn-danger">Excluir</button>
// Vermelho #C0392B, somente para ações destrutivas
```

### Tabelas

- Cabeçalho: `font-size: 10.5px`, `font-weight: 500`, `color: text-muted`, `text-transform: uppercase`, `letter-spacing: 0.04em`
- Linhas: padding `7px 12px`, borda inferior `0.5px solid border-color`
- Hover: fundo levemente destacado
- Primeira coluna: sempre Conta/Descrição ou Nome — alinhada à esquerda
- Colunas de tipo/status: centralizadas com badge
- Coluna de ações: alinhada à direita, ícones Lucide 16px

### Painéis inline (expansão dentro da tabela)

- Não usar modais para ações simples — usar painel inline que expande abaixo da linha
- Fundo levemente diferenciado da linha
- Máx-height com overflow-y: auto quando lista > 6 itens
- Botões Salvar/Cancelar sempre visíveis no rodapé do painel
- Campo de busca/autocomplete: placeholder "Buscar...", filtra em tempo real ao digitar

### Notificações toast

```jsx
toast.success("Mensagem de sucesso"); // verde, canto superior direito
toast.error("Mensagem de erro"); // vermelho
// Biblioteca: react-hot-toast
```

### Ícones

- Biblioteca exclusiva: **Lucide React**
- Tamanho padrão: 16px inline, 20px em botões standalone
- Nunca usar emojis como ícones funcionais
- Nunca usar Font Awesome ou Material Icons

---

## 5. Formulários

### Campos de texto

- Label: `font-size: 12px`, `font-weight: 500`, `margin-bottom: 4px`
- Input: borda `0.5px solid border-color`, border-radius padrão, padding `6px 10px`
- Focus: borda na cor do módulo ativo ou `--brand`
- Erro: borda vermelha + mensagem abaixo em `font-size: 11px` vermelho

### Dropdowns com autocomplete

- Campo de busca sempre no topo da lista
- Filtrar em tempo real ao digitar
- Máximo 8 itens visíveis antes de scroll
- Opção "Nenhum" quando aplicável — destacada em itálico no topo

### Checkboxes e flags

- Usar checkboxes nativos estilizados, não switches para ações de vinculação em massa
- Label ao lado direito do checkbox
- Espaçamento mínimo de 8px entre checkboxes em lista

---

## 6. Hierarquia de texto

| Elemento            | Font-size | Weight | Uso                              |
| ------------------- | --------- | ------ | -------------------------------- |
| Título de página    | 18-22px   | 500    | H1 de cada tela                  |
| Subtítulo/descrição | 12px      | 400    | Abaixo do título                 |
| Cabeçalho de seção  | 11px      | 600    | Uppercase, letter-spacing        |
| Corpo/item de lista | 12-13px   | 400    | Conteúdo principal               |
| Label de campo      | 12px      | 500    | Labels de formulário             |
| Texto secundário    | 11px      | 400    | Metadados, datas, contagens      |
| Badge/tag           | 9-10px    | 600    | Sempre uppercase ou capitalizado |

---

## 7. Espaçamento e Layout

- Margem entre seções: `16-20px`
- Padding interno de cards/painéis: `12-14px`
- Gap entre botões: `8px`
- Border-radius padrão: `var(--border-radius-md)` ou `6-8px`
- Border-radius de cards: `12-14px`
- Bordas: sempre `0.5px solid` — nunca `1px` (fica pesado)

---

## 8. Plano de Contas Referencial — padrão visual específico

### Tabela

Colunas: `Conta / Descrição` | `Tipo` | `Demonstrativo` | `Agrupamento` | `Ações`

### Hierarquia visual

- N1 (código 6 dígitos, sem ponto): **MAIÚSCULO NEGRITO**, fundo levemente destacado
- N2 (1 ponto): **Maiúsculo negrito**, indentação 16px
- N3 (2 pontos): normal, indentação 32px
- N4 (3 pontos): normal, indentação 48px
- N5 (4 pontos): normal, indentação 64px

### Botões de nível no topo

`Nível 1` | `Nível 2` | `Nível 3` | `Todos` | `Colapsar tudo`

### Coluna Demonstrativo

- Badges FC (âmbar) / DRE (roxo) / ORC (azul) — sem texto adicional
- Sem ícone de herança — badges iguais para herdados e diretos

### Coluna Agrupamento

- Nome do agrupamento em texto simples
- Se mais de um, mostrar o primeiro + tooltip com os demais

### Painel de vinculação (inline)

1. Tabs: FC | DRE | ORC — só mostrar tabs ainda não vinculadas
2. Campo de busca com autocomplete (filtra agrupamentos do demonstrativo selecionado)
3. Opção "Nenhum" para remover vínculo
4. Checkbox "Propagar para filhas diretas" (só em contas sintéticas)

---

## 9. Padrão de tabelas de demonstrativos

> Referência de implementação: `frontend/src/pages/controladoria/FluxoCaixa.jsx` (modo "Todos os
> meses") e `frontend/src/pages/controladoria/Orcamento.jsx`. Componente compartilhado:
> `frontend/src/components/CelulaValorPct.jsx`. Vale para FC, Orçamento e deve ser adotado por
> DRE / Balancete / Demonstrativo Ref. quando ganharem a mesma grade mês a mês.

### Célula de valor + % — `CelulaValorPct`

Toda célula numérica que pode exibir uma % de participação ao lado do valor usa o componente
compartilhado em vez de reimplementar o layout:

```jsx
<CelulaValorPct
  value={fmtCelula(v, bold)}   // string já formatada — cada tela mantém sua própria regra de vazio/zero
  pct={pctValor}                // número (0-100) ou null
  showPct={showPct}             // reflete o toggle da tela; controla se o slot é reservado
  pctColor="#534AB7"            // opcional, default já é a cor de participação padrão
  color={corValor(v)}           // opcional
  fontWeight={bold ? 700 : 400} // opcional
/>
```

> Células de valor **não usam sublinhado pontilhado** (`underline`) — uma linha ser clicável é
> indicado só por `cursor: pointer` + hover da linha, nunca por decoração no texto do número.

### % de participação em linhas de soma (totalizador)

Linhas `tipo === 'totalizador'` também exibem a % de participação, não só `agrupamento` — a
condição de cálculo é `showPct && (tipo === 'agrupamento' || isTotalizador)`. Como `getBaseRow`
já resolve a linha-base de cada seção (ex.: "Vendas - Totais" para o bloco de até a ordem 15,
"Vendas Líquidas Recebidas" para o restante), isso tem dois efeitos esperados, não bugs:
- a própria linha-base mostra **100%** (ela é participação de si mesma sobre si mesma);
- as demais linhas de soma da seção (ex.: Margem de Venda 1/2) mostram sua participação sobre
  essa base, exatamente como qualquer `agrupamento` já mostrava.

Linhas `tipo === 'titulo'` (colSpan) nunca exibem % — não têm célula de valor para reservar o
slot.

Regra central: **sempre que `showPct` for `true`, um slot de `minWidth: 42` é reservado à
direita do valor** — com o texto da % quando `pct` vier preenchido, ou um `<span>` vazio da
mesma largura quando a linha não tiver % a exibir (ex.: totalizador). Isso é o que mantém as
colunas de número alinhadas verticalmente independente do tipo de linha — nunca gerar o slot de
% só condicionalmente (`pct != null ? <span/> : null`), porque linhas sem % ficam com o número
colado na borda em vez de alinhado com as demais.

Quando a tela não deve reservar o slot de jeito nenhum se não houver valor de %, passar
`showPct={pctValor !== null}` em vez do estado do toggle diretamente (é o que o Orçamento faz —
ver o comentário no próprio componente).

### Formatação numérica

- `fontVariantNumeric: 'tabular-nums'` em **toda** célula que mostra número (incluindo colunas
  de total/acumulado — é comum esquecer essas ao copiar o padrão das colunas de mês).
- Regra única de vazio/zero por tela, num único helper reaproveitado em todos os tipos de linha:
  sem dado (`null`) → `"—"`; valor `0` numa linha normal → `"—"`; valor `0` numa linha em negrito
  (totalizador ou destaque) → `"0,00"`. Nunca resolver isso inline em mais de um lugar do mesmo
  arquivo — é assim que uma tela acaba mostrando `"—"` nos meses e `"0,00"` no Total para a mesma
  linha.

### Destaque de linha por slug (aparência de título sem ser título)

Para dar destaque visual a uma conta específica (ex.: "Compras") sem transformá-la numa linha de
título de verdade (que usa `colSpan` e perde os valores):

```js
const SLUGS_DESTAQUE_TITULO = ['compras']
// no loop de renderização, para linhas tipo === 'agrupamento':
const isDestaqueTitulo = tipo === 'agrupamento' && (
  SLUGS_DESTAQUE_TITULO.includes(agrupamento_slug) ||
  (!agrupamento_slug && SLUGS_DESTAQUE_TITULO.some(s => new RegExp(s, 'i').test(rotulo)))
)
```

- `tipo` no dado **nunca muda** — a linha continua `agrupamento`, com valores e % normais.
- Visual: `fontWeight: 800` no rótulo, fundo com a mesma cor sutil já usada para linhas em
  destaque no arquivo (reaproveitar o valor existente, nunca introduzir uma cor nova) e
  `borderTop: '1.5px solid var(--border)'` na linha inteira.
- Promover outra conta no futuro é só adicionar o slug à constante — nunca duplicar a lógica de
  detecção.

### Totalizador com chevron colapsável

- Linhas `tipo === 'totalizador'` mostram `ChevronDown`/`ChevronRight` (Lucide) no lugar do
  conector tracejado das linhas filhas, e um clique no rótulo colapsa/expande as linhas
  `agrupamento` daquela seção.
- Rótulo de linha filha (não totalizador): conector visual tracejado de 12x12px
  (`borderLeft`/`borderBottom` de `1.5px dashed var(--border)`) para indicar hierarquia.

### Título em colSpan

- Linhas `tipo === 'titulo'` renderizam uma única `<td colSpan={...}>` cobrindo toda a largura da
  tabela — sem células de valor, sem slot de %. `fontWeight: 800`, `color: 'var(--text-muted)'`,
  `textTransform: 'uppercase'`, `borderTop` mais grosso que o padrão para servir de divisor de
  seção.

---

## 10. Regras gerais para o Claude Code

1. **Nunca hardcodar cores** — sempre usar CSS variables ou a paleta definida acima
2. **Nunca usar modais** para ações simples de vinculação — usar painel inline
3. **Sempre Lucide React** para ícones — nunca emojis como elementos funcionais
4. **Bordas sempre 0.5px** — nunca 1px ou 2px (exceto borda ativa na sidebar)
5. **Toast para feedback** — sempre `react-hot-toast`, nunca `alert()`
6. **Componentes compartilhados** em `frontend/src/components/shared.jsx` — reutilizar antes de criar
7. **Fonte máxima em tabelas**: 12-13px para corpo, 10.5px para cabeçalhos
8. **Scroll em listas longas**: sempre `max-height` + `overflow-y: auto` quando lista > 6 itens
9. **Estado de carregamento**: `LoadingPage` de `shared.jsx` — nunca spinner customizado
10. **Confirmação de exclusão**: sempre pedir confirmação antes de deletar — nunca deletar direto
