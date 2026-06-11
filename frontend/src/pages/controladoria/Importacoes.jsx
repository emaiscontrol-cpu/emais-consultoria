import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { dreMotorAPI, clientesAPI, planosAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import api from '../../services/api'

const ANO_ATUAL = new Date().getFullYear()
const MESES_NOME = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const planoImportAPI = {
  preview: (arquivo, layoutId) => {
    const fd = new FormData(); fd.append('arquivo', arquivo)
    return api.post(`/plano/importar/preview?layout_id=${layoutId}`, fd)
  },
  importar: (arquivo, layoutId, clienteId, modo) => {
    const fd = new FormData(); fd.append('arquivo', arquivo)
    return api.post(`/plano/importar?layout_id=${layoutId}&cliente_id=${clienteId}&modo=${modo}`, fd)
  },
  listarLayouts: clienteId =>
    api.get(`/dre/layouts?cliente_id=${clienteId}&categoria=PLANO`),
  criarLayout: data =>
    api.post('/dre/layouts', { ...data, categoria: 'PLANO' }),
  atualizarLayout: (id, data) =>
    api.put(`/dre/layouts/${id}`, data),
}

// ── Componentes compartilhados ────────────────────────────────────────────────
function BadgeCount({ label, val, cor }) {
  const cores = {
    brand: { c: 'var(--brand)', bg: '#e8f0ff' },
    green: { c: '#16a34a', bg: '#f0fdf4' },
    red:   { c: '#dc2626', bg: '#fff0f0' },
    amber: { c: '#b45309', bg: '#fffbeb' },
    gray:  { c: '#6b7280', bg: '#f5f5f5' },
  }
  const s = cores[cor] || cores.brand
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{val}</div>
    </div>
  )
}

function UploadArea({ arquivo, onChange, accept = '.xlsx,.xls' }) {
  const ref = useRef()
  return (
    <div style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: 20,
      textAlign: 'center', cursor: 'pointer', background: arquivo ? '#f0fdf4' : '#fafafa' }}
      onClick={() => ref.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onChange(f) }}>
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => onChange(e.target.files[0])} />
      {arquivo
        ? <span style={{ color: '#16a34a', fontWeight: 600 }}>📄 {arquivo.name}</span>
        : <span style={{ color: 'var(--text-3)', fontSize: 13 }}>Arraste ou clique para selecionar XLSX</span>
      }
    </div>
  )
}

// ════════════════════════════════════════════════════════
// ABA PLANO DE CONTAS — 4 passos
// ════════════════════════════════════════════════════════

// Configurador de layout inline
function ConfiguradorLayout({ onSalvar, clienteId }) {
  const [form, setForm] = useState({ nome: '', coluna_conta: 0, coluna_descricao: 1, linha_inicio: 2, prefixos_ignorar: '' })
  const [salvando, setSalvando] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const salvar = async () => {
    if (!form.nome.trim()) { toast.error('Informe um nome para o layout'); return }
    setSalvando(true)
    try {
      const prefixos = form.prefixos_ignorar.split(',').map(s => s.trim()).filter(Boolean)
      const r = await planoImportAPI.criarLayout({
        cliente_id: clienteId || null,
        nome: form.nome,
        coluna_conta: parseInt(form.coluna_conta),
        coluna_descricao: parseInt(form.coluna_descricao),
        linha_inicio: parseInt(form.linha_inicio),
        prefixos_ignorar: prefixos,
        tipo_estrutura: 'PLANO',
      })
      toast.success('Layout salvo!')
      onSalvar(r.data)
    } catch { toast.error('Erro ao salvar layout') }
    finally { setSalvando(false) }
  }

  return (
    <div style={{ border: '1px solid #bfdbfe', borderRadius: 8, padding: 16, background: '#f0f6ff', marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--brand)', marginBottom: 12 }}>Configurar novo layout</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Nome do layout *</label>
          <input value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Varejo Alimentar" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Linha início dos dados</label>
          <input type="number" value={form.linha_inicio} min={1} onChange={e => set('linha_inicio', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Coluna Conta (0-based) *</label>
          <input type="number" value={form.coluna_conta} min={0} onChange={e => set('coluna_conta', e.target.value)} />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 11 }}>Coluna Descrição (0-based)</label>
          <input type="number" value={form.coluna_descricao} min={0} onChange={e => set('coluna_descricao', e.target.value)} />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11 }}>Ignorar linhas com prefixos (separados por vírgula)</label>
        <input value={form.prefixos_ignorar} onChange={e => set('prefixos_ignorar', e.target.value)}
          placeholder="Ex: TOTAL, ##, ---" />
      </div>
      <button onClick={salvar} disabled={salvando}
        style={{ background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        {salvando ? 'Salvando...' : 'Salvar layout'}
      </button>
    </div>
  )
}

function ImportarPlano() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [passo, setPasso] = useState(1)
  const [clientes, setClientes] = useState([])
  const [layouts, setLayouts] = useState([])
  const [config, setConfig] = useState({ cliente_id: '', modo: 'ATUALIZAR' })
  const [layoutSel, setLayoutSel] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [mostraCfg, setMostraCfg] = useState(false)
  const [preview, setPreview] = useState(null)
  const [analisando, setAnalisando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data || []))
  }, [])

  useEffect(() => {
    if (config.cliente_id) {
      planoImportAPI.listarLayouts(config.cliente_id).then(r => setLayouts(r.data || []))
    }
  }, [config.cliente_id])

  const set = (k, v) => setConfig(p => ({ ...p, [k]: v }))

  const analisar = async () => {
    if (!arquivo || !layoutSel) return
    setAnalisando(true)
    try {
      const r = await planoImportAPI.preview(arquivo, layoutSel)
      setPreview(r.data)
      setPasso(3)
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erro ao analisar arquivo')
    } finally { setAnalisando(false) }
  }

  const importar = async () => {
    setImportando(true)
    try {
      const r = await planoImportAPI.importar(arquivo, layoutSel, config.cliente_id, config.modo)
      setResultado(r.data)
      setPasso(4)
      toast.success('Importação concluída!')
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erro na importação')
    } finally { setImportando(false) }
  }

  const reiniciar = () => {
    setPasso(1); setPreview(null); setResultado(null); setArquivo(null); setLayoutSel('')
  }

  // ── Passo 1 ────────────────────────────────────────────────────────────────
  if (passo === 1) return (
    <div style={{ maxWidth: 560 }}>
      <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Configuração</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div className="form-group">
          <label>Cliente *</label>
          <select value={config.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Modo de importação *</label>
          <select value={config.modo} onChange={e => set('modo', e.target.value)}>
            <option value="NOVO">Novo plano (vazio)</option>
            <option value="ATUALIZAR">Atualizar (adiciona/atualiza)</option>
            <option value="MESCLAR">Mesclar (mantém config existente)</option>
          </select>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12, background: '#fafafa', marginBottom: 20, fontSize: 12 }}>
        {config.modo === 'NOVO' && <span style={{ color: '#b45309' }}><strong>NOVO:</strong> O plano deve estar vazio. Erro se já houver itens.</span>}
        {config.modo === 'ATUALIZAR' && <span style={{ color: 'var(--brand)' }}><strong>ATUALIZAR:</strong> Adiciona contas novas e atualiza descrição das existentes.</span>}
        {config.modo === 'MESCLAR' && <span style={{ color: '#16a34a' }}><strong>MESCLAR:</strong> Atualiza apenas a descrição — mantém módulo, movimento e agrupamento já configurados.</span>}
      </div>

      <button onClick={() => setPasso(2)} disabled={!config.cliente_id}
        style={{ background: config.cliente_id ? 'var(--brand)' : '#e5e7eb', color: config.cliente_id ? '#fff' : '#9ca3af',
          border: 'none', borderRadius: 7, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: config.cliente_id ? 'pointer' : 'default' }}>
        Próximo →
      </button>
    </div>
  )

  // ── Passo 2 ────────────────────────────────────────────────────────────────
  if (passo === 2) return (
    <div style={{ maxWidth: 560 }}>
      <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Layout e Upload</h4>

      <div className="form-group" style={{ marginBottom: 6 }}>
        <label>Layout salvo *</label>
        <select value={layoutSel} onChange={e => { setLayoutSel(e.target.value); setMostraCfg(e.target.value === '+') }}>
          <option value="">— Selecionar layout salvo —</option>
          {layouts.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          <option value="+">+ Configurar novo layout</option>
        </select>
      </div>

      {mostraCfg && (
        <ConfiguradorLayout clienteId={config.cliente_id} onSalvar={novoLayout => {
          setLayouts(prev => [...prev, novoLayout])
          setLayoutSel(String(novoLayout.id))
          setMostraCfg(false)
        }} />
      )}

      <div className="form-group" style={{ marginTop: 16, marginBottom: 20 }}>
        <label>Arquivo XLSX *</label>
        <UploadArea arquivo={arquivo} onChange={setArquivo} />
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setPasso(1)}
          style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
        <button onClick={analisar} disabled={!layoutSel || layoutSel === '+' || !arquivo || analisando}
          style={{ padding: '9px 22px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 7,
            fontWeight: 700, cursor: 'pointer', fontSize: 13,
            opacity: (!layoutSel || layoutSel === '+' || !arquivo) ? 0.45 : 1 }}>
          {analisando ? 'Analisando...' : 'Analisar arquivo →'}
        </button>
      </div>
    </div>
  )

  // ── Passo 3 ────────────────────────────────────────────────────────────────
  if (passo === 3 && preview) return (
    <div style={{ maxWidth: 740 }}>
      <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Preview e Validação</h4>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <BadgeCount label="Contas encontradas" val={preview.resumo?.total || 0} cor="green" />
        <BadgeCount label="N1 (totalizadores)" val={preview.resumo?.n1 || 0} cor="brand" />
        <BadgeCount label="N2 (sub-grupos)" val={preview.resumo?.n2 || 0} cor="brand" />
        <BadgeCount label="N3 (analíticas)" val={preview.resumo?.n3 || 0} cor="gray" />
      </div>

      {preview.ignoradas > 0 && (
        <div style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
          ⚠️ {preview.ignoradas} linha{preview.ignoradas !== 1 ? 's' : ''} ignorada{preview.ignoradas !== 1 ? 's' : ''} (vazias ou prefixos configurados)
        </div>
      )}

      {preview.erros?.length > 0 && (
        <div style={{ padding: '8px 12px', background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, marginBottom: 10 }}>
          ❌ {preview.erros.length} erro{preview.erros.length !== 1 ? 's' : ''}:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {preview.erros.slice(0, 5).map((e, i) => (
              <li key={i}>Linha {e.linha}: <code>{e.codigo}</code> — {e.erro}</li>
            ))}
            {preview.erros.length > 5 && <li>... e mais {preview.erros.length - 5}</li>}
          </ul>
        </div>
      )}

      {/* Preview tabela */}
      {preview.preview?.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '7px 12px', background: '#f0f4ff', fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>
            Primeiras {preview.preview.length} contas
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Nível', 'Código', 'Tipo', 'Descrição'].map(h => (
                  <th key={h} style={{ padding: '5px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.preview.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: c.nivel === 1 ? '#f0f6ff' : c.nivel === 2 ? '#fafafa' : 'transparent' }}>
                  <td style={{ padding: '4px 10px' }}>
                    <span style={{ fontWeight: 700, fontSize: 10,
                      color: c.nivel === 1 ? 'var(--brand)' : c.nivel === 2 ? '#374151' : '#9ca3af' }}>
                      N{c.nivel}
                    </span>
                  </td>
                  <td style={{ padding: '4px 10px', fontFamily: 'monospace', fontSize: 10 }}>{c.conta}</td>
                  <td style={{ padding: '4px 10px' }}>
                    <span style={{ fontSize: 10, background: c.tipo === 'TT' ? '#e8f0ff' : '#f5f5f5',
                      color: c.tipo === 'TT' ? 'var(--brand)' : '#6b7280',
                      padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                      {c.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '4px 10px', color: 'var(--text-2)' }}>{c.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview.resumo?.total > 0 && (
        <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12, marginBottom: 20 }}>
          ⚠️ Após importar, configure em massa: <strong>Módulo</strong>, <strong>Movimento</strong> e <strong>Agrupamento</strong> na tela de Plano de Contas.
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setPasso(2)}
          style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
          ← Voltar
        </button>
        <button onClick={importar} disabled={importando || !preview.resumo?.total}
          style={{ padding: '9px 22px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 7,
            fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: !preview.resumo?.total ? 0.45 : 1 }}>
          {importando ? 'Importando...' : `Confirmar e Importar ${preview.resumo?.total || 0} contas →`}
        </button>
      </div>
    </div>
  )

  // ── Passo 4 ────────────────────────────────────────────────────────────────
  if (passo === 4 && resultado) return (
    <div style={{ maxWidth: 560 }}>
      <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Resultado da Importação</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <BadgeCount label="✅ Criadas" val={resultado.criadas} cor="green" />
        <BadgeCount label="🔄 Atualizadas" val={resultado.atualizadas} cor="brand" />
        <BadgeCount label="⚠️ Ignoradas" val={resultado.ignoradas || 0} cor="amber" />
        <BadgeCount label="❌ Erros" val={(resultado.erros || []).length} cor={(resultado.erros || []).length > 0 ? 'red' : 'gray'} />
      </div>

      {(resultado.erros || []).length > 0 && (
        <div style={{ padding: '10px 14px', background: '#fff0f0', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
          ❌ Erros:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {resultado.erros.map((e, i) => <li key={i}><code>{e.codigo}</code>: {e.erro}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/controladoria/planos')}
          style={{ padding: '9px 18px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Ir para Plano de Contas →
        </button>
        <button onClick={reiniciar}
          style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
          Nova importação
        </button>
      </div>
    </div>
  )

  return null
}

// ════════════════════════════════════════════════════════
// ABA REALIZADO — componentes do arquivo anterior
// ════════════════════════════════════════════════════════

function Passo1Realizado({ onAvancar }) {
  const [clientes, setClientes] = useState([])
  const [layouts, setLayouts] = useState([])
  const [form, setForm] = useState({
    cliente_id: '', layout_id: '', unidade: 'CONSOLIDADO',
    ano: ANO_ATUAL, mes: '', reprocessar: false, arquivo: null,
  })

  useEffect(() => { clientesAPI.listar().then(r => setClientes(r.data || [])) }, [])

  useEffect(() => {
    if (form.cliente_id) dreMotorAPI.listarLayouts(form.cliente_id).then(r => setLayouts(r.data || []))
  }, [form.cliente_id])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))
  const pode = form.cliente_id && form.layout_id && form.arquivo && form.ano

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="form-group">
          <label>Cliente *</label>
          <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
            <option value="">Selecione...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Layout *</label>
          <select value={form.layout_id} onChange={e => set('layout_id', e.target.value)} disabled={!form.cliente_id}>
            <option value="">Selecione...</option>
            {layouts.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
          </select>
          {form.cliente_id && !layouts.length && (
            <span style={{ fontSize: 11, color: '#b45309' }}>Nenhum layout configurado</span>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="form-group">
          <label>Ano *</label>
          <input type="number" value={form.ano} min={2020} max={2035} onChange={e => set('ano', parseInt(e.target.value))} />
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
      <div className="form-group" style={{ marginBottom: 14 }}>
        <label>Arquivo XLSX *</label>
        <UploadArea arquivo={form.arquivo} onChange={f => set('arquivo', f)} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
        <input type="checkbox" checked={form.reprocessar} onChange={e => set('reprocessar', e.target.checked)} />
        <span>Reprocessar (substitui valores já importados no período)</span>
      </label>
      <button onClick={() => onAvancar(form)} disabled={!pode}
        style={{ background: pode ? 'var(--brand)' : '#e5e7eb', color: pode ? '#fff' : '#9ca3af',
          border: 'none', borderRadius: 7, padding: '10px 28px', fontSize: 14, fontWeight: 700,
          cursor: pode ? 'pointer' : 'default' }}>
        Importar →
      </button>
    </div>
  )
}

function Passo2Realizado({ resultado, onVerPendencias, onNova }) {
  const { importadas, direto, via_depara, pendencias } = resultado
  const total = importadas + pendencias
  return (
    <div style={{ maxWidth: 560 }}>
      <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Importação concluída</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <BadgeCount label="Total de linhas"  val={total}     cor="gray" />
        <BadgeCount label="Importadas"        val={importadas} cor="green" />
        <BadgeCount label="Match direto"      val={direto}    cor="brand" />
        <BadgeCount label="Via DE-PARA"       val={via_depara} cor="brand" />
        <BadgeCount label="Pendências" val={pendencias} cor={pendencias > 0 ? 'red' : 'green'} />
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

function Passo3Realizado({ logId, clienteId, planoId, onConcluir }) {
  const [pendencias, setPendencias] = useState([])
  const [itensPlano, setItensPlano] = useState([])
  const [resolucoes, setResolucoes] = useState({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    dreMotorAPI.pendenciasDoLog(logId).then(r => {
      const pends = (r.data || []).filter(p => !p.resolvido)
      setPendencias(pends)
      const init = {}; pends.forEach(p => { init[p.id] = { plano_item_id: '', salvar: true } })
      setResolucoes(init)
    })
  }, [logId])

  useEffect(() => {
    if (planoId) planosAPI.obter(planoId).then(r => {
      setItensPlano((r.data.itens || []).filter(i => i.tipo && !['TT','RES'].includes(i.tipo.toUpperCase())))
    })
  }, [planoId])

  const set = (id, k, v) => setResolucoes(p => ({ ...p, [id]: { ...p[id], [k]: v } }))
  const comRes = pendencias.filter(p => resolucoes[p.id]?.plano_item_id)

  const salvar = async () => {
    setSalvando(true)
    let ok = 0
    for (const p of comRes) {
      const res = resolucoes[p.id]
      try {
        await dreMotorAPI.resolverPendencia({ pendencia_id: p.id, plano_item_id: parseInt(res.plano_item_id), salvar_depara: res.salvar })
        ok++
      } catch { toast.error(`Erro: ${p.codigo_erp}`) }
    }
    toast.success(`${ok} pendências resolvidas`)
    onConcluir()
    setSalvando(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <h4 style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>Resolver Pendências ({pendencias.length})</h4>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
        Mapeie cada código do ERP para uma conta analítica. "Salvar DE-PARA" aplica o mapeamento automaticamente nas próximas importações.
      </p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f0f4ff' }}>
              {['Código ERP','Descrição','Mês','Valor','Conta sistema','Salvar DE-PARA'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--brand)', borderBottom: '2px solid var(--brand)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pendencias.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 10px', fontFamily: 'monospace', fontSize: 11 }}>{p.codigo_erp}</td>
                <td style={{ padding: '5px 10px', fontSize: 11, color: 'var(--text-3)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descricao||'—'}</td>
                <td style={{ padding: '5px 10px', fontSize: 11 }}>{MESES_NOME[p.mes]||'—'}</td>
                <td style={{ padding: '5px 10px', fontFamily: 'monospace', textAlign: 'right', fontSize: 11 }}>
                  {new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2}).format(p.valor)}
                </td>
                <td style={{ padding: '5px 10px' }}>
                  <select value={resolucoes[p.id]?.plano_item_id||''} onChange={e => set(p.id,'plano_item_id',e.target.value)}
                    style={{ fontSize: 11, width: '100%', padding: '3px 5px', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <option value="">— selecionar —</option>
                    {itensPlano.map(it => <option key={it.id} value={it.id}>{it.descricao} {it.agrupamento?`[${it.agrupamento}]`:''}</option>)}
                  </select>
                </td>
                <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                  <input type="checkbox" checked={resolucoes[p.id]?.salvar??true} onChange={e=>set(p.id,'salvar',e.target.checked)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={salvar} disabled={salvando||!comRes.length}
          style={{ padding: '9px 20px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: !comRes.length?0.45:1 }}>
          {salvando ? 'Salvando...' : `Salvar ${comRes.length} mapeamento${comRes.length!==1?'s':''}`}
        </button>
        <button onClick={onConcluir}
          style={{ padding: '9px 18px', background: 'none', color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>
          Pular
        </button>
      </div>
    </div>
  )
}

function HistoricoRealizado({ clienteId }) {
  const [logs, setLogs] = useState([])
  useEffect(() => {
    if (!clienteId) return
    dreMotorAPI.listarLogs(clienteId).then(r => setLogs(r.data || []))
  }, [clienteId])

  if (!clienteId || !logs.length) return null
  return (
    <div style={{ marginTop: 28 }}>
      <h5 style={{ fontWeight: 700, fontSize: 12, marginBottom: 10 }}>Histórico de importações</h5>
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {['Data','Ano/Mês','Unidade','Importadas','DE-PARA','Pendências'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 10px', color: 'var(--text-3)' }}>
                  {new Date(l.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}
                </td>
                <td style={{ padding: '5px 10px' }}>{l.ano}/{l.mes>0?String(l.mes).padStart(2,'0'):'todos'}</td>
                <td style={{ padding: '5px 10px' }}>{l.unidade}</td>
                <td style={{ padding: '5px 10px', fontWeight:600 }}>{l.direto+l.via_depara}</td>
                <td style={{ padding: '5px 10px' }}>{l.via_depara}</td>
                <td style={{ padding: '5px 10px', color: l.pendencias>0?'#dc2626':'#16a34a', fontWeight:600 }}>{l.pendencias}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ImportarRealizado() {
  const [passo, setPasso] = useState(1)
  const [importando, setImportando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [configForm, setConfigForm] = useState(null)
  const [clientePlanoId, setClientePlanoId] = useState(null)

  const aoAvancar = async form => {
    setImportando(true); setConfigForm(form)
    try {
      const rp = await planosAPI.listar()
      const planos = rp?.data || []
      const cid = parseInt(form.cliente_id)
      const planoCliente = planos.find(p =>
        (p.clientes_vinculados || []).some(cv => cv.id === cid)
      )
      if (planoCliente?.id) setClientePlanoId(planoCliente.id)
    } catch { /**/ }
    try {
      const params = { layout_id: form.layout_id, cliente_id: form.cliente_id, unidade: form.unidade, ano: form.ano, reprocessar: form.reprocessar }
      if (form.mes) params.mes = form.mes
      const r = await dreMotorAPI.importar(form.arquivo, params)
      setResultado(r.data); setPasso(2)
      toast.success('Importação concluída!')
    } catch (e) { toast.error(e?.response?.data?.detail || 'Erro na importação') }
    finally { setImportando(false) }
  }

  if (importando) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--brand)', fontWeight: 600 }}>Importando arquivo... aguarde</div>

  if (passo === 1) return (
    <>
      <Passo1Realizado onAvancar={aoAvancar} />
      <HistoricoRealizado clienteId={configForm?.cliente_id} />
    </>
  )
  if (passo === 2 && resultado) return (
    <Passo2Realizado resultado={resultado}
      onVerPendencias={() => setPasso(3)}
      onNova={() => { setPasso(1); setResultado(null) }}
    />
  )
  if (passo === 3 && resultado) return (
    <Passo3Realizado logId={resultado.log_id} clienteId={configForm?.cliente_id} planoId={clientePlanoId}
      onConcluir={() => { setPasso(1); setResultado(null) }}
    />
  )
  return null
}

// ════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL COM ABAS
// ════════════════════════════════════════════════════════
export default function ImportacoesPage() {
  const { usuario } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const aba = searchParams.get('aba') || 'plano'

  if (!['admin', 'consultor'].includes(usuario?.perfil)) {
    return <div style={{ padding: 40, color: 'var(--text-3)' }}>Acesso restrito.</div>
  }

  const setAba = nome => setSearchParams({ aba: nome })

  const tabStyle = ativo => ({
    padding: '8px 20px', cursor: 'pointer', fontWeight: ativo ? 700 : 500,
    fontSize: 13, border: 'none', background: 'none',
    color: ativo ? 'var(--brand)' : 'var(--text-3)',
    borderBottom: ativo ? '2px solid var(--brand)' : '2px solid transparent',
    transition: 'all .15s',
  })

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>📥 Importações</h2>
      </div>

      {/* Abas */}
      <div style={{ borderBottom: '1px solid var(--border)', marginBottom: 28, display: 'flex' }}>
        <button style={tabStyle(aba === 'plano')} onClick={() => setAba('plano')}>
          Plano de Contas
        </button>
        <button style={tabStyle(aba === 'realizado')} onClick={() => setAba('realizado')}>
          Realizado (ERP)
        </button>
      </div>

      {aba === 'plano' && <ImportarPlano />}
      {aba === 'realizado' && <ImportarRealizado />}
    </div>
  )
}
