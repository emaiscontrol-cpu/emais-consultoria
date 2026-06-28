import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, GitBranch, X, CornerDownRight, Zap, Link } from 'lucide-react'
import { refPlanoAPI, fluxoCaixaAPI } from '../../services/api'
import { Modal } from '../../components/shared'
import toast from 'react-hot-toast'

const TIPO_LABEL = { sintetica: 'Sintética', analitica: 'Analítica' }
const NAT_LABEL  = { soma: 'Soma (+)', subtrai: 'Subtrai (−)' }
const DEMO_LABEL = { fluxo_caixa: 'FC', dre: 'DRE', orcamento: 'Orç' }
const DEMO_COR   = {
  fluxo_caixa: { bg: '#FEF3C7', text: '#B45309' },
  dre:         { bg: '#EDE9FE', text: '#6D28D9' },
  orcamento:   { bg: '#DBEAFE', text: '#1D4ED8' },
}

// ── Badge de vínculo ──────────────────────────────────────────────────────────
function BadgeVinculo({ v, onRemover }) {
  const cor = DEMO_COR[v.demonstrativo] || { bg: 'var(--surface-hover)', text: 'var(--text-muted)' }
  const estilo = v.herdado
    ? { background: 'var(--surface-hover)', color: 'var(--text-muted)', opacity: 0.8 }
    : { background: cor.bg, color: cor.text }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      borderRadius: 4, padding: '2px 5px', fontSize: 10, fontWeight: 500,
      ...estilo,
    }}>
      {v.herdado && <CornerDownRight size={9} />}
      {v.agrupamento_nome}
      <span style={{ opacity: 0.7 }}>· {DEMO_LABEL[v.demonstrativo] || v.demonstrativo}</span>
      {!v.herdado && onRemover && (
        <button onClick={e => { e.stopPropagation(); onRemover(v.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0, marginLeft: 1 }}>
          <X size={9} />
        </button>
      )}
    </span>
  )
}

// ── Painel inline de vinculação ───────────────────────────────────────────────
function PainelVincular({ conta, nivel, agrupamentos, onSalvo, onFechar }) {
  const [form, setForm] = useState({ agrupamento_id: '', demonstrativo: 'fluxo_caixa', propagar: false })
  const [sugestoes, setSugestoes] = useState([])
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    refPlanoAPI.sugerirAgrupamento(conta.id)
      .then(r => setSugestoes(r.data))
      .catch(() => {})
  }, [conta.id])

  const salvar = async () => {
    if (!form.agrupamento_id) { toast.error('Selecione um agrupamento'); return }
    setSalvando(true)
    try {
      await refPlanoAPI.vincularAgrupamento(conta.id, {
        agrupamento_id: Number(form.agrupamento_id),
        demonstrativo: form.demonstrativo,
        propagar: form.propagar,
      })
      toast.success('Vínculo criado' + (form.propagar ? ' e propagado para filhas' : ''))
      onSalvo()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao criar vínculo')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <tr>
      <td colSpan={5} style={{ padding: '8px 12px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ paddingLeft: nivel * 20 + 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sugestoes.length > 0 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sugestões:</span>
              {sugestoes.map(s => (
                <button key={s.id} onClick={() => setForm(f => ({ ...f, agrupamento_id: String(s.id) }))}
                  style={{
                    background: form.agrupamento_id === String(s.id) ? 'var(--brand)' : 'var(--surface-hover)',
                    color: form.agrupamento_id === String(s.id) ? '#fff' : 'var(--text)',
                    border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
                  }}>
                  {s.nome} <span style={{ opacity: 0.7 }}>{Math.round(s.confianca * 100)}%</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ minWidth: 240, margin: 0 }}>
              <label style={{ fontSize: 11 }}>Agrupamento</label>
              <select value={form.agrupamento_id} onChange={e => setForm(f => ({ ...f, agrupamento_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {agrupamentos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ minWidth: 140, margin: 0 }}>
              <label style={{ fontSize: 11 }}>Demonstrativo</label>
              <select value={form.demonstrativo} onChange={e => setForm(f => ({ ...f, demonstrativo: e.target.value }))}>
                <option value="fluxo_caixa">Fluxo de Caixa</option>
                <option value="dre">DRE</option>
                <option value="orcamento">Orçamento</option>
              </select>
            </div>
            {conta.tipo === 'sintetica' && conta.filhos?.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, marginBottom: 2, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.propagar}
                  onChange={e => setForm(f => ({ ...f, propagar: e.target.checked }))} />
                Propagar para filhas diretas
              </label>
            )}
            <button className="btn btn-primary" style={{ height: 32, fontSize: 12 }} onClick={salvar} disabled={salvando}>
              Salvar
            </button>
            <button className="btn" style={{ height: 32, fontSize: 12 }} onClick={onFechar}>
              Cancelar
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Linha de conta ────────────────────────────────────────────────────────────
function ContaRow({ conta, nivel, planoId, agrupamentos, onRefresh }) {
  const [aberto, setAberto]       = useState(false)
  const [editando, setEditando]   = useState(false)
  const [criandoSub, setCriandoSub] = useState(false)
  const [vinculando, setVinculando] = useState(false)
  const [form, setForm]           = useState({})
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

  const removerVinculo = async (vinculoId) => {
    try {
      await refPlanoAPI.removerVinculo(conta.id, vinculoId)
      toast.success('Vínculo removido')
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao remover vínculo')
    }
  }

  const vinculos = conta.vinculos || []

  return (
    <>
      <tr style={{ background: nivel % 2 === 0 ? 'var(--surface)' : 'transparent' }}>
        {/* Conta / Descrição */}
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

        {/* Tipo */}
        <td style={{ textAlign: 'center', fontSize: 12 }}>
          <span style={{ background: conta.tipo === 'sintetica' ? 'var(--brand-light)' : 'var(--surface-hover)', borderRadius: 4, padding: '2px 8px' }}>
            {TIPO_LABEL[conta.tipo] || conta.tipo}
          </span>
        </td>

        {/* Natureza */}
        <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
          {conta.tipo === 'analitica' ? (NAT_LABEL[conta.natureza] || '—') : '—'}
        </td>

        {/* Agrupamento — nova coluna de vínculos */}
        <td style={{ paddingLeft: 8, paddingRight: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', minHeight: 24 }}>
            {vinculos.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
            )}
            {vinculos.map(v => (
              <BadgeVinculo key={v.id} v={v} onRemover={!v.herdado ? removerVinculo : null} />
            ))}
            <button
              title="Vincular agrupamento"
              onClick={() => setVinculando(v => !v)}
              style={{
                background: vinculando ? 'var(--brand)' : 'none',
                color: vinculando ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 4,
                cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1px 4px',
              }}>
              <Link size={10} />
            </button>
          </div>
        </td>

        {/* Ações */}
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

      {/* Painel inline de vinculação */}
      {vinculando && (
        <PainelVincular
          conta={conta}
          nivel={nivel}
          agrupamentos={agrupamentos}
          onSalvo={() => { setVinculando(false); onRefresh() }}
          onFechar={() => setVinculando(false)}
        />
      )}

      {/* Filhos */}
      {aberto && conta.filhos?.map(f => (
        <ContaRow key={f.id} conta={f} nivel={nivel + 1} planoId={planoId}
          agrupamentos={agrupamentos} onRefresh={onRefresh} />
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

// ── Modal de conta ────────────────────────────────────────────────────────────
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
              <label>Código fórmula <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(para templates)</span></label>
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

// ── Modal de relatório da sugestão automática ─────────────────────────────────
function RelatorioModal({ dados, onFechar }) {
  const { total_sem_vinculo, vinculados, pendentes, top_menor_confianca } = dados
  return (
    <Modal titulo="Relatório — Sugestão Automática de Agrupamento" onClose={onFechar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Contadores */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>{total_sem_vinculo}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>sem vínculo</div>
          </div>
          <div style={{ flex: 1, background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#065F46' }}>{vinculados}</div>
            <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>vinculados (≥ 80%)</div>
          </div>
          <div style={{ flex: 1, background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#B45309' }}>{pendentes}</div>
            <div style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>pendentes ({"<"} 80%)</div>
          </div>
        </div>

        {/* Lista de pendentes com menor confiança */}
        {top_menor_confianca?.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px' }}>
              Contas pendentes com menor confiança (revise manualmente):
            </p>
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {top_menor_confianca.map(item => (
                <div key={item.conta_id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)',
                  fontSize: 12,
                }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: 60 }}>{item.codigo}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→ {item.melhor_agrupamento}</span>
                  <span style={{
                    minWidth: 40, textAlign: 'right', fontWeight: 600,
                    color: item.confianca >= 0.6 ? '#B45309' : 'var(--red)',
                  }}>{Math.round(item.confianca * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendentes === 0 && (
          <p style={{ textAlign: 'center', color: '#047857', fontWeight: 500, fontSize: 13 }}>
            Todas as contas analíticas foram vinculadas automaticamente!
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={onFechar}>Fechar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
function contarPendentes(contas) {
  let n = 0
  for (const c of contas) {
    if (c.tipo === 'analitica' && (!c.vinculos || c.vinculos.length === 0)) n++
    if (c.filhos?.length > 0) n += contarPendentes(c.filhos)
  }
  return n
}

export default function PlanoReferencial() {
  const [planos, setPlanos]       = useState([])
  const [planoId, setPlanoId]     = useState(null)
  const [contas, setContas]       = useState([])
  const [criando, setCriando]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [agrupamentos, setAgrupamentos] = useState([])
  const [autoSugerindo, setAutoSugerindo] = useState(false)
  const [relatorio, setRelatorio] = useState(null)

  useEffect(() => {
    refPlanoAPI.listar().then(r => {
      setPlanos(r.data)
      if (r.data.length > 0) setPlanoId(r.data[0].id)
    })
    fluxoCaixaAPI.agrupadores().then(r => setAgrupamentos(r.data)).catch(() => {})
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

  const rodarAutoSugestao = async () => {
    if (!confirm('Isso irá vincular automaticamente contas analíticas sem vínculo (confiança ≥ 80%) ao Fluxo de Caixa. Continuar?')) return
    setAutoSugerindo(true)
    try {
      const r = await refPlanoAPI.autoSugerirAgrupamentos(planoId)
      const d = r.data
      setRelatorio(d)
      toast.success(`${d.vinculados} vinculados — ${d.pendentes} pendentes de revisão`)
      carregar()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro na sugestão automática')
    } finally {
      setAutoSugerindo(false)
    }
  }

  const pendentes = contarPendentes(contas)

  return (
    <div style={{ padding: 24 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Plano de Contas Referencial</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            Plano centralizado — moeda comum entre todos os clientes
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={rodarAutoSugestao} disabled={autoSugerindo}
            title="Vincula automaticamente contas analíticas sem vínculo (confiança ≥ 80%)"
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <Zap size={13} />
            {autoSugerindo ? 'Processando...' : 'Sugestão automática'}
          </button>
          <button className="btn btn-primary" onClick={() => setCriando(true)}>
            <Plus size={14} /> Nova Conta
          </button>
        </div>
      </div>

      {/* Badge de pendências */}
      {pendentes > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
          padding: '8px 12px', background: '#FEF3C7', borderRadius: 6,
          border: '1px solid #FCD34D', fontSize: 13,
        }}>
          <span style={{ fontWeight: 600, color: '#B45309' }}>{pendentes}</span>
          <span style={{ color: '#78350F' }}>
            conta{pendentes !== 1 ? 's' : ''} analítica{pendentes !== 1 ? 's' : ''} sem vínculo de agrupamento
          </span>
          <span style={{ color: '#B45309', fontSize: 11 }}>— use o botão "Sugestão automática" ou clique em <Link size={11} style={{ display: 'inline' }} /> em cada conta</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Conta / Descrição</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Tipo</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Natureza</th>
                <th style={{ textAlign: 'left', padding: '8px 8px', fontWeight: 600 }}>Agrupamento</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map(c => (
                <ContaRow key={c.id} conta={c} nivel={0} planoId={planoId}
                  agrupamentos={agrupamentos} onRefresh={carregar} />
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

      {relatorio && (
        <RelatorioModal dados={relatorio} onFechar={() => setRelatorio(null)} />
      )}
    </div>
  )
}
