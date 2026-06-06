import { useEffect, useState, useMemo } from 'react'
import { clientesAPI, orcamentoAPI, planosAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const ANO_ATUAL = new Date().getFullYear()
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const fmt = v =>
  v !== 0 && v !== null && v !== undefined
    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
    : '—'

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

// ── Modal de edição do template ───────────────────────────────────────────────
function ModalTemplateDRE({ planoId, planoNome, onClose, onReload }) {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [editKey, setEditKey] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [novaLinha, setNovaLinha] = useState({ descricao: '', tipo: 'NN', agrupamento: '', conta: '' })
  const [salvandoNova, setSalvandoNova] = useState(false)

  useEffect(() => {
    planosAPI.obter(planoId)
      .then(r => {
        const dreItens = (r.data.itens || []).filter(i =>
          i.modulo && i.modulo.toUpperCase().split(',').map(s => s.trim()).includes('D')
        )
        setItens(dreItens.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))
      })
      .catch(() => toast.error('Erro ao carregar template'))
      .finally(() => setLoading(false))
  }, [planoId])

  const iniciarEdicao = (item, field) => {
    setEditKey(`${item.id}-${field}`)
    setEditVal(item[field] ?? '')
  }

  const salvarCampo = async (item, field) => {
    const val = field === 'tipo' || field === 'conta' ? (editVal || null) : editVal
    setEditKey(null)
    try {
      await planosAPI.atualizarItem(planoId, item.id, { [field]: val })
      setItens(prev => prev.map(i => i.id === item.id ? { ...i, [field]: val } : i))
      onReload()
    } catch {
      toast.error('Erro ao salvar')
    }
  }

  const excluirItem = async (item) => {
    if (!window.confirm(`Excluir "${item.descricao}"?\nOs valores históricos desta linha serão removidos permanentemente.`)) return
    try {
      await planosAPI.excluirItem(planoId, item.id)
      setItens(prev => prev.filter(i => i.id !== item.id))
      onReload()
      toast.success('Linha removida')
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  const adicionarLinha = async () => {
    if (!novaLinha.descricao.trim()) { toast.error('Descrição obrigatória'); return }
    setSalvandoNova(true)
    try {
      const ordemMax = Math.max(0, ...itens.map(i => i.ordem ?? 0))
      const r = await planosAPI.adicionarItem(planoId, {
        ...novaLinha,
        conta: novaLinha.conta || null,
        modulo: 'D',
        ordem: ordemMax + 1,
      })
      setItens(prev => [...prev, r.data])
      setNovaLinha({ descricao: '', tipo: 'NN', agrupamento: '', conta: '' })
      onReload()
      toast.success('Linha adicionada')
    } catch {
      toast.error('Erro ao adicionar linha')
    } finally {
      setSalvandoNova(false)
    }
  }

  const tipoBadgeStyle = tipo => ({
    display: 'inline-block', cursor: 'pointer', padding: '2px 7px',
    borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: tipo === 'TT' ? '#e8f0ff' : tipo === 'RES' ? '#dcfce7' : tipo === 'GRP' ? '#f0f0f8' : '#f5f5f5',
    color: tipo === 'TT' ? 'var(--brand)' : tipo === 'RES' ? '#16a34a' : tipo === 'GRP' ? 'var(--brand)' : 'var(--text-2)',
  })

  const inputStyle = { fontSize: 12, width: '100%', padding: '3px 5px', border: '1px solid var(--brand)', borderRadius: 4, outline: 'none' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 940, boxShadow: '0 8px 40px rgba(0,0,0,.22)', marginBottom: 20 }}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Editar Template DRE</span>
          <span style={{ fontSize: 11, background: 'var(--brand-light)', color: 'var(--brand)', padding: '2px 8px', borderRadius: 4 }}>{planoNome}</span>
          <span style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', padding: '2px 8px', borderRadius: 4 }}>
            ⚠ Alterações afetam todos os clientes com este plano
          </span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4ff', position: 'sticky', top: 0, zIndex: 5 }}>
                  {[['Tipo', 80], ['Agrupamento', 120], ['Descrição', null], ['Conta', 140], ['', 48]].map(([h, w], i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--brand)', fontSize: 11, letterSpacing: '.04em', borderBottom: '2px solid var(--brand)', width: w || undefined }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* Tipo */}
                    <td style={{ padding: '4px 12px' }}>
                      {editKey === `${item.id}-tipo` ? (
                        <select value={editVal} onChange={e => setEditVal(e.target.value)}
                          onBlur={() => salvarCampo(item, 'tipo')} autoFocus style={{ fontSize: 12, width: 72 }}>
                          <option value="">—</option>
                          <option value="TT">TT</option>
                          <option value="NN">NN</option>
                          <option value="RES">RES</option>
                          <option value="GRP">GRP</option>
                        </select>
                      ) : (
                        <span style={tipoBadgeStyle(item.tipo)} onClick={() => iniciarEdicao(item, 'tipo')}>
                          {item.tipo || '—'}
                        </span>
                      )}
                    </td>
                    {/* Agrupamento */}
                    <td style={{ padding: '4px 12px' }}>
                      {editKey === `${item.id}-agrupamento` ? (
                        <input value={editVal} onChange={e => setEditVal(e.target.value)}
                          onBlur={() => salvarCampo(item, 'agrupamento')}
                          onKeyDown={e => { if (e.key === 'Enter') salvarCampo(item, 'agrupamento'); if (e.key === 'Escape') setEditKey(null) }}
                          autoFocus style={inputStyle} />
                      ) : (
                        <span onClick={() => iniciarEdicao(item, 'agrupamento')}
                          style={{ cursor: 'pointer', display: 'block', minHeight: 20, padding: '1px 2px', color: item.agrupamento ? 'inherit' : '#d1d5db' }}>
                          {item.agrupamento || '—'}
                        </span>
                      )}
                    </td>
                    {/* Descrição */}
                    <td style={{ padding: '4px 12px' }}>
                      {editKey === `${item.id}-descricao` ? (
                        <input value={editVal} onChange={e => setEditVal(e.target.value)}
                          onBlur={() => salvarCampo(item, 'descricao')}
                          onKeyDown={e => { if (e.key === 'Enter') salvarCampo(item, 'descricao'); if (e.key === 'Escape') setEditKey(null) }}
                          autoFocus style={inputStyle} />
                      ) : (
                        <span onClick={() => iniciarEdicao(item, 'descricao')}
                          style={{ cursor: 'pointer', display: 'block', minHeight: 20, padding: '1px 2px', fontWeight: (item.tipo === 'TT' || item.tipo === 'RES' || item.tipo === 'GRP') ? 600 : 400 }}>
                          {item.descricao}
                        </span>
                      )}
                    </td>
                    {/* Conta */}
                    <td style={{ padding: '4px 12px' }}>
                      {editKey === `${item.id}-conta` ? (
                        <input value={editVal} onChange={e => setEditVal(e.target.value)}
                          onBlur={() => salvarCampo(item, 'conta')}
                          onKeyDown={e => { if (e.key === 'Enter') salvarCampo(item, 'conta'); if (e.key === 'Escape') setEditKey(null) }}
                          autoFocus style={{ ...inputStyle, fontFamily: 'monospace' }} />
                      ) : (
                        <span onClick={() => iniciarEdicao(item, 'conta')}
                          style={{ cursor: 'pointer', display: 'block', minHeight: 20, padding: '1px 2px', color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 11 }}>
                          {item.conta || '—'}
                        </span>
                      )}
                    </td>
                    {/* Excluir */}
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <button onClick={() => excluirItem(item)} title="Excluir linha"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18, lineHeight: 1, padding: '1px 5px' }}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Nova linha */}
                <tr style={{ background: '#f9fafb', borderTop: '2px dashed var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <select value={novaLinha.tipo} onChange={e => setNovaLinha(p => ({ ...p, tipo: e.target.value }))}
                      style={{ fontSize: 12, width: 72 }}>
                      <option value="NN">NN</option>
                      <option value="TT">TT</option>
                      <option value="RES">RES</option>
                      <option value="GRP">GRP</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.agrupamento} onChange={e => setNovaLinha(p => ({ ...p, agrupamento: e.target.value }))}
                      placeholder="Agrupamento"
                      style={{ fontSize: 12, width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.descricao} onChange={e => setNovaLinha(p => ({ ...p, descricao: e.target.value }))}
                      placeholder="Descrição da linha *"
                      onKeyDown={e => e.key === 'Enter' && adicionarLinha()}
                      style={{ fontSize: 12, width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.conta} onChange={e => setNovaLinha(p => ({ ...p, conta: e.target.value }))}
                      placeholder="Conta"
                      style={{ fontSize: 12, width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'monospace' }} />
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <button onClick={adicionarLinha} disabled={salvandoNova || !novaLinha.descricao.trim()}
                      style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600, opacity: (!novaLinha.descricao.trim() || salvandoNova) ? .45 : 1 }}>
                      {salvandoNova ? '...' : '+ Add'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {itens.length} linha{itens.length !== 1 ? 's' : ''} · Clique em qualquer campo para editar
          </span>
          <button onClick={onClose} style={{ padding: '8px 24px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DRE principal ─────────────────────────────────────────────────────────────
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
  const [recolhidosL1, setRecolhidosL1] = useState(new Set())
  const [recolhidosL2, setRecolhidosL2] = useState(new Set())

  // ── Edição de valores ─────────────────────────────────────────────────────
  const [modoEdicao,  setModoEdicao]  = useState(false)
  const [editando,    setEditando]    = useState(null)   // {item_id, mes}
  const [editVal,     setEditVal]     = useState('')

  // ── Modal template ────────────────────────────────────────────────────────
  const [modalTemplate, setModalTemplate] = useState(false)

  const hierarquia = useMemo(() => {
    const nivel   = {}
    const paiL1   = {}
    const paiL2   = {}
    const vistoAgr = {}
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

  const grpIds = l1Ids

  useEffect(() => { setRecolhidosL1(new Set()); setRecolhidosL2(new Set()) }, [clienteId, ano, unidade])
  useEffect(() => { if (!modoEdicao) { setEditando(null); setEditVal('') } }, [modoEdicao])

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

  // ── Ao trocar ano manualmente ─────────────────────────────────────────────
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
  const carregarDre = () => {
    if (!clienteId) { setDados(null); setVals({}); return }
    setLoading(true)
    orcamentoAPI.obterDre(clienteId, ano, unidade)
      .then(r => {
        setDados(r.data)
        const m = {}
        for (const linha of r.data.linhas || []) m[linha.conta] = linha.valores
        setVals(m)
      })
      .catch(() => toast.error('Erro ao carregar DRE'))
      .finally(() => setLoading(false))
  }

  useEffect(carregarDre, [clienteId, ano, unidade])

  // ── Salvar valor editado ─────────────────────────────────────────────────
  const handleCelulaSave = async (item_id, mes, conta) => {
    const v = parseFloat(String(editVal).replace(',', '.')) || 0
    setEditando(null)
    setEditVal('')
    try {
      await orcamentoAPI.salvarDre(clienteId, ano, item_id, mes, v, unidade)
      setVals(prev => ({ ...prev, [conta]: { ...(prev[conta] || {}), [mes]: v } }))
    } catch {
      toast.error('Erro ao salvar valor')
    }
  }

  const total12 = conta =>
    Object.values(vals[conta] || {}).reduce((s, v) => s + (v || 0), 0)

  const anos = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 2 + i)
  const nomeUnidade = u => u === 'CONSOLIDADO' ? 'Consolidado' : u

  // ── Botões da barra azul ─────────────────────────────────────────────────
  const btnBarStyle = (ativo) => ({
    background: ativo ? '#fffbeb' : 'rgba(255,255,255,.15)',
    border: ativo ? '1px solid #fcd34d' : '1px solid rgba(255,255,255,.3)',
    color: ativo ? '#b45309' : '#fff',
    borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  })

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
              <option key={u} value={u}>{u === 'CONSOLIDADO' ? 'Consolidado (todas as unidades)' : u}</option>
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
      {!clienteId && <div className="empty-state">Selecione um cliente para visualizar o DRE.</div>}

      {clienteId && !loading && dados?.plano === null && (
        <div className="empty-state">
          Este cliente não possui plano DRE vinculado.
          Acesse <strong>Planos de Contas</strong> para vincular um template.
        </div>
      )}

      {clienteId && !loading && dados?.plano && unidades.length === 0 && (
        <div className="empty-state">
          Este cliente não possui dados de DRE importados para {ano}.<br />
          O DRE exibe dados históricos importados via planilha Excel.<br />
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
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, flexWrap: 'wrap',
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

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Expandir/recolher */}
              {grpIds.length > 0 && (
                <button onClick={toggleTudo} style={btnBarStyle(false)}>
                  {todosRecolhidos ? '▼ Expandir tudo' : '▶ Recolher tudo'}
                </button>
              )}
              {/* Editar valores — apenas para não-clientes */}
              {!isCliente && (
                <button onClick={() => setModoEdicao(p => !p)} style={btnBarStyle(modoEdicao)}>
                  {modoEdicao ? '✓ Finalizar edição' : '✏ Editar valores'}
                </button>
              )}
              {/* Editar template */}
              {!isCliente && (
                <button onClick={() => setModalTemplate(true)} style={btnBarStyle(false)}>
                  ⚙ Template
                </button>
              )}
            </div>
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
                  }}>DESCRIÇÃO</th>
                  {MESES.map((m, i) => (
                    <th key={i} style={{
                      textAlign: 'right', padding: '8px 8px', minWidth: 80,
                      fontWeight: 600, color: 'var(--text-2)', fontSize: 11,
                      borderBottom: '2px solid var(--brand)', background: '#f0f4ff',
                    }}>{m}</th>
                  ))}
                  <th style={{
                    textAlign: 'right', padding: '8px 10px', minWidth: 90,
                    borderLeft: '2px solid var(--border)', fontWeight: 700,
                    color: 'var(--brand)', fontSize: 11,
                    borderBottom: '2px solid var(--brand)', background: '#f0f4ff',
                  }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {dados.linhas.map(linha => {
                  const nv   = hierarquia.nivel[linha.item_id]
                  const ehNN = linha.tipo === 'NN' || linha.tipo === null

                  if (nv === 2 && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null
                  if (ehNN && recolhidosL2.has(hierarquia.paiL2[linha.item_id])) return null
                  if (ehNN && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null

                  const estilo = estiloLinha(linha.tipo)
                  const vConta = vals[linha.conta] || {}
                  const ehL1   = nv === 1
                  const ehL2   = nv === 2
                  const recL1  = ehL1 && recolhidosL1.has(linha.item_id)
                  const recL2  = ehL2 && recolhidosL2.has(linha.item_id)
                  const editavel = modoEdicao && ehNN

                  return (
                    <tr key={linha.item_id}
                      style={{ ...estilo, borderBottom: '1px solid var(--border)', cursor: (ehL1 || ehL2) ? 'pointer' : 'default' }}
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
                        const mes   = i + 1
                        const valor = vConta[mes] ?? 0
                        const isEditando = editavel && editando?.item_id === linha.item_id && editando?.mes === mes

                        return (
                          <td key={mes}
                            style={{
                              textAlign: 'right', padding: '5px 8px',
                              fontWeight: estilo.fontWeight,
                              color: corTexto(linha.tipo),
                              fontSize: 12,
                              background: editavel ? 'rgba(59,130,246,.04)' : 'transparent',
                              cursor: editavel ? 'text' : 'default',
                            }}
                            onClick={editavel && !isEditando ? (e) => {
                              e.stopPropagation()
                              setEditando({ item_id: linha.item_id, mes })
                              setEditVal(valor === 0 ? '' : String(valor))
                            } : undefined}
                          >
                            {isEditando ? (
                              <input
                                type="number"
                                value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                onBlur={() => handleCelulaSave(linha.item_id, mes, linha.conta)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleCelulaSave(linha.item_id, mes, linha.conta)
                                  if (e.key === 'Escape') { setEditando(null); setEditVal('') }
                                }}
                                onClick={e => e.stopPropagation()}
                                autoFocus
                                style={{ width: 72, textAlign: 'right', fontSize: 12, border: '1px solid var(--brand)', borderRadius: 4, padding: '2px 4px', outline: 'none' }}
                              />
                            ) : (
                              valor !== 0 ? fmt(valor) : (editavel ? <span style={{ color: '#d1d5db', fontSize: 10 }}>—</span> : '—')
                            )}
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
            {modoEdicao && <span style={{ color: '#b45309', fontWeight: 600 }}>✏ Modo edição ativo — clique em uma célula para editar</span>}
            {!modoEdicao && grpIds.length > 0 && <span>Clique no grupo para expandir/recolher</span>}
          </div>
        </>
      )}

      {/* Modal de edição do template */}
      {modalTemplate && dados?.plano && (
        <ModalTemplateDRE
          planoId={dados.plano.id}
          planoNome={dados.plano.nome}
          onClose={() => setModalTemplate(false)}
          onReload={carregarDre}
        />
      )}
    </div>
  )
}
