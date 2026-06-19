import { useEffect, useState } from 'react'
import { clientesAPI } from '../services/api'
import { Modal, LoadingPage } from '../components/shared'
import { Building2, FolderKanban, TrendingUp, BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'

const MODULOS = [
  {
    key:   'modulo_projetos',
    label: 'Projetos',
    desc:  'Gestão de projetos, fases, tarefas, atividades e dashboards.',
    icon:  FolderKanban,
    cor:   'var(--brand)',
  },
  {
    key:   'modulo_inteligencia_mercado',
    label: 'Inteligência de Mercado',
    desc:  'Análises de mercado, benchmarks e indicadores competitivos.',
    icon:  TrendingUp,
    cor:   '#7c3aed',
  },
  {
    key:   'modulo_analises_gerenciais',
    label: 'Análises Gerenciais',
    desc:  'DRE, Fluxo de Caixa, Balancete e Controle Orçamentário.',
    icon:  BarChart2,
    cor:   '#059669',
  },
]

const FORM_VAZIO = {
  razao_social: '', cnpj: '', contato_nome: '', contato_email: '', contato_fone: '',
  modulo_projetos: true, modulo_inteligencia_mercado: false, modulo_analises_gerenciais: false,
}

export default function Clientes() {
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [form,      setForm]      = useState(FORM_VAZIO)
  const [saving,    setSaving]    = useState(false)

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
    setForm(FORM_VAZIO)
    setShowModal(true)
  }

  const abrirEditar = c => {
    setEditando(c)
    setForm({
      razao_social:  c.razao_social,
      cnpj:          c.cnpj          || '',
      contato_nome:  c.contato_nome  || '',
      contato_email: c.contato_email || '',
      contato_fone:  c.contato_fone  || '',
      modulo_projetos:             c.modulo_projetos             ?? true,
      modulo_inteligencia_mercado: c.modulo_inteligencia_mercado ?? false,
      modulo_analises_gerenciais:  c.modulo_analises_gerenciais  ?? false,
    })
    setShowModal(true)
  }

  const handleSalvar = async e => {
    e.preventDefault(); setSaving(true)
    try {
      if (editando) await clientesAPI.atualizar(editando.id, form)
      else          await clientesAPI.criar(form)
      toast.success(editando ? 'Cliente atualizado!' : 'Cliente criado!')
      setShowModal(false); carregar()
    } catch { toast.error('Erro ao salvar cliente') }
    finally { setSaving(false) }
  }

  const toggleModulo = key =>
    setForm(f => ({ ...f, [key]: !f[key] }))

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
                <tr>
                  <th>Razão social</th><th>CNPJ</th><th>Contato</th>
                  <th>Email</th><th>Telefone</th><th>Módulos ativos</th><th></th>
                </tr>
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
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {c.modulo_projetos             && <Tag cor="var(--brand)">Projetos</Tag>}
                        {c.modulo_inteligencia_mercado && <Tag cor="#7c3aed">Int. Mercado</Tag>}
                        {c.modulo_analises_gerenciais  && <Tag cor="#059669">Análises</Tag>}
                        {!c.modulo_projetos && !c.modulo_inteligencia_mercado && !c.modulo_analises_gerenciais && (
                          <span className="text-muted" style={{ fontSize:12 }}>Nenhum</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={() => abrirEditar(c)}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <Modal
          title={editando ? 'Editar cliente' : 'Novo cliente'}
          onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSalvar} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>}
        >
          <form onSubmit={handleSalvar}>
            <div className="form-group">
              <label>Razão social *</label>
              <input value={form.razao_social} onChange={e => setForm(f => ({...f, razao_social: e.target.value}))} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>CNPJ</label>
                <input value={form.cnpj} onChange={e => setForm(f => ({...f, cnpj: e.target.value}))} placeholder="00.000.000/0001-00" />
              </div>
              <div className="form-group">
                <label>Nome do contato</label>
                <input value={form.contato_nome} onChange={e => setForm(f => ({...f, contato_nome: e.target.value}))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.contato_email} onChange={e => setForm(f => ({...f, contato_email: e.target.value}))} />
              </div>
              <div className="form-group">
                <label>Telefone</label>
                <input value={form.contato_fone} onChange={e => setForm(f => ({...f, contato_fone: e.target.value}))} />
              </div>
            </div>

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{
                fontSize: 12, fontWeight: 700, letterSpacing: '.06em',
                textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10,
              }}>
                Módulos contratados
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MODULOS.map(({ key, label, desc, icon: Icon, cor }) => {
                  const ativo = form[key]
                  return (
                    <div
                      key={key}
                      onClick={() => toggleModulo(key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                        border: `1.5px solid ${ativo ? cor : 'var(--border)'}`,
                        background: ativo ? cor + '0d' : 'var(--surface, #fafafa)',
                        transition: 'border-color .15s, background .15s',
                        userSelect: 'none',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                        background: ativo ? cor + '18' : '#f0f0f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background .15s',
                      }}>
                        <Icon size={18} color={ativo ? cor : '#999'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: ativo ? cor : 'var(--text)' }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          {desc}
                        </div>
                      </div>
                      <Toggle ativo={ativo} cor={cor} />
                    </div>
                  )
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                As permissões entram em vigor no próximo login dos usuários deste cliente.
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

function Toggle({ ativo, cor }) {
  return (
    <div style={{
      width: 38, height: 21, borderRadius: 11, flexShrink: 0,
      background: ativo ? cor : '#d1d5db',
      position: 'relative',
      transition: 'background .2s',
    }}>
      <div style={{
        position: 'absolute', top: 3,
        left: ativo ? 19 : 3,
        width: 15, height: 15, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        transition: 'left .2s',
      }} />
    </div>
  )
}

function Tag({ cor, children }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px',
      borderRadius: 99, background: cor + '18', color: cor,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}
