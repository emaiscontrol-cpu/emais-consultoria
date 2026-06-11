import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { orcamentoAPI, planosAPI, bandeiraAPI, dreMotorAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const ANO_ATUAL = new Date().getFullYear()
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const fmt = v =>
  v !== 0 && v !== null && v !== undefined
    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
    : '—'

const fmtPct = v => v === null || isNaN(v) ? '—' : `${v.toFixed(1)}%`

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

function buildPaiDiretoMap(items, idField = 'id') {
  const paiDireto = {}
  const ttPorAgrDot = {}
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

// ── Cálculo de valsCalc puro ──────────────────────────────────────────────────
function computeValsCalc(valsById, hierarquia, linhas) {
  const calc = { ...valsById }
  const byToken = {}
  const linhasOrdenadas = [...(linhas || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))

  for (const l of linhasOrdenadas) {
    if (l.tipo !== 'AN') continue
    const agr = l.agrupamento
    if (agr) {
      if (!byToken[agr]) byToken[agr] = {}
      for (let mes = 1; mes <= 12; mes++)
        byToken[agr][mes] = (byToken[agr][mes] || 0) + (valsById[l.item_id]?.[mes] ?? 0)
    }
    if (l.conta) {
      byToken[l.conta] = {}
      for (let mes = 1; mes <= 12; mes++) byToken[l.conta][mes] = valsById[l.item_id]?.[mes] ?? 0
    }
  }

  for (const l of linhasOrdenadas) {
    const ehTT = l.tipo === 'TT' || l.tipo === 'RES'
    if (!ehTT) continue
    let resultado = null

    if (l.formula) {
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
      const nv = hierarquia.nivel[l.item_id]
      if (nv === 1 || nv === 2) {
        const filhos = nv === 2 ? (hierarquia.filhosL2[l.item_id] || []) : (hierarquia.filhosL1[l.item_id] || [])
        if (filhos.length > 0) {
          resultado = {}
          for (let mes = 1; mes <= 12; mes++)
            resultado[mes] = filhos.reduce((s, id) => s + (valsById[id]?.[mes] ?? 0), 0)
        }
      }
    }

    if (resultado) {
      calc[l.item_id] = resultado
      if (l.agrupamento) byToken[l.agrupamento] = resultado
      if (l.conta)       byToken[l.conta]       = resultado
    }
  }
  return calc
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ vals, color = '#3b82f6', width = 58, height = 16 }) {
  const values = vals || []
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  if (range === 0) return <span style={{ color: '#d1d5db', fontSize: 9 }}>—</span>
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - 2 - ((v - min) / range) * (height - 4)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ verticalAlign: 'middle', overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ── FlagSelector ──────────────────────────────────────────────────────────────
function FlagSelector({ items, selected, onToggle, maxSelect, showAll, onAll, podeEditar, onManage }) {
  if (!items.length) return null
  const todasSel = showAll && items.every(it => selected.has(it.key))
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
      {showAll && (
        <button onClick={onAll}
          style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: todasSel ? '1.5px solid var(--brand)' : '1px solid var(--border)',
            background: todasSel ? 'var(--brand)' : '#fff', color: todasSel ? '#fff' : 'var(--text)' }}>
          Todas
        </button>
      )}
      {items.map(({ key, label, tipo }) => {
        const ativo = selected.has(key)
        const isBand = tipo === 'bandeira'
        const podeToggle = ativo || !maxSelect || selected.size < maxSelect
        const activeColor = isBand ? '#b45309' : 'var(--brand)'
        const activeBg    = isBand ? '#d97706' : 'var(--brand)'
        return (
          <button key={key} onClick={() => podeToggle && onToggle(key)}
            title={!podeToggle ? `Máx. ${maxSelect} selecionadas` : label}
            style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: ativo ? 600 : 400,
              cursor: podeToggle ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4,
              border: ativo ? `1.5px solid ${activeColor}` : '1px solid var(--border)',
              background: ativo ? activeBg : '#fff',
              color: ativo ? '#fff' : (isBand ? '#b45309' : 'var(--text)'),
              opacity: !podeToggle ? 0.45 : 1 }}>
            {isBand && <span style={{ fontSize: 9 }}>🏳</span>}
            {label === 'CONSOLIDADO' ? 'Consolidado' : label}
          </button>
        )
      })}
      {podeEditar && (
        <button onClick={onManage}
          style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10, cursor: 'pointer',
            border: '1px dashed #d1d5db', background: 'transparent', color: '#9ca3af' }}>
          + Bandeira
        </button>
      )}
    </div>
  )
}

// ── CheckboxSelector ──────────────────────────────────────────────────────────
function CheckboxSelector({ items, selected, onToggle, maxSelect, onSelectAll, onManage, podeEditar }) {
  if (!items.length) return null
  const half = Math.ceil(items.length / 2)
  const colunas = items.length > 5 ? [items.slice(0, half), items.slice(half)] : [items]
  return (
    <div style={{ display:'inline-flex', flexDirection:'column', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden', background:'#fff' }}>
      <div style={{ display:'flex', alignItems:'center', padding:'4px 10px', background:'#f8f9fa', borderBottom:'1px solid var(--border)', gap:8 }}>
        {onSelectAll && (
          <button onClick={onSelectAll}
            style={{ fontSize:10, padding:'2px 8px', borderRadius:4, border:'1px solid var(--border)', background:'#fff', cursor:'pointer', color:'var(--text-3)', fontWeight:600 }}>
            Todos
          </button>
        )}
        {selected.size > 0 && <span style={{ fontSize:10, color:'var(--brand)', fontWeight:600 }}>{selected.size} sel.</span>}
        {podeEditar && onManage && (
          <button onClick={onManage}
            style={{ marginLeft:'auto', fontSize:10, padding:'2px 8px', borderRadius:4, border:'1px dashed #d1d5db', background:'transparent', cursor:'pointer', color:'#9ca3af' }}>
            + Bandeira
          </button>
        )}
      </div>
      <div style={{ display:'flex' }}>
        {colunas.map((col, ci) => (
          <div key={ci} style={{ minWidth:160, borderLeft:ci>0?'1px solid var(--border)':'none' }}>
            {col.map((item, idx) => {
              const num = ci * half + idx + 1
              const sel = selected.has(item.key)
              const canToggle = sel || !maxSelect || selected.size < maxSelect
              const isBand = item.tipo === 'bandeira'
              return (
                <div key={item.key} onClick={() => canToggle && onToggle(item.key)}
                  style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px',
                    cursor:canToggle?'pointer':'not-allowed',
                    borderLeft:sel?`3px solid ${isBand?'#d97706':'var(--brand)'}`:'3px solid transparent',
                    background:sel?(isBand?'#fffbeb':'#f0f4ff'):'transparent',
                    opacity:!canToggle?.45:1, borderBottom:'1px solid #f5f5f5', userSelect:'none' }}>
                  <input type="checkbox" checked={sel} readOnly style={{ cursor:'inherit', pointerEvents:'none', accentColor:isBand?'#d97706':'var(--brand)' }} />
                  <span style={{ fontSize:10, color:'#9ca3af', fontFamily:'monospace', minWidth:16, textAlign:'right' }}>{num}</span>
                  <span style={{ fontSize:12, color:sel?(isBand?'#b45309':'var(--brand)'):'var(--text)', fontWeight:sel?600:400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {isBand && <span style={{ fontSize:9, marginRight:2 }}>🏳</span>}
                    {item.label==='CONSOLIDADO'?'Consolidado':item.label}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Modal Gerenciar Bandeiras ─────────────────────────────────────────────────
function ModalGerenciarBandeiras({ clienteId, unidadesDisp, onClose, onAlterado }) {
  const [lista,   setLista]   = useState([])
  const [loading, setLoading] = useState(true)
  const [editId,  setEditId]  = useState(null)  // null | 'novo' | id
  const [form,    setForm]    = useState({ nome: '', unidades: [] })
  const [salv,    setSalv]    = useState(false)

  const carregar = () => {
    setLoading(true)
    bandeiraAPI.listar(clienteId).then(r => setLista(r.data)).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(carregar, [])

  const abrir   = (b = null) => { setEditId(b ? b.id : 'novo'); setForm(b ? { nome: b.nome, unidades: [...b.unidades] } : { nome: '', unidades: [] }) }
  const cancelar = () => setEditId(null)

  const toggleU = u => setForm(f => ({
    ...f, unidades: f.unidades.includes(u) ? f.unidades.filter(x => x !== u) : [...f.unidades, u]
  }))

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error('Nome obrigatório'); return }
    setSalv(true)
    try {
      editId === 'novo' ? await bandeiraAPI.criar(clienteId, form) : await bandeiraAPI.atualizar(editId, form)
      toast.success('Salvo')
      cancelar()
      carregar()
      onAlterado()
    } catch { toast.error('Erro ao salvar') }
    finally { setSalv(false) }
  }

  const deletar = async id => {
    if (!window.confirm('Excluir esta bandeira?')) return
    try { await bandeiraAPI.deletar(id); carregar(); onAlterado(); toast.success('Excluída') }
    catch { toast.error('Erro') }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 10, width: 520, maxHeight: '80vh',
          display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,.22)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Gerenciar Bandeiras</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: 20 }}>Carregando...</div> : (
            <>
              {!lista.length && editId === null && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>
                  Nenhuma bandeira criada. Crie grupos de unidades para análise comparativa.
                </div>
              )}
              {lista.map(b => (
                <div key={b.id} style={{ marginBottom: 8 }}>
                  {editId === b.id ? (
                    <FormBandeira form={form} setForm={setForm} unidades={unidadesDisp}
                      onToggle={toggleU} onSalvar={salvar} onCancel={cancelar} salvando={salv} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        background: '#fafafa', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>🏳 {b.nome}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.unidades.join(' · ') || '—'}
                      </span>
                      <button className="btn btn-sm" onClick={() => abrir(b)} style={{ padding: '3px 10px' }}>Editar</button>
                      <button onClick={() => deletar(b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16 }}>×</button>
                    </div>
                  )}
                </div>
              ))}
              {editId === 'novo' && (
                <FormBandeira form={form} setForm={setForm} unidades={unidadesDisp}
                  onToggle={toggleU} onSalvar={salvar} onCancel={cancelar} salvando={salv} />
              )}
            </>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          {editId === null && <button className="btn btn-primary btn-sm" onClick={() => abrir()}>+ Nova Bandeira</button>}
          <button className="btn btn-sm" onClick={onClose} style={{ marginLeft: 'auto' }}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

function FormBandeira({ form, setForm, unidades, onToggle, onSalvar, onCancel, salvando }) {
  return (
    <div style={{ padding: 14, background: '#f0f4ff', border: '1px solid var(--brand)', borderRadius: 6 }}>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nome da Bandeira</label>
        <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
          placeholder="ex: Região Norte"
          style={{ fontSize: 13, padding: '5px 8px', width: '100%', borderRadius: 5, border: '1px solid var(--border)', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Unidades</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {unidades.filter(u => u !== 'CONSOLIDADO').map(u => {
            const sel = form.unidades.includes(u)
            return (
              <button key={u} onClick={() => onToggle(u)}
                style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
                  border: sel ? '1.5px solid var(--brand)' : '1px solid var(--border)',
                  background: sel ? 'var(--brand)' : '#fff', color: sel ? '#fff' : 'var(--text)' }}>
                {u}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={onSalvar} disabled={salvando}>{salvando ? '...' : 'Salvar'}</button>
        <button className="btn btn-sm" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

// ── Modal Template DRE ────────────────────────────────────────────────────────
function ModalTemplateDRE({ planoId, planoNome, onClose, onReload }) {
  const [itens, setItens] = useState([])
  const [formulas, setFormulas] = useState({}) // item_id → {formula_id, tipo_formula, componentes, auto_gerada}
  const [loading, setLoading] = useState(true)
  const [gerandoForm, setGerandoForm] = useState(false)
  const [editKey, setEditKey] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [novaLinha, setNovaLinha] = useState({ descricao: '', tipo: 'TT', agrupamento: '', conta: '', paiId: '' })
  const [salvandoNova, setSalvandoNova] = useState(false)
  const [sugestoes, setSugestoes] = useState([])
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false)
  const [carregandoSug, setCarregandoSug] = useState(false)
  const [aceitosSug, setAceitosSug] = useState(new Set()) // set de linha_ids rejeitados

  const carregarDados = () => {
    setLoading(true)
    Promise.all([
      planosAPI.obter(planoId),
      dreMotorAPI.listarFormulas(planoId).catch(() => ({ data: [] })),
    ]).then(([rp, rf]) => {
      const dreItens = (rp.data.itens || []).filter(i =>
        i.modulo && i.modulo.toUpperCase().split(',').map(s => s.trim()).includes('D')
      )
      setItens(dreItens.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))
      const fm = {}
      ;(rf.data || []).forEach(f => {
        fm[f.item_id] = { formula_id: f.formula_id, tipo_formula: f.tipo_formula, componentes: f.componentes || [], auto_gerada: f.auto_gerada }
      })
      setFormulas(fm)
    })
      .catch(() => toast.error('Erro ao carregar template'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregarDados() }, [planoId])

  const gerarFormulas = async () => {
    const temFormulas = Object.keys(formulas).length > 0
    if (temFormulas) {
      const ok = window.confirm(
        'Isso vai substituir todas as fórmulas existentes neste template.\n\nContinuar?'
      )
      if (!ok) return
    }
    setGerandoForm(true)
    try {
      const r = await dreMotorAPI.gerarFormulas(planoId, true)
      toast.success(`${r.data.geradas} fórmulas geradas`)
      carregarDados()
    } catch { toast.error('Erro ao gerar fórmulas') }
    finally { setGerandoForm(false) }
  }

  const toggleSinal = async (itemId, agrupamento) => {
    const f = formulas[itemId]
    if (!f?.formula_id) return
    const novos = f.componentes.map(c =>
      c.agrupamento === agrupamento ? { ...c, sinal: c.sinal === 1 ? -1 : 1 } : c
    )
    try {
      await dreMotorAPI.atualizarFormula(f.formula_id, { componentes: novos, auto_gerada: false })
      setFormulas(prev => ({ ...prev, [itemId]: { ...prev[itemId], componentes: novos, auto_gerada: false } }))
    } catch { toast.error('Erro ao alterar sinal') }
  }

  const sugerirAgrupamentos = async () => {
    setCarregandoSug(true)
    try {
      const r = await dreMotorAPI.sugerirAgrupamentos(planoId)
      const sug = r.data.sugestoes || []
      setSugestoes(sug)
      setMostrarSugestoes(true)
      if (!sug.length) toast('Nenhuma sugestão encontrada — todos os TTs já têm agrupamento', { icon: 'ℹ️' })
    } catch { toast.error('Erro ao buscar sugestões') }
    finally { setCarregandoSug(false) }
  }

  const aceitarSugestao = async (sug) => {
    try {
      await planosAPI.atualizarItem(planoId, sug.linha_id, { agrupamento: sug.agrupamento_sugerido })
      setItens(prev => prev.map(i => i.id === sug.linha_id ? { ...i, agrupamento: sug.agrupamento_sugerido } : i))
      setSugestoes(prev => prev.filter(s => s.linha_id !== sug.linha_id))
      toast.success(`Agrupamento ${sug.agrupamento_sugerido} aplicado`)
      onReload()
    } catch { toast.error('Erro ao aceitar sugestão') }
  }

  const aceitarAlternativa = async (sug, agr) => {
    try {
      await planosAPI.atualizarItem(planoId, sug.linha_id, { agrupamento: agr })
      setItens(prev => prev.map(i => i.id === sug.linha_id ? { ...i, agrupamento: agr } : i))
      setSugestoes(prev => prev.filter(s => s.linha_id !== sug.linha_id))
      toast.success(`Agrupamento ${agr} aplicado`)
      onReload()
    } catch { toast.error('Erro ao aceitar alternativa') }
  }

  const aceitarTodas = async () => {
    for (const sug of sugestoes) {
      if (!aceitosSug.has(sug.linha_id)) await aceitarSugestao(sug)
    }
    setSugestoes([])
    setMostrarSugestoes(false)
  }

  const paiDiretoMap = useMemo(() => buildPaiDiretoMap(itens, 'id'), [itens])
  const ttsList = useMemo(() => itens.filter(i => i.tipo === 'TT' || i.tipo === 'RES'), [itens])

  const iniciarEdicao = (item, field) => { setEditKey(`${item.id}-${field}`); setEditVal(item[field] ?? '') }

  const salvarCampo = async (item, field) => {
    const val = (field === 'tipo' || field === 'conta') ? (editVal || null) : editVal
    setEditKey(null)
    try {
      await planosAPI.atualizarItem(planoId, item.id, { [field]: val })
      setItens(prev => prev.map(i => i.id === item.id ? { ...i, [field]: val } : i))
      onReload()
    } catch { toast.error('Erro ao salvar') }
  }

  const excluirItem = async item => {
    if (!window.confirm(`Excluir "${item.descricao}"?\nOs valores históricos desta linha serão removidos permanentemente.`)) return
    try {
      await planosAPI.excluirItem(planoId, item.id)
      setItens(prev => prev.filter(i => i.id !== item.id))
      onReload()
      toast.success('Linha removida')
    } catch { toast.error('Erro ao excluir') }
  }

  const moverItem = async (item, direcao) => {
    const idx = itens.findIndex(i => i.id === item.id)
    const vizinho = direcao === 'up' ? itens[idx - 1] : itens[idx + 1]
    if (!vizinho) return
    const ordemA = item.ordem ?? idx
    const ordemB = vizinho.ordem ?? (direcao === 'up' ? idx - 1 : idx + 1)
    try {
      await Promise.all([
        planosAPI.atualizarItem(planoId, item.id,    { ordem: ordemB }),
        planosAPI.atualizarItem(planoId, vizinho.id, { ordem: ordemA }),
      ])
      setItens(prev => {
        const next = prev.map(i => {
          if (i.id === item.id)    return { ...i, ordem: ordemB }
          if (i.id === vizinho.id) return { ...i, ordem: ordemA }
          return i
        })
        return next.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      })
      onReload()
    } catch { toast.error('Erro ao reordenar') }
  }

  const handlePaiChange = paiId => {
    const pai = ttsList.find(t => String(t.id) === paiId)
    setNovaLinha(p => ({ ...p, paiId, agrupamento: pai ? (pai.agrupamento || '') : '' }))
  }

  const adicionarLinha = async () => {
    if (!novaLinha.descricao.trim()) { toast.error('Descrição obrigatória'); return }
    setSalvandoNova(true)
    try {
      const mesmoAgr = novaLinha.agrupamento ? itens.filter(i => i.agrupamento === novaLinha.agrupamento) : []
      const ordemBase = mesmoAgr.length > 0
        ? Math.max(...mesmoAgr.map(i => i.ordem ?? 0))
        : Math.max(0, ...itens.map(i => i.ordem ?? 0))
      const r = await planosAPI.adicionarItem(planoId, {
        descricao: novaLinha.descricao, tipo: novaLinha.tipo,
        agrupamento: novaLinha.agrupamento || null,
        conta: novaLinha.conta || null, modulo: 'D', ordem: ordemBase + 1,
      })
      setItens(prev => [...prev, r.data].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))
      setNovaLinha({ descricao: '', tipo: 'NN', agrupamento: '', conta: '', paiId: '' })
      onReload()
      toast.success('Linha adicionada')
    } catch { toast.error('Erro ao adicionar linha') }
    finally { setSalvandoNova(false) }
  }

  const tipoBadgeStyle = (tipo, clicavel = true) => ({
    display: 'inline-block', cursor: clicavel ? 'pointer' : 'default', padding: '2px 7px',
    borderRadius: 4, fontSize: 11, fontWeight: 600,
    background: tipo === 'TT' ? '#e8f0ff' : tipo === 'RES' ? '#dcfce7' : tipo === 'AN' ? '#f0f0f0' : '#f5f5f5',
    color: tipo === 'TT' ? 'var(--brand)' : tipo === 'RES' ? '#16a34a' : tipo === 'AN' ? 'var(--text-3)' : 'var(--text-2)',
  })

  const inputSt = { fontSize: 12, width: '100%', padding: '3px 5px', border: '1px solid var(--brand)', borderRadius: 4, outline: 'none' }
  const cellSt  = { cursor: 'pointer', display: 'block', minHeight: 20, padding: '1px 2px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', overflowY: 'auto' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 1020, boxShadow: '0 8px 40px rgba(0,0,0,.22)', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Editar Template DRE</span>
          <span style={{ fontSize: 11, background: 'var(--brand-light)', color: 'var(--brand)', padding: '2px 8px', borderRadius: 4 }}>{planoNome}</span>
          <span style={{ fontSize: 11, color: '#b45309', background: '#fffbeb', border: '1px solid #fcd34d', padding: '2px 8px', borderRadius: 4 }}>
            ⚠ Alterações afetam todos os clientes com este plano
          </span>
          <button onClick={gerarFormulas} disabled={gerandoForm}
            style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px', background: gerandoForm ? '#e5e7eb' : '#f0f4ff', color: 'var(--brand)', border: '1px solid var(--brand)', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            {gerandoForm ? '...' : '⚙ Gerar Fórmulas'}
          </button>
          <button onClick={sugerirAgrupamentos} disabled={carregandoSug}
            style={{ fontSize: 12, padding: '5px 12px', background: carregandoSug ? '#e5e7eb' : '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            {carregandoSug ? '...' : '🤖 Sugerir Agrupamentos'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1 }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Carregando...</div>
        ) : (
          <div style={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4ff', position: 'sticky', top: 0, zIndex: 5 }}>
                  {[['Nível',75],['Agrupamento',140],['Descrição',null],['Conta',100],['Fórmula',160],['Título Pai',160],['',80]].map(([h,w],i) => (
                    <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--brand)', fontSize: 11, letterSpacing: '.04em', borderBottom: '2px solid var(--brand)', width: w||undefined }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => {
                  const ehTT = item.tipo === 'TT' || item.tipo === 'RES'
                  const ehAN = item.tipo === 'AN'
                  const paiId   = paiDiretoMap[item.id]
                  const paiNome = paiId ? itens.find(t => t.id === paiId)?.descricao : null

                  const fItem = formulas[item.id]

                  // Nível: usa nivel do DB → tipo_formula como hint → fallback por conta
                  const nivelItem = item.nivel || (
                    ehAN ? 3 :
                    fItem?.tipo_formula === 'AGRUPAMENTOS' ? 1 :
                    fItem?.tipo_formula === 'FILHOS' ? 2 :
                    ['TT','RES'].includes(item.tipo)
                      ? ((item.conta||'').replace(/0+$/,'').length <= 1 ? 1 : 2)
                      : 3
                  )

                  // Visual idêntico ao Plano de Contas
                  const N_BADGE = nivelItem === 1
                    ? { label: 'N1', bg: '#1e40af', color: '#fff' }
                    : nivelItem === 2
                      ? { label: 'N2', bg: '#3b82f6', color: '#fff' }
                      : { label: 'N3', bg: '#e5e7eb', color: '#6b7280' }

                  const rowBg = nivelItem === 1
                    ? 'linear-gradient(90deg, #dbeafe 0%, #eff6ff 60%, transparent 100%)'
                    : ehAN ? '#fafafa' : ''

                  const rowBorder = nivelItem === 1
                    ? '3px solid #1d4ed8'
                    : nivelItem === 2
                      ? '2px solid #bfdbfe'
                      : '3px solid transparent'

                  const celFormulaAN = (
                    <td style={{ padding: '3px 12px' }}>
                      <span style={{ fontSize: 10, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: 4 }}>
                        ↓ Valor importado
                      </span>
                    </td>
                  )

                  const celFormulaN2 = (
                    <td style={{ padding: '4px 12px' }}>
                      {fItem?.componentes?.length > 0
                        ? <span style={{ fontSize: 10, background: '#eff6ff', color: 'var(--brand)', border: '1px solid #bfdbfe', padding: '2px 6px', borderRadius: 4 }}>
                            Σ {fItem.componentes.length} filho{fItem.componentes.length !== 1 ? 's' : ''}
                          </span>
                        : <span style={{ fontSize: 10, color: '#d1d5db' }}>Σ filhos</span>
                      }
                    </td>
                  )

                  const celFormulaN1 = (
                    <td style={{ padding: '4px 12px' }}>
                      {fItem?.componentes?.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {fItem.componentes.map((c, ci) => (
                            <span key={ci} onClick={() => toggleSinal(item.id, c.agrupamento)}
                              title={`Clique para ${c.sinal === 1 ? 'subtrair' : 'somar'}`}
                              style={{
                                cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                background: c.sinal === 1 ? '#e8f0ff' : '#fff0f0',
                                color: c.sinal === 1 ? 'var(--brand)' : '#dc2626',
                                border: `1px solid ${c.sinal === 1 ? '#bfdbfe' : '#fca5a5'}`,
                                fontFamily: 'monospace',
                              }}>
                              {c.sinal === 1 ? '+' : '−'} {c.agrupamento}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: 10, color: '#d1d5db' }}>sem fórmula</span>
                      )}
                    </td>
                  )

                  if (ehAN) return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: rowBg, borderLeft: rowBorder, opacity: .8 }}>
                      <td style={{ padding: '3px 12px' }}>
                        <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:N_BADGE.bg,color:N_BADGE.color }}>{N_BADGE.label}</span>
                      </td>
                      <td style={{ padding: '3px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)' }}>{item.agrupamento || '—'}</td>
                      <td style={{ padding: '3px 12px', paddingLeft: 40 }}
                        title="Descrição da conta contábil — não editável">
                        <span style={{ fontSize: 12, color: 'var(--text-2)', cursor: 'default' }}>
                          <span style={{ marginRight:4, opacity:.35, userSelect:'none' }}>└</span>
                          {item.descricao}
                        </span>
                      </td>
                      <td style={{ padding: '3px 12px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)' }}>{item.conta || '—'}</td>
                      {celFormulaAN}
                      <td style={{ padding: '3px 12px' }}><span style={{ fontSize: 11, color: paiNome ? '#374151' : '#d1d5db' }}>{paiNome?.slice(0,35) || '—'}</span></td>
                      <td style={{ padding: '3px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={() => moverItem(item,'up')} disabled={idx===0} style={{ background:'none',border:'none',cursor:idx===0?'default':'pointer',color:idx===0?'#d1d5db':'var(--brand)',fontSize:14,padding:'1px 3px' }}>↑</button>
                        <button onClick={() => moverItem(item,'down')} disabled={idx===itens.length-1} style={{ background:'none',border:'none',cursor:idx===itens.length-1?'default':'pointer',color:idx===itens.length-1?'#d1d5db':'var(--brand)',fontSize:14,padding:'1px 3px' }}>↓</button>
                        <button onClick={() => excluirItem(item)} style={{ background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:16,lineHeight:1,padding:'1px 3px' }}>×</button>
                      </td>
                    </tr>
                  )

                  // Célula de fórmula determinada pelo tipo_formula real do banco
                  const formulaColuna = fItem?.tipo_formula === 'AGRUPAMENTOS' ? celFormulaN1
                    : fItem?.tipo_formula === 'FILHOS' ? celFormulaN2
                    : nivelItem === 1 ? celFormulaN1 : celFormulaN2

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: rowBg, borderLeft: rowBorder }}>
                      <td style={{ padding: '4px 12px' }}>
                        <span style={{ fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:N_BADGE.bg,color:N_BADGE.color }}>{N_BADGE.label}</span>
                      </td>
                      <td style={{ padding: '4px 12px' }}>
                        <span style={{ fontFamily:'monospace',fontSize:11,color:item.agrupamento?'var(--text-2)':'#d1d5db' }}>{item.agrupamento||'—'}</span>
                      </td>
                      <td style={{ padding: '4px 12px', paddingLeft: nivelItem === 2 ? 20 : 8 }}>
                        {editKey === `${item.id}-descricao` ? (
                          <input value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={()=>salvarCampo(item,'descricao')}
                            onKeyDown={e=>{if(e.key==='Enter')salvarCampo(item,'descricao');if(e.key==='Escape')setEditKey(null)}}
                            autoFocus style={inputSt} />
                        ) : (
                          <span onClick={()=>iniciarEdicao(item,'descricao')} style={{...cellSt, fontWeight:700,
                            fontSize: nivelItem===1 ? 13 : 12,
                            textTransform: 'uppercase',
                            letterSpacing: nivelItem===1 ? '0.04em' : 'normal',
                            color: nivelItem===1 ? '#1d4ed8' : '#2563eb',
                          }}>
                            {nivelItem === 2 && <span style={{ marginRight:4, opacity:.4, userSelect:'none' }}>└</span>}
                            {item.descricao}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '4px 12px' }}>
                        {editKey === `${item.id}-conta` ? (
                          <input value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={()=>salvarCampo(item,'conta')}
                            onKeyDown={e=>{if(e.key==='Enter')salvarCampo(item,'conta');if(e.key==='Escape')setEditKey(null)}}
                            autoFocus style={{...inputSt,fontFamily:'monospace'}} />
                        ) : (
                          <span onClick={()=>iniciarEdicao(item,'conta')} style={{...cellSt,color:'var(--text-3)',fontFamily:'monospace',fontSize:11}}>{item.conta||'—'}</span>
                        )}
                      </td>
                      {formulaColuna}
                      <td style={{ padding: '4px 12px' }}>
                        <span style={{ fontSize:11,color:paiNome?'var(--text-3)':'#d1d5db',fontStyle:'italic' }}>
                          {paiNome?`↳ ${paiNome.slice(0,32)}`:'—'}
                        </span>
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button onClick={()=>moverItem(item,'up')} disabled={idx===0} style={{background:'none',border:'none',cursor:idx===0?'default':'pointer',color:idx===0?'#d1d5db':'var(--brand)',fontSize:14,padding:'1px 3px'}}>↑</button>
                        <button onClick={()=>moverItem(item,'down')} disabled={idx===itens.length-1} style={{background:'none',border:'none',cursor:idx===itens.length-1?'default':'pointer',color:idx===itens.length-1?'#d1d5db':'var(--brand)',fontSize:14,padding:'1px 3px'}}>↓</button>
                        <button onClick={()=>excluirItem(item)} style={{background:'none',border:'none',cursor:'pointer',color:'#dc2626',fontSize:16,lineHeight:1,padding:'1px 3px'}}>×</button>
                      </td>
                    </tr>
                  )
                })}

                <tr style={{ background: '#f9fafb', borderTop: '2px dashed var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <select value={novaLinha.tipo} onChange={e=>setNovaLinha(p=>({...p,tipo:e.target.value}))} style={{fontSize:12,width:72}}>
                      <option value="TT">TT</option>
                      <option value="RES">RES</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.agrupamento} onChange={e=>setNovaLinha(p=>({...p,agrupamento:e.target.value}))}
                      placeholder="Agrupamento" style={{fontSize:12,width:'100%',padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,fontFamily:'monospace'}} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.descricao} onChange={e=>setNovaLinha(p=>({...p,descricao:e.target.value}))}
                      placeholder="Descrição *" onKeyDown={e=>e.key==='Enter'&&adicionarLinha()}
                      style={{fontSize:12,width:'100%',padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4}} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={novaLinha.conta} onChange={e=>setNovaLinha(p=>({...p,conta:e.target.value}))}
                      placeholder="Conta" style={{fontSize:12,width:'100%',padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4,fontFamily:'monospace'}} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <select value={novaLinha.paiId} onChange={e=>handlePaiChange(e.target.value)}
                      style={{fontSize:12,width:'100%',padding:'4px 6px',border:'1px solid var(--border)',borderRadius:4}}>
                      <option value="">— sem pai —</option>
                      {ttsList.map(t=><option key={t.id} value={t.id}>{t.descricao.slice(0,48)}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <button onClick={adicionarLinha} disabled={salvandoNova||!novaLinha.descricao.trim()}
                      style={{background:'var(--brand)',color:'#fff',border:'none',borderRadius:6,padding:'5px 10px',fontSize:12,cursor:'pointer',fontWeight:600,opacity:(!novaLinha.descricao.trim()||salvandoNova)?.45:1}}>
                      {salvandoNova?'...':'+ Add'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {itens.length} linha{itens.length!==1?'s':''} · N1/N2/N3 detectados automaticamente pelo banco
          </span>
          <button onClick={onClose} style={{padding:'8px 24px',background:'var(--brand)',color:'#fff',border:'none',borderRadius:6,fontSize:13,cursor:'pointer',fontWeight:600}}>Fechar</button>
        </div>
      </div>

      {/* Painel lateral de sugestões de agrupamento */}
      {mostrarSugestoes && (
        <div style={{ position:'fixed', top:0, right:0, bottom:0, width:380, background:'#fff',
          boxShadow:'-4px 0 24px rgba(0,0,0,.18)', zIndex:1100, display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontWeight:700, fontSize:14 }}>🤖 Sugestões de Agrupamento</span>
            <span style={{ fontSize:11, background:'#f0fdf4', color:'#16a34a', padding:'2px 8px', borderRadius:4 }}>
              {sugestoes.length} restante{sugestoes.length!==1?'s':''}
            </span>
            <button onClick={()=>setMostrarSugestoes(false)} style={{ marginLeft:'auto', background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text-3)' }}>×</button>
          </div>

          <div style={{ flex:1, overflowY:'auto', padding:12 }}>
            {sugestoes.length === 0 && (
              <div style={{ padding:20, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
                ✅ Todas as sugestões foram aplicadas
              </div>
            )}
            {sugestoes.map((sug, i) => {
              const cor = sug.confianca >= 90 ? { bg:'#f0fdf4', border:'#bbf7d0', badge:'#16a34a' }
                : sug.confianca >= 70 ? { bg:'#fffbeb', border:'#fcd34d', badge:'#b45309' }
                : { bg:'#fff0f0', border:'#fca5a5', badge:'#dc2626' }
              return (
                <div key={sug.linha_id} style={{ border:`1px solid ${cor.border}`, borderRadius:8, padding:12,
                  background:cor.bg, marginBottom:10 }}>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:2 }}>Linha:</div>
                  <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>{sug.descricao_linha}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, background:'#e8f0ff', color:'var(--brand)', padding:'3px 8px', borderRadius:4 }}>
                      {sug.agrupamento_sugerido}
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, background:cor.badge, color:'#fff', padding:'2px 7px', borderRadius:99 }}>
                      {sug.confianca}%
                    </span>
                  </div>
                  {sug.descricao_sugerida !== sug.descricao_linha && (
                    <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8, fontStyle:'italic' }}>
                      Baseado em: "{sug.descricao_sugerida}"
                    </div>
                  )}
                  {sug.alternativas?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
                      <span style={{ fontSize:10, color:'var(--text-3)' }}>Alt:</span>
                      {sug.alternativas.map(alt => (
                        <button key={alt} onClick={() => aceitarAlternativa(sug, alt)}
                          style={{ fontSize:10, padding:'2px 7px', background:'#f0f4ff', color:'var(--brand)', border:'1px solid var(--brand)', borderRadius:4, cursor:'pointer' }}>
                          {alt}
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>aceitarSugestao(sug)}
                      style={{ flex:1, padding:'6px', background:'#16a34a', color:'#fff', border:'none', borderRadius:6, fontWeight:700, cursor:'pointer', fontSize:12 }}>
                      ✓ Aceitar
                    </button>
                    <button onClick={()=>setSugestoes(prev=>prev.filter(s=>s.linha_id!==sug.linha_id))}
                      style={{ flex:1, padding:'6px', background:'none', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:6, fontWeight:600, cursor:'pointer', fontSize:12 }}>
                      ✗ Rejeitar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {sugestoes.length > 1 && (
            <div style={{ padding:12, borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
              <button onClick={aceitarTodas}
                style={{ flex:1, padding:'9px', background:'var(--brand)', color:'#fff', border:'none', borderRadius:7, fontWeight:700, cursor:'pointer', fontSize:13 }}>
                ✓ Aceitar Todas ({sugestoes.length})
              </button>
              <button onClick={()=>setMostrarSugestoes(false)}
                style={{ padding:'9px 14px', background:'none', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', fontSize:13 }}>
                Fechar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── DRE principal ─────────────────────────────────────────────────────────────
export default function DRE() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isCliente    = usuario?.perfil === 'analista'
  const podeEditar   = !isCliente

  const [clientes,  setClientes]  = useState([])
  const [clienteId, setClienteId] = useState(location.state?.clienteId ? String(location.state.clienteId) : '')
  const [ano,       setAno]       = useState(ANO_ATUAL - 1)
  const [unidades,  setUnidades]  = useState([])
  const [bandeiras, setBandeiras] = useState([])

  // Modelo 1 — unidade única
  const [unidade,   setUnidade]   = useState('CONSOLIDADO')
  const [dados,     setDados]     = useState(null)
  const [valsById,  setValsById]  = useState({})
  const [loading,   setLoading]   = useState(false)

  // Modelos 2 e 3 — multi-unidade
  const [modelo,          setModelo]          = useState(1)
  const [selFlags,        setSelFlags]        = useState(new Set())
  const [dadosMulti,      setDadosMulti]      = useState({})
  const [loadingMulti,    setLoadingMulti]    = useState(false)

  // Opções visuais
  const [mostrarPct,      setMostrarPct]      = useState(false)
  const [compTipo,        setCompTipo]        = useState('unidades') // 'unidades' | 'meses'
  const [compMesFiltro,   setCompMesFiltro]   = useState(null)        // null | 1-12 (modo 2 unidades)
  const [compMes1,        setCompMes1]        = useState(null)        // 1-12 (modo 2 meses)
  const [compMes2,        setCompMes2]        = useState(null)        // 1-12 (modo 2 meses)
  const [recolhidosL1,    setRecolhidosL1]    = useState(new Set())
  const [recolhidosL2,    setRecolhidosL2]    = useState(new Set())
  const [modoEdicao,      setModoEdicao]      = useState(false)
  const [editando,        setEditando]        = useState(null)
  const [editVal,         setEditVal]         = useState('')
  const [modalTemplate,   setModalTemplate]   = useState(false)
  const [modalBandeiras,  setModalBandeiras]  = useState(false)

  const anos = Array.from({ length: 7 }, (_, i) => ANO_ATUAL - 4 + i)

  // ── Items de flag: unidades reais + bandeiras ───────────────────────────────
  const flagItems = useMemo(() => {
    const items = unidades.map(u => ({ key: u, label: u, tipo: 'unit' }))
    bandeiras.forEach(b => items.push({ key: `band:${b.id}`, label: b.nome, tipo: 'bandeira', unidades: b.unidades }))
    return items
  }, [unidades, bandeiras])

  // ── Hierarquia ──────────────────────────────────────────────────────────────
  const hierarquia = useMemo(() => {
    const nivel = {}, paiL1 = {}, paiDireto = {}, filhosL2 = {}, filhosL1 = {}
    const ttPorAgrSimples = {}, ttPorAgrDot = {}

    for (const l of dados?.linhas || []) {
      if (l.tipo !== 'TT' && l.tipo !== 'RES') continue
      const agr = l.agrupamento || ''
      if (agr.includes('.')) { if (ttPorAgrDot[agr] == null) ttPorAgrDot[agr] = l.item_id }
      else                   { if (ttPorAgrSimples[agr] == null) ttPorAgrSimples[agr] = l.item_id }
    }

    const l1DeAgr = {}
    let ttUltimo = null
    for (const l of dados?.linhas || []) {
      if (l.tipo === 'TT' || l.tipo === 'RES') {
        const agr = l.agrupamento || String(l.item_id)
        const dotIdx = agr.indexOf('.')
        if (dotIdx > 0) {
          const parentAgr = agr.slice(0, dotIdx)
          const parentId  = ttPorAgrSimples[parentAgr]
          if (parentId != null) { nivel[l.item_id] = 2; paiL1[l.item_id] = parentId; ttUltimo = l.item_id; continue }
        }
        const agrSimples = agr
        if (!l1DeAgr[agrSimples]) { l1DeAgr[agrSimples] = l.item_id; nivel[l.item_id] = 1 }
        else                      { nivel[l.item_id] = 2; paiL1[l.item_id] = l1DeAgr[agrSimples] }
        ttUltimo = l.item_id
      } else if (l.tipo === 'AN') {
        const agr = l.agrupamento || ''
        const pai = (agr.includes('.') && ttPorAgrDot[agr] != null) ? ttPorAgrDot[agr] : ttUltimo
        if (pai == null) continue
        paiDireto[l.item_id] = pai
        if (nivel[pai] === 2) {
          const l1id = paiL1[pai]
          paiL1[l.item_id] = l1id
          filhosL2[pai] = filhosL2[pai] || []; filhosL2[pai].push(l.item_id)
          if (l1id != null) { filhosL1[l1id] = filhosL1[l1id] || []; filhosL1[l1id].push(l.item_id) }
        } else {
          paiL1[l.item_id] = pai
          filhosL1[pai] = filhosL1[pai] || []; filhosL1[pai].push(l.item_id)
        }
      }
    }
    return { nivel, paiL1, paiDireto, filhosL2, filhosL1 }
  }, [dados?.linhas])

  const l1Ids = useMemo(() => (dados?.linhas||[]).filter(l => hierarquia.nivel[l.item_id]===1).map(l=>l.item_id), [dados?.linhas, hierarquia])
  const l2Ids = useMemo(() => (dados?.linhas||[]).filter(l => hierarquia.nivel[l.item_id]===2).map(l=>l.item_id), [dados?.linhas, hierarquia])

  const todosRecolhidos = l1Ids.length > 0 && l1Ids.every(id => recolhidosL1.has(id))
  const toggleL1  = id => setRecolhidosL1(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleL2  = id => setRecolhidosL2(p => { const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })
  const toggleTudo = () => {
    if (todosRecolhidos) { setRecolhidosL1(new Set()); setRecolhidosL2(new Set()) }
    else                 { setRecolhidosL1(new Set(l1Ids)); setRecolhidosL2(new Set(l2Ids)) }
  }

  // ── valsCalc Modelo 1 ───────────────────────────────────────────────────────
  const valsCalc = useMemo(
    () => computeValsCalc(valsById, hierarquia, dados?.linhas),
    [valsById, hierarquia, dados?.linhas]
  )

  // ── Numeração hierárquica ───────────────────────────────────────────────────
  const numeracao = useMemo(() => {
    const nums = {}, ctrs = {}
    for (const l of dados?.linhas || []) {
      const nv   = hierarquia.nivel[l.item_id]
      const ehAN = l.tipo === 'AN'
      if (nv === 1) {
        ctrs['root'] = (ctrs['root']||0) + 1; nums[l.item_id] = `${ctrs['root']}`; ctrs[l.item_id] = 0
      } else if (nv === 2) {
        const pid = hierarquia.paiL1[l.item_id]
        if (pid != null && nums[pid] != null) { ctrs[pid] = (ctrs[pid]||0) + 1; nums[l.item_id] = `${nums[pid]}.${ctrs[pid]}`; ctrs[l.item_id] = 0 }
      } else if (ehAN) {
        const pid = hierarquia.paiDireto[l.item_id]
        if (pid != null && nums[pid] != null) { ctrs[pid] = (ctrs[pid]||0) + 1; nums[l.item_id] = `${nums[pid]}.${ctrs[pid]}` }
      }
    }
    return nums
  }, [dados?.linhas, hierarquia])

  // ── % base ──────────────────────────────────────────────────────────────────
  // Encontra a linha de Faturamento Líquido por prioridade:
  // 1) agrupamento === 'TOTAL_RECEITA'  2) descricao contém FATURAMENTO + LIQ  3) primeiro RES
  const percBaseItem = useMemo(() => {
    const linhas = dados?.linhas || []
    const norm   = s => (s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    return (
      linhas.find(l => l.agrupamento === 'TOTAL_RECEITA') ||
      linhas.find(l => norm(l.descricao).includes('FATURAMENTO') && norm(l.descricao).includes('LIQ')) ||
      linhas.find(l => l.tipo === 'RES') ||
      null
    )
  }, [dados?.linhas])

  const percBaseTotal = useMemo(() => {
    if (!percBaseItem) return 0
    return Object.values(valsCalc[percBaseItem.item_id] || {}).reduce((s,v)=>s+(v||0), 0)
  }, [percBaseItem, valsCalc])

  const getPct = item_id => {
    if (!percBaseTotal) return null
    const t = Object.values(valsCalc[item_id]||{}).reduce((s,v)=>s+(v||0), 0)
    return (t / percBaseTotal) * 100
  }

  // ── valsCalc por unidade (Modelos 2/3) ──────────────────────────────────────
  const valsCalcMulti = useMemo(() => {
    const result = {}
    for (const [key, vb] of Object.entries(dadosMulti)) {
      result[key] = computeValsCalc(vb, hierarquia, dados?.linhas)
    }
    return result
  }, [dadosMulti, hierarquia, dados?.linhas])

  const totalAnual = (vc, item_id) => Object.values(vc[item_id]||{}).reduce((s,v)=>s+(v||0), 0)

  const percBaseTotalMulti = useMemo(() => {
    if (!percBaseItem) return {}
    const result = {}
    for (const [key, vc] of Object.entries(valsCalcMulti))
      result[key] = totalAnual(vc, percBaseItem.item_id)
    return result
  }, [percBaseItem, valsCalcMulti])

  const getPctMulti = (key, item_id) => {
    const base = percBaseTotalMulti[key]
    if (!base) return null
    return (totalAnual(valsCalcMulti[key] || {}, item_id) / base) * 100
  }

  const percBaseMensal = useMemo(() => {
    if (!percBaseItem) return {}
    const res = {}
    for (let m = 1; m <= 12; m++) res[m] = valsCalc[percBaseItem.item_id]?.[m] ?? 0
    return res
  }, [percBaseItem, valsCalc])

  const getPctMensal = (item_id, mes) => {
    const base = percBaseMensal[mes]
    if (!base) return null
    return ((valsCalc[item_id]?.[mes] ?? 0) / base) * 100
  }

  const getValComp = (key, item_id, mes) => {
    const vc = valsCalcMulti[key]
    if (!vc) return null
    if (mes === null) return totalAnual(vc, item_id)
    return vc[item_id]?.[mes] ?? 0
  }

  const getPctComp = (key, item_id, mes) => {
    if (!percBaseItem || !valsCalcMulti[key]) return null
    if (mes === null) return getPctMulti(key, item_id)
    const base = valsCalcMulti[key][percBaseItem.item_id]?.[mes] ?? 0
    if (!base) return null
    return ((valsCalcMulti[key][item_id]?.[mes] ?? 0) / base) * 100
  }

  // ── Helpers de carregamento ──────────────────────────────────────────────────
  const resolverValsById = async (key) => {
    const band = bandeiras.find(b => `band:${b.id}` === key)
    if (band) {
      const combined = {}
      for (const u of band.unidades) {
        try {
          const r = await orcamentoAPI.obterDre(clienteId, ano, u)
          for (const ln of r.data.linhas || []) {
            if (!combined[ln.item_id]) combined[ln.item_id] = {}
            for (let m = 1; m <= 12; m++)
              combined[ln.item_id][m] = (combined[ln.item_id][m] || 0) + (ln.valores?.[m] ?? 0)
          }
        } catch {}
      }
      return combined
    }
    const r = await orcamentoAPI.obterDre(clienteId, ano, key)
    const vb = {}
    for (const ln of r.data.linhas || []) vb[ln.item_id] = ln.valores
    if (!dados) {
      setDados(r.data)
    }
    return vb
  }

  const carregarBandeiras = async (cid) => {
    if (!cid) { setBandeiras([]); return }
    try { const r = await bandeiraAPI.listar(cid); setBandeiras(r.data || []) }
    catch { setBandeiras([]) }
  }

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => { setRecolhidosL1(new Set()); setRecolhidosL2(new Set()) }, [clienteId, ano, unidade])
  useEffect(() => { if (!modoEdicao) { setEditando(null); setEditVal('') } }, [modoEdicao])

  useEffect(() => {
    if (isCliente) {
      setClienteId(String(usuario.cliente_id))
    } else {
      orcamentoAPI.clientesComPlano()
        .then(r => { setClientes(r.data||[]); if ((r.data||[]).length===1) setClienteId(String(r.data[0].id)) })
        .catch(()=>{})
    }
  }, [])

  useEffect(() => {
    if (!clienteId) { setUnidades([]); return }
    carregarBandeiras(clienteId)
    const detectarAno = async () => {
      for (let a = ANO_ATUAL-1; a >= ANO_ATUAL-4; a--) {
        try {
          const r = await orcamentoAPI.unidades(clienteId, a)
          const lista = r.data || []
          if (lista.length > 0) {
            setAno(a); setUnidades(lista)
            setUnidade(lista.includes('CONSOLIDADO') ? 'CONSOLIDADO' : lista[0])
            return
          }
        } catch { break }
      }
      setUnidades([])
    }
    detectarAno()
  }, [clienteId])

  useEffect(() => {
    if (!clienteId) return
    orcamentoAPI.unidades(clienteId, ano)
      .then(r => { const l=r.data||[]; setUnidades(l); setUnidade(l.includes('CONSOLIDADO')?'CONSOLIDADO':(l[0]||'CONSOLIDADO')) })
      .catch(()=>setUnidades([]))
  }, [ano])

  // Modelo 1 — carrega dados para unidade atual
  const carregarDre = () => {
    if (!clienteId) { setDados(null); setValsById({}); return }
    setLoading(true)
    orcamentoAPI.obterDre(clienteId, ano, unidade)
      .then(r => {
        setDados(r.data)
        const m = {}
        for (const ln of r.data.linhas||[]) m[ln.item_id] = ln.valores
        setValsById(m)
      })
      .catch(()=>toast.error('Erro ao carregar DRE'))
      .finally(()=>setLoading(false))
  }
  useEffect(() => { if (modelo === 1) carregarDre() }, [clienteId, ano, unidade])

  // Carrega dados para modelos 2/3 quando selFlags mudar
  useEffect(() => {
    if (modelo === 1 || !clienteId || selFlags.size === 0) return
    setLoadingMulti(true)
    const keys = [...selFlags]
    Promise.all(keys.map(async k => {
      if (dadosMulti[k]) return [k, dadosMulti[k]]
      const vb = await resolverValsById(k)
      return [k, vb]
    })).then(results => {
      setDadosMulti(prev => {
        const next = { ...prev }
        results.forEach(([k, vb]) => { next[k] = vb })
        return next
      })
    }).catch(()=>toast.error('Erro ao carregar dados'))
    .finally(()=>setLoadingMulti(false))
  }, [selFlags, clienteId, ano, modelo])

  // Ao trocar modelo, garante que dados estruturais existam
  useEffect(() => {
    if (modelo !== 1 && !dados && clienteId) carregarDre()
    if (modelo === 1) { setSelFlags(new Set()); setDadosMulti({}) }
  }, [modelo])

  // Quando bandeiras são recarregadas, limpa cache dadosMulti de bandeiras removidas
  useEffect(() => {
    const bandIds = new Set(bandeiras.map(b => `band:${b.id}`))
    setDadosMulti(prev => {
      const next = {}
      for (const [k, v] of Object.entries(prev)) {
        if (!k.startsWith('band:') || bandIds.has(k)) next[k] = v
      }
      return next
    })
  }, [bandeiras])

  // ── Salvar valor editado ─────────────────────────────────────────────────────
  const handleCelulaSave = async (item_id, mes, valorStr) => {
    const v = parseFloat(String(valorStr??editVal).replace(',','.')) || 0
    setEditando(null); setEditVal('')
    setValsById(prev => ({ ...prev, [item_id]: { ...(prev[item_id]||{}), [mes]: v } }))
    try {
      await orcamentoAPI.salvarDre(clienteId, ano, item_id, mes, v, unidade)
    } catch(err) {
      toast.error(`Erro ao salvar: ${err?.response?.data?.detail||err?.message||'verifique o console'}`)
      carregarDre()
    }
  }

  const total12 = item_id => Object.values(valsCalc[item_id]||{}).reduce((s,v)=>s+(v||0), 0)

  // ── Flag toggle helpers ──────────────────────────────────────────────────────
  const toggleFlag1 = key => setUnidade(key)

  const toggleFlagMulti = (key, maxSel) => {
    setSelFlags(prev => {
      const n = new Set(prev)
      if (n.has(key)) { n.delete(key); setDadosMulti(p => { const q={...p}; delete q[key]; return q }) }
      else if (!maxSel || n.size < maxSel) n.add(key)
      return n
    })
  }

  const selecionarTodas = () => {
    const todas = new Set(flagItems.map(f => f.key))
    setSelFlags(todas)
  }

  const nomeUnidade = u => u === 'CONSOLIDADO' ? 'Consolidado' : u

  const btnBarStyle = ativo => ({
    background: ativo ? '#fffbeb' : 'rgba(255,255,255,.15)',
    border: ativo ? '1px solid #fcd34d' : '1px solid rgba(255,255,255,.3)',
    color: ativo ? '#b45309' : '#fff',
    borderRadius: 6, padding: '4px 12px', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  })

  const tabStyle = (ativo) => ({
    padding: '4px 14px', borderRadius: 6, fontSize: 11, fontWeight: ativo ? 700 : 500,
    cursor: 'pointer', border: 'none',
    background: ativo ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)',
    color: ativo ? '#fff' : 'rgba(255,255,255,.65)',
  })

  // ── Unidades selecionadas em ordem (Modelos 2/3) ────────────────────────────
  const selOrdenadas = flagItems.filter(f => selFlags.has(f.key))

  const compCols = useMemo(() => {
    if (compTipo === 'unidades') {
      return flagItems.filter(f => selFlags.has(f.key)).map(({ key, label }) => ({
        key,
        mes: compMesFiltro,
        label: (label === 'CONSOLIDADO' ? 'Consolidado' : label) + (compMesFiltro ? ` · ${MESES[compMesFiltro - 1]}` : ' · Anual'),
      }))
    }
    const key = [...selFlags][0]
    if (!key) return []
    const item = flagItems.find(f => f.key === key)
    const baseLabel = item ? (item.label === 'CONSOLIDADO' ? 'Consolidado' : item.label) : key
    const cols = []
    if (compMes1) cols.push({ key, mes: compMes1, label: `${baseLabel} · ${MESES[compMes1 - 1]}` })
    if (compMes2) cols.push({ key, mes: compMes2, label: `${baseLabel} · ${MESES[compMes2 - 1]}` })
    return cols
  }, [compTipo, selFlags, compMesFiltro, compMes1, compMes2, flagItems])

  const headerUnitsText = useMemo(() => {
    if (modelo === 1) return unidade === 'CONSOLIDADO' ? 'Consolidado' : unidade
    if (!compCols.length) return null
    return compCols.map(c => c.label).join(' vs ')
  }, [modelo, unidade, compCols])

  // Só mostra spinner na carga inicial (quando ainda não há dados)
  const cargaInicial = loading && !dados
  const temDados = dados?.plano && dados.linhas?.length > 0 && unidades.length > 0

  return (
    <div className="page">
      {/* ── Barra de controles ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display:'flex', flexDirection:'column', lineHeight:1.2, marginRight:4 }}>
          <span style={{ fontWeight:800, fontSize:15, color:'var(--brand)' }}>DRE</span>
          <span style={{ fontSize:10, color:'var(--text-3)', letterSpacing:'.02em' }}>Demonstração do Resultado</span>
        </div>
        <div style={{ width:1, height:30, background:'var(--border)' }} />
        {isCliente ? (
          <span style={{ fontWeight:600, fontSize:13 }}>{clientes.find(c=>String(c.id)===clienteId)?.razao_social??'—'}</span>
        ) : (
          <select value={clienteId} onChange={e=>setClienteId(e.target.value)} style={{fontSize:12,padding:'5px 10px',minWidth:220}}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c=><option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        )}
        {loading && dados && <span style={{fontSize:10,color:'var(--text-3)',opacity:.6}}>↻ atualizando...</span>}
      </div>

      {/* ── Estados vazios ─────────────────────────────────────────────────── */}
      {!clienteId && <div className="empty-state">Selecione um cliente para visualizar o DRE.</div>}
      {clienteId && !loading && dados?.plano===null && (
        <div className="empty-state">Este cliente não possui plano DRE vinculado. Acesse <strong>Modelos &amp; Contas</strong> para vincular uma estrutura.</div>
      )}
      {clienteId && !loading && dados?.plano && unidades.length===0 && (
        <div className="empty-state">Este cliente não possui dados de DRE importados para {ano}.<br/>O DRE exibe dados históricos importados via planilha Excel.</div>
      )}
      {cargaInicial && <div style={{textAlign:'center',padding:'60px 0',color:'var(--text-3)',fontSize:13}}>Carregando DRE...</div>}

      {/* ── Tabela / Modelos ───────────────────────────────────────────────── */}
      {temDados && (
        <>
          {/* Barra azul com abas de modelo */}
          <div style={{
            background: 'linear-gradient(90deg,var(--brand) 0%,#1a4fa8 100%)',
            color: '#fff', padding: '10px 16px', borderRadius: '8px 8px 0 0',
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap',
          }}>
            <span style={{ fontWeight:700, fontSize:14 }}>{dados.plano.nome}</span>
            <span style={{ opacity:.5 }}>·</span>
            <select value={ano} onChange={e=>setAno(Number(e.target.value))}
              style={{ fontSize:12, padding:'2px 8px', borderRadius:4, border:'1px solid rgba(255,255,255,.35)', background:'rgba(255,255,255,.14)', color:'#fff', cursor:'pointer', outline:'none', fontWeight:600 }}>
              {anos.map(a=><option key={a} value={a} style={{background:'#1a4fa8',color:'#fff'}}>{a}</option>)}
            </select>
            {headerUnitsText && (
              <>
                <span style={{ opacity:.5 }}>·</span>
                <span style={{ opacity:.85, fontSize:12, maxWidth:360, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{headerUnitsText}</span>
              </>
            )}

            {/* Abas de modelo */}
            <div style={{ display:'flex', gap:4, marginLeft:8 }}>
              <button style={tabStyle(modelo===1)} onClick={()=>setModelo(1)}>Anual</button>
              <button style={tabStyle(modelo===2)} onClick={()=>setModelo(2)}>Comparativo</button>
            </div>

            <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
              {modelo===1 && l1Ids.length > 0 && (
                <button onClick={toggleTudo} style={btnBarStyle(false)}>
                  {todosRecolhidos?'▼ Expandir':'▶ Recolher'}
                </button>
              )}
              <button onClick={()=>setMostrarPct(p=>!p)} style={btnBarStyle(mostrarPct)}>
                % Part.
              </button>
              {modelo===1 && podeEditar && (
                <button onClick={()=>setModalTemplate(true)} style={btnBarStyle(false)}>⚙ Estrutura</button>
              )}
              <button onClick={() => navigate('/controladoria/dre-dashboard2', { state: { clienteId, unidade } })}
                style={{ ...btnBarStyle(false), background:'#1e1e30', color:'#60a5fa', border:'1px solid #2a2a45', fontWeight:600 }}>
                Analytics
              </button>
            </div>
          </div>

          {/* Seletor de unidades */}
          {unidades.length > 0 && (
            <div style={{ background:'#f8f9ff', border:'1px solid var(--border)', borderTop:'none', padding:'10px 16px' }}>
              {modelo === 1 ? (
                <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, whiteSpace:'nowrap' }}>Unidade:</span>
                  <FlagSelector items={flagItems} selected={new Set([unidade])} onToggle={toggleFlag1} podeEditar={podeEditar} onManage={()=>setModalBandeiras(true)} />
                </div>
              ) : (
                <div style={{ display:'flex', flexWrap:'wrap', gap:16, alignItems:'flex-start' }}>
                  {/* Tipo de comparação */}
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, marginBottom:6 }}>Comparar:</div>
                    <div style={{ display:'flex', gap:5 }}>
                      {[['unidades','2 Unidades'],['meses','2 Meses']].map(([tipo, lbl]) => {
                        const ativo = compTipo === tipo
                        return (
                          <button key={tipo}
                            onClick={() => { setCompTipo(tipo); setSelFlags(new Set()); setDadosMulti({}); setCompMes1(null); setCompMes2(null); setCompMesFiltro(null) }}
                            style={{ padding:'4px 12px', borderRadius:99, fontSize:11, fontWeight:ativo?600:400, cursor:'pointer',
                              border:ativo?'1.5px solid var(--brand)':'1px solid var(--border)',
                              background:ativo?'var(--brand)':'#fff', color:ativo?'#fff':'var(--text)' }}>
                            {lbl}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Seletor de unidades (igual ao Anual) */}
                  <div>
                    <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, marginBottom:6 }}>
                      {compTipo === 'unidades' ? 'Unidades (máx. 2):' : 'Unidade:'}
                    </div>
                    <FlagSelector items={flagItems} selected={selFlags}
                      onToggle={k => toggleFlagMulti(k, compTipo === 'unidades' ? 2 : 1)}
                      maxSelect={compTipo === 'unidades' ? 2 : 1}
                      podeEditar={podeEditar} onManage={() => setModalBandeiras(true)} />
                  </div>

                  {/* Período — modo 2 Unidades */}
                  {compTipo === 'unidades' && (
                    <div>
                      <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, marginBottom:6 }}>Período:</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                        {[null, ...Array.from({length:12}, (_,i) => i+1)].map(mes => {
                          const ativo = compMesFiltro === mes
                          return (
                            <button key={mes ?? 'anual'} onClick={() => setCompMesFiltro(mes)}
                              style={{ padding: mes ? '4px 8px' : '4px 12px', borderRadius:99, fontSize:11, fontWeight:ativo?600:400, cursor:'pointer',
                                border:ativo?'1.5px solid var(--brand)':'1px solid var(--border)',
                                background:ativo?'var(--brand)':'#fff', color:ativo?'#fff':'var(--text)' }}>
                              {mes ? MESES[mes-1] : 'Anual'}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Meses — modo 2 Meses */}
                  {compTipo === 'meses' && selFlags.size > 0 && (
                    <div>
                      <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, marginBottom:6 }}>Meses:</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
                        {([['1º', compMes1, setCompMes1, compMes2], ['2º', compMes2, setCompMes2, compMes1]] ).map(([lbl, sel, setter, other]) => (
                          <div key={lbl}>
                            <div style={{ fontSize:10, color:'var(--text-3)', marginBottom:3, fontWeight:600 }}>{lbl}</div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                              {MESES.map((m, i) => {
                                const mes = i + 1
                                const ativo = sel === mes
                                const ocupado = other === mes
                                return (
                                  <button key={mes} onClick={() => !ocupado && setter(ativo ? null : mes)}
                                    style={{ padding:'4px 8px', borderRadius:99, fontSize:11, fontWeight:ativo?600:400,
                                      cursor: ocupado ? 'not-allowed' : 'pointer', opacity: ocupado ? .4 : 1,
                                      border:ativo?'1.5px solid var(--brand)':'1px solid var(--border)',
                                      background:ativo?'var(--brand)':'#fff', color:ativo?'#fff':'var(--text)' }}>
                                    {m}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Modelo 1: Anual ─────────────────────────────────────────── */}
          {modelo === 1 && (
            <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 200px)', border:'1px solid var(--border)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f0f4ff', position:'sticky', top:0, zIndex:10 }}>
                    <th style={{ textAlign:'left',padding:'8px 12px',minWidth:300,position:'sticky',left:0,background:'#f0f4ff',zIndex:11,fontWeight:700,color:'var(--brand)',fontSize:11,letterSpacing:'.05em',borderBottom:'2px solid var(--brand)' }}>DESCRIÇÃO</th>
                    {MESES.flatMap((m,i) => [
                      <th key={i} style={{ textAlign:'right',padding:'8px 6px',minWidth:mostrarPct?66:80,fontWeight:600,color:'var(--text-2)',fontSize:11,borderBottom:'2px solid var(--brand)',background:'#f0f4ff' }}>{m}</th>,
                      ...(mostrarPct?[<th key={`${i}-p`} style={{ textAlign:'right',padding:'8px 4px',minWidth:44,fontWeight:500,color:'#9ca3af',fontSize:10,borderBottom:'2px solid var(--brand)',background:'#f0f4ff' }}>%</th>]:[])
                    ])}
                    <th style={{ textAlign:'right',padding:'8px 10px',minWidth:90,borderLeft:'2px solid var(--border)',fontWeight:700,color:'var(--brand)',fontSize:11,borderBottom:'2px solid var(--brand)',background:'#f0f4ff' }}>Acumulado</th>
                    {mostrarPct && <th style={{ textAlign:'right',padding:'8px 8px',minWidth:54,fontWeight:700,color:'#16a34a',fontSize:11,borderBottom:'2px solid var(--brand)',background:'#f0f4ff' }}>%</th>}
                  </tr>
                </thead>
                <tbody>
                  {dados.linhas.map(linha => {
                    const nv    = hierarquia.nivel[linha.item_id]
                    const ehAN  = linha.tipo === 'AN'
                    const ehL1  = nv === 1
                    const ehL2  = nv === 2

                    if (ehL2 && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null
                    if (ehAN && recolhidosL2.has(hierarquia.paiDireto[linha.item_id])) return null
                    if (ehAN && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null

                    const estilo   = estiloLinha(linha.tipo)
                    const vItem    = valsCalc[linha.item_id] || {}
                    const recL1    = ehL1 && recolhidosL1.has(linha.item_id)
                    const recL2    = ehL2 && recolhidosL2.has(linha.item_id)
                    const editavel = modoEdicao && ehAN
                    const numStr   = numeracao[linha.item_id]

                    return (
                      <tr key={linha.item_id}
                        style={{ ...estilo, borderBottom:'1px solid var(--border)', cursor:(ehL1||ehL2)?'pointer':'default' }}
                        onClick={ehL1?()=>toggleL1(linha.item_id):ehL2?()=>toggleL2(linha.item_id):undefined}>
                        <td style={{ padding:'5px 12px', paddingLeft:ehAN?36:ehL2?22:10, position:'sticky',left:0,zIndex:1,
                          background:bgSticky(linha.tipo),color:corTexto(linha.tipo),fontWeight:estilo.fontWeight||400,fontSize:estilo.fontSize||12,userSelect:(ehL1||ehL2)?'none':'auto' }}>
                          {(ehL1||ehL2) && <span style={{fontSize:10,opacity:.6,marginRight:5}}>{(recL1||recL2)?'▶':'▼'}</span>}
                          {numStr && <span style={{fontSize:10,color:'var(--text-3)',fontFamily:'monospace',marginRight:6,opacity:.7}}>{numStr}</span>}
                          {linha.descricao}
                        </td>
                        {Array.from({length:12},(_,i)=>{
                          const mes = i + 1
                          const valor = vItem[mes] ?? 0
                          const isEdit = editavel && editando?.item_id===linha.item_id && editando?.mes===mes
                          return [
                            <td key={mes} style={{ textAlign:'right',padding:'5px 6px',fontWeight:estilo.fontWeight,color:corTexto(linha.tipo),fontSize:12,
                              background:editavel?'rgba(59,130,246,.04)':'transparent',cursor:editavel?'text':'default' }}
                              onClick={editavel&&!isEdit?e=>{e.stopPropagation();setEditando({item_id:linha.item_id,mes});setEditVal(valor===0?'':String(valor))}:undefined}>
                              {isEdit ? (
                                <input type="text" inputMode="decimal" value={editVal}
                                  onChange={e=>setEditVal(e.target.value)}
                                  onBlur={e=>handleCelulaSave(linha.item_id,mes,e.target.value)}
                                  onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur()}if(e.key==='Escape'){setEditando(null);setEditVal('')}}}
                                  onClick={e=>e.stopPropagation()} autoFocus
                                  style={{width:60,textAlign:'right',fontSize:12,border:'1px solid var(--brand)',borderRadius:4,padding:'2px 4px',outline:'none'}} />
                              ) : (valor!==0?fmt(valor):(editavel?<span style={{color:'#d1d5db',fontSize:10}}>—</span>:'—'))}
                            </td>,
                            ...(mostrarPct?[<td key={`${mes}-p`} style={{ textAlign:'right',padding:'5px 4px',fontSize:10,color:'#9ca3af',fontWeight:400 }}>{fmtPct(getPctMensal(linha.item_id,mes))}</td>]:[])
                          ]
                        }).flat()}
                        <td style={{ textAlign:'right',padding:'5px 10px',fontWeight:estilo.fontWeight||600,color:corTexto(linha.tipo),borderLeft:'2px solid var(--border)',background:bgSticky(linha.tipo),fontSize:12 }}>
                          {(()=>{const t=total12(linha.item_id);return t!==0?fmt(t):'—'})()}
                        </td>
                        {mostrarPct && (
                          <td style={{ textAlign:'right',padding:'5px 8px',fontSize:11,color:'#6b7280',fontWeight:estilo.fontWeight||400 }}>
                            {fmtPct(getPct(linha.item_id))}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Modelo 2: Comparativo ───────────────────────────────────── */}
          {modelo === 2 && (
            <div style={{ border:'1px solid var(--border)', borderTop:'none', borderRadius:'0 0 8px 8px' }}>
              {compCols.length === 0 ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>
                  {compTipo === 'unidades'
                    ? 'Selecione até 2 unidades acima para comparar.'
                    : selFlags.size === 0
                      ? 'Selecione uma unidade e dois meses para comparar.'
                      : 'Selecione o 1º e 2º mês para visualizar a comparação.'}
                </div>
              ) : loadingMulti ? (
                <div style={{ padding:40, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>Carregando...</div>
              ) : (
                <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:'calc(100vh - 200px)' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                    <thead>
                      <tr style={{ background:'#f0f4ff', position:'sticky', top:0, zIndex:10 }}>
                        <th style={{ textAlign:'left',padding:'8px 12px',minWidth:300,position:'sticky',left:0,background:'#f0f4ff',zIndex:11,fontWeight:700,color:'var(--brand)',fontSize:11,letterSpacing:'.05em',borderBottom:'2px solid var(--brand)' }}>DESCRIÇÃO</th>
                        {compCols.flatMap(col => [
                          <th key={col.label} style={{ textAlign:'right',padding:'8px 14px',minWidth:140,fontWeight:700,color:'var(--brand)',fontSize:11,borderBottom:'2px solid var(--brand)',background:'#f0f4ff',borderLeft:'1px solid var(--border)' }}>
                            {col.label}
                          </th>,
                          ...(mostrarPct ? [<th key={`${col.label}-pct`} style={{ textAlign:'right',padding:'8px 8px',minWidth:54,fontWeight:600,color:'#6b7280',fontSize:10,borderBottom:'2px solid var(--brand)',background:'#f0f4ff' }}>%</th>] : [])
                        ])}
                        {compCols.length === 2 && (
                          <>
                            <th style={{ textAlign:'right',padding:'8px 14px',minWidth:110,fontWeight:700,color:'#6b7280',fontSize:11,borderBottom:'2px solid var(--brand)',background:'#f0f4ff',borderLeft:'2px solid var(--border)' }}>Δ Diferença</th>
                            {mostrarPct && <th style={{ textAlign:'right',padding:'8px 10px',minWidth:72,fontWeight:700,color:'#16a34a',fontSize:11,borderBottom:'2px solid var(--brand)',background:'#f0f4ff' }}>Var. %</th>}
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {dados.linhas.map(linha => {
                        const nv   = hierarquia.nivel[linha.item_id]
                        const ehAN = linha.tipo === 'AN'
                        const ehL1 = nv === 1
                        const ehL2 = nv === 2

                        if (ehL2 && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null
                        if (ehAN && recolhidosL2.has(hierarquia.paiDireto[linha.item_id])) return null
                        if (ehAN && recolhidosL1.has(hierarquia.paiL1[linha.item_id])) return null

                        const estilo  = estiloLinha(linha.tipo)
                        const vals    = compCols.map(col => getValComp(col.key, linha.item_id, col.mes))
                        const diff    = compCols.length === 2 && vals[0] !== null && vals[1] !== null ? vals[0] - vals[1] : null
                        const diffPct = diff !== null && vals[1] !== 0 ? (diff / Math.abs(vals[1])) * 100 : null

                        return (
                          <tr key={linha.item_id}
                            style={{ ...estilo, borderBottom:'1px solid var(--border)', cursor:(ehL1||ehL2)?'pointer':'default' }}
                            onClick={ehL1?()=>toggleL1(linha.item_id):ehL2?()=>toggleL2(linha.item_id):undefined}>
                            <td style={{ padding:'5px 12px', paddingLeft:ehAN?36:ehL2?22:10, position:'sticky',left:0,zIndex:1,
                              background:bgSticky(linha.tipo),color:corTexto(linha.tipo),fontWeight:estilo.fontWeight||400,fontSize:estilo.fontSize||12,userSelect:(ehL1||ehL2)?'none':'auto' }}>
                              {(ehL1||ehL2) && <span style={{fontSize:10,opacity:.6,marginRight:5}}>▼</span>}
                              {linha.descricao}
                            </td>
                            {vals.flatMap((v, i) => [
                              <td key={i} style={{ textAlign:'right',padding:'5px 14px',fontWeight:estilo.fontWeight,color:corTexto(linha.tipo),borderLeft:'1px solid var(--border)' }}>
                                {v !== null ? fmt(v) : '—'}
                              </td>,
                              ...(mostrarPct ? [
                                <td key={`${i}-pct`} style={{ textAlign:'right',padding:'5px 8px',fontSize:11,color:'#6b7280',fontWeight:estilo.fontWeight||400 }}>
                                  {fmtPct(getPctComp(compCols[i].key, linha.item_id, compCols[i].mes))}
                                </td>
                              ] : [])
                            ])}
                            {compCols.length === 2 && (
                              <>
                                <td style={{ textAlign:'right',padding:'5px 14px',borderLeft:'2px solid var(--border)',fontWeight:600,
                                  color: diff===null?'var(--text-3)':diff>0?'#16a34a':diff<0?'#dc2626':'var(--text-3)' }}>
                                  {diff === null ? '—' : (
                                    <span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                                      <span style={{fontSize:14}}>{diff>0?'▲':diff<0?'▼':'─'}</span>
                                      {fmt(Math.abs(diff))}
                                    </span>
                                  )}
                                </td>
                                {mostrarPct && (
                                  <td style={{ textAlign:'right',padding:'5px 10px',fontSize:11,fontWeight:600,
                                    color: diffPct===null?'var(--text-3)':diffPct>0?'#16a34a':diffPct<0?'#dc2626':'var(--text-3)' }}>
                                    {diffPct === null ? '—' : `${diffPct>0?'+':''}${diffPct.toFixed(1)}%`}
                                  </td>
                                )}
                              </>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:20, marginTop:10, fontSize:11, color:'var(--text-3)', flexWrap:'wrap' }}>
            <span>Dados importados — {ano}</span>
            {modelo===1 && <span style={{color:'var(--brand)'}}>■ Subtotais calculados automaticamente</span>}
            {modelo===1 && <span style={{color:'#16a34a'}}>■ Resultado final</span>}
            {modelo===1 && modoEdicao && <span style={{color:'#b45309',fontWeight:600}}>✏ Modo edição ativo — clique em uma célula AN para editar</span>}
            {modelo===2 && compCols.length===2 && <span>▲ positivo em relação a <strong>{compCols[1].label}</strong></span>}
          </div>
        </>
      )}

      {modalTemplate && dados?.plano && (
        <ModalTemplateDRE
          planoId={dados.plano.id}
          planoNome={dados.plano.nome}
          onClose={()=>setModalTemplate(false)}
          onReload={carregarDre}
        />
      )}

      {modalBandeiras && clienteId && (
        <ModalGerenciarBandeiras
          clienteId={clienteId}
          unidadesDisp={unidades}
          onClose={()=>setModalBandeiras(false)}
          onAlterado={()=>carregarBandeiras(clienteId)}
        />
      )}
    </div>
  )
}
