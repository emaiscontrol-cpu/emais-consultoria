import { useState, useEffect, useCallback } from 'react'
import { demonstrativoFcAPI, clientesAPI } from '../../services/api'
import { LoadingPage } from '../../components/shared'

const MESES    = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANOS     = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)
const MESES_N  = Array.from({ length: 12 }, (_, i) => i + 1)

const fmt = v =>
  v == null ? '—' :
  Math.abs(v) >= 1000
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtPct = v => v == null ? '—' : `${v.toFixed(1)}%`

function corValor(v) {
  if (v == null || v === 0) return 'var(--text-muted)'
  return v < 0 ? 'var(--red, #EF4444)' : 'inherit'
}

// ── Segmented control ─────────────────────────────────────────────────────────
function SegControl({ value, onChange, options }) {
  return (
    <div style={{ display:'flex', borderRadius:6, overflow:'hidden',
      border:'1px solid var(--border)', background:'var(--surface)' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{ padding:'5px 14px', fontSize:12, border:'none', cursor:'pointer',
            fontWeight: value === o.value ? 700 : 400,
            background: value === o.value ? 'var(--brand)' : 'transparent',
            color: value === o.value ? '#fff' : 'var(--text-muted)',
            transition:'all .15s' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Linha da tabela ───────────────────────────────────────────────────────────
function Linha({ linha, modo, totalVendas }) {
  const { tipo, rotulo, negrito_totalizador, realizado, pct_realizado, valores_mensais } = linha

  if (tipo === 'titulo') {
    return (
      <tr style={{ background:'var(--surface)' }}>
        <td colSpan={modo === 'todos' ? 14 : 3}
          style={{ padding:'8px 12px', fontSize:11, fontWeight:800,
            color:'var(--text-muted)', letterSpacing:'.7px',
            textTransform:'uppercase', borderTop:'2px solid var(--border)' }}>
          {rotulo}
        </td>
      </tr>
    )
  }

  const bold    = negrito_totalizador || tipo === 'totalizador'
  const bgRow   = negrito_totalizador ? 'var(--surface)' : 'transparent'
  const tdStyle = { padding:'5px 12px', fontSize:12, fontWeight: bold ? 700 : 400,
    borderBottom:'1px solid var(--border)', background: bgRow }

  if (modo === 'todos') {
    const totalRow = valores_mensais
      ? Object.values(valores_mensais).reduce((s, v) => s + (v ?? 0), 0)
      : (realizado ?? 0)
    return (
      <tr style={{ background: bgRow }}>
        <td style={{ ...tdStyle, position:'sticky', left:0, background: bgRow,
          borderRight:'1px solid var(--border)', minWidth:200, maxWidth:260, whiteSpace:'normal' }}>
          {rotulo}
        </td>
        {MESES_N.map(m => {
          const v = valores_mensais ? (valores_mensais[m] ?? 0) : 0
          return (
            <td key={m} style={{ ...tdStyle, textAlign:'right', whiteSpace:'nowrap' }}>
              <span style={{ color: corValor(v) }}>{fmt(v)}</span>
            </td>
          )
        })}
        <td style={{ ...tdStyle, textAlign:'right', fontWeight:700,
          borderLeft:'2px solid var(--border)', whiteSpace:'nowrap' }}>
          <span style={{ color: corValor(totalRow) }}>{fmt(totalRow)}</span>
        </td>
      </tr>
    )
  }

  // mensal / acumulado
  const val = realizado ?? 0
  return (
    <tr style={{ background: bgRow }}>
      <td style={{ ...tdStyle, minWidth:220 }}>{rotulo}</td>
      <td style={{ ...tdStyle, textAlign:'right', whiteSpace:'nowrap' }}>
        <span style={{ color: corValor(val) }}>{val === 0 ? '—' : fmt(val)}</span>
      </td>
      <td style={{ ...tdStyle, textAlign:'right', color:'var(--text-muted)', fontSize:11 }}>
        {fmtPct(pct_realizado)}
      </td>
    </tr>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FluxoCaixa() {
  const hoje      = new Date()
  const [clientes,   setClientes]   = useState([])
  const [clienteId,  setClienteId]  = useState('')
  const [ano,        setAno]        = useState(hoje.getFullYear())
  const [mes,        setMes]        = useState(hoje.getMonth() + 1)
  const [modo,       setModo]       = useState('mensal')
  const [dados,      setDados]      = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [erro,       setErro]       = useState('')

  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data)).catch(() => {})
  }, [])

  const carregar = useCallback(() => {
    if (!clienteId) return
    setLoading(true)
    setErro('')
    setDados(null)
    const params = { cliente_id: clienteId, ano, modo }
    if (modo === 'mensal') params.mes = mes
    if (modo === 'acumulado') params.mes = mes
    demonstrativoFcAPI.carregar(params)
      .then(r => setDados(r.data))
      .catch(e => setErro(e?.response?.data?.detail ?? 'Erro ao carregar demonstrativo'))
      .finally(() => setLoading(false))
  }, [clienteId, ano, mes, modo])

  useEffect(() => { carregar() }, [carregar])

  const modoOpts = [
    { value: 'mensal',    label: 'Mensal' },
    { value: 'acumulado', label: 'Acumulado' },
    { value: 'todos',     label: 'Todos os meses' },
  ]

  const totalVendas = dados?.linhas?.find(l => l.ordem === 12)?.realizado ?? 0

  const thBase = {
    background:'var(--brand)', color:'#fff', fontSize:11, fontWeight:700,
    padding:'8px 12px', whiteSpace:'nowrap', position:'sticky', top:0, zIndex:2,
    borderBottom:'2px solid rgba(255,255,255,.2)',
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Fluxo de Caixa Executivo</div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>
            Demonstrativo gerado a partir dos lançamentos importados
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding:16, marginBottom:20,
        display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div className="form-group" style={{ margin:0, minWidth:220 }}>
          <label>Cliente</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin:0 }}>
          <label>Ano</label>
          <select value={ano} onChange={e => setAno(+e.target.value)}>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {modo !== 'todos' && (
          <div className="form-group" style={{ margin:0 }}>
            <label>Mês</label>
            <select value={mes} onChange={e => setMes(+e.target.value)}>
              {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom:1 }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Modo</div>
          <SegControl value={modo} onChange={setModo} options={modoOpts} />
        </div>
      </div>

      {/* Estados */}
      {!clienteId && (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
          Selecione um cliente para visualizar o demonstrativo.
        </div>
      )}

      {clienteId && loading && <LoadingPage />}

      {clienteId && !loading && erro && (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--red, #EF4444)' }}>
          {erro}
        </div>
      )}

      {/* Demonstrativo */}
      {!loading && dados && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {/* Cabeçalho informativo */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)',
            display:'flex', gap:24, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>{dados.cliente_nome}</span>
            <span style={{ fontSize:13, color:'var(--text-muted)' }}>
              {modo === 'todos'
                ? `Ano ${dados.ano} — todos os meses`
                : modo === 'acumulado'
                  ? `Jan–${MESES[(dados.mes ?? 1) - 1]}/${dados.ano}`
                  : `${MESES[(dados.mes ?? 1) - 1]}/${dados.ano}`}
            </span>
            <span style={{ fontSize:12, color:'var(--text-muted)', marginLeft:'auto' }}>
              {dados.linhas.length} linhas
            </span>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse',
              minWidth: modo === 'todos' ? 1400 : 520 }}>
              <thead>
                {modo === 'todos' ? (
                  <tr>
                    <th style={{ ...thBase, textAlign:'left', position:'sticky', left:0, zIndex:3,
                      minWidth:200, maxWidth:260 }}>Conta</th>
                    {MESES.map(m => <th key={m} style={{ ...thBase, textAlign:'right' }}>{m}</th>)}
                    <th style={{ ...thBase, textAlign:'right',
                      borderLeft:'2px solid rgba(255,255,255,.3)' }}>Total</th>
                  </tr>
                ) : (
                  <tr>
                    <th style={{ ...thBase, textAlign:'left', minWidth:220 }}>Conta</th>
                    <th style={{ ...thBase, textAlign:'right', minWidth:120 }}>Realizado</th>
                    <th style={{ ...thBase, textAlign:'right', minWidth:80 }}>% Vendas</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {dados.linhas.map(l => (
                  <Linha key={l.ordem} linha={l} modo={modo} totalVendas={totalVendas} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
