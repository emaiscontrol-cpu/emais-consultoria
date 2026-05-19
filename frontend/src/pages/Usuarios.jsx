import { useEffect, useState } from 'react'
import { usuariosAPI, clientesAPI } from '../services/api'
import { Modal, Avatar, LoadingPage } from '../components/shared'
import toast from 'react-hot-toast'

const PERFIS = { admin:'Administrador', consultor:'Consultor', ger_projeto:'Ger. Projeto', cliente:'Cliente' }

export default function Usuarios() {
  const [usuarios,  setUsuarios]  = useState([])
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nome:'', email:'', senha:'', perfil:'consultor', cliente_id:'' })
  const [saving, setSaving] = useState(false)

  const carregar = async () => {
    try {
      const [u, c] = await Promise.all([usuariosAPI.listar(), clientesAPI.listar()])
      setUsuarios(u.data); setClientes(c.data)
    } catch { toast.error('Erro ao carregar usuários') }
    finally { setLoading(false) }
  }
  useEffect(() => { carregar() }, [])

  const handleSalvar = async e => {
    e.preventDefault(); setSaving(true)
    try {
      await usuariosAPI.criar({ ...form, cliente_id: form.cliente_id ? parseInt(form.cliente_id) : null })
      toast.success('Usuário criado!')
      setShowModal(false)
      setForm({ nome:'', email:'', senha:'', perfil:'consultor', cliente_id:'' })
      carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao criar usuário')
    } finally { setSaving(false) }
  }

  const handleDesativar = async id => {
    if (!confirm('Desativar este usuário?')) return
    await usuariosAPI.desativar(id)
    toast.success('Usuário desativado')
    carregar()
  }

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Usuários</div>
          <div className="page-sub">{usuarios.length} usuário(s) ativo(s)</div>
        </div>
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}>+ Novo usuário</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Cliente vinculado</th><th></th></tr></thead>
            <tbody>
              {usuarios.map(u => {
                const cliente = clientes.find(c => c.id === u.cliente_id)
                const colors = { admin:'blue', consultor:'teal', ger_projeto:'amber', cliente:'purple' }
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Avatar nome={u.nome} color={colors[u.perfil]||'blue'} />
                        <span style={{ fontWeight:500 }}>{u.nome}</span>
                      </div>
                    </td>
                    <td className="text-muted">{u.email}</td>
                    <td><span className={`badge badge-${colors[u.perfil]||'gray'}`}>{PERFIS[u.perfil]}</span></td>
                    <td className="text-muted">{cliente?.razao_social || '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-danger" onClick={()=>handleDesativar(u.id)}>Desativar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <Modal title="Novo usuário" onClose={()=>setShowModal(false)}
          footer={<>
            <button className="btn" onClick={()=>setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSalvar} disabled={saving}>
              {saving ? 'Salvando...' : 'Criar usuário'}
            </button>
          </>}
        >
          <form onSubmit={handleSalvar}>
            <div className="form-group"><label>Nome completo *</label>
              <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required /></div>
            <div className="form-row">
              <div className="form-group"><label>Email *</label>
                <input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required /></div>
              <div className="form-group"><label>Senha *</label>
                <input type="password" value={form.senha} onChange={e=>setForm(f=>({...f,senha:e.target.value}))} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Perfil</label>
                <select value={form.perfil} onChange={e=>setForm(f=>({...f,perfil:e.target.value}))}>
                  {Object.entries(PERFIS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              {form.perfil === 'cliente' && (
                <div className="form-group"><label>Cliente vinculado</label>
                  <select value={form.cliente_id} onChange={e=>setForm(f=>({...f,cliente_id:e.target.value}))}>
                    <option value="">Selecionar...</option>
                    {clientes.map(c=><option key={c.id} value={c.id}>{c.razao_social}</option>)}
                  </select>
                </div>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
