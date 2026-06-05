import { useEffect, useState, useCallback } from 'react'
import { orcamentoAPI, clientesAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

// ── Lógica de cálculo DRE (totais calculados no frontend) ────────────────────
// Contas editáveis têm tipo=null; TT/RES são calculadas a partir delas.
const ANO_ATUAL = new Date().getFullYear()
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function calcularTotais(linhas, vals) {
  const result = { ...vals }
  // v lê de result para que cálculos em cascata funcionem (RLQ→MV→ML→MC→MC2→EBITDA)
  const v = (conta, m) => result[conta]?.[m] ?? 0

  const calcular = (conta, fn) => {
    result[conta] = {}
    for (let m = 1; m <= 12; m++) result[conta][m] = fn(m)
  }

  calcular('RLQ',    m => v('FAT',m) - v('DED',m))
  calcular('MV',     m => v('RLQ',m) - v('CMV',m))
  calcular('ML',     m => v('MV',m)  - v('PSS',m))
  calcular('MC',     m => v('ML',m)  - v('DV',m))
  calcular('MC2',    m => v('MC',m)  - v('CFD',m))
  calcular('TCI',    m => ['A1','A3','A4','A8','A10','A14','A16','A23','A7','A5','A11','B5']
                            .reduce((s, c) => s + v(c, m), 0))
  calcular('EBITDA', m => v('MC2',m) - v('TCI',m) + v('ORO',m))

  return result
}

// ── Célula editável ──────────────────────────────────────────────────────────
function Celula({ valor, onSave, readonly, negativo }) {
  const [editando, setEditando] = useState(false)
  const [draft, setDraft]       = useState('')
  const [saving, setSaving]     = useState(false)

  const fmt = v => {
    if (v === 0 || v === null || v === undefined) return '—'
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
  }

  const abrir = () => {
    if (readonly) return
    setDraft(valor ? String(valor).replace('.', ',') : '')
    setEditando(true)
  }

  const salvar = async () => {
    const num = parseFloat(draft.replace(',', '.')) || 0
    setSaving(true)
    try { await onSave(num) } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false); setEditando(false) }
  }

  if (editando) return (
    <td style={{ padding: 0 }}>
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={salvar}
        onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEditando(false) }}
        style={{ width: '100%', border: 'none', outline: '2px solid var(--brand)',
          padding: '4px 6px', fontSize: 12, textAlign: 'right', background: 'var(--brand-light)' }}
      />
    </td>
  )

  const cor = negativo && valor < 0 ? 'var(--red)' : valor > 0 ? 'inherit' : 'var(--text-3)'
  return (
    <td onClick={abrir}
      style={{ textAlign: 'right', padding: '4px 8px', fontSize: 12,
        cursor: readonly ? 'default' : 'pointer', color: cor,
        background: saving ? 'var(--brand-light)' : undefined }}>
      {fmt(valor)}
    </td>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Orcamento() {
  const { usuario } = useAuth()
  const isCliente = usuario?.perfil === 'cliente'

  const [clientes,   setClientes]   = useState([])
  const [clienteId,  setClienteId]  = useState('')
  const [ano,        setAno]        = useState(ANO_ATUAL)
  const [dados,      setDados]      = useState(null)   // {plano, linhas}
  const [loading,    setLoading]    = useState(false)
  const [vals,       setVals]       = useState({})     // {conta: {mes: valor}}

  // Carrega lista de clientes com plano
  useEffect(() => {
    if (isCliente) {
      setClienteId(String(usuario.cliente_id))
    } else {
      orcamentoAPI.clientesComPlano()
        .then(r => {
          setClientes(r.data)
          if (r.data.length === 1) setClienteId(String(r.data[0].id))
        })
        .catch(() => {})
    }
  }, [])

  // Carrega orçamento quando cliente/ano muda
  useEffect(() => {
    if (!clienteId) { setDados(null); setVals({}); return }
    setLoading(true)
    orcamentoAPI.obter(clienteId, ano)
      .then(r => {
        setDados(r.data)
        // Monta mapa vals
        const m = {}
        for (const linha of r.data.linhas || []) {
          if (linha.tipo == null) {   // apenas editáveis
            m[linha.conta] = linha.valores
          }
        }
        setVals(m)
      })
      .catch(() => toast.error('Erro ao carregar orçamento'))
      .finally(() => setLoading(false))
  }, [clienteId, ano])

  const valsCalculados = calcularTotais(dados?.linhas || [], vals)

  const handleSave = useCallback(async (itemId, conta, mes, valor) => {
    await orcamentoAPI.salvar(clienteId, ano, itemId, mes, valor)
    setVals(prev => ({
      ...prev,
      [conta]: { ...(prev[conta] || {}), [mes]: valor },
    }))
  }, [clienteId, ano])

  // ── Estilos por tipo — hierarquia visual DRE ──────────────────────────────
  const BG = {
    RES: '#0d3320',
    TT:  '#0A1C4E',
    GRP: '#071230',
    NN:  'transparent',
  }
  const estiloLinha = (tipo) => {
    if (tipo === 'RES') return { background: BG.RES, borderLeft: '3px solid #22c55e', fontWeight: 700, fontSize: 13 }
    if (tipo === 'TT')  return { background: BG.TT,  borderLeft: '3px solid var(--brand)', fontWeight: 700, fontSize: 13 }
    if (tipo === 'GRP') return { background: BG.GRP, borderLeft: '3px solid var(--brand)', fontWeight: 800, fontSize: 13 }
    return { background: BG.NN, borderLeft: '3px solid transparent' }
  }

  const corTexto = (tipo) => {
    if (tipo === 'RES') return '#4ade80'
    if (tipo === 'TT')  return '#e2e8ff'
    if (tipo === 'GRP') return '#94a8ff'
    return 'var(--text)'
  }

  const bgSticky = (tipo) => {
    if (tipo === 'RES') return BG.RES
    if (tipo === 'TT')  return BG.TT
    if (tipo === 'GRP') return BG.GRP
    return 'var(--surface,#fff)'
  }

  const total12 = (conta) =>
    Object.values(valsCalculados[conta] || {}).reduce((s, v) => s + (v || 0), 0)

  const anos = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 1 + i)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Orçamento</div>
          <div className="page-sub">DRE orçamentária — valores mensais por conta</div>
        </div>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {isCliente ? (
          <div className="metric-card" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>
            {clientes.find(c => String(c.id) === clienteId)?.razao_social
              ?? dados?.plano?.nome ?? '—'}
          </div>
        ) : (
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}
            style={{ fontSize: 13, padding: '8px 14px', minWidth: 280 }}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.razao_social} — {c.plano_nome}</option>
            ))}
          </select>
        )}

        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          style={{ fontSize: 13, padding: '8px 14px', width: 100 }}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {dados?.plano && (
          <span className="badge" style={{ fontSize: 11, background: 'var(--brand-light)', color: 'var(--brand)' }}>
            {dados.plano.nome}
          </span>
        )}
      </div>

      {/* Estado sem plano */}
      {!loading && clienteId && dados?.plano === null && (
        <div className="empty-state">
          Este cliente não possui plano de contas vinculado.
          Acesse <strong>Planos de Contas</strong> para vincular um template.
        </div>
      )}

      {!loading && !clienteId && (
        <div className="empty-state">Selecione um cliente para visualizar o orçamento.</div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>
          Carregando...
        </div>
      )}

      {/* Tabela DRE */}
      {!loading && dados?.plano && dados.linhas?.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--brand)', color: '#fff' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', minWidth: 260, position: 'sticky', left: 0, background: 'var(--brand)', zIndex: 1 }}>
                  Conta
                </th>
                {MESES.map((m, i) => (
                  <th key={i} style={{ textAlign: 'right', padding: '8px 8px', minWidth: 80 }}>{m}</th>
                ))}
                <th style={{ textAlign: 'right', padding: '8px 10px', minWidth: 90, borderLeft: '2px solid rgba(255,255,255,.2)' }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((linha, idx) => {
                const estilo    = estiloLinha(linha.tipo)
                const editavel  = linha.tipo == null
                const vConta    = valsCalculados[linha.conta] || {}

                if (linha.tipo === 'GRP') {
                  return (
                    <tr key={linha.item_id} style={{ ...estilo, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                      <td colSpan={14} style={{
                        padding: '9px 14px',
                        textTransform: 'uppercase',
                        letterSpacing: '.07em',
                        fontSize: 11, fontWeight: 800,
                        color: corTexto('GRP'),
                      }}>
                        {linha.descricao}
                      </td>
                    </tr>
                  )
                }

                const isTitulo = linha.tipo === 'TT' || linha.tipo === 'RES'

                return (
                  <tr key={linha.item_id}
                    style={{ ...estilo, borderBottom: isTitulo ? '1px solid rgba(255,255,255,.08)' : '1px solid var(--border)' }}
                    onMouseEnter={e => { if (editavel) e.currentTarget.style.background = 'var(--bg,#f9fafb)' }}
                    onMouseLeave={e => { if (editavel) e.currentTarget.style.background = '' }}>

                    {/* Nome da conta */}
                    <td style={{
                      padding: '6px 12px',
                      paddingLeft: editavel ? 28 : 14,
                      position: 'sticky', left: 0, zIndex: 1,
                      background: bgSticky(linha.tipo),
                      color: corTexto(linha.tipo),
                      fontWeight: estilo.fontWeight || 400,
                      fontSize: estilo.fontSize || 12,
                      textTransform: isTitulo ? 'uppercase' : 'none',
                      letterSpacing: isTitulo ? '.04em' : 'normal',
                    }}>
                      {linha.descricao}
                    </td>

                    {/* 12 meses */}
                    {Array.from({ length: 12 }, (_, i) => {
                      const mes = i + 1
                      const valor = vConta[mes] ?? 0
                      if (!editavel) {
                        return (
                          <td key={mes} style={{ textAlign: 'right', padding: '5px 8px',
                            fontWeight: estilo.fontWeight, color: corTexto(linha.tipo) }}>
                            {valor !== 0
                              ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(valor)
                              : '—'}
                          </td>
                        )
                      }
                      return (
                        <Celula key={mes} valor={valor} negativo
                          onSave={v => handleSave(linha.item_id, linha.conta, mes, v)} />
                      )
                    })}

                    {/* Total anual */}
                    <td style={{ textAlign: 'right', padding: '5px 10px',
                      fontWeight: estilo.fontWeight || 600,
                      color: corTexto(linha.tipo),
                      borderLeft: isTitulo ? '2px solid rgba(255,255,255,.1)' : '2px solid var(--border)',
                      background: bgSticky(linha.tipo) }}>
                      {(() => {
                        const t = total12(linha.conta)
                        return t !== 0
                          ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(t)
                          : '—'
                      })()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda */}
      {!loading && dados?.plano && (
        <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
          <span>Clique em qualquer célula branca para editar.</span>
          <span style={{ color: 'var(--brand)' }}>■ Subtotais calculados automaticamente</span>
          <span style={{ color: 'var(--green)' }}>■ EBITDA</span>
        </div>
      )}
    </div>
  )
}
