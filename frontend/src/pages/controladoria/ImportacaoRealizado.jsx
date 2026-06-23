import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { dreMotorAPI, clientesAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const ANO_ATUAL = new Date().getFullYear()
const MESES_NOME = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function Badge({ label, cor = 'brand' }) {
  const cores = {
    brand: { bg: '#e8f0ff', color: 'var(--brand)', border: '#bfdbfe' },
    green: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    red:   { bg: '#fff0f0', color: '#dc2626', border: '#fca5a5' },
    gray:  { bg: '#f5f5f5', color: '#6b7280', border: '#e5e7eb' },
    amber: { bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
  }
  const c = cores[cor] || cores.brand
  return (
    <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
      background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  )
}

// ── Passo 1: Configuração ──────────────────────────────────────────────────────
function Passo1({ onAvancar }) {
  const { usuario } = useAuth()
  const isAdmin = ['admin', 'consultor'].includes(usuario?.perfil)
  const [clientes, setClientes] = useState([])
  const [layouts, setLayouts] = useState([])
  const [form, setForm] = useState({
    cliente_id: '',
    layout_id: '',
    unidade: 'CONSOLIDADO',
    ano: ANO_ATUAL,
    mes: '',
    reprocessar: false,
    arquivo: null,
  })
  const fileRef = useRef()

  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data || []))
  }, [])

  useEffect(() => {
    if (form.cliente_id) {
      dreMotorAPI.listarLayouts(form.cliente_id).then(r => setLayouts(r.data || []))
    }
  }, [form.cliente_id])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const podeProsseguir = form.cliente_id && form.layout_id && form.arquivo && form.ano

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h3 style={{ marginBottom: 20, fontWeight: 700, fontSize: 16 }}>Passo 1 — Selecionar arquivo e configurações</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="form-group">
          <label>Cliente *</label>
          <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Layout de importação *</label>
          <select value={form.layout_id} onChange={e => set('layout_id', e.target.value)} disabled={!form.cliente_id}>
            <option value="">Selecione...</option>
            {layouts.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          {form.cliente_id && layouts.length === 0 && (
            <span style={{ fontSize: 11, color: '#b45309' }}>Nenhum layout configurado para este cliente</span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="form-group">
          <label>Ano *</label>
          <input type="number" value={form.ano} min={2020} max={2035}
            onChange={e => set('ano', parseInt(e.target.value))} />
        </div>
        <div className="form-group">
          <label>Mês (opcional)</label>
          <select value={form.mes} onChange={e => set('mes', e.target.value)}>
            <option value="">Todos os meses</option>
            {MESES_NOME.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Unidade</label>
          <input value={form.unidade} onChange={e => set('unidade', e.target.value)} placeholder="CONSOLIDADO" />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Arquivo XLSX *</label>
        <div style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: 20, textAlign: 'center', cursor: 'pointer',
          background: form.arquivo ? '#f0fdf4' : '#fafafa' }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) set('arquivo', f) }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={e => set('arquivo', e.target.files[0])} />
          {form.arquivo
            ? <span style={{ color: '#16a34a', fontWeight: 600 }}>📄 {form.arquivo.name}</span>
            : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Arraste ou clique para selecionar XLSX</span>
          }
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 24 }}>
        <input type="checkbox" checked={form.reprocessar} onChange={e => set('reprocessar', e.target.checked)} />
        <span>Reprocessar (substitui valores já importados no período)</span>
      </label>

      <button onClick={() => onAvancar(form)} disabled={!podeProsseguir}
        style={{ background: podeProsseguir ? 'var(--brand)' : '#e5e7eb',
          color: podeProsseguir ? '#fff' : '#9ca3af', border: 'none', borderRadius: 7,
          padding: '10px 28px', fontSize: 14, fontWeight: 700, cursor: podeProsseguir ? 'pointer' : 'default' }}>
        Importar →
      </button>
    </div>
  )
}

// ── Passo 2: Resultado ─────────────────────────────────────────────────────────
function Passo2({ resultado, onVerPendencias, onNova }) {
  const { importadas, direto, via_depara, pendencias, log_id } = resultado
  const total = importadas + pendencias

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h3 style={{ marginBottom: 20, fontWeight: 700, fontSize: 16 }}>Importação concluída</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        {[
          ['Total de linhas', total, 'gray'],
          ['Importadas', importadas, 'green'],
          ['Match direto', direto, 'brand'],
          ['Via DE-PARA', via_depara, 'brand'],
          ['Pendências', pendencias, pendencias > 0 ? 'red' : 'green'],
        ].map(([label, val, cor]) => (
          <div key={label} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: cor === 'red' ? '#dc2626' : cor === 'green' ? '#16a34a' : 'var(--brand)' }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        {pendencias > 0 && (
          <button onClick={onVerPendencias}
            style={{ padding: '9px 20px', background: '#fff0f0', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            Resolver {pendencias} pendência{pendencias !== 1 ? 's' : ''} →
          </button>
        )}
        <button onClick={onNova}
          style={{ padding: '9px 20px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
          Nova importação
        </button>
      </div>
    </div>
  )
}

// ── Passo 3: Resolver pendências ───────────────────────────────────────────────
function Passo3({ logId, clienteId, planoId, onConcluir }) {
  const [pendencias, setPendencias] = useState([])
  const [itensPlano, setItensPlano] = useState([])
  const [resolucoes, setResolucoes] = useState({}) // pendencia_id → {plano_item_id, salvar}
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    dreMotorAPI.pendenciasDoLog(logId).then(r => {
      const pends = (r.data || []).filter(p => !p.resolvido)
      setPendencias(pends)
      const init = {}
      pends.forEach(p => { init[p.id] = { plano_item_id: '', salvar: true } })
      setResolucoes(init)
    })
  }, [logId])

  useEffect(() => {
    setItensPlano([])
  }, [planoId])

  const set = (id, k, v) => setResolucoes(p => ({ ...p, [id]: { ...p[id], [k]: v } }))

  const pendenciasComResolucao = pendencias.filter(p => resolucoes[p.id]?.plano_item_id)

  const salvarTodas = async () => {
    if (pendenciasComResolucao.length === 0) return
    setSalvando(true)
    let ok = 0
    for (const p of pendenciasComResolucao) {
      const res = resolucoes[p.id]
      try {
        await dreMotorAPI.resolverPendencia({
          pendencia_id: p.id,
          plano_item_id: parseInt(res.plano_item_id),
          salvar_depara: res.salvar,
        })
        ok++
      } catch { toast.error(`Erro ao resolver ${p.codigo_erp}`) }
    }
    toast.success(`${ok} pendências resolvidas`)
    onConcluir()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Resolver Pendências ({pendencias.length})</h3>
        <Badge label={`${pendenciasComResolucao.length} mapeadas`} cor="green" />
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
        Mapeie cada código do ERP para uma conta analítica do sistema. Marque "Salvar DE-PARA" para que próximas importações usem este mapeamento automaticamente.
      </p>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f0f4ff' }}>
              {['Código ERP', 'Descrição', 'Mês', 'Valor', 'Conta sistema', 'Salvar DE-PARA'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--brand)', borderBottom: '2px solid var(--brand)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendencias.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 11 }}>{p.codigo_erp}</td>
                <td style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-3)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao || '—'}</td>
                <td style={{ padding: '6px 12px' }}>{MESES_NOME[p.mes] || '—'}</td>
                <td style={{ padding: '6px 12px', fontFamily: 'monospace', textAlign: 'right' }}>
                  {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(p.valor)}
                </td>
                <td style={{ padding: '6px 12px' }}>
                  <select value={resolucoes[p.id]?.plano_item_id || ''} onChange={e => set(p.id, 'plano_item_id', e.target.value)}
                    style={{ fontSize: 11, width: '100%', padding: '3px 5px', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <option value="">— selecionar —</option>
                    {itensPlano.map(it => (
                      <option key={it.id} value={it.id}>{it.descricao} {it.agrupamento ? `[${it.agrupamento}]` : ''}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                  <input type="checkbox" checked={resolucoes[p.id]?.salvar ?? true}
                    onChange={e => set(p.id, 'salvar', e.target.checked)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={salvarTodas} disabled={salvando || pendenciasComResolucao.length === 0}
          style={{ padding: '9px 22px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13,
            opacity: pendenciasComResolucao.length === 0 ? 0.45 : 1 }}>
          {salvando ? 'Salvando...' : `Salvar ${pendenciasComResolucao.length} mapeamento${pendenciasComResolucao.length !== 1 ? 's' : ''}`}
        </button>
        <button onClick={onConcluir}
          style={{ padding: '9px 20px', background: 'none', color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
          Pular
        </button>
      </div>
    </div>
  )
}

// ── Tela de histórico ──────────────────────────────────────────────────────────
function HistoricoImportacoes({ clienteId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clienteId) return
    setLoading(true)
    dreMotorAPI.listarLogs(clienteId).then(r => setLogs(r.data || [])).finally(() => setLoading(false))
  }, [clienteId])

  if (!clienteId) return null

  return (
    <div style={{ marginTop: 32 }}>
      <h4 style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Histórico de importações</h4>
      {loading ? <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Carregando...</span> : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Data', 'Ano/Mês', 'Unidade', 'Importadas', 'DE-PARA', 'Pendências'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>Nenhuma importação encontrada</td></tr>
              ) : logs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-3)' }}>
                    {new Date(l.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '6px 12px' }}>{l.ano}/{l.mes > 0 ? String(l.mes).padStart(2, '0') : 'todos'}</td>
                  <td style={{ padding: '6px 12px' }}>{l.unidade}</td>
                  <td style={{ padding: '6px 12px', fontWeight: 600 }}>{l.direto + l.via_depara}</td>
                  <td style={{ padding: '6px 12px' }}>{l.via_depara}</td>
                  <td style={{ padding: '6px 12px' }}>
                    {l.pendencias > 0
                      ? <span style={{ color: '#dc2626', fontWeight: 600 }}>{l.pendencias}</span>
                      : <span style={{ color: '#16a34a' }}>0</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function ImportacaoRealizado() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [passo, setPasso] = useState(1)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [configForm, setConfigForm] = useState(null)
  const [clientePlanoId, setClientePlanoId] = useState(null)

  if (!['admin', 'consultor'].includes(usuario?.perfil)) {
    return <div style={{ padding: 40, color: 'var(--text-3)' }}>Acesso restrito.</div>
  }

  const aoAvancar = async (form) => {
    setImportando(true)
    setConfigForm(form)

    try {
      const params = {
        layout_id: form.layout_id,
        cliente_id: form.cliente_id,
        unidade: form.unidade,
        ano: form.ano,
        reprocessar: form.reprocessar,
      }
      if (form.mes) params.mes = form.mes

      const r = await dreMotorAPI.importar(form.arquivo, params)
      setResultado(r.data)
      setPasso(2)
      toast.success('Importação concluída!')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erro na importação')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', padding: '0 4px' }}>
          ←
        </button>
        <h2 style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>Importar Realizado</h2>
        {passo > 1 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {['Configurar', 'Resultado', 'Pendências'].map((nome, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: passo === i + 1 ? 'var(--brand)' : '#f5f5f5',
                color: passo === i + 1 ? '#fff' : 'var(--text-3)',
              }}>{i + 1}. {nome}</span>
            ))}
          </div>
        )}
      </div>

      {importando && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--brand)', fontWeight: 600 }}>
          Importando arquivo... aguarde
        </div>
      )}

      {!importando && passo === 1 && (
        <>
          <Passo1 onAvancar={aoAvancar} />
          <HistoricoImportacoes clienteId={configForm?.cliente_id} />
        </>
      )}

      {!importando && passo === 2 && resultado && (
        <Passo2
          resultado={resultado}
          onVerPendencias={() => setPasso(3)}
          onNova={() => { setPasso(1); setResultado(null) }}
        />
      )}

      {!importando && passo === 3 && resultado && (
        <Passo3
          logId={resultado.log_id}
          clienteId={configForm?.cliente_id}
          planoId={clientePlanoId}
          onConcluir={() => { setPasso(1); setResultado(null) }}
        />
      )}
    </div>
  )
}
