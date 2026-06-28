import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, GitBranch, X, CornerDownRight, Zap, Link } from 'lucide-react'
import { refPlanoAPI, fluxoCaixaAPI } from '../../services/api'
import { Modal } from '../../components/shared'
import toast from 'react-hot-toast'

const TIPO_LABEL = { sintetica: 'Sintética', analitica: 'Analítica' }
const DEMO_LABEL = { fluxo_caixa: 'FC', dre: 'DRE', orcamento: 'ORC' }
const DEMO_COR   = {
  fluxo_caixa: { bg: '#FEF3C7', text: '#B45309' },
  dre:         { bg: '#EDE9FE', text: '#6D28D9' },
  orcamento:   { bg: '#DBEAFE', text: '#1D4ED8' },
}
const DEMOS = [
  { value: 'fluxo_caixa', label: 'FC' },
  { value: 'dre',         label: 'DRE' },
  { value: 'orcamento',   label: 'ORC' },
]

// ── Badge de vínculo ──────────────────────────────────────────────────────────
function BadgeVinculo({ v, onRemover }) {
  const cor = DEMO_COR[v.demonstrativo] || { bg: 'var(--surface-hover)', text: 'var(--text-muted)' }
  const estilo = v.herdado
    ? { background: 'var(--surface-hover)', color: 'var(--text-muted)', opacity: 0.7 }
    : { background: cor.bg, color: cor.text }

  return (
    <span
      title={v.agrupamento_nome}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 700,
        cursor: 'default', ...estilo,
      }}
    >
      {v.herdado && <CornerDownRight size={8} />}
      {DEMO_LABEL[v.demonstrativo] || v.demonstrativo}
      {!v.herdado && onRemover && (
        <button
          onClick={e => { e.stopPropagation(); onRemover(v.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex', padding: 0, marginLeft: 1 }}
        >
          <X size={8} />
        </button>
      )}
    </span>
  )
}

// ── Painel inline de vinculação ───────────────────────────────────────────────
function PainelVincular({ conta, nivel, agrupamentos, vinculos, onSalvo, onFechar }) {
  // Demos sem vínculo direto (não-herdado) — são as opções disponíveis
  const demosDisponiveis = DEMOS.filter(d => !vinculos.some(v => v.demonstrativo === d.value && !v.herdado))

  const [demo, setDemo]                   = useState(() => demosDisponiveis[0]?.value || 'fluxo_caixa')
  const [busca, setBusca]                 = useState('')
  const [agrupamentoId, setAgrupamentoId] = useState('')
  const [propagar, setPropagar]           = useState(false)
  const [salvando, setSalvando]           = useState(false)

  // Vínculo direto (não-herdado) para o demonstrativo selecionado
  const vinculoAtual = vinculos.find(v => v.demonstrativo === demo && !v.herdado) || null

  useEffect(() => {
    setAgrupamentoId('')
    setBusca('')
  }, [demo])

  // Filtra agrupamentos por demo; fallback para todos se nenhum configurado
  const porDemo = agrupamentos.filter(a =>
    Array.isArray(a.demonstrativos) && a.demonstrativos.includes(demo)
  )
  const fonte = porDemo.length > 0 ? porDemo : agrupamentos
  const filtrados = fonte
    .filter(a => busca === '' || a.nome.toLowerCase().includes(busca.toLowerCase()))
    .slice(0, 50)

  const salvar = async () => {
    setSalvando(true)
    try {
      if (agrupamentoId === '__nenhum__') {
        if (vinculoAtual) {
          await refPlanoAPI.removerVinculo(conta.id, vinculoAtual.id)
          toast.success('Vínculo removido')
        }
      } else {
        if (!agrupamentoId) { toast.error('Selecione um agrupamento'); setSalvando(false); return }
        await refPlanoAPI.vincularAgrupamento(conta.id, {
          agrupamento_id: Number(agrupamentoId),
          demonstrativo: demo,
          propagar,
        })
        toast.success('Vínculo criado' + (propagar ? ' e propagado para filhas' : ''))
      }
      onSalvo()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  // Todos os demonstrativos já vinculados
  if (demosDisponiveis.length === 0) {
    return (
      <tr>
        <td colSpan={4} style={{ padding: '10px 12px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ paddingLeft: nivel * 20 + 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 500 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Todos os demonstrativos já estão vinculados.
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Use o × em cada badge para remover um vínculo.
              </span>
            </div>
            <button className="btn" style={{ height: 28, fontSize: 12 }} onClick={onFechar}>Fechar</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan={4} style={{ padding: '8px 12px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ paddingLeft: nivel * 20 + 20, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 500 }}>

          {/* Tabs de demonstrativo — só mostra demos disponíveis */}
          <div style={{ display: 'flex', gap: 4 }}>
            {demosDisponiveis.map(d => {
              const ativo = demo === d.value
              const cor = DEMO_COR[d.value]
              return (
                <button key={d.value} onClick={() => setDemo(d.value)} style={{
                  padding: '4px 14px', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: ativo ? 'none' : '1px solid var(--border)',
                  background: ativo ? cor.bg : 'transparent',
                  color: ativo ? cor.text : 'var(--text-muted)',
                }}>
                  {d.label}
                </button>
              )
            })}
            {/* Demos já vinculados — apenas informativo */}
            {DEMOS.filter(d => !demosDisponiveis.some(dd => dd.value === d.value)).map(d => {
              const cor = DEMO_COR[d.value]
              return (
                <span key={d.value} style={{
                  padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
                  background: cor.bg, color: cor.text, opacity: 0.5,
                }} title="Já vinculado">
                  {d.label} ✓
                </span>
              )
            })}
          </div>

          {/* Autocomplete com radio buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <input
              placeholder="Buscar agrupamento..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{
                padding: '6px 8px', fontSize: 12,
                border: '1px solid var(--border)', borderBottom: 'none',
                borderRadius: '4px 4px 0 0',
                background: 'var(--surface)', color: 'var(--text)',
                outline: 'none',
              }}
            />
            <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 4px 4px', maxHeight: 168, overflowY: 'auto' }}>
              {/* Opção Nenhum */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontStyle: 'italic',
                borderBottom: '1px solid var(--border)',
                background: agrupamentoId === '__nenhum__' ? '#FEE2E2' : 'transparent',
                color: agrupamentoId === '__nenhum__' ? '#DC2626' : 'var(--text-muted)',
              }}>
                <input
                  type="radio"
                  name={`agrup-${conta.id}`}
                  value="__nenhum__"
                  checked={agrupamentoId === '__nenhum__'}
                  onChange={() => setAgrupamentoId('__nenhum__')}
                  style={{ accentColor: '#DC2626', margin: 0 }}
                />
                — Nenhum (remover vínculo)
              </label>
              {filtrados.map(a => (
                <label key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                  background: agrupamentoId === String(a.id) ? 'var(--brand-light)' : 'transparent',
                  color: agrupamentoId === String(a.id) ? 'var(--brand)' : 'var(--text)',
                }}>
                  <input
                    type="radio"
                    name={`agrup-${conta.id}`}
                    value={String(a.id)}
                    checked={agrupamentoId === String(a.id)}
                    onChange={() => setAgrupamentoId(String(a.id))}
                    style={{ accentColor: 'var(--brand)', margin: 0 }}
                  />
                  {a.nome}
                </label>
              ))}
              {filtrados.length === 0 && (
                <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                  Nenhum resultado
                </div>
              )}
            </div>
          </div>

          {/* Propagar — apenas para contas sintéticas com filhos */}
          {conta.tipo === 'sintetica' && conta.filhos?.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={propagar} onChange={e => setPropagar(e.target.checked)} />
              Propagar para filhas diretas
            </label>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ height: 30, fontSize: 12 }} onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn" style={{ height: 30, fontSize: 12 }} onClick={onFechar}>Cancelar</button>
          </div>
        </div>
      </td>
    </tr>
  )
}

// ── Linha de conta ────────────────────────────────────────────────────────────
function ContaRow({ conta, nivel, planoId, agrupamentos, onRefresh, expandKey, expandTarget }) {
  const [aberto, setAberto]         = useState(false)
  const [editando, setEditando]     = useState(false)
  const [criandoSub, setCriandoSub] = useState(false)
  const [vinculando, setVinculando] = useState(false)
  const [form, setForm]             = useState({})
  const temFilhos = conta.filhos?.length > 0

  // Sincroniza expansão quando o controle de nível muda
  useEffect(() => {
    if (expandKey > 0) {
      setAberto(expandTarget === Infinity || nivel < expandTarget)
    }
  }, [expandKey])

  const abrirEdicao = () => {
    setForm({ codigo: conta.codigo, descricao: conta.descricao, tipo: conta.tipo, agrupamento: conta.agrupamento || '' })
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

        {/* Demonstrativo */}
        <td style={{ paddingLeft: 8, paddingRight: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', minHeight: 24 }}>
            {vinculos.length === 0
              ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
              : vinculos.map(v => (
                  <BadgeVinculo key={v.id} v={v} onRemover={!v.herdado ? removerVinculo : null} />
                ))
            }
            <button
              title="Vincular agrupamento"
              onClick={() => setVinculando(v => !v)}
              style={{
                background: vinculando ? 'var(--brand)' : 'none',
                color: vinculando ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border)', borderRadius: 4,
                cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1px 4px',
              }}
            >
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
          vinculos={vinculos}
          onSalvo={() => { setVinculando(false); onRefresh() }}
          onFechar={() => setVinculando(false)}
        />
      )}

      {/* Filhos */}
      {aberto && conta.filhos?.map(f => (
        <ContaRow key={f.id} conta={f} nivel={nivel + 1} planoId={planoId}
          agrupamentos={agrupamentos} onRefresh={onRefresh}
          expandKey={expandKey} expandTarget={expandTarget} />
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
          inicial={{ codigo: '', descricao: '', tipo: 'analitica', agrupamento: '' }}
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
          <div className="form-group">
            <label>Código fórmula <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(para templates)</span></label>
            <input value={form.agrupamento || ''} onChange={e => update('agrupamento', e.target.value)}
              placeholder="ex: receita_bruta" style={{ fontFamily: 'monospace' }} />
          </div>
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
            <div style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>pendentes ({'<'} 80%)</div>
          </div>
        </div>

        {top_menor_confianca?.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px' }}>
              Contas pendentes com menor confiança (revise manualmente):
            </p>
            <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {top_menor_confianca.map(item => (
                <div key={item.conta_id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12,
                }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: 60 }}>{item.codigo}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>→ {item.melhor_agrupamento}</span>
                  <span style={{ minWidth: 40, textAlign: 'right', fontWeight: 600, color: item.confianca >= 0.6 ? '#B45309' : 'var(--red)' }}>
                    {Math.round(item.confianca * 100)}%
                  </span>
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

// Controles de nível de expansão
const btnNivelStyle = {
  padding: '3px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
  border: '1px solid var(--border)', borderRadius: 4,
  background: 'transparent', color: 'var(--text-muted)',
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
  // Controle de expansão por nível: expandKey muda para disparar useEffect em todas as ContaRow
  const [expandKey, setExpandKey]     = useState(0)
  const [expandTarget, setExpandTarget] = useState(0)

  const aplicarNivel = useCallback((target) => {
    setExpandTarget(target)
    setExpandKey(k => k + 1)
  }, [])

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
      setRelatorio(r.data)
      toast.success(`${r.data.vinculados} vinculados — ${r.data.pendentes} pendentes de revisão`)
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
            conta{pendentes !== 1 ? 's' : ''} analítica{pendentes !== 1 ? 's' : ''} sem vínculo de demonstrativo
          </span>
          <span style={{ color: '#B45309', fontSize: 11 }}>— use "Sugestão automática" ou clique em <Link size={11} style={{ display: 'inline' }} /> em cada conta</span>
        </div>
      )}

      {/* Controles de nível de expansão */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Expandir:</span>
        <button style={btnNivelStyle} onClick={() => aplicarNivel(0)}>Nível 1</button>
        <button style={btnNivelStyle} onClick={() => aplicarNivel(1)}>Nível 2</button>
        <button style={btnNivelStyle} onClick={() => aplicarNivel(2)}>Nível 3</button>
        <button style={btnNivelStyle} onClick={() => aplicarNivel(Infinity)}>Todos</button>
        <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
        <button style={{ ...btnNivelStyle, color: 'var(--text-muted)' }} onClick={() => aplicarNivel(-1)}>Colapsar tudo</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600 }}>Conta / Descrição</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 600 }}>Tipo</th>
                <th style={{ textAlign: 'left', padding: '8px 8px', fontWeight: 600 }}>Demonstrativo</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map(c => (
                <ContaRow key={c.id} conta={c} nivel={0} planoId={planoId}
                  agrupamentos={agrupamentos} onRefresh={carregar}
                  expandKey={expandKey} expandTarget={expandTarget} />
              ))}
              {contas.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
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
          inicial={{ codigo: '', descricao: '', tipo: 'analitica', agrupamento: '' }}
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
