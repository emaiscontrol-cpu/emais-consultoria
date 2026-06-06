import { useEffect, useState, useMemo } from 'react'
import { clientesAPI, orcamentoAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const ANO_ATUAL = new Date().getFullYear()
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const fmt = v =>
  v !== 0 && v !== null && v !== undefined
    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
    : '—'

// ── Estilos por tipo ──────────────────────────────────────────────────────────
const estiloLinha = tipo => {
  if (tipo === 'RES') return { background: 'linear-gradient(90deg,#dcfce7 0%,#f0faf4 60%,transparent 100%)', borderLeft: '3px solid #22c55e', fontWeight: 700, fontSize: 13 }
  if (tipo === 'TT')  return { background: 'linear-gradient(90deg,#e8f0ff 0%,#f4f7ff 60%,transparent 100%)', borderLeft: '3px solid var(--brand)', fontWeight: 700, fontSize: 13 }
  if (tipo === 'GRP') return { background: 'linear-gradient(90deg,#f0f0f8 0%,#f7f7fb 100%)', borderLeft: '3px solid var(--brand)', fontWeight: 800, fontSize: 11 }
  return { background: 'transparent', borderLeft: '3px solid transparent' }
}
const corTexto = tipo => {
  if (tipo === 'RES') return '#16a34a'
  if (tipo === 'TT')  return 'var(--brand)'
  if (tipo === 'GRP') return 'var(--brand)'
  return 'inherit'
}
const bgSticky = tipo => {
  if (tipo === 'RES') return '#e8f5ed'
  if (tipo === 'TT')  return '#e8f0ff'
  if (tipo === 'GRP') return '#f0f0f8'
  return 'var(--surface,#fff)'
}

export default function DRE() {
  const { usuario } = useAuth()
  const isCliente = usuario?.perfil === 'cliente'

  const [clientes,   setClientes]   = useState([])
  const [clienteId,  setClienteId]  = useState('')
  const [ano,        setAno]        = useState(ANO_ATUAL - 1)

  const [unidades,   setUnidades]   = useState([])
  const [unidade,    setUnidade]    = useState('CONSOLIDADO')

  const [dados,      setDados]      = useState(null)
  const [vals,       setVals]       = useState({})
  const [loading,    setLoading]    = useState(false)

  // ── Expandir/recolher (2 níveis) ─────────────────────────────────────────
  // Nível 1: primeiro TT de cada agrupamento (cabeçalho de seção)
  // Nível 2: TTs subsequentes no mesmo agrupamento (sub-grupos com contas NN)
  const [recolhidosL1, setRecolhidosL1] = useState(new Set())
  const [recolhidosL2, setRecolhidosL2] = useState(new Set())

  const hierarquia = useMemo(() => {
    const nivel   = {}   // item_id → 1 | 2
    const paiL1   = {}   // item_id (L2 TT ou NN) → item_id do L1 pai
    const paiL2   = {}   // item_id (NN) → item_id do L2 TT pai
    const vistoAgr = {}  // agrupamento → primeiro TT item_id
    let l1Atual = null, l2Atual = null

    for (const l of dados?.linhas || []) {
      if (l.tipo === 'TT' || l.tipo === 'RES') {
        const agr = l.agrupamento || String(l.item_id)
        if (!vistoAgr[agr]) {
          vistoAgr[agr] = l.item_id
          nivel[l.item_id] = 1
          l1Atual = l.item_id
          l2Atual = null
        } else {
          nivel[l.item_id] = 2
          paiL1[l.item_id] = l1Atual
          l2Atual = l.item_id
        }
      } else if (l.tipo === 'NN' || l.tipo === null) {
        if (l2Atual) { paiL2[l.item_id] = l2Atual; paiL1[l.item_id] = l1Atual }
        else if (l1Atual) { paiL2[l.item_id] = l1Atual; paiL1[l.item_id] = l1Atual }
      }
    }
    return { nivel, paiL1, paiL2 }
  }, [dados?.linhas])

  const l1Ids = useMemo(
    () => (dados?.linhas || []).filter(l => hierarquia.nivel[l.item_id] === 1).map(l => l.item_id),
    [dados?.linhas, hierarquia]
  )
  const l2Ids = useMemo(
    () => (dados?.linhas || []).filter(l => hierarquia.nivel[l.item_id] === 2).map(l => l.item_id),
    [dados?.linhas, hierarquia]
  )

  const todosRecolhidos = l1Ids.length > 0 && l1Ids.every(id => recolhidosL1.has(id))

  const toggleL1 = id => setRecolhidosL1(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleL2 = id => setRecolhidosL2(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleTudo = () => {
    if (todosRecolhidos) { setRecolhidosL1(new Set()); setRecolhidosL2(new Set()) }
    else { setRecolhidosL1(new Set(l1Ids)); setRecolhidosL2(new Set(l2Ids)) }
  }

  // aliases para compatibilidade com código existente
  const recolhidos  = recolhidosL1
  const grpParent   = hierarquia.paiL1
  const grpIds      = l1Ids

  // Ao trocar de cliente/ano/unidade, reset collapse
  useEffect(() => { setRecolhidosL1(new Set()); setRecolhidosL2(new Set()) }, [clienteId, ano, unidade])

  // ── Carregar clientes ────────────────────────────────────────────────────
  useEffect(() => {
    if (isCliente) {
      setClienteId(String(usuario.cliente_id))
    } else {
      clientesAPI.listar()
        .then(r => {
          setClientes(r.data || [])
          if ((r.data || []).length === 1) setClienteId(String(r.data[0].id))
        })
        .catch(() => {})
    }
  }, [])

  // ── Ao trocar cliente: auto-detecta o ano com dados ─────────────────────
  useEffect(() => {
    if (!clienteId) { setUnidades([]); return }
    const detectarAno = async () => {
      for (let a = ANO_ATUAL - 1; a >= ANO_ATUAL - 4; a--) {
        try {
          const r = await orcamentoAPI.unidades(clienteId, a)
          const lista = r.data || []
          if (lista.length > 0) {
            setAno(a)
            setUnidades(lista)
            setUnidade(lista.includes('CONSOLIDADO') ? 'CONSOLIDADO' : lista[0])
            return
          }
        } catch { break }
      }
      setUnidades([])
    }
    detectarAno()
  }, [clienteId])

  // ── Ao trocar ano manualmente: recarrega unidades ─────────────────────────
  useEffect(() => {
    if (!clienteId) return
    orcamentoAPI.unidades(clienteId, ano)
      .then(r => {
        const lista = r.data || []
        setUnidades(lista)
        setUnidade(lista.includes('CONSOLIDADO') ? 'CONSOLIDADO' : (lista[0] || 'CONSOLIDADO'))
      })
      .catch(() => setUnidades([]))
  }, [ano])

  // ── Carregar DRE ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clienteId) { setDados(null); setVals({}); return }
    setLoading(true)
    orcamentoAPI.obterDre(clienteId, ano, unidade)
      .then(r => {
        setDados(r.data)
        const m = {}
        for (const linha of r.data.linhas || []) {
          m[linha.conta] = linha.valores
        }
        setVals(m)
      })
      .catch(() => toast.error('Erro ao carregar DRE'))
      .finally(() => setLoading(false))
  }, [clienteId, ano, unidade])

  const total12 = conta =>
    Object.values(vals[conta] || {}).reduce((s, v) => s + (v || 0), 0)

  const anos = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 2 + i)

  const nomeUnidade = u => u === 'CONSOLIDADO' ? 'Consolidado' : u

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">DRE</div>
          <div className="page-sub">Demonstração do Resultado do Exercício — valores mensais</div>
        </div>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {isCliente ? (
          <div className="metric-card" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>
            {clientes.find(c => String(c.id) === clienteId)?.razao_social ?? '—'}
          </div>
        ) : (
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}
            style={{ fontSize: 13, padding: '8px 14px', minWidth: 280 }}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        )}

        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          style={{ fontSize: 13, padding: '8px 14px', width: 100 }}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {unidades.length > 0 && (
          <select value={unidade} onChange={e => setUnidade(e.target.value)}
            style={{ fontSize: 13, padding: '8px 14px', minWidth: 220 }}>
            {unidades.map(u => (
              <option key={u} value={u}>
                {u === 'CONSOLIDADO' ? 'Consolidado (todas as unidades)' : u}
              </option>
            ))}
          </select>
        )}

        {dados?.plano && (
          <span className="badge" style={{ fontSize: 11, background: 'var(--brand-light)', color: 'var(--brand)' }}>
            {dados.plano.nome}
          </span>
        )}
        {unidades.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {unidades.length} unidade{unidades.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Estados vazios */}
      {!clienteId && (
        <div className="empty-state">Selecione um cliente para visualizar o DRE.</div>
      )}

      {clienteId && !loading && dados?.plano === null && (
        <div className="empty-state">
          Este cliente não possui plano DRE vinculado.
          Acesse <strong>Planos de Contas</strong> para vincular um template.
        </div>
      )}

      {clienteId && !loading && dados?.plano && unidades.length === 0 && (
        <div className="empty-state">
          Este cliente não possui dados de DRE importados para {ano}.<br/>
          O DRE exibe dados históricos importados via planilha Excel.<br/>
          Somente clientes com importação realizada exibem resultados aqui.
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>
          Carregando DRE...
        </div>
      )}

      {/* Tabela DRE */}
      {!loading && dados?.plano && dados.linhas?.length > 0 && unidades.length > 0 && (
        <>
          {/* Cabeçalho da demonstração */}
          <div style={{
            background: 'linear-gradient(90deg, var(--brand) 0%, #1a4fa8 100%)',
            color: '#fff', padding: '10px 16px', borderRadius: '8px 8px 0 0',
            display: 'flex', alignItems: 'center', gap: 16, fontSize: 13,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{dados.plano.nome}</span>
            <span style={{ opacity: .7 }}>·</span>
            <span>{ano}</span>
            {unidades.length > 0 && (
              <>
                <span style={{ opacity: .7 }}>·</span>
                <span style={{ fontWeight: 600 }}>{nomeUnidade(unidade)}</span>
              </>
            )}
            {/* Botão global expandir/recolher */}
            {grpIds.length > 0 && (
              <button onClick={toggleTudo} style={{
                marginLeft: 'auto',
                background: 'rgba(255,255,255,.15)',
                border: '1px solid rgba(255,255,255,.3)',
                color: '#fff', borderRadius: 6,
                padding: '4px 12px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                {todosRecolhidos ? '▼ Expandir tudo' : '▶ Recolher tudo'}
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4ff', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{
                    textAlign: 'left', padding: '8px 12px', minWidth: 280,
                    position: 'sticky', left: 0, background: '#f0f4ff', zIndex: 11,
                    fontWeight: 700, color: 'var(--brand)', fontSize: 11, letterSpacing: '.05em',
                    borderBottom: '2px solid var(--brand)',
                  }}>
                    DESCRIÇÃO
                  </th>
                  {MESES.map((m, i) => (
                    <th key={i} style={{
                      textAlign: 'right', padding: '8px 8px', minWidth: 80,
                      fontWeight: 600, color: 'var(--text-2)', fontSize: 11,
                      borderBottom: '2px solid var(--brand)',
                      background: '#f0f4ff',
                    }}>{m}</th>
                  ))}
                  <th style={{
                    textAlign: 'right', padding: '8px 10px', minWidth: 90,
                    borderLeft: '2px solid var(--border)', fontWeight: 700,
                    color: 'var(--brand)', fontSize: 11,
                    borderBottom: '2px solid var(--brand)',
                    background: '#f0f4ff',
                  }}>
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {dados.linhas.map(linha => {
                  const nv  = hierarquia.nivel[linha.item_id]
                  const ehNN = linha.tipo === 'NN' || linha.tipo === null

                  // Ocultar L2 TT se seu pai L1 está recolhido
                  if (nv === 2 && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null
                  // Ocultar NN se seu TT pai direto está recolhido (L2 ou L1)
                  if (ehNN && recolhidosL2.has(hierarquia.paiL2[linha.item_id])) return null
                  // Ocultar NN se o L1 avô está recolhido
                  if (ehNN && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null

                  const estilo = estiloLinha(linha.tipo)
                  const vConta = vals[linha.conta] || {}
                  const ehL1   = nv === 1
                  const ehL2   = nv === 2
                  const recL1  = ehL1 && recolhidosL1.has(linha.item_id)
                  const recL2  = ehL2 && recolhidosL2.has(linha.item_id)

                  return (
                    <tr key={linha.item_id}
                      style={{ ...estilo, borderBottom: '1px solid var(--border)',
                        cursor: (ehL1 || ehL2) ? 'pointer' : 'default' }}
                      onClick={ehL1 ? () => toggleL1(linha.item_id) : ehL2 ? () => toggleL2(linha.item_id) : undefined}
                    >
                      <td style={{
                        padding: '5px 12px',
                        paddingLeft: ehNN ? 36 : ehL2 ? 22 : 10,
                        position: 'sticky', left: 0, zIndex: 1,
                        background: bgSticky(linha.tipo),
                        color: corTexto(linha.tipo),
                        fontWeight: estilo.fontWeight || 400,
                        fontSize: estilo.fontSize || 12,
                        userSelect: (ehL1 || ehL2) ? 'none' : 'auto',
                      }}>
                        {(ehL1 || ehL2) && (
                          <span style={{ fontSize: 10, opacity: .6, marginRight: 6 }}>
                            {(recL1 || recL2) ? '▶' : '▼'}
                          </span>
                        )}
                        {linha.descricao}
                      </td>

                      {Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1
                        const valor = vConta[mes] ?? 0
                        return (
                          <td key={mes} style={{
                            textAlign: 'right', padding: '5px 8px',
                            fontWeight: estilo.fontWeight,
                            color: corTexto(linha.tipo),
                            fontSize: 12,
                          }}>
                            {valor !== 0 ? fmt(valor) : '—'}
                          </td>
                        )
                      })}

                      <td style={{
                        textAlign: 'right', padding: '5px 10px',
                        fontWeight: estilo.fontWeight || 600,
                        color: corTexto(linha.tipo),
                        borderLeft: '2px solid var(--border)',
                        background: bgSticky(linha.tipo),
                        fontSize: 12,
                      }}>
                        {(() => { const t = total12(linha.conta); return t !== 0 ? fmt(t) : '—' })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
            <span>Dados importados — {ano}</span>
            <span style={{ color: 'var(--brand)' }}>■ Subtotais calculados</span>
            <span style={{ color: '#16a34a' }}>■ Resultado final</span>
            {grpIds.length > 0 && (
              <span>Clique no grupo para expandir/recolher</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
