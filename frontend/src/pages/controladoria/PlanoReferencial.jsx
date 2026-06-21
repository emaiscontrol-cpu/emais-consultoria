import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, GitBranch } from 'lucide-react'
import { refPlanoAPI } from '../../services/api'
import { Modal } from '../../components/shared'
import toast from 'react-hot-toast'

const TIPO_LABEL = { sintetica: 'Sintética', analitica: 'Analítica' }
const NAT_LABEL  = { soma: 'Soma (+)', subtrai: 'Subtrai (−)' }

function ContaRow({ conta, nivel, planoId, onRefresh }) {
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState(false)
  const [criandoSub, setCriandoSub] = useState(false)
  const [form, setForm] = useState({})
  const temFilhos = conta.filhos?.length > 0

  const abrirEdicao = () => {
    setForm({
      codigo: conta.codigo, descricao: conta.descricao,
      tipo: conta.tipo, natureza: conta.natureza || '',
      agrupamento: conta.agrupamento || '',
    })
    setEditando(true)
  }

  const salvarEdicao = async () => {
    try {
      await refPlanoAPI.atualizarConta(conta.id, form)
      toast.success('Conta atualizada')
      setEditando(false)
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar')
    }
  }

  const excluir = async () => {
    if (!confirm(`Excluir a conta "${conta.codigo} — ${conta.descricao}"?`)) return
    try {
      await refPlanoAPI.deletarConta(conta.id)
      toast.success('Conta removida')
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao excluir')
    }
  }

  const salvarSub = async (dados) => {
    try {
      await refPlanoAPI.criarSubconta(conta.id, dados)
      toast.success('Sub-conta criada')
      setCriandoSub(false)
      setAberto(true)
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao criar sub-conta')
    }
  }

  return (
    <>
      <tr style={{ background: nivel % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
        <td style={{ paddingLeft: nivel * 20 + 12, display: 'flex', alignItems: 'center', gap: 4, paddingTop: 8, paddingBottom: 8 }}>
          {temFilhos
            ? <button onClick={() => setAberto(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            : <span style={{ width: 18 }} />
          }
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', marginRight: 4 }}>{conta.codigo}</span>
          <span style={{ fontWeight: conta.tipo === 'sintetica' ? 700 : 400 }}>{conta.descricao}</span>
        </td>
        <td style={{ textAlign: 'center', fontSize: 12 }}>
          <span style={{ background: conta.tipo === 'sintetica' ? 'var(--brand-light)' : 'var(--surface-hover)', borderRadius: 4, padding: '2px 8px' }}>
            {TIPO_LABEL[conta.tipo] || conta.tipo}
          </span>
        </td>
        <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {conta.tipo === 'analitica' ? (NAT_LABEL[conta.natureza] || '—') : '—'}
        </td>
        <td style={{ textAlign: 'center', fontSize: 11, fontFamily: 'monospace', color: 'var(--brand)' }}>
          {conta.agrupamento || '—'}
        </td>
        <td style={{ textAlign: 'right', paddingRight: 12 }}>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
            <button title="Criar sub-conta" onClick={() => setCriandoSub(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <GitBranch size={13} />
            </button>
            <button title="Editar" onClick={abrirEdicao}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <Pencil size={13} />
            </button>
            <button title="Excluir" onClick={excluir}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}>
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>

      {aberto && conta.filhos?.map(f => (
        <ContaRow key={f.id} conta={f} nivel={nivel + 1} planoId={planoId} onRefresh={onRefresh} />
      ))}

      {editando && (
        <FormContaModal
          titulo="Editar Conta"
          inicial={form}
          onSalvar={salvarEdicao}
          onFechar={() => setEditando(false)}
          onChange={setForm}
        />
      )}

      {criandoSub && (
        <FormContaModal
          titulo={`Nova sub-conta de: ${conta.codigo}`}
          inicial={{ codigo: '', descricao: '', tipo: 'analitica', natureza: 'soma', agrupamento: '' }}
          onSalvar={salvarSub}
          onFechar={() => setCriandoSub(false)}
        />
      )}
    </>
  )
}

function FormContaModal({ titulo, inicial, onSalvar, onFechar, onChange }) {
  const [form, setForm] = useState(inicial)
  const update = (k, v) => {
    const novo = { ...form, [k]: v }
    setForm(novo)
    onChange?.(novo)
  }

  return (
    <Modal titulo={titulo} onClose={onFechar}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="form-group">
          <label>Código</label>
          <input value={form.codigo} onChange={e => update('codigo', e.target.value)} placeholder="ex: 3.1.1" />
        </div>
        <div className="form-group">
          <label>Descrição</label>
          <input value={form.descricao} onChange={e => update('descricao', e.target.value)} placeholder="Nome da conta" />
        </div>
        <div className="form-group">
          <label>Tipo</label>
          <select value={form.tipo} onChange={e => update('tipo', e.target.value)}>
            <option value="sintetica">Sintética (agrupadora)</option>
            <option value="analitica">Analítica (recebe lançamento)</option>
          </select>
        </div>
        {form.tipo === 'analitica' && (
          <>
            <div className="form-group">
              <label>Natureza</label>
              <select value={form.natureza || ''} onChange={e => update('natureza', e.target.value)}>
                <option value="soma">Soma (+)</option>
                <option value="subtrai">Subtrai (−)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Agrupamento <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(código para fórmulas)</span></label>
              <input value={form.agrupamento || ''} onChange={e => update('agrupamento', e.target.value)}
                placeholder="ex: receita_bruta" style={{ fontFamily: 'monospace' }} />
            </div>
          </>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onSalvar(form)}>Salvar</button>
        </div>
      </div>
    </Modal>
  )
}

export default function PlanoReferencial() {
  const [planos, setPlanos] = useState([])
  const [planoId, setPlanoId] = useState(null)
  const [contas, setContas] = useState([])
  const [criando, setCriando] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refPlanoAPI.listar().then(r => {
      setPlanos(r.data)
      if (r.data.length > 0) setPlanoId(r.data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!planoId) return
    carregar()
  }, [planoId])

  const carregar = async () => {
    setLoading(true)
    try {
      const r = await refPlanoAPI.listarContas(planoId)
      setContas(r.data)
    } finally {
      setLoading(false)
    }
  }

  const criarConta = async (dados) => {
    try {
      await refPlanoAPI.criarConta(planoId, dados)
      toast.success('Conta criada')
      setCriando(false)
      carregar()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao criar conta')
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Plano de Contas Referencial</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Plano centralizado — moeda comum entre todos os clientes
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCriando(true)}>
          <Plus size={14} /> Nova Conta
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Conta / Descrição</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Tipo</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Natureza</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Agrupamento</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map(c => (
                <ContaRow key={c.id} conta={c} nivel={0} planoId={planoId} onRefresh={carregar} />
              ))}
              {contas.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {criando && (
        <FormContaModal
          titulo="Nova Conta Raiz"
          inicial={{ codigo: '', descricao: '', tipo: 'analitica', natureza: 'soma', agrupamento: '' }}
          onSalvar={criarConta}
          onFechar={() => setCriando(false)}
        />
      )}
    </div>
  )
}
