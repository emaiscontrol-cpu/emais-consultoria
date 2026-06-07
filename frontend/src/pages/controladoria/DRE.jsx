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
  return { background: 'transparent', borderLeft: '3px solid transparent' }
}
const corTexto = tipo => {
  if (tipo === 'RES') return '#16a34a'
  if (tipo === 'TT')  return 'var(--brand)'
  return 'inherit'
}
const bgSticky = tipo => {
  if (tipo === 'RES') return '#e8f5ed'
  if (tipo === 'TT')  return '#e8f0ff'
  return 'var(--surface,#fff)'
}

// ── Helper: paiDireto map para lista de itens do plano ────────────────────────
// Usado no modal (item.id) e na DRE principal (linha.item_id).
// idField: nome do campo de id nos objetos da lista.
function buildPaiDiretoMap(items, idField = 'id') {
  const paiDireto = {}
  const ttPorAgrDot = {}   // agrupamento com ponto → id do TT
  let ttUltimo = null

  for (const l of items) {
    const agr = l.agrupamento || ''
    const tipo = l.tipo
    if (tipo === 'TT' || tipo === 'RES') {
      if (agr.includes('.') && !ttPorAgrDot[agr]) ttPorAgrDot[agr] = l[idField]
      ttUltimo = l[idField]
    } else if (tipo === 'AN') {
      if (agr.includes('.') && ttPorAgrDot[agr] != null) {
        paiDireto[l[idField]] = ttPorAgrDot[agr]
      } else {
        paiDireto[l[idField]] = ttUltimo
      }
    }
  }
  return paiDireto
}

// ── Modal de edição do template ───────────────────────────────────────────────
function ModalTemplateDRE({ planoId, planoNome, onClose, onReload }) {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [editKey, setEditKey] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [novaLinha, setNovaLinha] = useState({ descricao: '', tipo: 'NN', agrupamento: '', conta: '', paiId: '' })
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

  // Mapa paiDireto para exibição na coluna "Título Pai"
  const paiDiretoMap = useMemo(() => buildPaiDiretoMap(itens, 'id'), [itens])

  // Lista de TTs para o dropdown de pai
  const ttsList = useMemo(
    () => itens.filter(i => i.tipo === 'TT' || i.tipo === 'RES'),
    [itens]
  )

  const iniciarEdicao = (item, field) => {
    setEditKey(`${item.id}-${field}`)
    setEditVal(item[field] ?? '')
  }

  const salvarCampo = async (item, field) => {
    const val = (field === 'tipo' || field === 'conta') ? (editVal || null) : editVal
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

  // Ao selecionar o pai, preenche agrupamento automaticamente
  const handlePaiChange = (paiId) => {
    const pai = ttsList.find(t => String(t.id) === paiId)
    const agr = pai ? (pai.agrupamento || '') : ''
    setNovaLinha(p => ({ ...p, paiId, agrupamento: agr }))
  }

  const adicionarLinha = async () => {
    if (!novaLinha.descricao.trim()) { toast.error('Descrição obrigatória'); return }
    setSalvandoNova(true)
    try {
      // Posiciona após o último item com mesmo agrupamento (ou no final geral)
      const mesmoAgr = novaLinha.agrupamento
        ? itens.filter(i => i.agrupamento === novaLinha.agrupamento)
        : []
      const ordemBase = mesmoAgr.length > 0
        ? Math.max(...mesmoAgr.map(i => i.ordem ?? 0))
        : Math.max(0, ...itens.map(i => i.ordem ?? 0))

      const r = await planosAPI.adicionarItem(planoId, {
        descricao: novaLinha.descricao,
        tipo: novaLinha.tipo,
        agrupamento: novaLinha.agrupamento || null,
        conta: novaLinha.conta || null,
        modulo: 'D',
        ordem: ordemBase + 1,
      })
      setItens(prev => [...prev, r.data].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))
      setNovaLinha({ descricao: '', tipo: 'NN', agrupamento: '', conta: '', paiId: '' })
      onReload()
      toast.success('Linha adicionada')
    } catch {
      toast.error('Erro ao adicionar linha')
    } finally {
      setSalvandoNova(false)
    }
  }

  const tipoBadgeStyle = (tipo, clicavel = true) => ({
    display: 'inline-block', cursor: clicavel ? 'pointer' : 'default', padding: '2px 7px',
    borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: tipo === 'TT' ? '#e8f0ff' : tipo === 'RES' ? '#dcfce7' : tipo === 'AN' ? '#f0f0f0' : '#f5f5f5',
    color: tipo === 'TT' ? 'var(--brand)' : tipo === 'RES' ? '#16a34a' : tipo === 'AN' ? 'var(--text-3)' : 'var(--text-2)',
  })

  const inputSt = { fontSize: 12, width: '100%', padding: '3px 5px', border: '1px solid var(--brand)', borderRadius: 4, outline: 'none' }
  const cellSt = { cursor: 'pointer', display: 'block', minHeight: 20, padding: '1px 2px' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 1020, boxShadow: '0 8px 40px rgba(0,0,0,.22)', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Editar Template DRE</span>
          <span style={{ fontSize: 11, background: 'var(--brand-light)', color: 'var(--brand)', padding: '2px 8px', borderRadius: 4 }}>{planoNome}</span>
          <span style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', padding: '2px 8px', borderRadius: 4 }}>
            ⚠ Alterações afetam todos os clientes com este plano
          </span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4ff', position: 'sticky', top: 0, zIndex: 5 }}>
                  {[['Tipo',75],['Agrupamento',140],['Descrição',null],['Conta',100],['Fórmula',160],['Título Pai',160],['',44]].map(([h, w], i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--brand)', fontSize: 11, letterSpacing: '.04em', borderBottom: '2px solid var(--brand)', width: w || undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map(item => {
                  const ehTT = item.tipo === 'TT' || item.tipo === 'RES'
                  const ehAN = item.tipo === 'AN'
                  const paiId = paiDiretoMap[item.id]
                  const paiNome = paiId ? itens.find(t => t.id === paiId)?.descricao : null

                  // Linhas AN: exibição somente-leitura (origem = Plano de Contas)
                  if (ehAN) return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: '#fafafa', opacity: .72 }}>
                      <td style={{ padding: '3px 12px' }}><span style={tipoBadgeStyle('AN', false)}>AN</span></td>
                      <td style={{ padding: '3px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)' }}>{item.agrupamento || '—'}</td>
                      <td style={{ padding: '3px 12px', fontSize: 12, color: 'var(--text-2)' }}>{item.descricao}</td>
                      <td style={{ padding: '3px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)' }}>{item.conta || '—'}</td>
                      <td style={{ padding: '3px 12px' }}><span style={{ fontSize: 10, color: '#d1d5db' }}>—</span></td>
                      <td style={{ padding: '3px 12px' }}><span style={{ fontSize: 11, color: paiNome ? '#374151' : '#d1d5db' }}>{paiNome?.slice(0,35) || '—'}</span></td>
                      <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                        <button onClick={() => excluirItem(item)} title="Excluir"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18, lineHeight: 1, padding: '1px 5px' }}>×</button>
                      </td>
                    </tr>
                  )

                  // Linhas TT / RES: totalmente editáveis
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: '#fafbff' }}>
                      {/* Tipo */}
                      <td style={{ padding: '4px 12px' }}>
                        {editKey === `${item.id}-tipo` ? (
                          <select value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => salvarCampo(item, 'tipo')} autoFocus style={{ fontSize: 12, width: 72 }}>
                            <option value="TT">TT</option>
                            <option value="RES">RES</option>
                          </select>
                        ) : (
                          <span style={tipoBadgeStyle(item.tipo)} onClick={() => iniciarEdicao(item, 'tipo')}>{item.tipo || '—'}</span>
                        )}
                      </td>
                      {/* Agrupamento — exibição apenas (define-se no Plano) */}
                      <td style={{ padding: '4px 12px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: item.agrupamento ? 'var(--text-2)' : '#d1d5db' }}>
                          {item.agrupamento || '—'}
                        </span>
                      </td>
                      {/* Descrição */}
                      <td style={{ padding: '4px 12px' }}>
                        {editKey === `${item.id}-descricao` ? (
                          <input value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => salvarCampo(item, 'descricao')}
                            onKeyDown={e => { if (e.key === 'Enter') salvarCampo(item, 'descricao'); if (e.key === 'Escape') setEditKey(null) }}
                            autoFocus style={inputSt} />
                        ) : (
                          <span onClick={() => iniciarEdicao(item, 'descricao')} style={{ ...cellSt, fontWeight: 600 }}>
                            {item.descricao}
                          </span>
                        )}
                      </td>
                      {/* Conta */}
                      <td style={{ padding: '4px 12px' }}>
                        {editKey === `${item.id}-conta` ? (
                          <input value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => salvarCampo(item, 'conta')}
                            onKeyDown={e => { if (e.key === 'Enter') salvarCampo(item, 'conta'); if (e.key === 'Escape') setEditKey(null) }}
                            autoFocus style={{ ...inputSt, fontFamily: 'monospace' }} />
                        ) : (
                          <span onClick={() => iniciarEdicao(item, 'conta')} style={{ ...cellSt, color: 'var(--text-3)', fontFamily: 'monospace', fontSize: 11 }}>
                            {item.conta || '—'}
                          </span>
                        )}
                      </td>
                      {/* Fórmula */}
                      <td style={{ padding: '4px 12px' }}>
                        {editKey === `${item.id}-formula` ? (
                          <input value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => salvarCampo(item, 'formula')}
                            onKeyDown={e => { if (e.key === 'Enter') salvarCampo(item, 'formula'); if (e.key === 'Escape') setEditKey(null) }}
                            autoFocus placeholder="ex: RECEITA - DEDUCOES" style={{ ...inputSt, fontFamily: 'monospace' }} />
                        ) : (
                          <span onClick={() => iniciarEdicao(item, 'formula')} title="Clique para editar a fórmula"
                            style={{ ...cellSt, fontFamily: 'monospace', fontSize: 10, color: item.formula ? '#1d4ed8' : '#d1d5db' }}>
                            {item.formula || '+ filhos'}
                          </span>
                        )}
                      </td>
                      {/* Pai */}
                      <td style={{ padding: '4px 12px' }}>
                        <span style={{ fontSize: 11, color: paiNome ? 'var(--text-3)' : '#d1d5db', fontStyle: 'italic' }}>
                          {paiNome ? `↳ ${paiNome.slice(0,32)}` : '—'}
                        </span>
                      </td>
                      {/* Excluir */}
                      <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                        <button onClick={() => excluirItem(item)} title="Excluir"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18, lineHeight: 1, padding: '1px 5px' }}>×</button>
                      </td>
                    </tr>
                  )
                })}

                {/* Nova linha */}
                <tr style={{ background: '#f9fafb', borderTop: '2px dashed var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <select value={novaLinha.tipo} onChange={e => setNovaLinha(p => ({ ...p, tipo: e.target.value }))} style={{ fontSize: 12, width: 72 }}>
                      <option value="TT">TT</option>
                      <option value="RES">RES</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.agrupamento} onChange={e => setNovaLinha(p => ({ ...p, agrupamento: e.target.value }))}
                      placeholder="Agrupamento"
                      style={{ fontSize: 12, width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'monospace' }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.descricao} onChange={e => setNovaLinha(p => ({ ...p, descricao: e.target.value }))}
                      placeholder="Descrição *" onKeyDown={e => e.key === 'Enter' && adicionarLinha()}
                      style={{ fontSize: 12, width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.conta} onChange={e => setNovaLinha(p => ({ ...p, conta: e.target.value }))}
                      placeholder="Conta"
                      style={{ fontSize: 12, width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'monospace' }} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select value={novaLinha.paiId} onChange={e => handlePaiChange(e.target.value)}
                      style={{ fontSize: 12, width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 4 }}>
                      <option value="">— sem pai —</option>
                      {ttsList.map(t => <option key={t.id} value={t.id}>{t.descricao.slice(0, 48)}</option>)}
                    </select>
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

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {itens.length} linha{itens.length !== 1 ? 's' : ''} · Para vínculo explícito use <code style={{background:'#f0f4ff',padding:'1px 4px',borderRadius:3}}>GRUPO.SUBGRUPO</code> no agrupamento do TT filho e das suas NNs
          </span>
          <button onClick={onClose} style={{ padding: '8px 24px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Fechar</button>
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
  const [valsById,   setValsById]   = useState({})   // {item_id: {mes: valor}} — valores NN brutos
  const [loading,    setLoading]    = useState(false)

  // Expandir/recolher
  const [recolhidosL1, setRecolhidosL1] = useState(new Set())
  const [recolhidosL2, setRecolhidosL2] = useState(new Set())

  // Edição de valores
  const [modoEdicao,  setModoEdicao]  = useState(false)
  const [editando,    setEditando]    = useState(null)
  const [editVal,     setEditVal]     = useState('')

  // Modal template
  const [modalTemplate, setModalTemplate] = useState(false)

  // ── Hierarquia ──────────────────────────────────────────────────────────────
  // Detecção HÍBRIDA:
  //   1. TT com agrupamento "GRUPO.SUB" → L2 explícito; pai = TT com agrupamento "GRUPO"
  //   2. TT sem ponto → detecção por ordem (1º do grupo = L1, demais = L2)
  //   3. NN com agrupamento "GRUPO.SUB" → pai = TT com mesmo agrupamento
  //   4. NN sem ponto / sem match explícito → pai = último TT visto (fallback por ordem)
  const hierarquia = useMemo(() => {
    const nivel = {}, paiL1 = {}, paiDireto = {}
    const filhosL2 = {}, filhosL1 = {}

    // Fase 1: indexar TTs por agrupamento (para lookup de pais explícitos)
    const ttPorAgrSimples = {}  // agrupamento sem ponto → item_id
    const ttPorAgrDot     = {}  // agrupamento com ponto → item_id

    for (const l of dados?.linhas || []) {
      if (l.tipo !== 'TT' && l.tipo !== 'RES') continue
      const agr = l.agrupamento || ''
      if (agr.includes('.')) {
        if (ttPorAgrDot[agr] == null) ttPorAgrDot[agr] = l.item_id
      } else {
        if (ttPorAgrSimples[agr] == null) ttPorAgrSimples[agr] = l.item_id
      }
    }

    // Fase 2: percorrer em ordem e montar relações
    const l1DeAgr = {}   // agrupamento simples → primeiro TT item_id (para fallback L1/L2)
    let ttUltimo = null  // último TT visto (para NNs sem parent explícito)

    for (const l of dados?.linhas || []) {
      if (l.tipo === 'TT' || l.tipo === 'RES') {
        const agr = l.agrupamento || String(l.item_id)
        const dotIdx = agr.indexOf('.')

        if (dotIdx > 0) {
          // Parent explícito: prefixo antes do ponto
          const parentAgr = agr.slice(0, dotIdx)
          const parentId  = ttPorAgrSimples[parentAgr]
          if (parentId != null) {
            nivel[l.item_id] = 2
            paiL1[l.item_id] = parentId
            ttUltimo = l.item_id
            continue
          }
        }

        // Fallback por ordem: primeiro TT do agrupamento = L1, demais = L2
        const agrSimples = agr.includes('.') ? agr : agr
        if (!l1DeAgr[agrSimples]) {
          l1DeAgr[agrSimples] = l.item_id
          nivel[l.item_id] = 1
        } else {
          nivel[l.item_id] = 2
          paiL1[l.item_id] = l1DeAgr[agrSimples]
        }
        ttUltimo = l.item_id

      } else if (l.tipo === 'NN' || l.tipo === null) {
        const agr = l.agrupamento || ''
        let pai = null

        // Parent explícito: agrupamento com ponto coincide com um TT
        if (agr.includes('.') && ttPorAgrDot[agr] != null) {
          pai = ttPorAgrDot[agr]
        } else {
          // Fallback: último TT visto
          pai = ttUltimo
        }

        if (pai == null) continue
        paiDireto[l.item_id] = pai

        if (nivel[pai] === 2) {
          const l1id = paiL1[pai]
          paiL1[l.item_id] = l1id
          filhosL2[pai] = filhosL2[pai] || []
          filhosL2[pai].push(l.item_id)
          if (l1id != null) {
            filhosL1[l1id] = filhosL1[l1id] || []
            filhosL1[l1id].push(l.item_id)
          }
        } else {
          paiL1[l.item_id] = pai
          filhosL1[pai] = filhosL1[pai] || []
          filhosL1[pai].push(l.item_id)
        }
      }
    }

    return { nivel, paiL1, paiDireto, filhosL2, filhosL1 }
  }, [dados?.linhas])

  // ── IDs por nível ──────────────────────────────────────────────────────────
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

  // ── Cálculo automático dos TTs ─────────────────────────────────────────────
  // Regra:
  //   1. TTs com campo formula → avalia expressão referenciando conta ou agrupamento
  //   2. TTs sem formula mas com NNs filhos → soma dos filhos (comportamento original)
  //   3. Demais → mantém valor do banco
  //
  // Sintaxe da fórmula: tokens separados por espaço com + e -
  //   ex: "FAT - DED"  /  "RECEITA - DEDUCOES"  /  "MC2 - TCI + ORO"
  const valsCalc = useMemo(() => {
    const calc = { ...valsById }

    // Mapa de lookup: conta/agrupamento → {mes: valor}
    // Populado com NNs primeiro (soma absoluta por agrupamento)
    const byToken = {}

    const linhasOrdenadas = [...(dados?.linhas || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

    // Fase 1: ANs — somar por agrupamento e indexar por conta
    for (const l of linhasOrdenadas) {
      if (l.tipo !== 'AN') continue
      const agr = l.agrupamento
      if (agr) {
        if (!byToken[agr]) byToken[agr] = {}
        for (let mes = 1; mes <= 12; mes++) {
          byToken[agr][mes] = (byToken[agr][mes] || 0) + (valsById[l.item_id]?.[mes] ?? 0)
        }
      }
      if (l.conta) {
        byToken[l.conta] = {}
        for (let mes = 1; mes <= 12; mes++) byToken[l.conta][mes] = valsById[l.item_id]?.[mes] ?? 0
      }
    }

    // Fase 2: TTs/RES em ordem — fórmula explícita ou soma de filhos
    for (const l of linhasOrdenadas) {
      const ehTT = l.tipo === 'TT' || l.tipo === 'RES'
      if (!ehTT) continue

      let resultado = null

      if (l.formula) {
        // Avalia expressão mês a mês — insere espaços ao redor de + e - para aceitar "A+B" e "A + B"
        const tokens = l.formula.trim().replace(/([+\-])/g, ' $1 ').split(/\s+/).filter(Boolean)
        resultado = {}
        for (let mes = 1; mes <= 12; mes++) {
          let v = 0, sg = 1
          for (const tok of tokens) {
            if (tok === '+') { sg = 1; continue }
            if (tok === '-') { sg = -1; continue }
            v += sg * ((byToken[tok] || {})[mes] ?? 0)
            sg = 1
          }
          resultado[mes] = v
        }
      } else {
        // Fallback: soma filhos diretos (hierarquia)
        const nv = hierarquia.nivel[l.item_id]
        if (nv === 1 || nv === 2) {
          const filhos = nv === 2
            ? (hierarquia.filhosL2[l.item_id] || [])
            : (hierarquia.filhosL1[l.item_id] || [])
          if (filhos.length > 0) {
            resultado = {}
            for (let mes = 1; mes <= 12; mes++) {
              resultado[mes] = filhos.reduce((s, id) => s + (valsById[id]?.[mes] ?? 0), 0)
            }
          }
        }
      }

      if (resultado) {
        calc[l.item_id] = resultado
        // Disponibiliza o resultado para fórmulas subsequentes
        if (l.agrupamento) byToken[l.agrupamento] = resultado
        if (l.conta)       byToken[l.conta]       = resultado
      }
    }

    return calc
  }, [valsById, hierarquia, dados?.linhas])

  // ── Numeração hierárquica ──────────────────────────────────────────────────
  // Esquema: L1 → "1", "2"... · L2 → "1.1", "1.2"... · NN → "1.1.1", "1.1.2"...
  const numeracao = useMemo(() => {
    const nums = {}, ctrs = {}
    for (const l of dados?.linhas || []) {
      const nv   = hierarquia.nivel[l.item_id]
      const ehNN = l.tipo === 'NN' || l.tipo === null
      if (nv === 1) {
        ctrs['root'] = (ctrs['root'] || 0) + 1
        nums[l.item_id] = `${ctrs['root']}`
        ctrs[l.item_id] = 0
      } else if (nv === 2) {
        const pid = hierarquia.paiL1[l.item_id]
        if (pid != null && nums[pid] != null) {
          ctrs[pid] = (ctrs[pid] || 0) + 1
          nums[l.item_id] = `${nums[pid]}.${ctrs[pid]}`
          ctrs[l.item_id] = 0
        }
      } else if (ehNN) {
        const pid = hierarquia.paiDireto[l.item_id]
        if (pid != null && nums[pid] != null) {
          ctrs[pid] = (ctrs[pid] || 0) + 1
          nums[l.item_id] = `${nums[pid]}.${ctrs[pid]}`
        }
      }
    }
    return nums
  }, [dados?.linhas, hierarquia])

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { setRecolhidosL1(new Set()); setRecolhidosL2(new Set()) }, [clienteId, ano, unidade])
  useEffect(() => { if (!modoEdicao) { setEditando(null); setEditVal('') } }, [modoEdicao])

  useEffect(() => {
    if (isCliente) {
      setClienteId(String(usuario.cliente_id))
    } else {
      clientesAPI.listar()
        .then(r => { setClientes(r.data || []); if ((r.data || []).length === 1) setClienteId(String(r.data[0].id)) })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!clienteId) { setUnidades([]); return }
    const detectarAno = async () => {
      for (let a = ANO_ATUAL - 1; a >= ANO_ATUAL - 4; a--) {
        try {
          const r = await orcamentoAPI.unidades(clienteId, a)
          const lista = r.data || []
          if (lista.length > 0) { setAno(a); setUnidades(lista); setUnidade(lista.includes('CONSOLIDADO') ? 'CONSOLIDADO' : lista[0]); return }
        } catch { break }
      }
      setUnidades([])
    }
    detectarAno()
  }, [clienteId])

  useEffect(() => {
    if (!clienteId) return
    orcamentoAPI.unidades(clienteId, ano)
      .then(r => { const l = r.data || []; setUnidades(l); setUnidade(l.includes('CONSOLIDADO') ? 'CONSOLIDADO' : (l[0] || 'CONSOLIDADO')) })
      .catch(() => setUnidades([]))
  }, [ano])

  const carregarDre = () => {
    if (!clienteId) { setDados(null); setValsById({}); return }
    setLoading(true)
    orcamentoAPI.obterDre(clienteId, ano, unidade)
      .then(r => {
        setDados(r.data)
        const m = {}
        for (const linha of r.data.linhas || []) m[linha.item_id] = linha.valores
        setValsById(m)
      })
      .catch(() => toast.error('Erro ao carregar DRE'))
      .finally(() => setLoading(false))
  }

  useEffect(carregarDre, [clienteId, ano, unidade])

  // ── Salvar valor editado ────────────────────────────────────────────────────
  const handleCelulaSave = async (item_id, mes, valorStr) => {
    const raw = String(valorStr ?? editVal)
    const v = parseFloat(raw.replace(',', '.')) || 0
    setEditando(null)
    setEditVal('')
    setValsById(prev => ({ ...prev, [item_id]: { ...(prev[item_id] || {}), [mes]: v } }))
    try {
      await orcamentoAPI.salvarDre(clienteId, ano, item_id, mes, v, unidade)
    } catch(err) {
      const detail = err?.response?.data?.detail || err?.message || 'verifique o console (F12)'
      toast.error(`Erro ao salvar: ${detail}`)
      carregarDre()
    }
  }

  const total12 = item_id =>
    Object.values(valsCalc[item_id] || {}).reduce((s, v) => s + (v || 0), 0)

  const anos = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 2 + i)
  const nomeUnidade = u => u === 'CONSOLIDADO' ? 'Consolidado' : u

  const btnBarStyle = ativo => ({
    background: ativo ? '#fffbeb' : 'rgba(255,255,255,.15)',
    border: ativo ? '1px solid #fcd34d' : '1px solid rgba(255,255,255,.3)',
    color: ativo ? '#b45309' : '#fff',
    borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  })

  return (
    <div className="page">
      {/* Barra compacta: título + todos os controles em uma linha */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2, marginRight: 4 }}>
          <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--brand)' }}>DRE</span>
          <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '.02em' }}>Demonstração do Resultado</span>
        </div>
        <div style={{ width: 1, height: 30, background: 'var(--border)' }} />
        {isCliente ? (
          <span style={{ fontWeight: 600, fontSize: 13 }}>{clientes.find(c => String(c.id) === clienteId)?.razao_social ?? '—'}</span>
        ) : (
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ fontSize: 12, padding: '5px 10px', minWidth: 220 }}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        )}
        <select value={ano} onChange={e => setAno(Number(e.target.value))} style={{ fontSize: 12, padding: '5px 10px', width: 78 }}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {unidades.length > 0 && (
          <select value={unidade} onChange={e => setUnidade(e.target.value)} style={{ fontSize: 12, padding: '5px 10px', minWidth: 180 }}>
            {unidades.map(u => <option key={u} value={u}>{u === 'CONSOLIDADO' ? 'Consolidado (todas as unidades)' : u}</option>)}
          </select>
        )}
        {dados?.plano && <span className="badge" style={{ fontSize: 10, background: 'var(--brand-light)', color: 'var(--brand)', padding: '2px 8px' }}>{dados.plano.nome}</span>}
        {unidades.length > 0 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{unidades.length} unid.</span>}
      </div>

      {/* Estados vazios */}
      {!clienteId && <div className="empty-state">Selecione um cliente para visualizar o DRE.</div>}
      {clienteId && !loading && dados?.plano === null && (
        <div className="empty-state">Este cliente não possui plano DRE vinculado. Acesse <strong>Modelos &amp; Contas</strong> para vincular uma estrutura.</div>
      )}
      {clienteId && !loading && dados?.plano && unidades.length === 0 && (
        <div className="empty-state">
          Este cliente não possui dados de DRE importados para {ano}.<br />
          O DRE exibe dados históricos importados via planilha Excel.
        </div>
      )}
      {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>Carregando DRE...</div>}

      {/* Tabela */}
      {!loading && dados?.plano && dados.linhas?.length > 0 && unidades.length > 0 && (
        <>
          {/* Barra azul */}
          <div style={{
            background: 'linear-gradient(90deg, var(--brand) 0%, #1a4fa8 100%)',
            color: '#fff', padding: '10px 16px', borderRadius: '8px 8px 0 0',
            display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, flexWrap: 'wrap',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{dados.plano.nome}</span>
            <span style={{ opacity: .7 }}>·</span>
            <span>{ano}</span>
            <span style={{ opacity: .7 }}>·</span>
            <span style={{ fontWeight: 600 }}>{nomeUnidade(unidade)}</span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {l1Ids.length > 0 && (
                <button onClick={toggleTudo} style={btnBarStyle(false)}>
                  {todosRecolhidos ? '▼ Expandir tudo' : '▶ Recolher tudo'}
                </button>
              )}
              {!isCliente && (
                <button onClick={() => setModoEdicao(p => !p)} style={btnBarStyle(modoEdicao)}>
                  {modoEdicao ? '✓ Finalizar edição' : '✏ Editar valores'}
                </button>
              )}
              {!isCliente && (
                <button onClick={() => setModalTemplate(true)} style={btnBarStyle(false)}>⚙ Estrutura</button>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 170px)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4ff', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', minWidth: 300, position: 'sticky', left: 0, background: '#f0f4ff', zIndex: 11, fontWeight: 700, color: 'var(--brand)', fontSize: 11, letterSpacing: '.05em', borderBottom: '2px solid var(--brand)' }}>DESCRIÇÃO</th>
                  {MESES.map((m, i) => (
                    <th key={i} style={{ textAlign: 'right', padding: '8px 8px', minWidth: 80, fontWeight: 600, color: 'var(--text-2)', fontSize: 11, borderBottom: '2px solid var(--brand)', background: '#f0f4ff' }}>{m}</th>
                  ))}
                  <th style={{ textAlign: 'right', padding: '8px 10px', minWidth: 90, borderLeft: '2px solid var(--border)', fontWeight: 700, color: 'var(--brand)', fontSize: 11, borderBottom: '2px solid var(--brand)', background: '#f0f4ff' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {dados.linhas.map(linha => {
                  const nv    = hierarquia.nivel[linha.item_id]
                  const ehNN  = linha.tipo === 'NN' || linha.tipo === null
                  const ehL1  = nv === 1
                  const ehL2  = nv === 2

                  // Visibilidade collapse
                  if (ehL2 && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null
                  if (ehNN && recolhidosL2.has(hierarquia.paiDireto[linha.item_id])) return null
                  if (ehNN && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null

                  const estilo   = estiloLinha(linha.tipo)
                  const vItem    = valsCalc[linha.item_id] || {}
                  const recL1    = ehL1 && recolhidosL1.has(linha.item_id)
                  const recL2    = ehL2 && recolhidosL2.has(linha.item_id)
                  const editavel = modoEdicao && ehNN
                  const numStr   = numeracao[linha.item_id]

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
                          <span style={{ fontSize: 10, opacity: .6, marginRight: 5 }}>
                            {(recL1 || recL2) ? '▶' : '▼'}
                          </span>
                        )}
                        {numStr && (
                          <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'monospace', marginRight: 6, opacity: .7 }}>
                            {numStr}
                          </span>
                        )}
                        {linha.descricao}
                      </td>

                      {Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1
                        const valor = vItem[mes] ?? 0
                        const isEditando = editavel && editando?.item_id === linha.item_id && editando?.mes === mes

                        return (
                          <td key={mes}
                            style={{
                              textAlign: 'right', padding: '5px 8px',
                              fontWeight: estilo.fontWeight, color: corTexto(linha.tipo), fontSize: 12,
                              background: editavel ? 'rgba(59,130,246,.04)' : 'transparent',
                              cursor: editavel ? 'text' : 'default',
                            }}
                            onClick={editavel && !isEditando ? e => { e.stopPropagation(); setEditando({ item_id: linha.item_id, mes }); setEditVal(valor === 0 ? '' : String(valor)) } : undefined}
                          >
                            {isEditando ? (
                              <input type="text" inputMode="decimal" value={editVal}
                                onChange={e => setEditVal(e.target.value)}
                                onBlur={e => handleCelulaSave(linha.item_id, mes, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
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
                        fontWeight: estilo.fontWeight || 600, color: corTexto(linha.tipo),
                        borderLeft: '2px solid var(--border)', background: bgSticky(linha.tipo), fontSize: 12,
                      }}>
                        {(() => { const t = total12(linha.item_id); return t !== 0 ? fmt(t) : '—' })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
            <span>Dados importados — {ano}</span>
            <span style={{ color: 'var(--brand)' }}>■ Subtotais calculados automaticamente</span>
            <span style={{ color: '#16a34a' }}>■ Resultado final</span>
            {modoEdicao && <span style={{ color: '#b45309', fontWeight: 600 }}>✏ Modo edição ativo — clique em uma célula NN para editar</span>}
            {!modoEdicao && l1Ids.length > 0 && <span>Clique no título para expandir/recolher</span>}
          </div>
        </>
      )}

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
