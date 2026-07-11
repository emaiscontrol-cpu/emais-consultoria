import { createElement as h } from 'react'

// Paleta oficial de gráficos do sistema (ver DESIGN_SYSTEM.md § Gráficos).
// Origem: PainelDetalheAgrupamento.jsx — padrão visual aprovado pelo usuário.
export const VIOLETA = {
  forte: '#534AB7',
  medio: '#8F85F0',
  claro: '#C5C2EC',
}

export const PALETA_VIOLETA = [VIOLETA.forte, VIOLETA.medio, VIOLETA.claro]

export const COR_POSITIVO  = '#1E8449'
export const COR_NEGATIVO  = '#C0392B'
export const COR_PLANEJADO = '#0ea5e9'

export const TABULAR_NUMS = { fontVariantNumeric: 'tabular-nums' }

// Duas superfícies suportadas: "light" (cards claros — telas financeiras, padrão
// violeta) e "dark" (dashboards do módulo Projetos, que mantêm fundo escuro próprio
// por decisão do usuário — só os tokens de grid/eixo/tooltip mudam, a gramática do
// gráfico é a mesma nas duas).
const SURFACE = {
  light: {
    tooltipBg: 'var(--surface)',
    tooltipBorder: '0.5px solid var(--border)',
    tooltipShadow: 'var(--shadow)',
    tooltipTitle: 'var(--text-muted)',
    tooltipText: 'var(--text)',
    grid: 'rgba(0,0,0,0.04)',
    axis: 'var(--text-muted)',
    track: '#E0DED8',
  },
  dark: {
    tooltipBg: '#1F1F1F',
    tooltipBorder: '1px solid rgba(255,255,255,.08)',
    tooltipShadow: '0 6px 20px rgba(0,0,0,.5)',
    tooltipTitle: '#9B9A94',
    tooltipText: '#EDECEA',
    grid: '#2A2826',
    axis: '#9B9A94',
    track: 'rgba(255,255,255,.08)',
  },
}

export function superficie(dark) {
  return dark ? SURFACE.dark : SURFACE.light
}

// Abrevia valores grandes nos eixos (10.0M / 25K) — padrão de todos os eixos numéricos.
export function tickFormatterAbreviado(v) {
  const abs = Math.abs(v)
  if (abs >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (abs >= 1000) return `${(v / 1000).toFixed(0)}K`
  return v
}

export function fmtNumeroBR(v) {
  return v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function fmtMoedaBR(v) {
  return v == null ? '—' : `R$ ${fmtNumeroBR(v)}`
}

// Props padrão de eixo: sem linha/tick, fonte pequena na cor de texto apagado da superfície.
export function eixoProps(dark) {
  const s = superficie(dark)
  return { tickLine: false, axisLine: false, style: { fontSize: 9, fill: s.axis } }
}

// Grid sutil: só linhas horizontais tracejadas, baixa opacidade.
export function gridProps(dark) {
  const s = superficie(dark)
  return { strokeDasharray: '3 3', vertical: false, stroke: s.grid }
}

// Tooltip padrão do sistema: card branco (ou escuro), título pequeno em cima,
// valor(es) em destaque embaixo — sempre com formatação em R$ por padrão.
export function CustomTooltip({ active, payload, label, dark, formatter = fmtMoedaBR, corValor = VIOLETA.forte }) {
  if (!active || !payload || !payload.length) return null
  const s = superficie(dark)
  return h('div', {
    style: {
      background: s.tooltipBg, border: s.tooltipBorder, padding: '6px 10px',
      borderRadius: 4, boxShadow: s.tooltipShadow,
    },
  }, [
    label != null ? h('p', { key: 'label', style: { margin: 0, fontSize: 10, color: s.tooltipTitle } }, label) : null,
    ...payload.map((p, i) => h('p', {
      key: i,
      style: { margin: 0, fontSize: 11, fontWeight: 700, color: p.color || p.fill || corValor },
    }, p.name ? `${p.name}: ${formatter(p.value)}` : formatter(p.value))),
  ])
}

// Conteúdo central de rosca: percentual (ou valor) grande + rótulo/código embaixo.
// Uso: <Label position="center" content={centroRoscaContent({ valor, rotulo, dark })} />
export function centroRoscaContent({ valor, rotulo, dark }) {
  const s = superficie(dark)
  return function ContentCentroRosca({ viewBox }) {
    const { cx, cy } = viewBox
    return h('g', null,
      h('text', {
        key: 'v', x: cx, y: cy, textAnchor: 'middle', dominantBaseline: 'middle',
        fontSize: 20, fontWeight: 800, fill: s.tooltipText,
      }, valor),
      h('text', {
        key: 'r', x: cx, y: cy + 16, textAnchor: 'middle', dominantBaseline: 'middle',
        fontSize: 9, fill: s.tooltipTitle,
      }, rotulo),
    )
  }
}
