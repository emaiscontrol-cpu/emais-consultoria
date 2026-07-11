import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, Label, Legend, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { Card } from './ui'
import {
  PALETA_VIOLETA, VIOLETA, TABULAR_NUMS,
  superficie, eixoProps, gridProps, tickFormatterAbreviado,
  fmtMoedaBR, fmtNumeroBR, CustomTooltip, centroRoscaContent,
} from './chartTheme'

// Todo gráfico do sistema passa por aqui — nunca importar `recharts` direto numa
// tela (ver DESIGN_SYSTEM.md § Gráficos). Cada wrapper aceita `dark` para as
// dashboards do módulo Projetos (fundo escuro próprio, mesma gramática de gráfico).

function Moldura({ card, titulo, dark, children }) {
  if (!card) return children
  if (dark) {
    return (
      <div style={{ background: '#171717', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 20px' }}>
        {titulo && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9B9A94', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>
            {titulo}
          </div>
        )}
        {children}
      </div>
    )
  }
  return (
    <Card>
      {titulo && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>
          {titulo}
        </div>
      )}
      {children}
    </Card>
  )
}

// ── GraficoProgresso — barra horizontal de percentual (sem recharts) ─────────
export function GraficoProgresso({ valor, cor = VIOLETA.forte, altura = 8, corTrilho, animar = true, delayMs = 0 }) {
  const trilho = corTrilho || '#EDEDEA'
  return (
    <div style={{ height: altura, borderRadius: altura / 2, background: trilho, overflow: 'hidden' }}>
      <div style={{
        height: '100%', borderRadius: altura / 2, background: cor,
        width: animar ? `${Math.min(Math.abs(valor ?? 0), 100)}%` : '0%',
        transition: 'width 1s cubic-bezier(.4,0,.2,1)', transitionDelay: `${delayMs}ms`,
      }} />
    </div>
  )
}

// ── GraficoRosca — donut com label central (percentual/valor + rótulo) ───────
export function GraficoRosca({
  dados, altura = 200, innerRadius = 55, outerRadius = 82,
  valorCentro, rotuloCentro, legenda = false, legendaDetalhada = false,
  tooltip = false, tooltipFormatter = fmtNumeroBR,
  dark = false, card = false, titulo,
}) {
  const s = superficie(dark)
  const conteudo = (
    <ResponsiveContainer width="100%" height={altura}>
      <PieChart>
        <Pie data={dados} cx={legenda ? '38%' : '50%'} cy="50%" innerRadius={innerRadius} outerRadius={outerRadius}
          dataKey="value" paddingAngle={3} strokeWidth={0}>
          {dados.map((d, i) => <Cell key={i} fill={d.color || PALETA_VIOLETA[i % PALETA_VIOLETA.length]} />)}
          {(valorCentro != null) && (
            <Label position="center" content={centroRoscaContent({ valor: valorCentro, rotulo: rotuloCentro, dark })} />
          )}
        </Pie>
        {tooltip && <Tooltip content={<CustomTooltip dark formatter={tooltipFormatter} />} />}
        {legenda && (
          <Legend
            layout={legendaDetalhada ? 'vertical' : 'horizontal'}
            align={legendaDetalhada ? 'right' : 'center'}
            verticalAlign="middle"
            content={legendaDetalhada ? (({ payload }) => (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {(payload || []).map((e, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: e.color, flexShrink: 0 }} />
                    <span style={{ color: s.tooltipTitle, flex: 1 }}>{e.value}</span>
                    <span style={{ fontWeight: 700, color: s.tooltipText, ...TABULAR_NUMS }}>{e.payload?.value ?? ''}</span>
                  </li>
                ))}
              </ul>
            )) : undefined}
            formatter={!legendaDetalhada ? (v => <span style={{ fontSize: 11, color: s.tooltipTitle }}>{v}</span>) : undefined}
            iconType="circle" iconSize={8}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  )
  return <Moldura card={card} titulo={titulo} dark={dark}>{conteudo}</Moldura>
}

// ── GraficoBarras — barras simples, agrupadas, empilhadas ou horizontais ─────
// barras: [{ chave, cor, nome, radius, stackId, barSize, cellProps(entry, idx) }]
export function GraficoBarras({
  dados, chaveX, barras, altura = 220, layout = 'horizontal',
  grid = true, tooltip = true, tooltipFormatter = fmtMoedaBR, legenda = false,
  formatoY = tickFormatterAbreviado, margin, dark = false, card = false, titulo,
}) {
  const conteudo = (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout={layout} margin={margin || { top: 5, right: 5, left: -10, bottom: 5 }}>
        {grid && <CartesianGrid {...gridProps(dark)} vertical={layout === 'vertical'} horizontal={layout !== 'vertical'} />}
        {layout === 'vertical' ? (
          <>
            <XAxis type="number" {...eixoProps(dark)} tickFormatter={formatoY} />
            <YAxis type="category" dataKey={chaveX} {...eixoProps(dark)} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={chaveX} {...eixoProps(dark)} />
            <YAxis {...eixoProps(dark)} tickFormatter={formatoY} />
          </>
        )}
        {tooltip && <Tooltip content={<CustomTooltip dark formatter={tooltipFormatter} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />}
        {legenda && <Legend formatter={v => <span style={{ fontSize: 11, color: superficie(dark).tooltipTitle }}>{v}</span>} iconType="circle" iconSize={8} />}
        {barras.map((b, bi) => (
          <Bar key={b.chave} dataKey={b.chave} name={b.nome || b.chave} fill={b.cor || PALETA_VIOLETA[bi % PALETA_VIOLETA.length]}
            radius={b.radius ?? [3, 3, 0, 0]} stackId={b.stackId} barSize={b.barSize}>
            {b.cellProps && dados.map((entry, i) => <Cell key={i} {...b.cellProps(entry, i)} />)}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
  return <Moldura card={card} titulo={titulo} dark={dark}>{conteudo}</Moldura>
}

// ── GraficoLinha — uma ou mais linhas (ex.: burndown ideal vs. real) ─────────
// linhas: [{ chave, cor, nome, tracejado, dot }]
export function GraficoLinha({
  dados, chaveX, linhas, altura = 200, grid = true, tooltip = true,
  tooltipFormatter = fmtNumeroBR, legenda = false, dark = false, card = false, titulo, margin,
}) {
  const conteudo = (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={margin || { top: 5, right: 12, left: -10, bottom: 0 }}>
        {grid && <CartesianGrid {...gridProps(dark)} />}
        <XAxis dataKey={chaveX} {...eixoProps(dark)} />
        <YAxis {...eixoProps(dark)} allowDecimals={false} />
        {tooltip && <Tooltip content={<CustomTooltip dark formatter={tooltipFormatter} />} />}
        {legenda && <Legend iconType="plainline" iconSize={16} formatter={v => <span style={{ fontSize: 11, color: superficie(dark).tooltipTitle }}>{v}</span>} />}
        {linhas.map((l, li) => (
          <Line key={l.chave} type="monotone" dataKey={l.chave} name={l.nome || l.chave}
            stroke={l.cor || PALETA_VIOLETA[li % PALETA_VIOLETA.length]}
            strokeWidth={l.strokeWidth ?? 2} strokeDasharray={l.tracejado ? '3 3' : undefined}
            dot={l.dot ?? false} connectNulls={l.connectNulls ?? false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
  return <Moldura card={card} titulo={titulo} dark={dark}>{conteudo}</Moldura>
}

// ── GraficoArea — área suavizada com gradiente (tendência/evolução) ─────────
// areas: [{ chave, cor, nome, tracejado }]
export function GraficoArea({
  dados, chaveX, areas, altura = 150, grid = true, tooltip = true,
  tooltipFormatter = fmtMoedaBR, formatoY = tickFormatterAbreviado,
  dark = false, card = false, titulo, margin,
}) {
  const conteudo = (
    <ResponsiveContainer width="100%" height={altura}>
      <AreaChart data={dados} margin={margin || { top: 10, right: 10, left: -20, bottom: 5 }}>
        <defs>
          {areas.map((a, ai) => {
            const cor = a.cor || PALETA_VIOLETA[ai % PALETA_VIOLETA.length]
            return (
              <linearGradient key={a.chave} id={`grad-area-${a.chave}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cor} stopOpacity={a.opacidade ?? 0.25} />
                <stop offset="95%" stopColor={cor} stopOpacity={0} />
              </linearGradient>
            )
          })}
        </defs>
        {grid && <CartesianGrid {...gridProps(dark)} />}
        <XAxis dataKey={chaveX} {...eixoProps(dark)} />
        <YAxis {...eixoProps(dark)} tickFormatter={formatoY} />
        {tooltip && <Tooltip content={<CustomTooltip dark formatter={tooltipFormatter} />} cursor={{ stroke: 'rgba(83, 74, 183, 0.2)', strokeWidth: 1 }} />}
        {areas.map((a, ai) => (
          <Area key={a.chave} type="monotone" dataKey={a.chave} name={a.nome || a.chave}
            stroke={a.cor || PALETA_VIOLETA[ai % PALETA_VIOLETA.length]}
            strokeWidth={a.strokeWidth ?? 2} strokeDasharray={a.tracejado ? '3 3' : undefined}
            fillOpacity={1} fill={`url(#grad-area-${a.chave})`} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
  return <Moldura card={card} titulo={titulo} dark={dark}>{conteudo}</Moldura>
}

export { fmtMoedaBR, fmtNumeroBR, tickFormatterAbreviado, PALETA_VIOLETA, VIOLETA, TABULAR_NUMS }
