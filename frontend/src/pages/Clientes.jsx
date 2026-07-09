import { useEffect, useState } from 'react'
import { clientesAPI, refUnidadesAPI, refTemplatesAPI } from '../services/api'
import { Modal, LoadingPage } from '../components/shared'
import { Building2, FolderKanban, TrendingUp, BarChart2, Plus, Edit2, Trash2, Store } from 'lucide-react'
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
  template_dre_padrao_id: '',
}

export default function Clientes() {
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [form,      setForm]      = useState(FORM_VAZIO)
  const [saving,    setSaving]    = useState(false)
  const [templatesDRE, setTemplatesDRE] = useState([])

  // Estados de gestão de Unidades (Filiais)
  const [showUnidadesModal, setShowUnidadesModal] = useState(false)
  const [clienteUnidades, setClienteUnidades] = useState(null)
  const [unidadesList, setUnidadesList] = useState([])
  const [novaUnidade, setNovaUnidade] = useState({ codigo: '', nome: '' })
  const [editandoUnidade, setEditandoUnidade] = useState(null)

  const carregar = async () => {
    try {
      const { data } = await clientesAPI.listar()
      setClientes(data)
    } catch { toast.error('Erro ao carregar clientes') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    carregar()
    refTemplatesAPI.listar('dre', null).then(r => setTemplatesDRE(r.data || [])).catch(() => {})
  }, [])

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
      template_dre_padrao_id:      c.template_dre_padrao_id      || '',
    })
    setShowModal(true)
  }

  const handleSalvar = async e => {
    e.preventDefault(); setSaving(true)
    const payload = {
      ...form,
      template_dre_padrao_id: form.template_dre_padrao_id ? Number(form.template_dre_padrao_id) : null
    }
    try {
      if (editando) await clientesAPI.atualizar(editando.id, payload)
      else          await clientesAPI.criar(payload)
      toast.success(editando ? 'Cliente atualizado!' : 'Cliente criado!')
      setShowModal(false); carregar()
    } catch { toast.error('Erro ao salvar cliente') }
    finally { setSaving(false) }
  }

  const toggleModulo = key =>
    setForm(f => ({ ...f, [key]: !f[key] }))

  // CRUD de Unidades/Filiais
  const abrirUnidades = async (c) => {
    setClienteUnidades(c)
    setNovaUnidade({ codigo: '', nome: '' })
    setEditandoUnidade(null)
    carregarUnidades(c.id)
    setShowUnidadesModal(true)
  }

  const carregarUnidades = async (cid) => {
    try {
      const r = await refUnidadesAPI.listar(cid)
      setUnidadesList(r.data || [])
    } catch {
      toast.error('Erro ao carregar unidades contábeis')
    }
  }

  const salvarUnidade = async (e) => {
    e.preventDefault()
    const cod = String(novaUnidade.codigo || '').trim()
    const nom = String(novaUnidade.nome || '').trim()
    if (!cod || !nom) return toast.error('Preencha código e nome da filial')
    if (cod.length !== 3 || isNaN(cod)) return toast.error('O código da filial deve possuir exatamente 3 dígitos numéricos')

    try {
      if (editandoUnidade) {
        await refUnidadesAPI.atualizar(editandoUnidade.id, { codigo: cod, nome: nom, ativo: true })
        toast.success('Filial atualizada com sucesso!')
      } else {
        await refUnidadesAPI.criar(clienteUnidades.id, { codigo: cod, nome: nom, ativo: true })
        toast.success('Nova filial adicionada!')
      }
      setNovaUnidade({ codigo: '', nome: '' })
      setEditandoUnidade(null)
      carregarUnidades(clienteUnidades.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar filial')
    }
  }

  const deletarUnidade = async (uid) => {
    if (!confirm('Deseja realmente remover esta filial contábil? Lançamentos associados podem ficar órfãos.')) return
    try {
      await refUnidadesAPI.deletar(uid)
      toast.success('Filial removida com sucesso!')
      carregarUnidades(clienteUnidades.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover filial')
    }
  }

  const iniciarEditarUnidade = (u) => {
    setEditandoUnidade(u)
    setNovaUnidade({ codigo: String(u.codigo || ''), nome: String(u.nome || '') })
  }

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <style>{`
        .btn-acao-tabela {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          border-radius: 6px;
          color: var(--text-muted, #6b7280) !important;
          cursor: pointer;
          transition: background .2s, color .2s;
        }
        .btn-acao-tabela:hover {
          background: var(--border-color, rgba(0, 0, 0, 0.05));
          color: var(--text, #111827) !important;
        }
      `}</style>
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
                  <th>Email</th><th>Telefone</th><th>Módulos ativos</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Unidades</th>
                  <th style={{ textAlign: 'center', width: 90 }}>Editar</th>
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
                    <td style={{ textAlign: 'center' }}>
                      {c.modulo_analises_gerenciais ? (
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          <button 
                            className="btn-acao-tabela" 
                            onClick={() => abrirUnidades(c)} 
                            title="Ver filiais contábeis" 
                            aria-label="Ver unidades"
                          >
                            <Store size={18} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted, #6b7280)', opacity: 0.35 }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button 
                          className="btn-acao-tabela" 
                          onClick={() => abrirEditar(c)} 
                          title="Editar cliente" 
                          aria-label="Editar cliente"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo/Editar Cliente */}
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

            {/* Template DRE Padrão do Cliente */}
            {form.modulo_analises_gerenciais && (
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Template DRE Padrão (Carregamento automático)</label>
                <select 
                  value={form.template_dre_padrao_id} 
                  onChange={e => setForm(f => ({...f, template_dre_padrao_id: e.target.value}))}
                >
                  <option value="">Selecione um template padrão...</option>
                  {templatesDRE.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            )}

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

      {/* Modal Gestão de Unidades (Filiais) do Cliente */}
      {showUnidadesModal && clienteUnidades && (
        <Modal
          title={`Filiais / Unidades Contábeis — ${clienteUnidades.razao_social}`}
          onClose={() => setShowUnidadesModal(false)}
          footer={<button className="btn btn-primary" onClick={() => setShowUnidadesModal(false)}>Concluir</button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Formulário de Adicionar/Editar */}
            <form onSubmit={salvarUnidade} style={{ display: 'flex', gap: 10, background: 'var(--surface, #fafafa)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: '0 0 90px' }}>
                <label style={{ fontSize: 11 }}>Código (3 d.) *</label>
                <input 
                  value={novaUnidade.codigo} 
                  onChange={e => setNovaUnidade(u => ({...u, codigo: e.target.value.slice(0, 3)}))}
                  placeholder="100" 
                  maxLength={3}
                  required 
                />
              </div>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label style={{ fontSize: 11 }}>Nome da Unidade/Filial *</label>
                <input 
                  value={novaUnidade.nome} 
                  onChange={e => setNovaUnidade(u => ({...u, nome: e.target.value}))}
                  placeholder="Nome amigável da filial" 
                  required 
                />
              </div>
              <button className="btn btn-primary" type="submit" style={{ display: 'flex', alignItems: 'center', gap: 4, height: 38 }}>
                <Plus size={14} />
                {editandoUnidade ? 'Salvar' : 'Adicionar'}
              </button>
              {editandoUnidade && (
                <button className="btn" type="button" onClick={() => { setEditandoUnidade(null); setNovaUnidade({ codigo: '', nome: '' }) }} style={{ height: 38 }}>
                  Cancelar
                </button>
              )}
            </form>

            {/* Listagem */}
            <div className="table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
              <table style={{ fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-header, #f3f4f6)' }}>
                    <th>Código</th>
                    <th>Nome da Filial</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {unidadesList.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                        Nenhuma filial cadastrada para este cliente. Elas também podem ser criadas automaticamente durante a importação.
                      </td>
                    </tr>
                  ) : (
                    unidadesList.map(u => (
                      <tr key={u.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{u.codigo}</td>
                        <td>{u.nome}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn-sm btn-ghost" onClick={() => iniciarEditarUnidade(u)} style={{ padding: 4 }}>
                              <Edit2 size={13} />
                            </button>
                            <button className="btn btn-sm btn-ghost" onClick={() => deletarUnidade(u.id)} style={{ padding: 4, color: '#ef4444' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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
