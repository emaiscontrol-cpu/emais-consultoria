import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { demonstrativoFcAPI, clientesAPI } from '../../services/api'
import { LoadingPage } from '../../components/shared'

const MESES   = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANOS    = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)
const MESES_N = Array.from({ length: 12 }, (_, i) => i + 1)

const fmt = v =>
  v == null ? '—' :
  Math.abs(v) >= 1000
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtPct = v => v == null ? '' : `${v.toFixed(1)}%`

function corValor(v) {
  if (v == null || v === 0) return 'var(--text-muted)'
  return v < 0 ? 'var(--red, #EF4444)' : 'inherit'
}

// Para cada agrupamento: qual totalizador "fecha" sua seção (para collapse e para %)
function buildGroupings(linhas) {
  const parentOf        = {}  // agrup.ordem → totalizador.ordem (collapse)
  const sectionRefOrdem = {}  // agrup.ordem → totalizador.ordem (% de participação)
  let pending = []
  for (const l of linhas) {
    if (l.tipo === 'titulo') {
      pending = []
    } else if (l.tipo === 'agrupamento') {
      pending.push(l.ordem)
    } else if (l.tipo === 'totalizador') {
      for (const o of pending) {
        parentOf[o]        = l.ordem
        sectionRefOrdem[o] = l.ordem
      }
      pending = []
    }
  }
  return { parentOf, sectionRefOrdem }
}

function SegControl({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden',
      border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{ padding: '5px 14px', fontSize: 12, border: 'none', cursor: 'pointer',
            fontWeight: value === o.value ? 700 : 400,
            background: value === o.value ? 'var(--brand)' : 'transparent',
            color: value === o.value ? '#fff' : 'var(--text-muted)',
            transition: 'all .15s' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function FluxoCaixa() {
  const hoje = new Date()
  const [clientes,    setClientes]    = useState([])
  const [clienteId,   setClienteId]   = useState('')
  const [ano,         setAno]         = useState(hoje.getFullYear())
  const [mes,         setMes]         = useState(hoje.getMonth() + 1)
  const [modo,        setModo]        = useState('mensal')
  const [dados,       setDados]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [erro,        setErro]        = useState('')

  // Melhoria 1 — expand/collapse de totalizadores
  const [collapsedTotais, setCollapsedTotais] = useState(new Set())

  // Melhoria 2 — % de participação (só no modo "todos")
  const [showPct, setShowPct] = useState(false)

  // Melhoria 3 — detalhe por conta_origem
  const [detailOpen,   setDetailOpen]   = useState({})
  const [detalheCache, setDetalheCache] = useState({})
  const [detalheLoad,  setDetalheLoad]  = useState({})

  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data)).catch(() => {})
  }, [])

  const carregar = useCallback(() => {
    if (!clienteId) return
    setLoading(true)
    setErro('')
    setDados(null)
    setDetailOpen({})
    setCollapsedTotais(new Set())
    const params = { cliente_id: clienteId, ano, modo }
    if (modo !== 'todos') params.mes = mes
    demonstrativoFcAPI.carregar(params)
      .then(r => setDados(r.data))
      .catch(e => setErro(e?.response?.data?.detail ?? 'Erro ao carregar demonstrativo'))
      .finally(() => setLoading(false))
  }, [clienteId, ano, mes, modo])

  useEffect(() => { carregar() }, [carregar])

  const { parentOf, sectionRefOrdem, totalizadorMap, allTotalizadores } = useMemo(() => {
    if (!dados) return { parentOf: {}, sectionRefOrdem: {}, totalizadorMap: {}, allTotalizadores: new Set() }
    const { parentOf, sectionRefOrdem } = buildGroupings(dados.linhas)
    const totalizadorMap = Object.fromEntries(dados.linhas.map(l => [l.ordem, l]))
    const allTotalizadores = new Set(
      dados.linhas.filter(l => l.tipo === 'totalizador').map(l => l.ordem)
    )
    return { parentOf, sectionRefOrdem, totalizadorMap, allTotalizadores }
  }, [dados])

  const toggleTotalizador = (ordem) => {
    setCollapsedTotais(prev => {
      const next = new Set(prev)
      if (next.has(ordem)) next.delete(ordem)
      else next.add(ordem)
      return next
    })
  }

  const toggleDetail = async (linha) => {
    const { ordem, agrupamento_slug } = linha
    const cacheKey = `${clienteId}:${ano}:${modo === 'todos' ? 'all' : mes}:${modo}:${agrupamento_slug}`

    if (detailOpen[ordem]) {
      setDetailOpen(p => ({ ...p, [ordem]: false }))
      return
    }

    setDetailOpen(p => ({ ...p, [ordem]: true }))
    if (detalheCache[cacheKey] !== undefined) return

    setDetalheLoad(p => ({ ...p, [ordem]: true }))
    try {
      const params = { cliente_id: clienteId, ano, agrupamento_slug, modo }
      if (modo !== 'todos') params.mes = mes
      const r = await demonstrativoFcAPI.detalhe(params)
      setDetalheCache(p => ({ ...p, [cacheKey]: r.data }))
    } catch {
      setDetalheCache(p => ({ ...p, [cacheKey]: [] }))
    } finally {
      setDetalheLoad(p => ({ ...p, [ordem]: false }))
    }
  }

  // % relativo ao totalizador que fecha a seção da linha
  const getPct = (linha, mes_i) => {
    const refOrdem = sectionRefOrdem[linha.ordem]
    if (!refOrdem) return null
    const refLinha = totalizadorMap[refOrdem]
    if (!refLinha) return null

    let refVal, lineVal
    if (modo === 'todos') {
      if (mes_i !== null) {
        refVal  = refLinha.valores_mensais?.[mes_i] ?? 0
        lineVal = linha.valores_mensais?.[mes_i] ?? 0
      } else {
        refVal  = Object.values(refLinha.valores_mensais ?? {}).reduce((s, v) => s + (v ?? 0), 0)
        lineVal = Object.values(linha.valores_mensais  ?? {}).reduce((s, v) => s + (v ?? 0), 0)
      }
    } else {
      refVal  = refLinha.realizado ?? 0
      lineVal = linha.realizado    ?? 0
    }
    if (!refVal) return null
    return lineVal / refVal * 100
  }

  const modoOpts = [
    { value: 'mensal',    label: 'Mensal' },
    { value: 'acumulado', label: 'Acumulado' },
    { value: 'todos',     label: 'Todos os meses' },
  ]

  const thBase = {
    background: 'var(--brand)', color: '#fff', fontSize: '10.5px', fontWeight: 600,
    padding: '8px 12px', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2,
    borderBottom: '0.5px solid rgba(255,255,255,.2)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  }

  const colSpanAll = modo === 'todos' ? 14 : 3

  const renderRows = () => {
    if (!dados) return null
    const result = []

    for (const linha of dados.linhas) {
      const {
        ordem, tipo, rotulo, negrito_totalizador,
        realizado, pct_realizado, valores_mensais,
        conta_count, agrupamento_slug,
      } = linha

      // Agrupamentos cujo totalizador pai está colapsado ficam ocultos
      if (tipo === 'agrupamento') {
        const parent = parentOf[ordem]
        if (parent !== undefined && collapsedTotais.has(parent)) continue
      }

      const isTotalizador  = tipo === 'totalizador'
      const bold           = negrito_totalizador || isTotalizador
      const bgRow          = negrito_totalizador ? 'var(--surface)' : 'transparent'
      const isExpanded     = !collapsedTotais.has(ordem)
      const showDetailIcon = tipo === 'agrupamento' && (conta_count ?? 0) > 1
      const isDetailOpen   = !!detailOpen[ordem]
      const cacheKey       = `${clienteId}:${ano}:${modo === 'todos' ? 'all' : mes}:${modo}:${agrupamento_slug}`

      const tdBase = {
        padding: '5px 12px', fontSize: 12, fontWeight: bold ? 700 : 400,
        borderBottom: '0.5px solid var(--border)', background: bgRow,
      }

      if (tipo === 'titulo') {
        result.push(
          <tr key={ordem} style={{ background: 'var(--surface)' }}>
            <td colSpan={colSpanAll} style={{
              padding: '8px 12px', fontSize: 11, fontWeight: 800,
              color: 'var(--text-muted)', letterSpacing: '.7px',
              textTransform: 'uppercase', borderTop: '2px solid var(--border)',
            }}>
              {rotulo}
            </td>
          </tr>
        )
        continue
      }

      const Chevron = isExpanded || isDetailOpen ? ChevronDown : ChevronRight
      const rotuloContent = (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {(isTotalizador || showDetailIcon)
            ? <Chevron size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
            : <span style={{ width: 16, flexShrink: 0 }} />}
          {rotulo}
        </span>
      )

      const onClickRotulo = isTotalizador
        ? () => toggleTotalizador(ordem)
        : showDetailIcon ? () => toggleDetail(linha) : undefined

      if (modo === 'todos') {
        const totalRow = valores_mensais
          ? Object.values(valores_mensais).reduce((s, v) => s + (v ?? 0), 0)
          : (realizado ?? 0)
        const pctTotal = showPct && tipo === 'agrupamento' ? getPct(linha, null) : null

        result.push(
          <tr key={ordem} style={{ background: bgRow }}>
            <td
              style={{ ...tdBase, position: 'sticky', left: 0, background: bgRow,
                borderRight: '0.5px solid var(--border)', minWidth: 200, maxWidth: 260,
                whiteSpace: 'normal', cursor: onClickRotulo ? 'pointer' : 'default' }}
              onClick={onClickRotulo}
            >
              {rotuloContent}
            </td>
            {MESES_N.map(m => {
              const v   = valores_mensais ? (valores_mensais[m] ?? 0) : 0
              const pct = showPct && tipo === 'agrupamento' ? getPct(linha, m) : null
              return (
                <td key={m} style={{ ...tdBase, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span style={{ color: corValor(v) }}>{fmt(v)}</span>
                  {pct != null && (
                    <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>
                      {fmtPct(pct)}
                    </span>
                  )}
                </td>
              )
            })}
            <td style={{ ...tdBase, textAlign: 'right', fontWeight: 700,
              borderLeft: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>
              <span style={{ color: corValor(totalRow) }}>{fmt(totalRow)}</span>
              {pctTotal != null && (
                <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 4 }}>
                  {fmtPct(pctTotal)}
                </span>
              )}
            </td>
          </tr>
        )
      } else {
        const val = realizado ?? 0
        result.push(
          <tr key={ordem} style={{ background: bgRow }}>
            <td
              style={{ ...tdBase, minWidth: 220,
                cursor: onClickRotulo ? 'pointer' : 'default' }}
              onClick={onClickRotulo}
            >
              {rotuloContent}
            </td>
            <td style={{ ...tdBase, textAlign: 'right', whiteSpace: 'nowrap' }}>
              <span style={{ color: corValor(val) }}>{val === 0 ? '—' : fmt(val)}</span>
            </td>
            <td style={{ ...tdBase, textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
              {fmtPct(pct_realizado)}
            </td>
          </tr>
        )
      }

      // Painel de detalhe inline (Melhoria 3)
      if (tipo === 'agrupamento' && isDetailOpen) {
        const detalhe  = detalheCache[cacheKey]
        const isLoading = detalheLoad[ordem]

        result.push(
          <tr key={`d-${ordem}`}>
            <td colSpan={colSpanAll} style={{ padding: 0 }}>
              <div style={{
                background: 'var(--surface)', borderBottom: '0.5px solid var(--border)',
                padding: '8px 12px 10px 32px',
              }}>
                {isLoading ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Carregando...</span>
                ) : detalhe && detalhe.length > 0 ? (
                  <div style={detalhe.length > 6
                    ? { maxHeight: 200, overflowY: 'auto' }
                    : {}}>
                    <table style={{ width: '100%', maxWidth: 560, borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th style={{
                            textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600,
                            padding: '2px 8px 4px 0', borderBottom: '0.5px solid var(--border)',
                            fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            Conta de origem
                          </th>
                          <th style={{
                            textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600,
                            padding: '2px 0 4px 8px', borderBottom: '0.5px solid var(--border)',
                            whiteSpace: 'nowrap', fontSize: '10.5px', textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {modo === 'todos' ? 'Total Ano' : 'Valor'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhe.map((d, i) => (
                          <tr key={i}>
                            <td style={{ padding: '4px 8px 4px 0',
                              borderBottom: '0.5px solid var(--border)', color: 'var(--text)' }}>
                              {d.conta_origem}
                              {d.descricao && (
                                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                                  — {d.descricao}
                                </span>
                              )}
                            </td>
                            <td style={{
                              textAlign: 'right', padding: '4px 0 4px 8px',
                              borderBottom: '0.5px solid var(--border)',
                              whiteSpace: 'nowrap', fontWeight: 500, color: corValor(d.valor),
                            }}>
                              {fmt(d.valor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Nenhum lançamento detalhado encontrado.
                  </span>
                )}
              </div>
            </td>
          </tr>
        )
      }
    }

    return result
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Fluxo de Caixa Executivo</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Demonstrativo gerado a partir dos lançamentos importados
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: 16, marginBottom: 20,
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
          <label>Cliente</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Ano</label>
          <select value={ano} onChange={e => setAno(+e.target.value)}>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {modo !== 'todos' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label>Mês</label>
            <select value={mes} onChange={e => setMes(+e.target.value)}>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Modo</div>
          <SegControl value={modo} onChange={setModo} options={modoOpts} />
        </div>
      </div>

      {!clienteId && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Selecione um cliente para visualizar o demonstrativo.
        </div>
      )}

      {clienteId && loading && <LoadingPage />}

      {clienteId && !loading && erro && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--red, #EF4444)' }}>
          {erro}
        </div>
      )}

      {!loading && dados && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Barra de controles do demonstrativo */}
          <div style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)',
            display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{dados.cliente_nome}</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {modo === 'todos'
                ? `Ano ${dados.ano} — todos os meses`
                : modo === 'acumulado'
                  ? `Jan–${MESES[(dados.mes ?? 1) - 1]}/${dados.ano}`
                  : `${MESES[(dados.mes ?? 1) - 1]}/${dados.ano}`}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {modo === 'todos' && (
                <button
                  onClick={() => setShowPct(p => !p)}
                  style={{
                    padding: '4px 10px', fontSize: 11, borderRadius: 5, cursor: 'pointer',
                    border: '0.5px solid var(--border)', transition: 'all .15s',
                    background: showPct ? 'var(--brand)' : 'transparent',
                    color: showPct ? '#fff' : 'var(--text-muted)',
                  }}>
                  % participação
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => setCollapsedTotais(new Set())}
                style={{ padding: '4px 10px', fontSize: 11 }}>
                Expandir tudo
              </button>
              <button
                className="btn-secondary"
                onClick={() => setCollapsedTotais(new Set(allTotalizadores))}
                style={{ padding: '4px 10px', fontSize: 11 }}>
                Colapsar tudo
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse',
              minWidth: modo === 'todos' ? 1400 : 520 }}>
              <thead>
                {modo === 'todos' ? (
                  <tr>
                    <th style={{ ...thBase, textAlign: 'left', position: 'sticky', left: 0, zIndex: 3,
                      minWidth: 200, maxWidth: 260 }}>Conta</th>
                    {MESES.map(m => <th key={m} style={{ ...thBase, textAlign: 'right' }}>{m}</th>)}
                    <th style={{ ...thBase, textAlign: 'right',
                      borderLeft: '0.5px solid rgba(255,255,255,.3)' }}>Total</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ ...thBase, textAlign: 'left', minWidth: 220 }}>Conta</th>
                    <th style={{ ...thBase, textAlign: 'right', minWidth: 120 }}>Realizado</th>
                    <th style={{ ...thBase, textAlign: 'right', minWidth: 80 }}>% Vendas</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {renderRows()}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
