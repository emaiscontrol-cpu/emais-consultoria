import { useState, useEffect } from 'react'
import { demonstrativoFcAPI } from '../services/api'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar } from 'recharts'

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const formatValue = v => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (
      <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', padding: '6px 10px', borderRadius: 4, boxShadow: 'var(--shadow)' }}>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)' }}>{payload[0].payload.mes}</p>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#534AB7' }}>
          R$ {formatValue(payload[0].value)}
        </p>
      </div>
    )
  }
  return null
}


const CustomTooltipBars = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const formatValue = v => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    return (
      <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', padding: '8px 12px', borderRadius: 4, boxShadow: 'var(--shadow)', maxWidth: 220 }}>
        <p style={{ margin: '0 0 4px 0', fontSize: 10, fontWeight: 700, color: 'var(--text)', whiteSpace: 'normal', wordBreak: 'break-all' }}>
          {payload[0].payload.conta}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10.5 }}>
          <span style={{ color: '#534AB7', fontWeight: 600 }}>Atual:</span>
          <span style={{ fontWeight: 700 }}>R$ {formatValue(payload[0].value)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10.5, marginTop: 2 }}>
          <span style={{ color: '#9B9A94', fontWeight: 600 }}>Anterior:</span>
          <span style={{ fontWeight: 700 }}>R$ {formatValue(payload[1]?.value)}</span>
        </div>
        {payload[0].value != null && payload[1]?.value != null ? (
          <div style={{
            marginTop: 4, paddingTop: 4, borderTop: '0.5px solid var(--border)',
            fontSize: 10, fontWeight: 700,
            color: payload[0].value > payload[1].value ? '#C0392B' : '#1E8449',
            textAlign: 'right'
          }}>
            Variação: {payload[0].value > payload[1].value ? '+' : ''}{((payload[0].value - payload[1].value) / Math.abs(payload[1].value) * 100).toFixed(0)}%
          </div>
        ) : null}
      </div>
    )
  }
  return null
}

const fmt = v => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const R = 44
const CIRC = 2 * Math.PI * R

const CORES_ABC = {
  A: ['#534AB7'], // Roxo sólido
  B: ['#8F85F0'], // Lilás/Periwinkle sólido
  C: ['#C5C2EC'], // Lavanda claro sólido
}

const corPorClasse = (classe, posClasse) => {
  const arr = CORES_ABC[classe]
  return arr[Math.min(posClasse - 1, arr.length - 1)]
}

const LEGENDA_ABC = [
  { classe: 'A', bg: '#534AB7', cor: '#534AB7', desc: 'Até 70% do total' },
  { classe: 'B', bg: '#8F85F0', cor: '#8F85F0', desc: '70% a 90%' },
  { classe: 'C', bg: '#C5C2EC', cor: '#C5C2EC', desc: '90% a 100%' },
]


const nomeConta = it => `${it.conta_origem}${it.descricao ? ` · ${it.descricao}` : ''}`
const nomeCurto = it => {
  const base = it.descricao || it.conta_origem || ''
  return base.length > 18 ? `${base.slice(0, 17)}…` : base
}

// Classifica por curva ABC (70/90/100) e aplica gradiente de cor por posição dentro da classe.
function classificarABC(itens, total) {
  const ordenados = itens
    .slice()
    .sort((a, b) => Math.abs(b.valor ?? 0) - Math.abs(a.valor ?? 0))

  let acumulado = 0
  const posPorClasse = { A: 0, B: 0, C: 0 }
  return ordenados.map(it => {
    const pct = total ? (it.valor / total) * 100 : 0
    // Classifica pelo acumulado ANTES de somar esta conta: a conta que cruza o
    // limiar ainda pertence à classe que está sendo alcançada (ex.: uma única
    // conta com 85% do total é A, não B — o acumulado prévio era 0%, < 70%).
    const classe = acumulado < 70 ? 'A' : acumulado < 90 ? 'B' : 'C'
    acumulado += Math.abs(pct)
    posPorClasse[classe] += 1
    return { ...it, pct, classe, posClasse: posPorClasse[classe], cor: corPorClasse(classe, posPorClasse[classe]) }
  })
}

// Painel de detalhamento sofisticado por agrupamento — lista ABC + rosca + comparativo.
// Reutilizável por qualquer demonstrativo que exponha um endpoint /detalhe-comparativo no
// mesmo formato: { atual: [{conta_origem, descricao, valor}], anterior: [...], periodo_atual, periodo_anterior }.
export default function PainelDetalheAgrupamento({
  agrupamentoSlug, agrupamentoNome, periodo,
  clienteId, ano, mes, mesFim, modo = 'mensal',
  totalAgrupamento,
}) {
  const [dados, setDados] = useState(null)
  const [erro, setErro]   = useState('')
  const [animar, setAnimar] = useState(false)

  useEffect(() => {
    let cancelado = false
    setDados(null)
    setErro('')
    setAnimar(false)

    const params = { cliente_id: clienteId, ano, agrupamento_slug: agrupamentoSlug, modo }
    if (mes != null) params.mes = mes
    if (mesFim != null) params.mes_fim = mesFim

    demonstrativoFcAPI.detalheComparativo(params)
      .then(r => { if (!cancelado) setDados(r.data ?? { atual: [], anterior: [] }) })
      .catch(() => { if (!cancelado) setErro('Erro ao carregar lançamentos.') })

    return () => { cancelado = true }
  }, [clienteId, ano, agrupamentoSlug, modo, mes, mesFim])

  // Dispara a animação só depois que o painel já está pintado com barras/arcos em 0
  useEffect(() => {
    if (!dados || (dados.atual ?? []).length === 0) return
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimar(true))
    })
    return () => cancelAnimationFrame(raf1)
  }, [dados])

  if (erro) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--red, #EF4444)' }}>{erro}</div>
    )
  }
  if (dados === null) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
    )
  }

  const itensAtual = dados.atual ?? []
  if (itensAtual.length === 0) return null
  const itensAnterior = dados.anterior ?? []

  const total = totalAgrupamento != null && totalAgrupamento !== 0
    ? totalAgrupamento
    : itensAtual.reduce((s, i) => s + (i.valor ?? 0), 0)

  const linhas = classificarABC(itensAtual, total)

  const pctPorClasse = { A: 0, B: 0, C: 0 }
  linhas.forEach(it => { pctPorClasse[it.classe] += Math.abs(it.pct) })

  const maior = linhas[0]
  const top6 = linhas.slice(0, 6)
  const anteriorMap = new Map(itensAnterior.map(a => [a.conta_origem, a.valor]))
  const semAnterior = itensAnterior.length === 0
  const maxComp = Math.max(
    1,
    ...top6.flatMap(it => [Math.abs(it.valor ?? 0), Math.abs(anteriorMap.get(it.conta_origem) ?? 0)])
  )

  return (
    <div style={{
      background: 'var(--surface-hover)',
      borderTop: '0.5px solid var(--border)',
      borderBottom: '0.5px solid var(--border)',
      borderLeft: 'none',
      borderRight: 'none',
      margin: '0',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.03), inset 0 -3px 6px rgba(0,0,0,0.03)',
    }}>
      {/* Estilo CSS injetado localmente para hover e efeitos modernos */}
      <style>{`
        .detail-row-item {
          transition: all 0.15s ease;
        }
        .detail-row-item:hover {
          background-color: rgba(0, 0, 0, 0.02) !important;
        }
      `}</style>
      <div style={{
        background: 'var(--bg)', padding: '8px 20px',
        display: 'flex', alignItems: 'center', gap: 24,
        borderBottom: '0.5px solid var(--border)',
      }}>
        <span style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
          fontWeight: 700, color: 'var(--brand)',
        }}>
          Detalhamento · {agrupamentoNome} · {periodo}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
          Total: <span style={{ color: 'var(--brand-dark)', fontWeight: 800 }}>R$ {fmt(total)}</span> · <span style={{ color: 'var(--text-muted)' }}>{linhas.length} {linhas.length === 1 ? 'conta' : 'contas'}</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
        {/* Coluna 1 — lista de contas */}
        <div style={{
          flex: 1.2, minWidth: 320, borderRight: '1px solid rgba(0,0,0,0.06)',
          alignSelf: 'stretch', display: 'flex', flexDirection: 'column',
          justifyContent: linhas.length < 5 ? 'space-evenly' : 'flex-start',
          maxHeight: 250,
          overflowY: 'auto',
        }}>
          {linhas.map((it, i) => (
            <div key={i} className="detail-row-item" style={{
              padding: '10px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              borderBottom: i === linhas.length - 1 ? 'none' : '0.5px solid rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BadgeABC classe={it.classe} cor={it.cor} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nomeConta(it)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  R$ {fmt(it.valor)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: it.cor }}>
                  {it.pct.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.05)', overflow: 'hidden', marginTop: 2 }}>
                <div style={{
                  height: '100%',
                  borderRadius: 3,
                  background: it.cor,
                  width: animar ? `${Math.min(Math.abs(it.pct), 100)}%` : '0%',
                  transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                  transitionDelay: `${i * 30}ms`,
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Coluna 2 — rosca analítica */}
        <div style={{
          width: 200, flexShrink: 0, borderRight: '1px solid rgba(0,0,0,0.06)',
          padding: '14px 12px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'var(--text)',
            textTransform: 'uppercase', letterSpacing: '.03em',
            width: '100%', marginBottom: 5
          }}>
            Distribuição ABC
          </div>
          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Classe A', value: pctPorClasse.A },
                    { name: 'Classe B', value: pctPorClasse.B },
                    { name: 'Classe C', value: pctPorClasse.C },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="value"
                >
                  <Cell fill="#534AB7" />
                  <Cell fill="#8F85F0" />
                  <Cell fill="#C5C2EC" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute',
              top: '47%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                {maior ? `${Math.abs(maior.pct).toFixed(0)}%` : '—'}
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--brand)', fontWeight: 700, letterSpacing: '0.02em', marginTop: 3 }}>
                {maior ? maior.conta_origem : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', justifyContent: 'center', marginTop: 8, width: '100%' }}>
            {LEGENDA_ABC.map(l => (
              <div key={l.classe} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.bg, flexShrink: 0 }} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: l.cor }}>{l.classe}</span>
                <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>
                  {Math.round(pctPorClasse[l.classe] ?? 0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 3 — comparativo com período anterior */}
        <div style={{ width: 260, flexShrink: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--text)',
              textTransform: 'uppercase', letterSpacing: '.03em',
            }}>
              Análise Comparativa
            </div>
          </div>

          {semAnterior ? (
            <div style={{
              textAlign: 'center', padding: '30px 10px',
              fontSize: 10, fontStyle: 'italic', color: 'var(--text-muted)',
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              Sem dados anteriores
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={top6.map(it => ({
                  name: nomeCurto(it),
                  Atual: it.valor,
                  Anterior: anteriorMap.get(it.conta_origem) ?? 0,
                  conta: nomeConta(it),
                }))} margin={{ top: 5, right: 5, left: -22, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: 8, fill: 'var(--text-muted)' }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: 8.5, fill: 'var(--text-muted)' }} tickFormatter={v => {
                    const abs = Math.abs(v)
                    if (abs >= 1000000) return `${(v/1000000).toFixed(1)}M`
                    if (abs >= 1000) return `${(v/1000).toFixed(0)}K`
                    return v
                  }} />
                  <Tooltip content={<CustomTooltipBars />} />
                  <Bar dataKey="Atual" fill="#534AB7" radius={[2, 2, 0, 0]} barSize={8} />
                  <Bar dataKey="Anterior" fill="#C5C2EC" radius={[2, 2, 0, 0]} barSize={8} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#534AB7' }} />
                  Atual ({dados.periodo_atual ?? periodo})
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#C5C2EC' }} />
                  Anterior ({dados.periodo_anterior ?? '—'})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Coluna 4 — evolução/tendência anual */}
        <div style={{ flex: 1.5, minWidth: 350, padding: '10px 20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--text)',
              textTransform: 'uppercase', letterSpacing: '.03em',
            }}>
              Evolução Mensal (Ano Corrente)
            </div>
          </div>
          {dados.trend && dados.trend.length > 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5 }}>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={dados.trend} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#534AB7" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#534AB7" stopOpacity={0.00}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} style={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => {
                    const abs = Math.abs(v)
                    if (abs >= 1000000) return `${(v/1000000).toFixed(1)}M`
                    if (abs >= 1000) return `${(v/1000).toFixed(0)}K`
                    return v
                  }} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(83, 74, 183, 0.2)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="valor" stroke="#534AB7" strokeWidth={2} fillOpacity={1} fill="url(#colorTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '30px 10px',
              fontSize: 10, fontStyle: 'italic', color: 'var(--text-muted)',
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              Sem dados de evolução
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BadgeABC({ classe, cor, size = 14 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 3, background: cor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 800, color: '#fff', flexShrink: 0,
    }}>
      {classe}
    </span>
  )
}

function LinhaComparativa({ it, anteriorVal, maxComp, animar, delay }) {
  const variacao = anteriorVal ? ((it.valor - anteriorVal) / Math.abs(anteriorVal)) * 100 : null
  const widthAtual    = animar ? `${Math.min(Math.abs(it.valor ?? 0) / maxComp * 100, 100)}%` : '0%'
  const widthAnterior = animar ? `${Math.min(Math.abs(anteriorVal ?? 0) / maxComp * 100, 100)}%` : '0%'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <BadgeABC classe={it.classe} cor={it.cor} size={13} />
        <span style={{
          flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: 500, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {nomeCurto(it)}
        </span>
        {variacao != null && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, flexShrink: 0,
            background: variacao > 0 ? '#FDE7E7' : variacao < 0 ? '#E3F5EA' : '#EEEDEA',
            color: variacao > 0 ? '#C0392B' : variacao < 0 ? '#1E8449' : '#6B6A65',
          }}>
            {variacao > 0 ? '▲' : variacao < 0 ? '▼' : '—'}{Math.abs(variacao).toFixed(0)}%
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <div style={{ flex: 1, height: 9, borderRadius: 2, background: '#EDEDEA', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#534AB7', width: widthAtual,
            transition: 'width 1s cubic-bezier(.4,0,.2,1)', transitionDelay: `${delay}ms`,
          }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#534AB7', minWidth: 50, textAlign: 'right', flexShrink: 0 }}>
          {fmt(it.valor)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 9, borderRadius: 2, background: '#EDEDEA', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#C5C2EC', width: widthAnterior,
            transition: 'width 1s cubic-bezier(.4,0,.2,1)', transitionDelay: `${delay}ms`,
          }} />
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right', flexShrink: 0 }}>
          {anteriorVal != null ? fmt(anteriorVal) : '—'}
        </span>
      </div>
    </div>
  )
}

function Rosca({ linhas, animar, maior }) {
  let acumulado = 0
  const arcos = linhas.map(it => {
    const start = acumulado
    const fatia = Math.min(Math.abs(it.pct), 100) / 100 * CIRC
    acumulado += fatia
    return { cor: it.cor, start, fatia }
  })

  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={R} fill="none" stroke="#E0DED8" strokeWidth={14} />
        <g transform="rotate(-90 60 60)">
          {arcos.map((a, i) => (
            <circle
              key={i}
              cx={60} cy={60} r={R} fill="none"
              stroke={a.cor} strokeWidth={14}
              strokeDasharray={animar ? `${a.fatia} ${CIRC - a.fatia}` : `0 ${CIRC}`}
              strokeDashoffset={-a.start}
              style={{
                transition: 'stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)',
                transitionDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </g>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 2,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#1A1A18' }}>
          {maior ? `${Math.abs(maior.pct).toFixed(0)}%` : '—'}
        </span>
        <span style={{
          fontSize: 8, color: '#5F5E5A', maxWidth: 62, textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {maior ? nomeCurto(maior) : ''}
        </span>
      </div>
    </div>
  )
}
