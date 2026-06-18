import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projetosAPI, clientesAPI, modelosAPI } from '../services/api'
import { Badge, Progress, LoadingPage, Modal } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import { FolderKanban, FileDown, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { relatoriosAPI } from '../services/api'
import toast from 'react-hot-toast'

export default function Projetos() {
  const { usuario } = useAuth()
  const navigate = useNavigate()
  const [projetos,  setProjetos]  = useState([])
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ nome:'', descricao:'', cliente_id:'', data_inicio:'', data_fim_prev:'', template_id:'' })
  const [templates, setTemplates] = useState([])
  const [saving, setSaving] = useState(false)
  const [showNovoCliente, setShowNovoCliente] = useState(false)
  const [formCliente, setFormCliente] = useState({ razao_social:'', cnpj:'', contato_nome:'', contato_email:'', contato_fone:'' })
  const [savingCliente, setSavingCliente] = useState(false)

  const isConsultor = ['admin','consultor','ger_projeto'].includes(usuario?.perfil)
  const [busca, setBusca] = useState('')
  const [exportando, setExportando] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId,    setEditingId]    = useState(null)
  const [formEdit,     setFormEdit]     = useState({ nome:'', descricao:'', cliente_id:'', data_inicio:'', data_fim_prev:'' })
  const [savingEdit,   setSavingEdit]   = useState(false)

  const handleExportar = async () => {
    setExportando(true)
    try {
      const { data } = await relatoriosAPI.projetosExcel()
      const url = URL.createObjectURL(data)
      const a = document.createElement('a'); a.href = url
      a.download = `relatorio_${new Date().toISOString().slice(0,10)}.xlsx`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Relatório gerado!')
    } catch { toast.error('Erro ao gerar relatório') }
    finally { setExportando(false) }
  }

  const projetosFiltrados = projetos.filter(p => {
    const q = busca.toLowerCase()
    const nomeCliente = clientes.find(c => c.id === p.cliente_id)?.razao_social || ''
    return p.nome.toLowerCase().includes(q) || nomeCliente.toLowerCase().includes(q)
  })

  useEffect(() => {
    Promise.all([
      projetosAPI.listar(),
      isConsultor ? clientesAPI.listar() : Promise.resolve({ data: [] }),
      isConsultor ? modelosAPI.listar() : Promise.resolve({ data: [] }),
    ]).then(([p, c, t]) => {
      setProjetos(p.data)
      setClientes(c.data)
      setTemplates(t.data)
    }).catch(() => toast.error('Erro ao carregar projetos'))
    .finally(() => setLoading(false))
  }, [])

  const handleSalvarCliente = async e => {
    e.preventDefault()
    setSavingCliente(true)
    try {
      const { data: novoCliente } = await clientesAPI.criar(formCliente)
      toast.success('Cliente criado!')
      const { data: lista } = await clientesAPI.listar()
      setClientes(lista)
      setForm(f => ({ ...f, cliente_id: String(novoCliente.id) }))
      setShowNovoCliente(false)
      setFormCliente({ razao_social:'', cnpj:'', contato_nome:'', contato_email:'', contato_fone:'' })
    } catch { toast.error('Erro ao criar cliente') }
    finally { setSavingCliente(false) }
  }

  const handleSalvar = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: novoProjeto } = await projetosAPI.criar({
        nome: form.nome,
        descricao: form.descricao || null,
        cliente_id: parseInt(form.cliente_id),
        data_inicio: form.data_inicio || null,
        data_fim_prev: form.data_fim_prev || null,
      })
      if (form.template_id) {
        try {
          await modelosAPI.aplicar(parseInt(form.template_id), novoProjeto.id)
          toast.success('Projeto criado com template aplicado!')
        } catch {
          toast.success('Projeto criado! (template não pôde ser aplicado)')
        }
      } else {
        toast.success('Projeto criado!')
      }
      setShowModal(false)
      const { data } = await projetosAPI.listar()
      setProjetos(data)
    } catch {
      toast.error('Erro ao criar projeto')
    } finally {
      setSaving(false)
    }
  }

  const handleAbrirEditar = (e, p) => {
    e.stopPropagation()
    setEditingId(p.id)
    setFormEdit({
      nome: p.nome,
      descricao: p.descricao || '',
      cliente_id: String(p.cliente_id || ''),
      data_inicio: p.data_inicio ? new Date(p.data_inicio).toISOString().slice(0,10) : '',
      data_fim_prev: p.data_fim_prev ? new Date(p.data_fim_prev).toISOString().slice(0,10) : '',
    })
    setShowEditModal(true)
  }

  const handleSalvarEdicao = async () => {
    setSavingEdit(true)
    try {
      await projetosAPI.atualizar(editingId, {
        nome: formEdit.nome,
        descricao: formEdit.descricao || null,
        cliente_id: parseInt(formEdit.cliente_id),
        data_inicio: formEdit.data_inicio || null,
        data_fim_prev: formEdit.data_fim_prev || null,
      })
      toast.success('Projeto atualizado!')
      setShowEditModal(false)
      const { data } = await projetosAPI.listar()
      setProjetos(data)
    } catch { toast.error('Erro ao atualizar projeto') }
    finally { setSavingEdit(false) }
  }

  const handleExcluir = async (e, p) => {
    e.stopPropagation()
    if (!confirm(`Excluir o projeto "${p.nome}"? Esta ação não pode ser desfeita.`)) return
    try {
      await projetosAPI.deletar(p.id)
      toast.success('Projeto excluído!')
      setProjetos(prev => prev.filter(x => x.id !== p.id))
    } catch { toast.error('Erro ao excluir projeto') }
  }

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Projetos</div>
          <div className="page-sub">{projetosFiltrados.length} projeto(s) encontrado(s)</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input
            placeholder="Buscar por nome ou cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ padding:'6px 12px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', fontSize:13, width:240 }}
          />
          <button className="btn btn-ghost" onClick={handleExportar} disabled={exportando} title="Exportar Excel">
            <FileDown size={15}/> {exportando ? 'Gerando...' : 'Exportar'}
          </button>
          {isConsultor && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Novo projeto</button>
          )}
        </div>
      </div>

      <div className="card">
        {projetosFiltrados.length === 0 ? (
          <div className="empty-state">
            <FolderKanban size={32} style={{ margin:'0 auto 8px', display:'block' }} />
            <div>{busca ? 'Nenhum projeto encontrado para essa busca' : 'Nenhum projeto ainda'}</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th>Início</th>
                  <th>Previsão fim</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projetosFiltrados.map(p => (
                  <tr key={p.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/projetos/${p.id}`)}>
                    <td style={{ fontWeight:600 }}>{p.nome}</td>
                    <td className="text-muted">{clientes.find(c => c.id === p.cliente_id)?.razao_social || '—'}</td>
                    <td><Badge status={p.status} /></td>
                    <td style={{ minWidth:140 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Progress value={p.progresso} />
                        <span className="text-sm text-muted">{p.progresso}%</span>
                      </div>
                    </td>
                    <td className="text-muted text-sm">
                      {p.data_inicio ? new Date(p.data_inicio).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="text-muted text-sm">
                      {p.data_fim_prev ? new Date(p.data_fim_prev).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ whiteSpace:'nowrap' }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/projetos/${p.id}`)}>Ver →</button>
                      {isConsultor && (<>
                        <button className="btn btn-sm btn-ghost" style={{ padding:'3px 6px', marginLeft:2 }} title="Editar projeto"
                          onClick={e => handleAbrirEditar(e, p)}>
                          <Pencil size={13} />
                        </button>
                        <button className="btn btn-sm btn-ghost" style={{ padding:'3px 6px', marginLeft:2, color:'var(--red)' }} title="Excluir projeto"
                          onClick={e => handleExcluir(e, p)}>
                          <Trash2 size={13} />
                        </button>
                      </>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditModal && (
        <Modal title="Editar projeto" onClose={() => setShowEditModal(false)}
          footer={<>
            <button className="btn" onClick={() => setShowEditModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSalvarEdicao} disabled={savingEdit || !formEdit.nome || !formEdit.cliente_id}>
              {savingEdit ? 'Salvando...' : 'Salvar'}
            </button>
          </>}>
          <div className="form-group">
            <label>Nome do projeto *</label>
            <input value={formEdit.nome} onChange={e => setFormEdit(f => ({...f, nome: e.target.value}))} />
          </div>
          <div className="form-group">
            <label>Cliente *</label>
            <select value={formEdit.cliente_id} onChange={e => setFormEdit(f => ({...f, cliente_id: e.target.value}))}>
              <option value="">Selecionar cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <textarea value={formEdit.descricao} onChange={e => setFormEdit(f => ({...f, descricao: e.target.value}))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Data de início</label>
              <input type="date" value={formEdit.data_inicio} onChange={e => setFormEdit(f => ({...f, data_inicio: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Previsão de término</label>
              <input type="date" value={formEdit.data_fim_prev} onChange={e => setFormEdit(f => ({...f, data_fim_prev: e.target.value}))} />
            </div>
          </div>
        </Modal>
      )}

      {showModal && (
        <Modal title="Novo projeto" onClose={() => { setShowModal(false); setShowNovoCliente(false) }}
          footer={!showNovoCliente && <>
            <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSalvar} disabled={saving || !form.nome || !form.cliente_id}>
              {saving ? 'Salvando...' : 'Criar projeto'}
            </button>
          </>}
        >
          {/* Formulário de projeto */}
          {!showNovoCliente && (
            <div>
              <div className="form-group">
                <label>Nome do projeto *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Ex: Implantação ERP" />
              </div>
              <div className="form-group">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                  <label style={{ margin:0 }}>Cliente *</label>
                  <button type="button" className="btn btn-ghost btn-sm"
                    style={{ fontSize:11, padding:'2px 8px', gap:4 }}
                    onClick={() => setShowNovoCliente(true)}>
                    <Plus size={11}/> Incluir cliente
                  </button>
                </div>
                <select value={form.cliente_id} onChange={e=>setForm(f=>({...f,cliente_id:e.target.value}))}>
                  <option value="">Selecionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <textarea value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Objetivo do projeto..." />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Data de início</label>
                  <input type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>Previsão de término</label>
                  <input type="date" value={form.data_fim_prev} onChange={e=>setForm(f=>({...f,data_fim_prev:e.target.value}))} />
                </div>
              </div>
              {templates.length > 0 && (
                <div className="form-group">
                  <label>Template de fases (opcional)</label>
                  <select value={form.template_id} onChange={e=>setForm(f=>({...f,template_id:e.target.value}))}>
                    <option value="">— Sem template (projeto em branco) —</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.nome} ({t.total_fases} fases, {t.total_tarefas} tarefas)</option>
                    ))}
                  </select>
                  {form.template_id && (
                    <span style={{ fontSize:11, color:'var(--brand)', marginTop:3, display:'block' }}>
                      As fases e tarefas serão criadas automaticamente ao salvar.
                      {form.data_inicio ? ' Prazos calculados a partir da data de início.' : ' Informe a data de início para calcular os prazos automaticamente.'}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Formulário de novo cliente (tela separada dentro do modal) */}
          {showNovoCliente && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNovoCliente(false)}>
                  ← Voltar
                </button>
                <span style={{ fontSize:13, fontWeight:600 }}>Novo cliente</span>
              </div>
              <div className="form-group">
                <label>Razão social *</label>
                <input value={formCliente.razao_social} onChange={e=>setFormCliente(f=>({...f,razao_social:e.target.value}))}
                  placeholder="Nome da empresa..." autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>CNPJ</label>
                  <input value={formCliente.cnpj} onChange={e=>setFormCliente(f=>({...f,cnpj:e.target.value}))}
                    placeholder="00.000.000/0001-00" />
                </div>
                <div className="form-group">
                  <label>Nome do contato</label>
                  <input value={formCliente.contato_nome} onChange={e=>setFormCliente(f=>({...f,contato_nome:e.target.value}))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={formCliente.contato_email} onChange={e=>setFormCliente(f=>({...f,contato_email:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>Telefone</label>
                  <input value={formCliente.contato_fone} onChange={e=>setFormCliente(f=>({...f,contato_fone:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <button type="button" className="btn btn-primary" onClick={handleSalvarCliente}
                  disabled={savingCliente || !formCliente.razao_social}>
                  {savingCliente ? 'Salvando...' : 'Salvar cliente'}
                </button>
                <button type="button" className="btn" onClick={() => setShowNovoCliente(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
