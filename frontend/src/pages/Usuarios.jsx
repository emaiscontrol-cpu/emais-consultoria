import { useEffect, useState } from 'react'
import { usuariosAPI, clientesAPI } from '../services/api'
import { Modal, Avatar, LoadingPage } from '../components/shared'
import { BotaoEditar, BotaoExcluir, BotaoNovo } from '../components/ui'
import { KeyRound, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const PERFIS = { admin:'Administrador', consultor:'Consultor', ger_projeto:'Ger. Projeto', analista:'Analista', ti:'T.I' }
const CORES  = { admin:'blue', consultor:'teal', ger_projeto:'amber', analista:'purple', ti:'green' }
const FORM_VAZIO = { nome:'', email:'', senha:'', perfil:'consultor', cliente_id:'', ia_claude: false, ia_gemini: false, ia_openrouter: false, codigo_acesso: '' }

export default function Usuarios() {
  const { usuario: eu } = useAuth()
  const isAdmin = eu?.perfil === 'admin'

  const [usuarios,      setUsuarios]      = useState([])
  const [clientes,      setClientes]      = useState([])
  const [resetRequests, setResetRequests] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showModal,     setShowModal]     = useState(false)
  const [editando,      setEditando]      = useState(null)
  const [deletando,     setDeletando]     = useState(null)
  const [form,          setForm]          = useState(FORM_VAZIO)
  const [saving,        setSaving]        = useState(false)

  const carregar = async () => {
    try {
      const [u, c] = await Promise.all([usuariosAPI.listar(), clientesAPI.listar()])
      setUsuarios(u.data)
      setClientes(c.data)
    } catch { toast.error('Erro ao carregar usuários') }
    finally { setLoading(false) }

    if (isAdmin) {
      try {
        const rr = await usuariosAPI.listarResetRequests()
        setResetRequests(rr.data)
      } catch { /* silencioso — banner simplesmente não aparece */ }
    }
  }
  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setShowModal(true)
  }

  function abrirEditar(u) {
    setEditando(u)
    setForm({ nome: u.nome, email: u.email, senha: '', perfil: u.perfil, cliente_id: u.cliente_id || '', ia_claude: u.ia_claude ?? false, ia_gemini: u.ia_gemini ?? false, ia_openrouter: u.ia_openrouter ?? false, codigo_acesso: u.codigo_acesso || '' })
    setShowModal(true)
  }

  const handleSalvar = async (e) => {
    if (e?.preventDefault) e.preventDefault()
    if (!editando && !form.senha) {
      toast.error('Informe uma senha para o novo usuário')
      return
    }
    setSaving(true)
    try {
      const clienteId = form.cliente_id ? parseInt(form.cliente_id) : null
      // Verifica unicidade do código localmente
      const codigoLimpo = form.codigo_acesso.replace(/\D/g, '').slice(0, 3) || null
      if (codigoLimpo) {
        const codigoJaUsado = usuarios.some(u => {
          if (u.codigo_acesso !== codigoLimpo) return false
          if (editando && u.id === editando.id) return false
          const uClienteId = u.cliente_id || null
          const targetClienteId = clienteId || null
          return uClienteId === targetClienteId
        })
        if (codigoJaUsado) { toast.error('Código de acesso já utilizado por outro usuário nesta empresa'); setSaving(false); return }
      }
      if (editando) {
        const payload = { nome: form.nome, email: form.email, perfil: form.perfil }
        if (form.senha) payload.senha = form.senha
        if (clienteId) payload.cliente_id = clienteId
        if (!clienteId && editando.cliente_id) payload.remover_cliente = true
        if (isAdmin) {
          payload.ia_claude     = form.ia_claude
          payload.ia_gemini     = form.ia_gemini
          payload.ia_openrouter = form.ia_openrouter
        }
        if (codigoLimpo) payload.codigo_acesso = codigoLimpo
        else if (editando.codigo_acesso) payload.remover_codigo = true
        await usuariosAPI.atualizar(editando.id, payload)
        toast.success('Usuário atualizado!')
      } else {
        await usuariosAPI.criar({ ...form, cliente_id: clienteId, codigo_acesso: codigoLimpo })
        toast.success('Usuário criado!')
      }
      setShowModal(false)
      carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar usuário')
    } finally { setSaving(false) }
  }

  const handleExcluir = async () => {
    try {
      await usuariosAPI.excluir(deletando.id)
      toast.success('Usuário excluído.')
      setDeletando(null)
      carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao excluir usuário')
    }
  }

  const handleAtenderReset = async (req) => {
    const u = usuarios.find(x => x.id === req.usuario_id)
    if (u) abrirEditar(u)
    await usuariosAPI.dispensarReset(req.id)
    setResetRequests(prev => prev.filter(r => r.id !== req.id))
  }

  const handleDispensarReset = async (id) => {
    await usuariosAPI.dispensarReset(id)
    setResetRequests(prev => prev.filter(r => r.id !== id))
  }

  const precisaCliente = ['analista', 'ger_projeto', 'ti'].includes(form.perfil)

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Usuários</div>
          <div className="page-sub">{usuarios.length} usuário(s) ativo(s)</div>
        </div>
        <BotaoNovo onClick={abrirNovo}>Novo usuário</BotaoNovo>
      </div>

      {/* Banner solicitações de reset (admin only) */}
      {isAdmin && resetRequests.length > 0 && (
        <div style={{
          background: '#FFF7ED', border: '1px solid #FED7AA',
          borderRadius: 10, padding: '14px 18px', marginBottom: 16,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <KeyRound size={16} color="#EA580C" />
            <span style={{ fontWeight:700, fontSize:13, color:'#EA580C' }}>
              {resetRequests.length} solicitação(ões) de redefinição de senha pendente(s)
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {resetRequests.map(r => (
              <div key={r.id} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                background:'#fff', borderRadius:8, padding:'8px 12px',
                border:'1px solid #FED7AA',
              }}>
                <div>
                  <span style={{ fontWeight:600, fontSize:13 }}>{r.nome}</span>
                  <span style={{ color:'#6b7280', fontSize:12, marginLeft:8 }}>{r.email}</span>
                  <span style={{ color:'#9ca3af', fontSize:11, marginLeft:8 }}>
                    {new Date(r.criado_em).toLocaleString('pt-BR')}
                  </span>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => handleAtenderReset(r)}>
                    Redefinir senha
                  </button>
                  <button className="btn btn-sm btn-ghost" title="Dispensar" onClick={() => handleDispensarReset(r.id)}>
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Código</th><th>Perfil</th><th>Cliente vinculado</th><th></th></tr>
            </thead>
            <tbody>
              {usuarios.map(u => {
                const cliente = clientes.find(c => c.id === u.cliente_id)
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar nome={u.nome} color={CORES[u.perfil] || 'blue'} />
                        <span style={{ fontWeight:500 }}>{u.nome}</span>
                        {isAdmin && (u.ia_claude || u.ia_gemini || u.ia_openrouter) && (
                          <div style={{ display:'flex', gap:3 }}>
                            {u.ia_claude     && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#7c3aed22', color:'#7c3aed', fontWeight:700 }}>C</span>}
                            {u.ia_gemini     && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#1A73E822', color:'#1A73E8', fontWeight:700 }}>G</span>}
                            {u.ia_openrouter && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#f59e0b22', color:'#f59e0b', fontWeight:700 }}>OR</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {u.codigo_acesso
                        ? <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:15, letterSpacing:4, color:'#0A1C4E' }}>{u.codigo_acesso}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td><span className={`badge badge-${CORES[u.perfil] || 'gray'}`}>{PERFIS[u.perfil]}</span></td>
                    <td className="text-muted">{cliente?.razao_social || '—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <BotaoEditar onClick={() => abrirEditar(u)} />
                        <BotaoExcluir onClick={() => setDeletando(u)} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal novo / editar */}
      {showModal && (
        <Modal
          title={editando ? 'Editar usuário' : 'Novo usuário'}
          onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSalvar} disabled={saving}>
              {saving ? 'Salvando...' : editando ? 'Salvar' : 'Criar usuário'}
            </button>
          </>}
        >
          <form onSubmit={handleSalvar}>
            <div className="form-group">
              <label>Nome completo *</label>
              <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label>Código de acesso</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="000"
                  value={form.codigo_acesso}
                  onChange={e => setForm(f => ({...f, codigo_acesso: e.target.value.replace(/\D/g, '').slice(0, 3)}))}
                  style={{ textAlign:'center', letterSpacing:6, fontWeight:700, fontSize:16 }}
                />
                {form.codigo_acesso.length > 0 && form.codigo_acesso.length < 3 && (
                  <div style={{ fontSize:11, color:'var(--red)', marginTop:3 }}>Deve ter 3 dígitos</div>
                )}
                {form.codigo_acesso.length === 3 && usuarios.some(u => {
                  if (u.codigo_acesso !== form.codigo_acesso) return false
                  if (editando && u.id === editando.id) return false
                  const uClienteId = u.cliente_id || null
                  const targetClienteId = form.cliente_id ? parseInt(form.cliente_id) : null
                  return uClienteId === targetClienteId
                }) && (
                  <div style={{ fontSize:11, color:'var(--red)', marginTop:3 }}>Código já utilizado nesta empresa</div>
                )}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group" style={{ flex:1 }}>
                <label>{editando ? 'Nova senha (opcional)' : 'Senha *'}</label>
                <input type="password" value={form.senha}
                  onChange={e => setForm(f => ({...f, senha: e.target.value}))}
                  required={!editando} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Perfil</label>
                <select value={form.perfil} onChange={e => setForm(f => ({...f, perfil: e.target.value, cliente_id: ''}))}>
                  {Object.entries(PERFIS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {precisaCliente && (
                <div className="form-group">
                  <label>Cliente vinculado{form.perfil === 'analista' ? ' *' : ''}</label>
                  <select value={form.cliente_id} onChange={e => setForm(f => ({...f, cliente_id: e.target.value}))}
                    required={form.perfil === 'analista'}>
                    <option value="">Nenhum</option>
                    {clientes.filter(c => c.ativo).map(c => (
                      <option key={c.id} value={c.id}>{c.razao_social}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {/* Toggles de IA — visíveis apenas para admin */}
            {isAdmin && (
              <div style={{ borderTop:'1px solid var(--border)', marginTop:4, paddingTop:14 }}>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Acesso à IA</div>
                {[
                  { key:'ia_claude',     label:'Claude',      sub:'Anthropic',   color:'#7c3aed' },
                  { key:'ia_gemini',     label:'Gemini',      sub:'Google AI',   color:'#1A73E8' },
                  { key:'ia_openrouter', label:'OpenRouter',  sub:'Multi-modelo',color:'#f59e0b' },
                ].map(({ key, label, sub, color }) => (
                  <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div>
                      <span style={{ fontWeight:600, fontSize:13, color }}>{label}</span>
                      <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:6 }}>{sub}</span>
                    </div>
                    <button type="button" onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))} style={{
                      width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
                      background: form[key] ? color : 'var(--border)',
                      position:'relative', flexShrink:0, transition:'background .2s',
                    }}>
                      <span style={{
                        position:'absolute', top:2, left: form[key] ? 20 : 2,
                        width:20, height:20, borderRadius:'50%', background:'#fff',
                        transition:'left .2s', display:'block', boxShadow:'0 1px 3px rgba(0,0,0,.3)',
                      }}/>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Modal confirmar exclusão */}
      {deletando && (
        <Modal
          title="Excluir usuário"
          onClose={() => setDeletando(null)}
          footer={<>
            <button className="btn" onClick={() => setDeletando(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleExcluir}>Excluir</button>
          </>}
        >
          <p style={{ fontSize:14 }}>
            Tem certeza que deseja excluir <strong>{deletando.nome}</strong>?<br/>
            Esta ação não pode ser desfeita.
          </p>
        </Modal>
      )}
    </div>
  )
}
