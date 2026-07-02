import { useState, useEffect } from 'react'
import { demonstrativoFcAPI } from '../services/api'

const fmt = v => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const R = 44
const CIRC = 2 * Math.PI * R

const CORES_ABC = {
  A: ['#A89EF0', '#7B6FE8', '#5244CC'],
  B: ['#EF9F27', '#D4880F'],
  C: ['#9B9A94', '#6B6A65'],
}
const corPorClasse = (classe, posClasse) => {
  const arr = CORES_ABC[classe]
  return arr[Math.min(posClasse - 1, arr.length - 1)]
}

const LEGENDA_ABC = [
  { classe: 'A', bg: '#EEEDFE', cor: '#2E2398', desc: 'Até 70% do total' },
  { classe: 'B', bg: '#FAEEDA', cor: '#633806', desc: '70% a 90%' },
  { classe: 'C', bg: '#EBEBEB', cor: '#3C3A36', desc: '90% a 100%' },
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
    acumulado += Math.abs(pct)
    const classe = acumulado <= 70 ? 'A' : acumulado <= 90 ? 'B' : 'C'
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
      border: '0.5px solid var(--border)',
      borderRadius: 8,
      margin: '0 10px 8px',
      minWidth: 500,
      maxWidth: 780,
      overflow: 'hidden',
    }}>
      <div style={{
        background: 'var(--bg)', padding: '6px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '0.5px solid var(--border)', gap: 12,
      }}>
        <span style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
          fontWeight: 600, color: 'var(--text-muted)',
        }}>
          Detalhamento · {agrupamentoNome} · {periodo}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Total: R$ {fmt(total)} · {linhas.length} {linhas.length === 1 ? 'conta' : 'contas'}
        </span>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Coluna 1 — lista de contas */}
        <div style={{ flex: 1, minWidth: 0, borderRight: '0.5px solid var(--border)' }}>
          {linhas.map((it, i) => (
            <div key={i} style={{ padding: '6px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <BadgeABC classe={it.classe} cor={it.cor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11.5, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {nomeConta(it)}
                </div>
                <div style={{ height: 3, borderRadius: 2, background: '#D8D6CF', marginTop: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: it.cor,
                    width: animar ? `${Math.min(Math.abs(it.pct), 100)}%` : '0%',
                    transition: 'width 1s cubic-bezier(.4,0,.2,1)',
                    transitionDelay: `${i * 40}ms`,
                  }} />
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: it.cor, minWidth: 38, textAlign: 'right', flexShrink: 0 }}>
                {it.pct.toFixed(1)}%
              </span>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text)', minWidth: 80, textAlign: 'right', flexShrink: 0 }}>
                {fmt(it.valor)}
              </span>
            </div>
          ))}
        </div>

        {/* Coluna 2 — rosca analítica */}
        <div style={{
          width: 175, flexShrink: 0, borderRight: '0.5px solid var(--border)',
          padding: '14px 12px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          <Rosca linhas={linhas} animar={animar} maior={maior} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {LEGENDA_ABC.map(l => (
              <div key={l.classe} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: l.bg, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: l.cor, width: 10, flexShrink: 0 }}>{l.classe}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 8, color: 'var(--text-muted)' }}>{l.desc}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: l.cor, flexShrink: 0 }}>
                  {Math.round(pctPorClasse[l.classe] ?? 0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna 3 — comparativo com período anterior */}
        <div style={{ width: 230, flexShrink: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--text)',
              textTransform: 'uppercase', letterSpacing: '.03em',
            }}>
              Comparativo
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 5, fontSize: 9, color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#534AB7', flexShrink: 0 }} />
                {dados.periodo_atual ?? periodo}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#C5C2EC', flexShrink: 0 }} />
                {dados.periodo_anterior ?? '—'}
              </span>
            </div>
          </div>

          {semAnterior ? (
            <div style={{
              textAlign: 'center', padding: '16px 10px',
              fontSize: 10, fontStyle: 'italic', color: 'var(--text-muted)',
            }}>
              Sem dados anteriores
            </div>
          ) : (
            top6.map((it, i) => (
              <LinhaComparativa
                key={i}
                it={it}
                anteriorVal={anteriorMap.get(it.conta_origem) ?? null}
                maxComp={maxComp}
                animar={animar}
                delay={i * 60}
              />
            ))
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
