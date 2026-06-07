import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, Upload, ChevronRight, ChevronDown, X, Users, BookOpen } from 'lucide-react'
import { planosAPI, clientesAPI } from '../../services/api'
import toast from 'react-hot-toast'

const MOD_LABEL = { F: 'Fluxo', D: 'DRE', O: 'Orçamento' }
const MOD_COLOR = { F: 'var(--teal)', D: 'var(--brand)', O: 'var(--purple)' }
const MOV_OPCOES = ['Entrada', 'Saída', 'Receita', 'Despesa']

function ModBadge({ modulo }) {
  if (!modulo) return null
  return (
    <span style={{ display:'inline-flex', gap:3 }}>
      {modulo.split(',').map(m => m.trim().toUpperCase()).filter(m => MOD_LABEL[m]).map(m => (
        <span key={m} style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:99,
          background: MOD_COLOR[m] + '1A', color: MOD_COLOR[m], border:`1px solid ${MOD_COLOR[m]}40` }}>
          {MOD_LABEL[m]}
        </span>
      ))}
    </span>
  )
}

export default function Planos() {
  const [planos, setPlanos]       = useState([])
  const [planoAtivo, setPlanoAtivo] = useState(null)
  const [abaAtiva, setAbaAtiva]   = useState('itens')   // 'itens' | 'clientes'
  const [loading, setLoading]     = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editPlano, setEditPlano] = useState(null)
  const [formPlano, setFormPlano] = useState({ nome: '', descricao: '' })
  const [arquivoImport, setArquivoImport] = useState(null)
  const [salvando, setSalvando]   = useState(false)
  const importModalRef = useRef()

  const [showItem, setShowItem]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [formItem, setFormItem]   = useState({ agrupamento:'', descricao:'', conta:'', tipo:'', modulo:'', movimento:'' })
  const [salvandoItem, setSalvandoItem] = useState(false)

  const [clientesPlano, setClientesPlano] = useState([])
  const [togglendoCliente, setTogglendoCliente] = useState(null)
  const [popover, setPopover] = useState(null) // { field, bulk, item? }
  const [selecionados, setSelecionados] = useState(new Set())

  const fileRef = useRef()

  const getSubordinadas = (item, itens) => {
    if (item.tipo?.toUpperCase() !== 'TT') return []
    const inicio = itens.findIndex(i => i.id === item.id)
    const subs = []
    for (let i = inicio + 1; i < itens.length; i++) {
      if (itens[i].tipo?.toUpperCase() === 'TT') break
      subs.push(itens[i])
    }
    return subs
  }

  const toggleSelecionado = (item) => {
    const itens = planoAtivo?.itens ?? []
    const isTT = item.tipo?.toUpperCase() === 'TT'
    const subs = isTT ? getSubordinadas(item, itens) : []
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
        subs.forEach(s => next.delete(s.id))
      } else {
        next.add(item.id)
        subs.forEach(s => next.add(s.id))
      }
      return next
    })
  }

  const toggleTodos = () => {
    const total = planoAtivo?.itens?.length ?? 0
    setSelecionados(selecionados.size === total ? new Set() : new Set(planoAtivo.itens.map(i => i.id)))
  }

  const aplicarPopover = async (value) => {
    const { field, bulk, item } = popover
    const ids = bulk ? [...selecionados] : [item.id]
    try {
      await Promise.all(ids.map(id => planosAPI.atualizarItem(planoAtivo.id, id, { [field]: value ?? null })))
      const r = await planosAPI.obter(planoAtivo.id)
      setPlanoAtivo(r.data)
      if (bulk) setSelecionados(new Set())
      toast.success(`${ids.length} conta(s) atualizada(s)`)
    } catch { toast.error('Erro ao atualizar') }
    setPopover(null)
  }

  const carregar = async () => {
    setLoading(true)
    try {
      const r = await planosAPI.listar()
      setPlanos(Array.isArray(r.data) ? r.data : [])
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  const abrirPlano = async (plano) => {
    if (planoAtivo?.id === plano.id) { setPlanoAtivo(null); return }
    setAbaAtiva('itens')
    try {
      const r = await planosAPI.obter(plano.id)
      setPlanoAtivo(r.data)
    } catch { toast.error('Erro ao carregar plano') }
  }

  const mudarAba = async (aba) => {
    setAbaAtiva(aba)
    if (aba === 'clientes' && planoAtivo) {
      try {
        const r = await planosAPI.clientesDoPlano(planoAtivo.id)
        setClientesPlano(Array.isArray(r.data) ? r.data : [])
      } catch { toast.error('Erro ao carregar clientes') }
    }
  }

  // ── Plano CRUD ──────────────────────────────────────────────────────────────
  const abrirCriar = () => {
    setEditPlano(null); setFormPlano({ nome:'', descricao:'' }); setArquivoImport(null); setShowModal(true)
  }
  const abrirEditar = (p, e) => {
    e.stopPropagation()
    setEditPlano(p); setFormPlano({ nome: p.nome, descricao: p.descricao || '' }); setShowModal(true)
  }
  const salvarPlano = async e => {
    e.preventDefault(); setSalvando(true)
    try {
      if (editPlano) {
        await planosAPI.atualizar(editPlano.id, formPlano)
        if (arquivoImport) await planosAPI.importar(editPlano.id, arquivoImport)
        toast.success('Plano atualizado')
        if (planoAtivo?.id === editPlano.id) {
          const r = await planosAPI.obter(editPlano.id); setPlanoAtivo(r.data)
        }
      } else {
        const r = await planosAPI.criar(formPlano)
        if (arquivoImport) {
          const res = await planosAPI.importar(r.data.id, arquivoImport)
          toast.success(`Plano criado · ${res.data.importados} itens importados`)
        } else {
          toast.success('Plano criado')
        }
      }
      setShowModal(false); carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar')
    } finally { setSalvando(false) }
  }
  const excluirPlano = async (p, e) => {
    e.stopPropagation()
    if (!confirm(`Excluir plano "${p.nome}"?`)) return
    try {
      await planosAPI.excluir(p.id)
      toast.success('Plano excluído')
      if (planoAtivo?.id === p.id) setPlanoAtivo(null)
      carregar()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao excluir') }
  }

  // ── Itens ───────────────────────────────────────────────────────────────────
  const abrirNovoItem = () => {
    setEditItem(null)
    setFormItem({ agrupamento:'', descricao:'', conta:'', tipo:'', modulo:'', movimento:'' })
    setShowItem(true)
  }
  const abrirEditarItem = item => {
    setEditItem(item)
    setFormItem({ agrupamento: item.agrupamento, descricao: item.descricao,
                  conta: item.conta || '', tipo: item.tipo || '',
                  modulo: item.modulo || '', movimento: item.movimento || '' })
    setShowItem(true)
  }
  const salvarItem = async e => {
    e.preventDefault(); setSalvandoItem(true)
    try {
      const payload = { ...formItem,
        conta: formItem.conta || null,
        tipo: formItem.tipo || null,
        modulo: formItem.modulo.toUpperCase() || null,
        movimento: formItem.movimento || null }
      if (editItem) {
        await planosAPI.atualizarItem(planoAtivo.id, editItem.id, payload)
      } else {
        await planosAPI.adicionarItem(planoAtivo.id, payload)
      }
      toast.success(editItem ? 'Item atualizado' : 'Item adicionado')
      setShowItem(false)
      const r = await planosAPI.obter(planoAtivo.id); setPlanoAtivo(r.data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar item')
    } finally { setSalvandoItem(false) }
  }
  const excluirItem = async item => {
    if (!confirm(`Excluir "${item.descricao}"?`)) return
    try {
      await planosAPI.excluirItem(planoAtivo.id, item.id)
      toast.success('Item excluído')
      const r = await planosAPI.obter(planoAtivo.id); setPlanoAtivo(r.data)
    } catch { toast.error('Erro ao excluir') }
  }

  // ── Importação ──────────────────────────────────────────────────────────────
  const handleImportar = async e => {
    const file = e.target.files[0]; if (!file) return
    try {
      const r = await planosAPI.importar(planoAtivo.id, file)
      toast.success(`${r.data.importados} itens importados`)
      const r2 = await planosAPI.obter(planoAtivo.id); setPlanoAtivo(r2.data)
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro na importação') }
    e.target.value = ''
  }

  // ── Vínculo clientes ────────────────────────────────────────────────────────
  const toggleCliente = async (cliente) => {
    setTogglendoCliente(cliente.id)
    try {
      if (cliente.vinculado) {
        await planosAPI.desvincularCliente(planoAtivo.id, cliente.id)
      } else {
        await planosAPI.vincularCliente(planoAtivo.id, cliente.id)
      }
      const r = await planosAPI.clientesDoPlano(planoAtivo.id)
      setClientesPlano(Array.isArray(r.data) ? r.data : [])
      carregar()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao vincular') }
    finally { setTogglendoCliente(null) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Modelos &amp; Contas</div>
        </div>
        <button className="btn btn-primary" onClick={abrirCriar}>
          <Plus size={14}/> Novo Plano
        </button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {loading && <div style={{ color:'var(--text-3)', fontSize:13 }}>Carregando...</div>}
        {!loading && planos.length === 0 && (
          <div className="card" style={{ textAlign:'center', padding:'48px 20px', color:'var(--text-3)' }}>
            <BookOpen size={32} style={{ marginBottom:12, opacity:.4 }}/>
            <div>Nenhum plano cadastrado.</div>
          </div>
        )}

        {planos.map(p => (
          <div key={p.id} className="card" style={{ padding:0, overflow:'hidden' }}>
            {/* Cabeçalho */}
            <div onClick={() => abrirPlano(p)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px',
                       cursor:'pointer', userSelect:'none',
                       borderBottom: planoAtivo?.id === p.id ? '0.5px solid var(--border)' : 'none' }}>
              {planoAtivo?.id === p.id
                ? <ChevronDown size={15} color="var(--text-3)"/>
                : <ChevronRight size={15} color="var(--text-3)"/>}
              <span style={{ fontWeight:600, fontSize:13, flex:1 }}>{p.nome}</span>
              <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:8 }}>
                {p.total_itens} itens · {p.clientes_vinculados?.length || 0} cliente(s)
              </span>
              <button className="btn btn-sm" style={{ padding:'3px 8px', marginLeft:4 }}
                onClick={e => abrirEditar(p, e)}><Pencil size={12}/></button>
              <button className="btn btn-sm" style={{ padding:'3px 8px', color:'var(--red)' }}
                onClick={e => excluirPlano(p, e)}><Trash2 size={12}/></button>
            </div>

            {/* Painel expandido */}
            {planoAtivo?.id === p.id && (
              <div style={{ padding:'12px 16px' }}>
                {/* Abas */}
                <div style={{ display:'flex', gap:0, borderBottom:'0.5px solid var(--border)', marginBottom:14 }}>
                  {[['itens','Contas'], ['clientes','Clientes vinculados']].map(([key, label]) => (
                    <button key={key} onClick={() => mudarAba(key)}
                      style={{ padding:'6px 16px', fontSize:12, fontWeight: abaAtiva===key ? 700 : 400,
                               background:'none', border:'none', cursor:'pointer',
                               borderBottom: abaAtiva===key ? '2px solid var(--brand)' : '2px solid transparent',
                               color: abaAtiva===key ? 'var(--brand)' : 'var(--text-2)' }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Aba Contas */}
                {abaAtiva === 'itens' && (
                  <>
                    <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                      <button className="btn btn-sm btn-primary" onClick={abrirNovoItem}>
                        <Plus size={12}/> Nova Conta
                      </button>
                      <button className="btn btn-sm" onClick={() => fileRef.current.click()}>
                        <Upload size={12}/> Importar XLSX/CSV/TXT
                      </button>
                      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt"
                        style={{ display:'none' }} onChange={handleImportar}/>
                    </div>

                    {/* Barra de ações em massa */}
                    {selecionados.size > 0 && (
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
                        padding:'8px 14px', background:'var(--brand)', borderRadius:7,
                        marginBottom:10 }}>
                        <span style={{ color:'#fff', fontSize:12, fontWeight:700, marginRight:4 }}>
                          {selecionados.size} selecionada(s)
                        </span>
                        {[
                          { field:'agrupamento', label:'Agrupamento' },
                          { field:'modulo',      label:'Módulo' },
                          { field:'movimento',   label:'Movimento' },
                        ].map(({ field, label }) => (
                          <button key={field} onClick={() => setPopover({ field, bulk:true })}
                            style={{ fontSize:12, padding:'4px 12px', borderRadius:5, border:'none',
                              background:'rgba(255,255,255,.22)', color:'#fff', cursor:'pointer', fontWeight:600 }}>
                            {label}
                          </button>
                        ))}
                        <button onClick={() => setSelecionados(new Set())}
                          style={{ marginLeft:'auto', fontSize:11, padding:'3px 10px', borderRadius:5,
                            border:'1px solid rgba(255,255,255,.4)', background:'transparent',
                            color:'rgba(255,255,255,.8)', cursor:'pointer' }}>
                          Desmarcar
                        </button>
                      </div>
                    )}

                    {planoAtivo.itens?.length === 0
                      ? <div style={{ color:'var(--text-3)', fontSize:13, padding:'12px 0' }}>
                          Nenhuma conta. Importe um arquivo ou adicione manualmente.
                        </div>
                      : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th style={{ width:32, textAlign:'center' }}>
                                <input type="checkbox" style={{ cursor:'pointer' }}
                                  checked={selecionados.size === planoAtivo.itens.length && planoAtivo.itens.length > 0}
                                  onChange={toggleTodos}/>
                              </th>
                              <th style={{ width:36, textAlign:'center' }}>#</th>
                              <th style={{ width:100 }}>Agrupamento</th>
                              <th style={{ width:80 }}>Conta</th>
                              <th>Descrição</th>
                              <th style={{ width:50 }}>Tipo</th>
                              <th style={{ width:110 }}>Módulo ✎</th>
                              <th style={{ width:90 }}>Movimento ✎</th>
                              <th style={{ width:100 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {planoAtivo.itens.map((item, idx) => {
                              const isGrupo = item.tipo?.toUpperCase() === 'TT'
                              return (
                                <tr key={item.id} style={{
                                  background: selecionados.has(item.id)
                                    ? (isGrupo ? '#dce8ff' : '#eef3ff')
                                    : isGrupo
                                      ? 'linear-gradient(90deg, #e8f0ff 0%, #f4f7ff 60%, transparent 100%)'
                                      : '',
                                  borderLeft: isGrupo
                                    ? '3px solid var(--brand)' : '3px solid transparent'
                                }}>
                                  <td style={{ textAlign:'center' }}>
                                    <input type="checkbox" style={{ cursor:'pointer', width:14, height:14, accentColor:'var(--brand)' }}
                                      checked={selecionados.has(item.id)}
                                      onChange={() => toggleSelecionado(item)}/>
                                  </td>
                                  <td style={{ textAlign:'center', fontSize:11, color:'var(--text-3)', fontVariantNumeric:'tabular-nums' }}>{idx + 1}</td>
                                  <td style={{ fontFamily:'monospace', fontSize:11, cursor:'pointer', color: item.agrupamento ? 'inherit' : 'var(--text-3)' }}
                                    title="Clique para editar o agrupamento"
                                    onClick={() => setPopover({ item, field:'agrupamento' })}>
                                    {item.agrupamento || <span style={{ fontSize:10 }}>+ AGR</span>}
                                  </td>
                                  <td style={{ fontFamily:'monospace', fontSize:11 }}>{item.conta || '—'}</td>
                                  <td>
                                    <span style={{
                                      fontSize:13,
                                      fontWeight: isGrupo ? 700 : 400,
                                      color: isGrupo ? 'var(--brand)' : 'inherit',
                                      letterSpacing: isGrupo ? '0.02em' : 'normal',
                                    }}>
                                      {item.descricao}
                                    </span>
                                  </td>
                                  <td style={{ fontSize:11, fontFamily:'monospace' }}>{item.tipo || '—'}</td>
                                  <td style={{ cursor:'pointer' }} title="Clique para definir módulo"
                                    onClick={() => setPopover({ item, field:'modulo' })}>
                                    {item.modulo
                                      ? <ModBadge modulo={item.modulo}/>
                                      : <span style={{ fontSize:10, color:'var(--text-3)' }}>+ MOD</span>}
                                  </td>
                                  <td style={{ cursor:'pointer' }} title="Clique para definir movimento"
                                    onClick={() => setPopover({ item, field:'movimento' })}>
                                    {item.movimento
                                      ? <span style={{ fontSize:11, padding:'2px 7px', borderRadius:99,
                                          background: ['Entrada','Receita'].includes(item.movimento) ? 'var(--green-light)' : 'var(--red-light)',
                                          color: ['Entrada','Receita'].includes(item.movimento) ? 'var(--green)' : 'var(--red)' }}>
                                          {item.movimento}
                                        </span>
                                      : <span style={{ fontSize:10, color:'var(--text-3)' }}>+ MOV</span>}
                                  </td>
                                  <td>
                                    <div style={{ display:'flex', gap:3 }}>
                                      <button className="btn btn-sm" style={{ padding:'2px 6px', fontSize:10, color:'var(--teal)' }}
                                        onClick={abrirNovoItem} title="Adicionar Sub Conta">Sub</button>
                                      <button className="btn btn-sm" style={{ padding:'2px 5px' }}
                                        onClick={() => abrirEditarItem(item)}><Pencil size={11}/></button>
                                      <button className="btn btn-sm" style={{ padding:'2px 5px', color:'var(--red)' }}
                                        onClick={() => excluirItem(item)}><Trash2 size={11}/></button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* Aba Clientes */}
                {abaAtiva === 'clientes' && (
                  <div>
                    {clientesPlano.length === 0
                      ? <div style={{ color:'var(--text-3)', fontSize:13 }}>Nenhum cliente cadastrado.</div>
                      : clientesPlano.map(c => (
                        <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10,
                          padding:'8px 0', borderBottom:'0.5px solid var(--border)' }}>
                          <input type="checkbox" checked={c.vinculado}
                            disabled={togglendoCliente === c.id}
                            onChange={() => toggleCliente(c)}
                            style={{ cursor:'pointer', width:15, height:15 }}/>
                          <span style={{ fontSize:13, flex:1 }}>{c.razao_social}</span>
                          {c.vinculado && (
                            <span style={{ fontSize:11, color:'var(--teal)', fontWeight:600 }}>
                              Vinculado
                            </span>
                          )}
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal plano */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1000,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:10, padding:28, width:420,
                        boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{editPlano ? 'Editar Plano' : 'Novo Plano'}</div>
              <button className="btn btn-sm" onClick={() => setShowModal(false)}><X size={14}/></button>
            </div>
            <form onSubmit={salvarPlano}>
              <div className="form-group">
                <label>Nome *</label>
                <input value={formPlano.nome} required
                  onChange={e => setFormPlano(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Plano Padrão E Mais"/>
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea value={formPlano.descricao} rows={2}
                  onChange={e => setFormPlano(f => ({ ...f, descricao: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <Upload size={13}/> Importar contas (XLSX / CSV / TXT)
                  <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:400 }}>— opcional</span>
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input ref={importModalRef} type="file" accept=".xlsx,.xls,.csv,.txt"
                    style={{ display:'none' }}
                    onChange={e => setArquivoImport(e.target.files[0] || null)}/>
                  <button type="button" className="btn btn-sm"
                    onClick={() => importModalRef.current.click()}>
                    <Upload size={12}/> {arquivoImport ? 'Trocar arquivo' : 'Selecionar arquivo'}
                  </button>
                  {arquivoImport && (
                    <span style={{ fontSize:12, color:'var(--teal)', flex:1, overflow:'hidden',
                                   textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {arquivoImport.name}
                    </span>
                  )}
                </div>
                {arquivoImport && (
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>
                    As contas serão importadas automaticamente ao salvar.
                  </div>
                )}
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : arquivoImport ? 'Salvar e Importar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popover quick-edit: Módulo / Movimento / Agrupamento */}
      {popover && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.25)', zIndex:3000,
                      display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setPopover(null)}>
          <div style={{ background:'#fff', borderRadius:10, padding:20, minWidth:220,
                        boxShadow:'0 4px 24px rgba(0,0,0,.18)' }}
            onClick={e => e.stopPropagation()}>

            {popover.field === 'modulo' && (
              <>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Módulo</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {[
                    { v:null,    l:'— Nenhum —' },
                    { v:'F',     l:'F — Fluxo de Caixa' },
                    { v:'D',     l:'D — DRE' },
                    { v:'O',     l:'O — Orçamento' },
                    { v:'F,D',   l:'F,D — Fluxo + DRE' },
                    { v:'F,O',   l:'F,O — Fluxo + Orçamento' },
                    { v:'D,O',   l:'D,O — DRE + Orçamento' },
                    { v:'F,D,O', l:'F,D,O — Todos' },
                  ].map(({ v, l }) => (
                    <button key={v ?? 'n'} className="btn btn-sm"
                      style={{ textAlign:'left',
                               background: (!popover.bulk && popover.item?.modulo === v) ? 'var(--brand-light,#e8f0ff)' : '' }}
                      onClick={() => aplicarPopover(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}

            {popover.field === 'movimento' && (
              <>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>Movimento</div>
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {[
                    { v:null,      l:'— Nenhum —' },
                    { v:'Entrada', l:'Entrada' },
                    { v:'Saída',   l:'Saída' },
                    { v:'Receita', l:'Receita' },
                    { v:'Despesa', l:'Despesa' },
                  ].map(({ v, l }) => (
                    <button key={v ?? 'n'} className="btn btn-sm"
                      style={{ textAlign:'left',
                               background: (!popover.bulk && popover.item?.movimento === v) ? 'var(--brand-light,#e8f0ff)' : '' }}
                      onClick={() => aplicarPopover(v)}>
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}

            {popover.field === 'agrupamento' && (
              <>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>
                  Agrupamento{popover.bulk ? ` (${selecionados.size} itens)` : ''}
                </div>
                <input
                  autoFocus
                  defaultValue={!popover.bulk ? (popover.item?.agrupamento || '') : ''}
                  placeholder="ex: RECEITA, CUSTOS_VAR..."
                  style={{ width:'100%', fontSize:12, padding:'6px 8px', border:'1px solid var(--border)', borderRadius:5, fontFamily:'monospace', outline:'none' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') aplicarPopover(e.target.value.trim() || null)
                    if (e.key === 'Escape') setPopover(null)
                  }}
                  id="agr-input"
                />
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <button className="btn btn-sm" style={{ flex:1, background:'var(--brand)', color:'#fff' }}
                    onClick={() => aplicarPopover(document.getElementById('agr-input').value.trim() || null)}>
                    Aplicar
                  </button>
                  <button className="btn btn-sm" onClick={() => setPopover(null)}>Cancelar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal item */}
      {showItem && planoAtivo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1000,
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:10, padding:28, width:480,
                        boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>{editItem ? 'Editar Conta' : 'Nova Conta'}</div>
              <button className="btn btn-sm" onClick={() => setShowItem(false)}><X size={14}/></button>
            </div>
            <form onSubmit={salvarItem}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label>Agrupamento *</label>
                  <input value={formItem.agrupamento} required placeholder="Ex: 1.1.01"
                    onChange={e => setFormItem(f => ({ ...f, agrupamento: e.target.value }))}/>
                </div>
                <div className="form-group">
                  <label>Conta</label>
                  <input value={formItem.conta} placeholder="Ex: 1001"
                    onChange={e => setFormItem(f => ({ ...f, conta: e.target.value }))}/>
                </div>
              </div>
              <div className="form-group">
                <label>Descrição *</label>
                <input value={formItem.descricao} required placeholder="Nome da conta"
                  onChange={e => setFormItem(f => ({ ...f, descricao: e.target.value }))}/>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={formItem.tipo} onChange={e => setFormItem(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="AN">AN — Analítica</option>
                  <option value="TT">TT — Título</option>
                  <option value="RES">RES — Resultado</option>
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div className="form-group">
                  <label>Módulo</label>
                  <input value={formItem.modulo} placeholder="F, D, O ou F,D,O"
                    onChange={e => setFormItem(f => ({ ...f, modulo: e.target.value.toUpperCase() }))}/>
                  <div style={{ fontSize:10, color:'var(--text-3)', marginTop:3 }}>
                    F=Fluxo · D=DRE · O=Orçamento
                  </div>
                </div>
                <div className="form-group">
                  <label>Movimento</label>
                  <select value={formItem.movimento}
                    onChange={e => setFormItem(f => ({ ...f, movimento: e.target.value }))}>
                    <option value="">— Nenhum —</option>
                    {MOV_OPCOES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
                <button type="button" className="btn" onClick={() => setShowItem(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={salvandoItem}>
                  {salvandoItem ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
