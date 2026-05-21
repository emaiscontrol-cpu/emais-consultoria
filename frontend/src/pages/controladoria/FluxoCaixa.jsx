import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, ChevronRight, ChevronDown, Upload, Settings } from 'lucide-react'
import { fluxoCaixaAPI, clientesAPI } from '../../services/api'
import toast from 'react-hot-toast'

const MESES     = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANOS      = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)
const fmt       = v => (v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtColor  = v => ({ color: v < 0 ? '#EF4444' : v > 0 ? '#111827' : '#9CA3AF' })

// ── Celula editável ───────────────────────────────────────────────────────────
function CelulaEdit({ value, onSave, disabled }) {
  const [edit, setEdit]   = useState(false)
  const [local, setLocal] = useState('')
  const inputRef          = useRef()

  const abrir = () => {
    if (disabled) return
    setLocal(value === 0 ? '' : String(value).replace('.', ','))
    setEdit(true)
    setTimeout(() => inputRef.current?.select(), 30)
  }

  const salvar = () => {
    const n = parseFloat(local.replace(/\./g, '').replace(',', '.')) || 0
    onSave(n)
    setEdit(false)
  }

  if (edit) return (
    <input ref={inputRef} value={local} autoFocus
      onChange={e => setLocal(e.target.value)}
      onBlur={salvar}
      onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setEdit(false) }}
      style={{ width:'100%', textAlign:'right', border:'none', borderBottom:'2px solid var(--brand)',
        outline:'none', background:'#EFF6FF', fontSize:12, padding:'2px 4px', borderRadius:2 }}
    />
  )

  return (
    <div onClick={abrir} style={{ textAlign:'right', fontSize:12, cursor: disabled ? 'default' : 'pointer',
      padding:'2px 4px', borderRadius:2, ...fmtColor(value),
      background: !disabled && value === 0 ? 'transparent' : 'transparent',
      ':hover': { background: '#F3F4F6' } }}>
      {value !== 0 ? fmt(value) : <span style={{ color:'#D1D5DB' }}>—</span>}
    </div>
  )
}

// ── Modal Conta ───────────────────────────────────────────────────────────────
function ModalConta({ planoId, contas, conta, onSave, onClose }) {
  const [form, setForm] = useState({
    codigo: conta?.codigo ?? '', nome: conta?.nome ?? '',
    tipo: conta?.tipo ?? 'entrada', classe: conta?.classe ?? '',
    pai_id: conta?.pai_id ?? '', ordem: conta?.ordem ?? 0,
    plano_id: planoId,
  })
  const [salvando, setSalvando] = useState(false)

  const salvar = async e => {
    e.preventDefault()
    if (!form.nome.trim()) return toast.error('Informe o nome da conta')
    setSalvando(true)
    try {
      const payload = { ...form, pai_id: form.pai_id || null, nivel: form.pai_id ? 2 : 1 }
      if (conta) await fluxoCaixaAPI.atualizarConta(conta.id, payload)
      else       await fluxoCaixaAPI.criarConta(payload)
      toast.success(conta ? 'Conta atualizada' : 'Conta criada')
      onSave()
    } catch { toast.error('Erro ao salvar conta') }
    finally   { setSalvando(false) }
  }

  const pais = contas.filter(c => !c.pai_id && c.id !== conta?.id)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:10, padding:28, width:440,
        boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>
          {conta ? 'Editar Conta' : 'Nova Conta'}
        </div>
        <form onSubmit={salvar}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div className="form-group" style={{ margin:0 }}>
              <label>Código</label>
              <input value={form.codigo} placeholder="Ex: 1.1.01"
                onChange={e => setForm(f=>({...f, codigo:e.target.value}))} />
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label>Ordem</label>
              <input type="number" value={form.ordem}
                onChange={e => setForm(f=>({...f, ordem:+e.target.value}))} />
            </div>
          </div>
          <div className="form-group">
            <label>Nome da Conta *</label>
            <input value={form.nome} required placeholder="Ex: Receita de Honorários"
              onChange={e => setForm(f=>({...f, nome:e.target.value}))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div className="form-group" style={{ margin:0 }}>
              <label>Tipo *</label>
              <select value={form.tipo} onChange={e => setForm(f=>({...f, tipo:e.target.value}))}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label>Classe / Agrupador</label>
              <input value={form.classe} placeholder="Ex: Cartões de Crédito"
                onChange={e => setForm(f=>({...f, classe:e.target.value}))} />
            </div>
          </div>
          <div className="form-group">
            <label>Conta Pai (subconta)</label>
            <select value={form.pai_id} onChange={e => setForm(f=>({...f, pai_id:e.target.value}))}>
              <option value="">— Nível raiz —</option>
              {pais.map(c => <option key={c.id} value={c.id}>{c.codigo ? `${c.codigo} — ` : ''}{c.nome}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Plano ───────────────────────────────────────────────────────────────
function ModalPlano({ clienteId, onSave, onClose }) {
  const [nome, setNome]         = useState('')
  const [desc, setDesc]         = useState('')
  const [salvando, setSalvando] = useState(false)

  const salvar = async e => {
    e.preventDefault()
    if (!nome.trim()) return toast.error('Informe o nome do plano')
    setSalvando(true)
    try {
      await fluxoCaixaAPI.criarPlano({ nome, descricao: desc, cliente_id: clienteId })
      toast.success('Plano criado!')
      onSave()
    } catch { toast.error('Erro ao criar plano') }
    finally { setSalvando(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:10, padding:28, width:400,
        boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
        <div style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>Novo Plano de Contas</div>
        <form onSubmit={salvar}>
          <div className="form-group">
            <label>Nome do Plano *</label>
            <input value={nome} required placeholder="Ex: Plano Padrão 2026"
              onChange={e => setNome(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <input value={desc} placeholder="Opcional"
              onChange={e => setDesc(e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function FluxoCaixa() {
  const [clientes,    setClientes]    = useState([])
  const [clienteId,   setClienteId]   = useState('')
  const [planos,      setPlanos]      = useState([])
  const [planoId,     setPlanoId]     = useState('')
  const [ano,         setAno]         = useState(new Date().getFullYear())
  const [contas,      setContas]      = useState([])
  const [valores,     setValores]     = useState({})   // { "id_mes": valor }
  const [saldos,      setSaldos]      = useState({})   // { mes: valor }
  const [loading,     setLoading]     = useState(false)
  const [modalConta,  setModalConta]  = useState(null) // null | 'new' | conta obj
  const [modalPlano,  setModalPlano]  = useState(false)
  const [expandidos,  setExpandidos]  = useState({})   // { contaId: bool }

  // ── carregamentos ─────────────────────────────────────────────────────────
  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!clienteId) return
    fluxoCaixaAPI.planos(clienteId).then(r => {
      setPlanos(r.data)
      setPlanoId(r.data[0]?.id ?? '')
    }).catch(() => {})
  }, [clienteId])

  const carregarDados = useCallback(() => {
    if (!planoId || !ano) return
    setLoading(true)
    Promise.all([
      fluxoCaixaAPI.contas(planoId),
      fluxoCaixaAPI.valores(planoId, ano),
      fluxoCaixaAPI.saldos(planoId, ano),
    ]).then(([c, v, s]) => {
      setContas(c.data)
      const valMap = {}
      v.data.forEach(x => { valMap[`${x.conta_id}_${x.mes}`] = x.valor })
      setValores(valMap)
      const salMap = {}
      s.data.forEach(x => { salMap[x.mes] = x.valor })
      setSaldos(salMap)
      // auto-expande pais com filhos
      const exp = {}
      c.data.forEach(cc => { if (cc.tem_filhos) exp[cc.id] = true })
      setExpandidos(exp)
    }).finally(() => setLoading(false))
  }, [planoId, ano])

  useEffect(() => { carregarDados() }, [carregarDados])

  // ── cálculos ──────────────────────────────────────────────────────────────
  const getValor = useCallback((contaId, mes) => {
    const filhos = contas.filter(c => c.pai_id === contaId)
    if (filhos.length > 0) return filhos.reduce((s, f) => s + getValor(f.id, mes), 0)
    return valores[`${contaId}_${mes}`] ?? 0
  }, [contas, valores])

  const totalTipo = useCallback((tipo, mes) =>
    contas.filter(c => c.tipo === tipo && !c.pai_id)
          .reduce((s, c) => s + getValor(c.id, mes), 0)
  , [contas, getValor])

  const getSaldoInicial = useCallback((mes) => {
    if (mes === 1) return saldos[1] ?? 0
    const prev = getSaldoInicial(mes - 1) + totalTipo('entrada', mes - 1) - totalTipo('saida', mes - 1)
    return prev
  }, [saldos, totalTipo])

  const getSaldoFinal = useCallback((mes) =>
    getSaldoInicial(mes) + totalTipo('entrada', mes) - totalTipo('saida', mes)
  , [getSaldoInicial, totalTipo])

  // ── save ──────────────────────────────────────────────────────────────────
  const saveValor = async (contaId, mes, valor) => {
    setValores(prev => ({ ...prev, [`${contaId}_${mes}`]: valor }))
    try { await fluxoCaixaAPI.salvarValor({ conta_id: contaId, ano, mes, valor }) }
    catch { toast.error('Erro ao salvar valor') }
  }

  const saveSaldo = async (mes, valor) => {
    setSaldos(prev => ({ ...prev, [mes]: valor }))
    try { await fluxoCaixaAPI.salvarSaldo({ plano_id: planoId, ano, mes, valor }) }
    catch { toast.error('Erro ao salvar saldo') }
  }

  const deletarConta = async (id) => {
    if (!window.confirm('Excluir esta conta?')) return
    try {
      await fluxoCaixaAPI.deletarConta(id)
      toast.success('Conta excluída')
      carregarDados()
    } catch { toast.error('Erro ao excluir') }
  }

  // ── render helpers ────────────────────────────────────────────────────────
  const totalAnual = (fn, ...args) =>
    Array.from({ length: 12 }, (_, i) => fn(...args, i + 1)).reduce((a, b) => a + b, 0)

  const thStyle = { background:'#0A1C4E', color:'#fff', fontSize:11, fontWeight:700,
    textAlign:'right', padding:'6px 6px', whiteSpace:'nowrap', position:'sticky', top:0, zIndex:2 }
  const thLeft  = { ...thStyle, textAlign:'left', minWidth:220, position:'sticky', left:0, zIndex:3 }

  const rowSaldo = (label, fn, mes, editavel, bold) => {
    const v = fn(mes)
    return (
      <td style={{ padding:'4px 6px', ...fmtColor(v), fontWeight: bold ? 700 : 400,
        background: bold ? '#F0FDF4' : '#fff', fontSize:12 }}>
        {editavel
          ? <CelulaEdit value={v} onSave={val => saveSaldo(mes, val)} />
          : <div style={{ textAlign:'right', ...fmtColor(v) }}>{fmt(v)}</div>}
      </td>
    )
  }

  const renderContas = (tipo) => {
    const raiz = contas.filter(c => c.tipo === tipo && !c.pai_id)
    return raiz.map(conta => renderConta(conta, tipo))
  }

  const renderConta = (conta, tipo, depth = 0) => {
    const filhos   = contas.filter(c => c.pai_id === conta.id)
    const temFilhos= filhos.length > 0
    const expand   = expandidos[conta.id] ?? true
    const bgRow    = depth === 0 ? '#FAFAFA' : '#fff'

    return [
      <tr key={conta.id} style={{ background: bgRow }}>
        <td style={{ padding:'4px 8px', fontSize:12, fontWeight: temFilhos ? 600 : 400,
          color:'#374151', position:'sticky', left:0, background: bgRow,
          borderRight:'1px solid #E5E7EB', paddingLeft: 8 + depth * 16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            {temFilhos
              ? <button onClick={() => setExpandidos(e => ({...e, [conta.id]: !e[conta.id]}))}
                  style={{ border:'none', background:'none', cursor:'pointer', padding:0, color:'#6B7280' }}>
                  {expand ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
                </button>
              : <span style={{ width:17, display:'inline-block' }} />
            }
            {conta.codigo && <span style={{ color:'#9CA3AF', fontSize:11, marginRight:4 }}>{conta.codigo}</span>}
            {conta.nome}
            {conta.classe && <span style={{ marginLeft:6, fontSize:10, color:'#fff', background:'#6366F1',
              borderRadius:99, padding:'1px 6px' }}>{conta.classe}</span>}
          </div>
        </td>
        {Array.from({ length: 12 }, (_, i) => {
          const mes  = i + 1
          const val  = getValor(conta.id, mes)
          return (
            <td key={mes} style={{ padding:'2px 4px', background: bgRow }}>
              {temFilhos
                ? <div style={{ textAlign:'right', fontSize:12, fontWeight:600, ...fmtColor(val), padding:'2px 4px' }}>
                    {val !== 0 ? fmt(val) : <span style={{ color:'#D1D5DB' }}>—</span>}
                  </div>
                : <CelulaEdit value={val} onSave={v => saveValor(conta.id, mes, v)} />
              }
            </td>
          )
        })}
        <td style={{ padding:'2px 6px', background: bgRow }}>
          <div style={{ textAlign:'right', fontSize:12, fontWeight:600,
            ...fmtColor(totalAnual(getValor, conta.id)) }}>
            {fmt(totalAnual(getValor, conta.id))}
          </div>
        </td>
        <td style={{ padding:'2px 6px', background: bgRow }}>
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => setModalConta(conta)}
              style={{ border:'none', background:'none', cursor:'pointer', color:'#6B7280', padding:2 }}>
              <Settings size={12}/>
            </button>
            <button onClick={() => deletarConta(conta.id)}
              style={{ border:'none', background:'none', cursor:'pointer', color:'#EF4444', padding:2 }}>
              <Trash2 size={12}/>
            </button>
          </div>
        </td>
      </tr>,
      ...(temFilhos && expand ? filhos.map(f => renderConta(f, tipo, depth + 1)) : [])
    ]
  }

  const rowTotal = (label, tipo, cor) => (
    <tr style={{ background: cor }}>
      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:700, color:'#111827',
        position:'sticky', left:0, background: cor, borderRight:'1px solid #E5E7EB' }}>
        {label}
      </td>
      {Array.from({ length: 12 }, (_, i) => {
        const v = totalTipo(tipo, i + 1)
        return (
          <td key={i} style={{ padding:'4px 6px', textAlign:'right', fontSize:12,
            fontWeight:700, ...fmtColor(v) }}>
            {fmt(v)}
          </td>
        )
      })}
      <td style={{ padding:'4px 6px', textAlign:'right', fontSize:12, fontWeight:700,
        ...fmtColor(totalAnual(totalTipo, tipo)) }}>
        {fmt(totalAnual(totalTipo, tipo))}
      </td>
      <td />
    </tr>
  )

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Fluxo de Caixa</div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>
            Demonstração financeira em regime de caixa
          </div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {planoId && (
            <button className="btn btn-sm" onClick={() => setModalConta('new')}>
              <Plus size={14}/> Nova Conta
            </button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding:16, marginBottom:20,
        display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div className="form-group" style={{ margin:0, minWidth:200 }}>
          <label>Cliente</label>
          <select value={clienteId} onChange={e => { setClienteId(e.target.value); setPlanoId('') }}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        {clienteId && (
          <>
            <div className="form-group" style={{ margin:0, minWidth:220 }}>
              <label>Plano de Contas</label>
              <select value={planoId} onChange={e => setPlanoId(e.target.value)}>
                <option value="">Selecione o plano...</option>
                {planos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <button className="btn btn-sm" style={{ marginBottom:1 }}
              onClick={() => setModalPlano(true)}>
              <Plus size={13}/> Novo Plano
            </button>
          </>
        )}
        {planoId && (
          <div className="form-group" style={{ margin:0 }}>
            <label>Ano</label>
            <select value={ano} onChange={e => setAno(+e.target.value)}>
              {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Estado vazio */}
      {!clienteId && (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
          Selecione um cliente para visualizar o Fluxo de Caixa.
        </div>
      )}

      {clienteId && !planoId && (
        <div className="card" style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
          {planos.length === 0
            ? <>Nenhum Plano de Contas cadastrado para este cliente. <br/>
                <button className="btn btn-primary btn-sm" style={{ marginTop:12 }}
                  onClick={() => setModalPlano(true)}>
                  <Plus size={13}/> Criar Plano de Contas
                </button>
              </>
            : 'Selecione um Plano de Contas para continuar.'}
        </div>
      )}

      {/* Grade */}
      {planoId && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {loading
            ? <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>Carregando...</div>
            : (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1100 }}>
                  <thead>
                    <tr>
                      <th style={thLeft}>Conta</th>
                      {MESES.map(m => <th key={m} style={thStyle}>{m}</th>)}
                      <th style={thStyle}>Total</th>
                      <th style={{ ...thStyle, width:60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Saldo Inicial */}
                    <tr style={{ background:'#EFF6FF' }}>
                      <td style={{ padding:'6px 8px', fontSize:12, fontWeight:700, color:'#1D4ED8',
                        position:'sticky', left:0, background:'#EFF6FF', borderRight:'1px solid #E5E7EB' }}>
                        Saldo Inicial
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1
                        const v   = getSaldoInicial(mes)
                        return (
                          <td key={mes} style={{ padding:'2px 4px', background:'#EFF6FF' }}>
                            {mes === 1
                              ? <CelulaEdit value={v} onSave={val => saveSaldo(1, val)} />
                              : <div style={{ textAlign:'right', fontSize:12, color:'#1D4ED8',
                                  fontWeight:600, padding:'2px 4px' }}>{fmt(v)}</div>
                            }
                          </td>
                        )
                      })}
                      <td style={{ background:'#EFF6FF' }} /><td style={{ background:'#EFF6FF' }} />
                    </tr>

                    {/* Separador Entradas */}
                    <tr style={{ background:'#ECFDF5' }}>
                      <td colSpan={15} style={{ padding:'5px 8px', fontSize:11, fontWeight:800,
                        color:'#065F46', letterSpacing:'.6px', textTransform:'uppercase',
                        position:'sticky', left:0, background:'#ECFDF5' }}>
                        Entradas
                      </td>
                    </tr>
                    {renderContas('entrada')}
                    {rowTotal('TOTAL ENTRADAS', 'entrada', '#D1FAE5')}

                    {/* Separador Saídas */}
                    <tr style={{ background:'#FEF2F2' }}>
                      <td colSpan={15} style={{ padding:'5px 8px', fontSize:11, fontWeight:800,
                        color:'#991B1B', letterSpacing:'.6px', textTransform:'uppercase',
                        position:'sticky', left:0, background:'#FEF2F2' }}>
                        Saídas
                      </td>
                    </tr>
                    {renderContas('saida')}
                    {rowTotal('TOTAL SAÍDAS', 'saida', '#FEE2E2')}

                    {/* Saldo Final */}
                    {Array.from({ length: 1 }, () => (
                      <tr key="sf" style={{ background:'#1E3A5F' }}>
                        <td style={{ padding:'8px', fontSize:13, fontWeight:800, color:'#fff',
                          position:'sticky', left:0, background:'#1E3A5F', borderRight:'1px solid rgba(255,255,255,.1)' }}>
                          Saldo Final
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const v = getSaldoFinal(i + 1)
                          return (
                            <td key={i} style={{ padding:'6px', textAlign:'right', fontSize:13,
                              fontWeight:800, color: v < 0 ? '#FCA5A5' : '#6EE7B7' }}>
                              {fmt(v)}
                            </td>
                          )
                        })}
                        <td style={{ padding:'6px', textAlign:'right', fontSize:13, fontWeight:800,
                          color: getSaldoFinal(12) < 0 ? '#FCA5A5' : '#6EE7B7' }}>
                          {fmt(totalAnual(totalTipo, 'entrada') - totalAnual(totalTipo, 'saida'))}
                        </td>
                        <td style={{ background:'#1E3A5F' }} />
                      </tr>
                    ))}
                  </tbody>
                </table>

                {contas.length === 0 && (
                  <div style={{ padding:32, textAlign:'center', color:'var(--text-muted)' }}>
                    Nenhuma conta cadastrada. <button className="btn-link"
                      style={{ color:'var(--brand)', fontWeight:600, border:'none', background:'none', cursor:'pointer' }}
                      onClick={() => setModalConta('new')}>Adicionar conta</button>
                  </div>
                )}
              </div>
            )
          }
        </div>
      )}

      {/* Modais */}
      {(modalConta === 'new' || (modalConta && modalConta.id)) && (
        <ModalConta
          planoId={planoId}
          contas={contas}
          conta={modalConta === 'new' ? null : modalConta}
          onSave={() => { setModalConta(null); carregarDados() }}
          onClose={() => setModalConta(null)}
        />
      )}
      {modalPlano && (
        <ModalPlano
          clienteId={clienteId}
          onSave={() => {
            setModalPlano(false)
            fluxoCaixaAPI.planos(clienteId).then(r => {
              setPlanos(r.data)
              setPlanoId(r.data[r.data.length - 1]?.id ?? '')
            })
          }}
          onClose={() => setModalPlano(false)}
        />
      )}
    </div>
  )
}
