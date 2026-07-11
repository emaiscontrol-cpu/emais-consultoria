import { useEffect, useState, useRef } from 'react'
import { clientesAPI, refTemplatesAPI } from '../services/api'
import { Modal, LoadingPage } from '../components/shared'
import { BotaoEditar, BotaoExcluir, BotaoNovo } from '../components/ui'
import { Building2, FolderKanban, TrendingUp, BarChart2, Store, Check, X } from 'lucide-react'
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
  unidades: []
}

const UNIDADE_FORM_VAZIO = {
  codigo: '', nome: '', cnpj: '',
  endereco_logradouro: '', endereco_numero: '', endereco_complemento: '',
  endereco_bairro: '', endereco_cidade: '', endereco_estado: '', endereco_cep: ''
}

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

export default function Clientes() {
  const [clientes,  setClientes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editando,  setEditando]  = useState(null)
  const [form,      setForm]      = useState(FORM_VAZIO)
  const [saving,    setSaving]    = useState(false)
  const [templatesDRE, setTemplatesDRE] = useState([])

  // Controle de Abas no Modal de Cliente ('geral' ou 'unidades')
  const [abaAtiva, setAbaAtiva] = useState('geral')

  // Confirmação em 2 etapas para exclusão de cliente
  const [clienteExcluindo, setClienteExcluindo] = useState(null)

  // Confirmação em 2 etapas para remoção de unidade (dentro do modal)
  const [unidadeRemovendoIdx, setUnidadeRemovendoIdx] = useState(null)

  // Formulário interno de unidade (dentro do modal)
  const [unidadeForm, setUnidadeForm] = useState(UNIDADE_FORM_VAZIO)
  const [editandoUnidadeIdx, setEditandoUnidadeIdx] = useState(null)

  // Edição inline (rápida) de Código/Nome direto na célula da tabela de unidades
  const [unidadeInlineEdit, setUnidadeInlineEdit] = useState(null) // { idx, campo, valor }

  // Linha de adição inline (rápida) de nova unidade, direto na tabela
  const [novaUnidade, setNovaUnidade] = useState({ codigo: '', nome: '' })
  const [novaUnidadeErro, setNovaUnidadeErro] = useState(null) // { campo: 'codigo'|'nome', msg }
  const novaUnidadeCodigoRef = useRef(null)
  const novaUnidadeNomeRef = useRef(null)

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
    setForm({ ...FORM_VAZIO, unidades: [] })
    setUnidadeForm(UNIDADE_FORM_VAZIO)
    setEditandoUnidadeIdx(null)
    setUnidadeInlineEdit(null)
    setNovaUnidade({ codigo: '', nome: '' })
    setNovaUnidadeErro(null)
    setAbaAtiva('geral')
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
      unidades:                    c.unidades                    || []
    })
    setUnidadeForm(UNIDADE_FORM_VAZIO)
    setEditandoUnidadeIdx(null)
    setUnidadeInlineEdit(null)
    setNovaUnidade({ codigo: '', nome: '' })
    setNovaUnidadeErro(null)
    setAbaAtiva('geral')
    setShowModal(true)
  }

  const abrirExcluirCliente = c => {
    setClienteExcluindo(c)
  }

  const handleSalvar = async e => {
    e.preventDefault(); setSaving(true)

    // Rede de segurança: se houver texto pendente na linha inline de adição
    // (não confirmado com Enter/✓), tratar antes de montar o payload.
    let unidadesFinal = form.unidades || []
    const codPendente = String(novaUnidade.codigo || '').trim()
    const nomPendente = String(novaUnidade.nome || '').trim()
    if (codPendente || nomPendente) {
      const val = validarNovaUnidade(codPendente, nomPendente, unidadesFinal)
      if (!val.ok) {
        setAbaAtiva('unidades')
        setNovaUnidadeErro({ campo: val.campo, msg: val.msg })
        setSaving(false)
        ;(val.campo === 'codigo' ? novaUnidadeCodigoRef : novaUnidadeNomeRef).current?.focus()
        return toast.error(val.msg)
      }
      unidadesFinal = [...unidadesFinal, { ...UNIDADE_FORM_VAZIO, codigo: val.codigo, nome: val.nome }]
      setForm(f => ({ ...f, unidades: unidadesFinal }))
      setNovaUnidade({ codigo: '', nome: '' })
    }

    // Validar se há alguma unidade na lista com código inconsistente
    const invalidUnidade = unidadesFinal.find(u => !u.codigo || u.codigo.length !== 3 || isNaN(u.codigo))
    if (invalidUnidade) {
      setAbaAtiva('unidades')
      setSaving(false)
      return toast.error(`A unidade "${invalidUnidade.nome}" possui código inválido. O código deve ter exatamente 3 dígitos numéricos.`)
    }

    // Validar unicidade de código entre as unidades do cliente
    const codigos = unidadesFinal.map(u => String(u.codigo))
    const codigoDuplicado = codigos.find((cod, idx) => codigos.indexOf(cod) !== idx)
    if (codigoDuplicado) {
      setAbaAtiva('unidades')
      setSaving(false)
      return toast.error(`Existem unidades duplicadas com o código '${codigoDuplicado}'. Cada unidade deve ter um código único.`)
    }

    const payload = {
      ...form,
      unidades: unidadesFinal,
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

  // Exclusão de cliente (2 etapas)
  const confirmarExcluirCliente = async () => {
    if (!clienteExcluindo) return
    try {
      await clientesAPI.deletar(clienteExcluindo.id)
      toast.success('Cliente excluído com sucesso!')
      setClienteExcluindo(null)
      carregar()
    } catch {
      toast.error('Erro ao excluir cliente')
    }
  }

  // Manipuladores da lista local de Unidades do Formulário
  const formatarCNPJ = (v) => {
    v = v.replace(/\D/g, '')
    if (v.length > 14) v = v.slice(0, 14)
    if (v.length <= 2) return v
    if (v.length <= 5) return `${v.slice(0, 2)}.${v.slice(2)}`
    if (v.length <= 8) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`
    if (v.length <= 12) return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`
    return `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`
  }

  const formatarCEP = (v) => {
    v = v.replace(/\D/g, '')
    if (v.length > 8) v = v.slice(0, 8)
    if (v.length <= 5) return v
    return `${v.slice(0, 5)}-${v.slice(5)}`
  }

  const handleAdicionarUnidade = (e) => {
    e.preventDefault()
    const cod = String(unidadeForm.codigo || '').trim()
    const nom = String(unidadeForm.nome || '').trim()
    const doc = String(unidadeForm.cnpj || '').trim()
    const cep = String(unidadeForm.endereco_cep || '').trim()

    if (cod.length !== 3 || isNaN(cod)) {
      return toast.error('O código da unidade deve ter exatamente 3 dígitos numéricos')
    }
    if (!nom) {
      return toast.error('O nome da unidade é obrigatório')
    }
    if (doc && doc.replace(/\D/g, '').length !== 14) {
      return toast.error('CNPJ da unidade inválido (deve conter 14 dígitos)')
    }
    if (cep && cep.replace(/\D/g, '').length !== 8) {
      return toast.error('CEP da unidade inválido (deve conter 8 dígitos)')
    }

    const unidades = form.unidades || []

    // Validar duplicidade local por código
    const dupCod = unidades.some((u, idx) => u.codigo === cod && idx !== editandoUnidadeIdx)
    if (dupCod) return toast.error(`Código de unidade '${cod}' já está adicionado neste cliente`)

    const dupNom = unidades.some((u, idx) => u.nome.toLowerCase() === nom.toLowerCase() && idx !== editandoUnidadeIdx)
    if (dupNom) return toast.error(`Nome de unidade '${nom}' já está adicionado neste cliente`)

    let novas = [...unidades]
    if (editandoUnidadeIdx !== null) {
      novas[editandoUnidadeIdx] = { ...unidadeForm, codigo: cod, nome: nom }
      toast.success('Unidade atualizada no formulário!')
    } else {
      novas.push({ ...unidadeForm, codigo: cod, nome: nom })
      toast.success('Unidade adicionada ao formulário!')
    }

    setForm(f => ({ ...f, unidades: novas }))
    setUnidadeForm(UNIDADE_FORM_VAZIO)
    setEditandoUnidadeIdx(null)
  }

  const iniciarEditarUnidadeLocal = (idx) => {
    setUnidadeInlineEdit(null)
    setEditandoUnidadeIdx(idx)
    setUnidadeForm({ ...form.unidades[idx] })
  }

  const confirmarRemoverUnidadeLocal = () => {
    if (unidadeRemovendoIdx === null) return
    setUnidadeInlineEdit(null)
    const novas = [...form.unidades]
    novas.splice(unidadeRemovendoIdx, 1)
    setForm(f => ({ ...f, unidades: novas }))
    setUnidadeRemovendoIdx(null)
    toast.success('Unidade removida do formulário!')
  }

  // Edição inline (rápida) de Código/Nome direto na célula, sem abrir o formulário completo
  const iniciarEdicaoInlineUnidade = (idx, campo) => {
    setEditandoUnidadeIdx(null)
    setUnidadeInlineEdit({ idx, campo, valor: String(form.unidades[idx][campo] ?? '') })
  }

  const cancelarEdicaoInlineUnidade = () => setUnidadeInlineEdit(null)

  const confirmarEdicaoInlineUnidade = () => {
    if (!unidadeInlineEdit) return
    const { idx, campo, valor } = unidadeInlineEdit
    const unidades = form.unidades || []

    if (campo === 'codigo') {
      const cod = String(valor).trim()
      if (cod.length !== 3 || isNaN(cod)) {
        return toast.error('O código da unidade deve ter exatamente 3 dígitos numéricos')
      }
      const dup = unidades.some((u, i) => i !== idx && u.codigo === cod)
      if (dup) {
        return toast.error(`Código de unidade '${cod}' já está adicionado neste cliente`)
      }
      const novas = [...unidades]
      novas[idx] = { ...novas[idx], codigo: cod }
      setForm(f => ({ ...f, unidades: novas }))
    } else if (campo === 'nome') {
      const nome = String(valor).trim()
      if (!nome) {
        return toast.error('O nome da unidade é obrigatório')
      }
      const dup = unidades.some((u, i) => i !== idx && u.nome.toLowerCase() === nome.toLowerCase())
      if (dup) {
        return toast.error(`Nome de unidade '${nome}' já está adicionado neste cliente`)
      }
      const novas = [...unidades]
      novas[idx] = { ...novas[idx], nome }
      setForm(f => ({ ...f, unidades: novas }))
    }
    setUnidadeInlineEdit(null)
  }

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmarEdicaoInlineUnidade() }
    else if (e.key === 'Escape') { e.preventDefault(); cancelarEdicaoInlineUnidade() }
  }

  // Validação reaproveitada (mesmas regras de handleAdicionarUnidade/confirmarEdicaoInlineUnidade)
  // para a linha de adição inline de nova unidade
  const validarNovaUnidade = (codigo, nome, unidadesExistentes) => {
    const cod = String(codigo || '').trim()
    const nom = String(nome || '').trim()
    if (cod.length !== 3 || isNaN(cod)) {
      return { ok: false, campo: 'codigo', msg: 'O código da unidade deve ter exatamente 3 dígitos numéricos' }
    }
    if (!nom) {
      return { ok: false, campo: 'nome', msg: 'O nome da unidade é obrigatório' }
    }
    if (unidadesExistentes.some(u => u.codigo === cod)) {
      return { ok: false, campo: 'codigo', msg: `Código de unidade '${cod}' já está adicionado neste cliente` }
    }
    if (unidadesExistentes.some(u => u.nome.toLowerCase() === nom.toLowerCase())) {
      return { ok: false, campo: 'nome', msg: `Nome de unidade '${nom}' já está adicionado neste cliente` }
    }
    return { ok: true, codigo: cod, nome: nom }
  }

  const confirmarNovaUnidadeInline = () => {
    const val = validarNovaUnidade(novaUnidade.codigo, novaUnidade.nome, form.unidades || [])
    if (!val.ok) {
      setNovaUnidadeErro({ campo: val.campo, msg: val.msg })
      ;(val.campo === 'codigo' ? novaUnidadeCodigoRef : novaUnidadeNomeRef).current?.focus()
      return
    }
    setForm(f => ({ ...f, unidades: [...(f.unidades || []), { ...UNIDADE_FORM_VAZIO, codigo: val.codigo, nome: val.nome }] }))
    setNovaUnidade({ codigo: '', nome: '' })
    setNovaUnidadeErro(null)
    novaUnidadeCodigoRef.current?.focus()
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
          cursor: pointer;
          transition: background .2s, color .2s;
        }
        .btn-acao-tabela:hover {
          background: var(--border-color, rgba(0, 0, 0, 0.05));
        }
      `}</style>
      <div className="page-header">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-sub">{clientes.length} cliente(s) cadastrado(s)</div>
        </div>
        <BotaoNovo onClick={abrirNovo}>Novo cliente</BotaoNovo>
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
                  <th style={{ textAlign: 'center', width: 100 }}>Ações</th>
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
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <BotaoEditar onClick={() => abrirEditar(c)} title="Editar cliente" />
                        <BotaoExcluir onClick={() => abrirExcluirCliente(c)} title="Excluir cliente" />
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
          {/* Navegação por Abas para Eliminar o Scroll Duplo */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border, #eaeaea)', marginBottom: 20, gap: 16 }}>
            <button
              type="button"
              onClick={() => setAbaAtiva('geral')}
              style={{
                padding: '10px 4px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${abaAtiva === 'geral' ? 'var(--brand)' : 'transparent'}`,
                color: abaAtiva === 'geral' ? 'var(--brand)' : 'var(--text-muted, #6b7280)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all .2s'
              }}
            >
              Geral
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva('unidades')}
              style={{
                padding: '10px 4px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${abaAtiva === 'unidades' ? 'var(--brand)' : 'transparent'}`,
                color: abaAtiva === 'unidades' ? 'var(--brand)' : 'var(--text-muted, #6b7280)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all .2s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <Store size={14} /> Unidades ({(form.unidades || []).length})
            </button>
          </div>

          <form onSubmit={handleSalvar} style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
            
            {/* ABA GERAL */}
            {abaAtiva === 'geral' && (
              <div>
                <div className="form-group">
                  <label>Razão social *</label>
                  <input value={form.razao_social} onChange={e => setForm(f => ({...f, razao_social: e.target.value}))} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>CNPJ</label>
                    <input 
                      value={form.cnpj} 
                      onChange={e => setForm(f => ({...f, cnpj: formatarCNPJ(e.target.value)}))} 
                      placeholder="00.000.000/0001-00" 
                    />
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

                {/* Template DRE Padrão */}
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

                {/* Módulos Contratados */}
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
                </div>
              </div>
            )}

            {/* ABA UNIDADES */}
            {abaAtiva === 'unidades' && (
              <div>
                <div style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: '.06em',
                  textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 6
                }}>
                  <Store size={15} /> Unidades do Cliente
                </div>

                {/* Tabela de Unidades Locais Adicionadas */}
                <div className="table-wrap" style={{ marginBottom: 16 }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-header, #f3f4f6)' }}>
                        <th>Código</th>
                        <th>Unidade</th>
                        <th>CNPJ</th>
                        <th>Cidade/UF</th>
                        <th style={{ textAlign: 'right', width: 80 }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(form.unidades || []).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px' }}>
                            Nenhuma unidade adicionada neste cliente. Use a linha abaixo para adicionar.
                          </td>
                        </tr>
                      )}
                      {
                        form.unidades.map((u, idx) => (
                          <tr key={idx}>
                            <td
                              style={{ fontFamily: 'monospace', fontWeight: 600, cursor: 'pointer' }}
                              onDoubleClick={() => iniciarEdicaoInlineUnidade(idx, 'codigo')}
                              title="Duplo-clique para editar rapidamente"
                            >
                              {unidadeInlineEdit?.idx === idx && unidadeInlineEdit?.campo === 'codigo' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onDoubleClick={e => e.stopPropagation()}>
                                  <input
                                    autoFocus
                                    value={unidadeInlineEdit.valor}
                                    onChange={e => setUnidadeInlineEdit(s => ({ ...s, valor: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                                    onKeyDown={handleInlineKeyDown}
                                    onBlur={confirmarEdicaoInlineUnidade}
                                    onFocus={e => e.target.select()}
                                    maxLength={3}
                                    style={{ width: 36, fontFamily: 'monospace', fontWeight: 600, padding: '2px 4px' }}
                                  />
                                  <button type="button" className="btn-acao-tabela" style={{ width: 20, height: 20, padding: 0 }} title="Confirmar" onMouseDown={e => e.preventDefault()} onClick={confirmarEdicaoInlineUnidade}>
                                    <Check size={12} color="#16a34a" />
                                  </button>
                                  <button type="button" className="btn-acao-tabela" style={{ width: 20, height: 20, padding: 0 }} title="Cancelar" onMouseDown={e => e.preventDefault()} onClick={cancelarEdicaoInlineUnidade}>
                                    <X size={12} color="#ef4444" />
                                  </button>
                                </div>
                              ) : u.codigo}
                            </td>
                            <td
                              style={{ cursor: 'pointer' }}
                              onDoubleClick={() => iniciarEdicaoInlineUnidade(idx, 'nome')}
                              title="Duplo-clique para editar rapidamente"
                            >
                              {unidadeInlineEdit?.idx === idx && unidadeInlineEdit?.campo === 'nome' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onDoubleClick={e => e.stopPropagation()}>
                                  <input
                                    autoFocus
                                    value={unidadeInlineEdit.valor}
                                    onChange={e => setUnidadeInlineEdit(s => ({ ...s, valor: e.target.value }))}
                                    onKeyDown={handleInlineKeyDown}
                                    onBlur={confirmarEdicaoInlineUnidade}
                                    onFocus={e => e.target.select()}
                                    style={{ flex: 1, minWidth: 80, padding: '2px 4px' }}
                                  />
                                  <button type="button" className="btn-acao-tabela" style={{ width: 20, height: 20, padding: 0, flexShrink: 0 }} title="Confirmar" onMouseDown={e => e.preventDefault()} onClick={confirmarEdicaoInlineUnidade}>
                                    <Check size={12} color="#16a34a" />
                                  </button>
                                  <button type="button" className="btn-acao-tabela" style={{ width: 20, height: 20, padding: 0, flexShrink: 0 }} title="Cancelar" onMouseDown={e => e.preventDefault()} onClick={cancelarEdicaoInlineUnidade}>
                                    <X size={12} color="#ef4444" />
                                  </button>
                                </div>
                              ) : u.nome}
                            </td>
                            <td className="text-muted">{u.cnpj || '—'}</td>
                            <td className="text-muted">{u.endereco_cidade ? `${u.endereco_cidade}/${u.endereco_estado || '—'}` : '—'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <BotaoEditar onClick={() => iniciarEditarUnidadeLocal(idx)} title="Editar unidade" />
                                <BotaoExcluir onClick={() => setUnidadeRemovendoIdx(idx)} title="Remover unidade" />
                              </div>
                            </td>
                          </tr>
                        ))
                      }

                      {/* Linha de adição inline de nova unidade */}
                      <tr style={{ background: 'var(--surface, #fafafa)' }}>
                        <td>
                          <input
                            ref={novaUnidadeCodigoRef}
                            value={novaUnidade.codigo}
                            onChange={e => { setNovaUnidade(n => ({ ...n, codigo: e.target.value.replace(/\D/g, '').slice(0, 3) })); setNovaUnidadeErro(null) }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); novaUnidadeNomeRef.current?.focus() } }}
                            placeholder="100"
                            maxLength={3}
                            style={{
                              width: 40, fontFamily: 'monospace', fontWeight: 600, padding: '4px 6px',
                              border: novaUnidadeErro?.campo === 'codigo' ? '1px solid #ef4444' : undefined
                            }}
                          />
                        </td>
                        <td>
                          <input
                            ref={novaUnidadeNomeRef}
                            value={novaUnidade.nome}
                            onChange={e => { setNovaUnidade(n => ({ ...n, nome: e.target.value })); setNovaUnidadeErro(null) }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarNovaUnidadeInline() } }}
                            placeholder="Nome da unidade"
                            style={{
                              width: '100%', padding: '4px 6px',
                              border: novaUnidadeErro?.campo === 'nome' ? '1px solid #ef4444' : undefined
                            }}
                          />
                        </td>
                        <td className="text-muted">—</td>
                        <td className="text-muted">—</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {(() => {
                              const podeConfirmar = validarNovaUnidade(novaUnidade.codigo, novaUnidade.nome, form.unidades || []).ok
                              return (
                                <button
                                  type="button"
                                  className="btn-acao-tabela"
                                  disabled={!podeConfirmar}
                                  onClick={confirmarNovaUnidadeInline}
                                  style={{ padding: 4, width: 28, height: 28, opacity: podeConfirmar ? 1 : 0.35, cursor: podeConfirmar ? 'pointer' : 'default' }}
                                  title="Adicionar unidade"
                                >
                                  <Check size={14} color="#16a34a" />
                                </button>
                              )
                            })()}
                            <button
                              type="button"
                              className="btn-acao-tabela"
                              onClick={() => { setNovaUnidade({ codigo: '', nome: '' }); setNovaUnidadeErro(null) }}
                              style={{ padding: 4, width: 28, height: 28 }}
                              title="Limpar"
                            >
                              <X size={14} color="#ef4444" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {novaUnidadeErro && (
                        <tr>
                          <td colSpan={5} style={{ color: '#ef4444', fontSize: 11, padding: '4px 8px' }}>
                            {novaUnidadeErro.msg}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Formulário completo — só no fluxo do lápis (editar unidade existente) */}
                {editandoUnidadeIdx !== null && (
                <div style={{
                  background: 'var(--surface, #fafafa)',
                  border: '1.5px dashed var(--border, #e5e7eb)',
                  borderRadius: 8,
                  padding: 16,
                  marginTop: 10
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
                    ✏️ Editar Unidade
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Linha 1 */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="form-group" style={{ margin: 0, flex: '0 0 90px' }}>
                        <label style={{ fontSize: 11 }}>Código (3 d.) *</label>
                        <input 
                          value={unidadeForm.codigo} 
                          onChange={e => setUnidadeForm(u => ({...u, codigo: e.target.value.replace(/\D/g, '').slice(0, 3)}))}
                          placeholder="100"
                          maxLength={3}
                          required
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: 1 }}>
                        <label style={{ fontSize: 11 }}>Nome da Unidade *</label>
                        <input
                          value={unidadeForm.nome}
                          onChange={e => setUnidadeForm(u => ({...u, nome: e.target.value}))}
                          placeholder="Nome da unidade"
                          required
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: 1 }}>
                        <label style={{ fontSize: 11 }}>CNPJ da Unidade</label>
                        <input 
                          value={unidadeForm.cnpj} 
                          onChange={e => setUnidadeForm(u => ({...u, cnpj: formatarCNPJ(e.target.value)}))}
                          placeholder="00.000.000/0001-00" 
                        />
                      </div>
                    </div>

                    {/* Linha 2 */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="form-group" style={{ margin: 0, flex: '0 0 110px' }}>
                        <label style={{ fontSize: 11 }}>CEP</label>
                        <input 
                          value={unidadeForm.endereco_cep} 
                          onChange={e => setUnidadeForm(u => ({...u, endereco_cep: formatarCEP(e.target.value)}))}
                          placeholder="00000-000" 
                          maxLength={9}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: 1 }}>
                        <label style={{ fontSize: 11 }}>Logradouro (Endereço)</label>
                        <input 
                          value={unidadeForm.endereco_logradouro} 
                          onChange={e => setUnidadeForm(u => ({...u, endereco_logradouro: e.target.value}))}
                          placeholder="Av. Principal, Rua, etc." 
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: '0 0 90px' }}>
                        <label style={{ fontSize: 11 }}>Número</label>
                        <input 
                          value={unidadeForm.endereco_numero} 
                          onChange={e => setUnidadeForm(u => ({...u, endereco_numero: e.target.value}))}
                          placeholder="S/N" 
                        />
                      </div>
                    </div>

                    {/* Linha 3 */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div className="form-group" style={{ margin: 0, flex: 1 }}>
                        <label style={{ fontSize: 11 }}>Complemento</label>
                        <input 
                          value={unidadeForm.endereco_complemento} 
                          onChange={e => setUnidadeForm(u => ({...u, endereco_complemento: e.target.value}))}
                          placeholder="Sala, Andar, Bloco, etc." 
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: 1 }}>
                        <label style={{ fontSize: 11 }}>Bairro</label>
                        <input 
                          value={unidadeForm.endereco_bairro} 
                          onChange={e => setUnidadeForm(u => ({...u, endereco_bairro: e.target.value}))}
                          placeholder="Bairro" 
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: 1 }}>
                        <label style={{ fontSize: 11 }}>Cidade</label>
                        <input 
                          value={unidadeForm.endereco_cidade} 
                          onChange={e => setUnidadeForm(u => ({...u, endereco_cidade: e.target.value}))}
                          placeholder="Cidade" 
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0, flex: '0 0 90px' }}>
                        <label style={{ fontSize: 11 }}>Estado</label>
                        <select 
                          value={unidadeForm.endereco_estado} 
                          onChange={e => setUnidadeForm(u => ({...u, endereco_estado: e.target.value}))}
                        >
                          <option value="">UF</option>
                          {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Botões do Formulário de Unidades */}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
                      <button
                        className="btn"
                        type="button"
                        onClick={() => { setUnidadeForm(UNIDADE_FORM_VAZIO); setEditandoUnidadeIdx(null); }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        onClick={handleAdicionarUnidade}
                        style={{ borderColor: 'var(--brand)', color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 4 }}
                      >
                        <Check size={14} />
                        Concluir
                      </button>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* MODAL 2 ETAPAS: Excluir Cliente */}
      {clienteExcluindo && (
        <Modal
          title="Excluir Cliente"
          onClose={() => setClienteExcluindo(null)}
          footer={<>
            <button className="btn" onClick={() => setClienteExcluindo(null)}>Cancelar</button>
            <button 
              className="btn btn-danger" 
              onClick={confirmarExcluirCliente} 
              style={{ background: '#ef4444', color: '#fff' }}
            >
              Confirmar exclusão
            </button>
          </>}
        >
          <div style={{ padding: '8px 0' }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              Tem certeza que deseja excluir o cliente <strong>{clienteExcluindo.razao_social}</strong>?
            </p>
            <p style={{ color: '#ef4444', fontSize: 12, marginTop: 12, lineHeight: 1.4, background: '#ef44440f', padding: '10px 12px', borderRadius: 6, border: '1px solid #ef444426' }}>
              <strong>Atenção:</strong> Esta ação é irreversível e excluirá também todas as unidades e dados de demonstrativos (realizados e lançamentos contábeis) vinculados a este cliente.
            </p>
          </div>
        </Modal>
      )}

      {/* MODAL 2 ETAPAS: Remover Unidade */}
      {unidadeRemovendoIdx !== null && (
        <Modal
          title="Confirmar Remoção da Unidade"
          onClose={() => setUnidadeRemovendoIdx(null)}
          footer={<>
            <button className="btn" onClick={() => setUnidadeRemovendoIdx(null)}>Cancelar</button>
            <button 
              className="btn btn-danger" 
              onClick={confirmarRemoverUnidadeLocal} 
              style={{ background: '#ef4444', color: '#fff' }}
            >
              Confirmar remoção
            </button>
          </>}
        >
          <div style={{ padding: '8px 0' }}>
            <p style={{ margin: 0, fontSize: 14 }}>
              Tem certeza que deseja remover a unidade <strong>{form.unidades[unidadeRemovendoIdx]?.nome} ({form.unidades[unidadeRemovendoIdx]?.codigo})</strong> deste formulário?
            </p>
            <p style={{ color: '#ef4444', fontSize: 12, marginTop: 12, lineHeight: 1.4 }}>
              * A remoção só será definitiva e gravada no banco de dados quando você clicar em <strong>Salvar</strong> no formulário principal do cliente.
            </p>
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
