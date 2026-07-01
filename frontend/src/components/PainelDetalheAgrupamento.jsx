import { useState, useEffect } from 'react'
import { demonstrativoFcAPI } from '../services/api'

const CORES = ['#0F6E56', '#1D9E75', '#5DCAA5', '#9BD5C0', '#C8E8DE']
const corPorIndice = i => CORES[i] ?? CORES[CORES.length - 1]

const fmt = v => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const R = 38
const CIRC = 2 * Math.PI * R

// Painel de detalhamento de lançamentos por agrupamento — lista + rosca animadas.
// Reutilizável por qualquer demonstrativo que exponha um endpoint /detalhe no
// mesmo formato: [{ conta_origem, descricao, valor }].
export default function PainelDetalheAgrupamento({
  agrupamentoSlug, agrupamentoNome, periodo,
  clienteId, ano, mes, mesFim, modo = 'mensal',
  totalAgrupamento,
}) {
  const [itens, setItens] = useState(null)
  const [erro, setErro]   = useState('')
  const [animar, setAnimar] = useState(false)

  useEffect(() => {
    let cancelado = false
    setItens(null)
    setErro('')
    setAnimar(false)

    const params = { cliente_id: clienteId, ano, agrupamento_slug: agrupamentoSlug, modo }
    if (mes != null) params.mes = mes
    if (mesFim != null) params.mes_fim = mesFim

    demonstrativoFcAPI.detalhe(params)
      .then(r => { if (!cancelado) setItens(r.data ?? []) })
      .catch(() => { if (!cancelado) setErro('Erro ao carregar lançamentos.') })

    return () => { cancelado = true }
  }, [clienteId, ano, agrupamentoSlug, modo, mes, mesFim])

  // Dispara a animação só depois que a lista já está pintada com largura/arco 0
  useEffect(() => {
    if (!itens || itens.length === 0) return
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setAnimar(true))
      return raf2
    })
    return () => cancelAnimationFrame(raf1)
  }, [itens])

  if (erro) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--red, #EF4444)' }}>{erro}</div>
    )
  }
  if (itens === null) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
    )
  }
  if (itens.length === 0) {
    return null
  }

  const total = totalAgrupamento || itens.reduce((s, i) => s + (i.valor ?? 0), 0)
  const linhas = itens
    .slice()
    .sort((a, b) => Math.abs(b.valor ?? 0) - Math.abs(a.valor ?? 0))
    .map((it, i) => ({
      ...it,
      pct: total ? (it.valor / total) * 100 : 0,
      cor: corPorIndice(i),
    }))

  const simples = linhas.length <= 1

  return (
    <div style={{
      background: 'var(--surface-hover)',
      border: '0.5px solid var(--border)',
      borderRadius: 8,
      margin: '0 10px 8px',
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

      <div style={{ display: 'flex', gap: 20, padding: '14px 16px' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {linhas.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: it.cor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 500, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {it.conta_origem}{it.descricao ? ` · ${it.descricao}` : ''}
                </div>
                <div style={{ height: 3, borderRadius: 2, background: '#D8D6CF', marginTop: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: it.cor,
                    width: animar ? `${Math.min(Math.abs(it.pct), 100)}%` : '0%',
                    transition: 'width 1s cubic-bezier(.4,0,.2,1)',
                  }} />
                </div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: it.cor, minWidth: 40, textAlign: 'right', flexShrink: 0 }}>
                {it.pct.toFixed(1)}%
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', minWidth: 100, textAlign: 'right', flexShrink: 0 }}>
                {fmt(it.valor)}
              </span>
            </div>
          ))}
        </div>

        {!simples && (
          <div style={{ width: 170, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Rosca linhas={linhas} animar={animar} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
              {linhas.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: it.cor, flexShrink: 0 }} />
                  <span style={{
                    flex: 1, minWidth: 0, color: 'var(--text-muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {it.conta_origem}
                  </span>
                  <span style={{ color: it.cor, fontWeight: 600, flexShrink: 0 }}>{it.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Rosca({ linhas, animar }) {
  let acumulado = 0
  const arcos = linhas.map(it => {
    const start  = acumulado
    const fatia  = Math.min(Math.abs(it.pct), 100) / 100 * CIRC
    acumulado += fatia
    return { cor: it.cor, start, fatia }
  })

  return (
    <div style={{ position: 'relative', width: 100, height: 100 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={R} fill="none" stroke="#E0DED8" strokeWidth={12} />
        <g transform="rotate(-90 50 50)">
          {arcos.map((a, i) => (
            <circle
              key={i}
              cx={50} cy={50} r={R} fill="none"
              stroke={a.cor} strokeWidth={12}
              strokeDasharray={animar ? `${a.fatia} ${CIRC - a.fatia}` : `0 ${CIRC}`}
              strokeDashoffset={-a.start}
              style={{
                transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)',
                transitionDelay: `${i * 150}ms`,
              }}
            />
          ))}
        </g>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{linhas.length}</span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>contas</span>
      </div>
    </div>
  )
}
