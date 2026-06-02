import { useEffect, useState } from 'react'
import { usuariosAPI, clientesAPI } from '../services/api'
import { Modal, Avatar, LoadingPage } from '../components/shared'
import { Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const PERFIS = { admin:'Administrador', consultor:'Consultor', ger_projeto:'Ger. Projeto', cliente:'Cliente', ti:'T.I' }
const CORES  = { admin:'blue', consultor:'teal', ger_projeto:'amber', cliente:'purple', ti:'green' }
const FORM_VAZIO = { nome:'', email:'', senha:'', perfil:'consultor', cliente_id:'' }

export default function Usuarios() {
  const [usuarios,  setUsuarios]  = useState([])
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [deletando, setDeletando] = useState(null)
  const [form,      setForm]      = useState(FORM_VAZIO)
  const [saving,    setSaving]    = useState(false)

  const carregar = async () => {
    try {
      const [u, c] = await Promise.all([usuariosAPI.listar(), clientesAPI.listar()])
      setUsuarios(u.data); setClientes(c.data)
    } catch { toast.error('Erro ao carregar usuários') }
    finally { setLoading(false) }
  }
  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_VAZIO)
    setShowModal(true)
  }

  function abrirEditar(u) {
    setEditando(u)
    setForm({ nome: u.nome, email: u.email, senha: '', perfil: u.perfil, cliente_id: u.cliente_id || '' })
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
      if (editando) {
        const payload = { nome: form.nome, email: form.email, perfil: form.perfil }
        if (form.senha) payload.senha = form.senha
        if (clienteId) payload.cliente_id = clienteId
        if (!clienteId && editando.cliente_id) payload.remover_cliente = true
        await usuariosAPI.atualizar(editando.id, payload)
        toast.success('Usuário atualizado!')
      } else {
        await usuariosAPI.criar({ ...form, cliente_id: clienteId })
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

  const precisaCliente = ['cliente', 'ger_projeto', 'ti'].includes(form.perfil)

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Usuários</div>
          <div className="page-sub">{usuarios.length} usuário(s) ativo(s)</div>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>+ Novo usuário</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Cliente vinculado</th><th></th></tr>
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
                      </div>
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td><span className={`badge badge-${CORES[u.perfil] || 'gray'}`}>{PERFIS[u.perfil]}</span></td>
                    <td className="text-muted">{cliente?.razao_social || '—'}</td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => abrirEditar(u)} title="Editar">
                          <Pencil size={13}/>
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setDeletando(u)} title="Excluir"
                          style={{ color:'var(--red)' }}>
                          <Trash2 size={13}/>
                        </button>
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
                  <label>Cliente vinculado{form.perfil === 'cliente' ? ' *' : ''}</label>
                  <select value={form.cliente_id} onChange={e => setForm(f => ({...f, cliente_id: e.target.value}))}
                    required={form.perfil === 'cliente'}>
                    <option value="">Nenhum</option>
                    {clientes.filter(c => c.ativo).map(c => (
                      <option key={c.id} value={c.id}>{c.razao_social}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
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
