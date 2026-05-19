import { useEffect, useState } from 'react'
import { clientesAPI } from '../services/api'
import { Modal, LoadingPage } from '../components/shared'
import { Building2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Clientes() {
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [form, setForm] = useState({ razao_social:'', cnpj:'', contato_nome:'', contato_email:'', contato_fone:'' })
  const [saving, setSaving] = useState(false)

  const carregar = async () => {
    try {
      const { data } = await clientesAPI.listar()
      setClientes(data)
    } catch { toast.error('Erro ao carregar clientes') }
    finally { setLoading(false) }
  }
  useEffect(() => { carregar() }, [])

  const abrirNovo = () => {
    setEditando(null)
    setForm({ razao_social:'', cnpj:'', contato_nome:'', contato_email:'', contato_fone:'' })
    setShowModal(true)
  }
  const abrirEditar = c => {
    setEditando(c)
    setForm({ razao_social:c.razao_social, cnpj:c.cnpj||'', contato_nome:c.contato_nome||'', contato_email:c.contato_email||'', contato_fone:c.contato_fone||'' })
    setShowModal(true)
  }
  const handleSalvar = async e => {
    e.preventDefault(); setSaving(true)
    try {
      if (editando) await clientesAPI.atualizar(editando.id, form)
      else await clientesAPI.criar(form)
      toast.success(editando ? 'Cliente atualizado!' : 'Cliente criado!')
      setShowModal(false); carregar()
    } catch { toast.error('Erro ao salvar cliente') }
    finally { setSaving(false) }
  }

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-sub">{clientes.length} cliente(s) cadastrado(s)</div>
        </div>
        <button className="btn btn-primary" onClick={abrirNovo}>+ Novo cliente</button>
      </div>

      <div className="card">
        {clientes.length === 0 ? (
          <div className="empty-state">
            <Building2 size={32} style={{ display:'block', margin:'0 auto 8px' }}/>
            <div>Nenhum cliente cadastrado</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Razão social</th><th>CNPJ</th><th>Contato</th><th>Email</th><th>Telefone</th><th></th></tr>
              </thead>
              <tbody>
                {clientes.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight:600 }}>{c.razao_social}</td>
                    <td className="text-muted">{c.cnpj || '—'}</td>
                    <td>{c.contato_nome || '—'}</td>
                    <td className="text-muted">{c.contato_email || '—'}</td>
                    <td className="text-muted">{c.contato_fone || '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={()=>abrirEditar(c)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal title={editando ? 'Editar cliente' : 'Novo cliente'} onClose={()=>setShowModal(false)}
          footer={<>
            <button className="btn" onClick={()=>setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSalvar} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>}
        >
          <form onSubmit={handleSalvar}>
            <div className="form-group"><label>Razão social *</label>
              <input value={form.razao_social} onChange={e=>setForm(f=>({...f,razao_social:e.target.value}))} required /></div>
            <div className="form-row">
              <div className="form-group"><label>CNPJ</label>
                <input value={form.cnpj} onChange={e=>setForm(f=>({...f,cnpj:e.target.value}))} placeholder="00.000.000/0001-00" /></div>
              <div className="form-group"><label>Nome do contato</label>
                <input value={form.contato_nome} onChange={e=>setForm(f=>({...f,contato_nome:e.target.value}))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Email</label>
                <input type="email" value={form.contato_email} onChange={e=>setForm(f=>({...f,contato_email:e.target.value}))} /></div>
              <div className="form-group"><label>Telefone</label>
                <input value={form.contato_fone} onChange={e=>setForm(f=>({...f,contato_fone:e.target.value}))} /></div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
