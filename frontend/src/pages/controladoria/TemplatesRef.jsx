import { useState, useEffect } from 'react'
import { Plus, Copy, GripVertical, AlertTriangle } from 'lucide-react'
import { refTemplatesAPI, refSegmentosAPI, refPlanoAPI, fluxoCaixaAPI } from '../../services/api'
import { Modal } from '../../components/shared'
import { BotaoEditar, BotaoExcluir, BotaoNovo } from '../../components/ui'
import toast from 'react-hot-toast'

const TIPO_LABEL = { dre: 'DRE', fluxo_caixa: 'Fluxo de Caixa', orcamento: 'Orçamento' }
const MODO_LABEL = { agrupamento: 'Agrupamento (folha)', soma_filhos: 'Soma dos filhos (título)', formula: 'Fórmula (totalizador)' }
const NIVEL_LABEL = { 1: '1 — Bloco (A)', 2: '2 — Grupo (C)', 3: '3 — Subgrupo (D)', 4: '4 — Folha (E)' }

// Campos de modo_calculo/nivel/agrupamento — compartilhado entre a linha em edição e a nova linha
function CamposModoCalculo({ form, setForm, agrupamentosReais, agrupamentos, rotulosDisponiveis, rotuloAtual, inserirVar }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ fontSize: 12 }}>Modo de cálculo</label>
          <select value={form.modo_calculo} onChange={e => setForm(f => ({ ...f, modo_calculo: e.target.value }))}>
            {Object.entries(MODO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ fontSize: 12 }}>Nível</label>
          <select value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: Number(e.target.value) }))}>
            {Object.entries(NIVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {form.modo_calculo === 'agrupamento' && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12 }}>Agrupamento</label>
          <select value={form.agrupamento_slug || ''} onChange={e => setForm(f => ({ ...f, agrupamento_slug: e.target.value }))}>
            <option value="">Selecione...</option>
            {agrupamentosReais.map(a => <option key={a.id} value={a.slug}>{a.nome}</option>)}
          </select>
        </div>
      )}

      {form.modo_calculo === 'soma_filhos' && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
          Valor calculado automaticamente pela soma das linhas-filhas diretas (por nível).
        </div>
      )}

      {form.modo_calculo === 'formula' && (
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Fórmula</label>
          <textarea value={form.formula_texto} onChange={e => setForm(f => ({ ...f, formula_texto: e.target.value }))}
            style={{ width: '100%', height: 60, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            placeholder="ex: {linha:receita_liquida} - {linha:custos_variaveis}" />
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Variáveis disponíveis:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {agrupamentos.map(a => (
                <button key={a} onClick={() => inserirVar(`{agrupamento:${a}}`)}
                  style={{ fontSize: 10, fontFamily: 'monospace', background: 'rgba(79,70,229,.1)', color: 'var(--brand)', border: '1px solid rgba(79,70,229,.2)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
                  {a}
                </button>
              ))}
              {rotulosDisponiveis.filter(r => r !== rotuloAtual).map(r => (
                <button key={r} onClick={() => inserirVar(`{linha:${r}}`)}
                  style={{ fontSize: 10, background: 'rgba(34,197,94,.1)', color: '#16a34a', border: '1px solid rgba(34,197,94,.2)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function LinhaRow({ linha, templateId, agrupamentos, agrupamentosReais, rotulosDisponiveis, onRefresh }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    rotulo: linha.rotulo,
    formula_texto: linha.formula_texto || '',
    negrito_totalizador: linha.negrito_totalizador,
    ordem: linha.ordem,
    modo_calculo: linha.modo_calculo || 'agrupamento',
    nivel: linha.nivel || 4,
    agrupamento_slug: linha.agrupamento_slug || '',
  })

  const salvar = async () => {
    try {
      await refTemplatesAPI.atualizarLinha(templateId, linha.id, form)
      toast.success('Linha atualizada')
      setEditando(false)
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const excluir = async () => {
    if (!confirm('Remover esta linha?')) return
    try {
      await refTemplatesAPI.deletarLinha(templateId, linha.id)
      toast.success('Linha removida')
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const inserirVar = (v) => {
    setForm(f => ({ ...f, formula_texto: (f.formula_texto || '') + v }))
  }

  if (editando) return (
    <tr style={{ background: 'var(--brand-light)' }}>
      <td colSpan={5} style={{ padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Rótulo</label>
              <input value={form.rotulo} onChange={e => setForm(f => ({ ...f, rotulo: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input type="checkbox" checked={form.negrito_totalizador}
                onChange={e => setForm(f => ({ ...f, negrito_totalizador: e.target.checked }))} />
              <label style={{ fontSize: 12 }}>Negrito (totalizador)</label>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 12 }}>Ordem</label>
              <input type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))} style={{ width: 80 }} />
            </div>
          </div>
          <div>
            <CamposModoCalculo form={form} setForm={setForm} agrupamentosReais={agrupamentosReais}
              agrupamentos={agrupamentos} rotulosDisponiveis={rotulosDisponiveis}
              rotuloAtual={linha.rotulo} inserirVar={inserirVar} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-sm" onClick={() => setEditando(false)}>Cancelar</button>
          <button className="btn btn-sm btn-primary" onClick={salvar}>Salvar</button>
        </div>
      </td>
    </tr>
  )

  const nivel = linha.nivel || 4
  const modo = linha.modo_calculo || 'agrupamento'

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 16px 8px', paddingLeft: 16 + (nivel - 1) * 20, fontWeight: linha.negrito_totalizador ? 700 : 400 }}>
        {linha.rotulo}
      </td>
      <td style={{ padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)' }}>{MODO_LABEL[modo]}</td>
      <td style={{ padding: '8px 16px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', maxWidth: 640, wordBreak: 'break-word', whiteSpace: 'normal' }}>
        {modo === 'formula' && (linha.formula_texto || <em style={{ opacity: 0.5 }}>sem fórmula</em>)}
        {modo === 'agrupamento' && (linha.agrupamento_slug || <em style={{ opacity: 0.5 }}>sem agrupamento</em>)}
        {modo === 'soma_filhos' && <em style={{ opacity: 0.5 }}>soma dos filhos</em>}
      </td>
      <td style={{ padding: '8px 16px', textAlign: 'center' }}>{linha.ordem}</td>
      <td style={{ padding: '8px 16px', textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <BotaoEditar onClick={() => setEditando(true)} />
          <BotaoExcluir onClick={excluir} />
        </div>
      </td>
    </tr>
  )
}

function EditorTemplate({ template, onFechar, onRefresh }) {
  const [t, setT] = useState(template)
  const [agrupamentos, setAgrupamentos] = useState([])
  const [agrupamentosReais, setAgrupamentosReais] = useState([])
  const [novaLinha, setNovaLinha] = useState({
    rotulo: '', formula_texto: '', negrito_totalizador: false, ordem: 0,
    modo_calculo: 'agrupamento', nivel: 4, agrupamento_slug: '',
  })
  const [adicionando, setAdicionando] = useState(false)

  useEffect(() => {
    refPlanoAPI.listar().then(r => {
      if (r.data[0]) refPlanoAPI.listarAgrupamentos(r.data[0].id).then(ra => setAgrupamentos(ra.data))
    })
    fluxoCaixaAPI.agrupadores().then(r => setAgrupamentosReais(r.data)).catch(() => {})
    carregar()
  }, [])

  const carregar = async () => {
    const r = await refTemplatesAPI.detalhe(template.id)
    setT(r.data)
  }

  const adicionarLinha = async () => {
    try {
      await refTemplatesAPI.criarLinha(t.id, { ...novaLinha, ordem: t.linhas.length })
      toast.success('Linha adicionada')
      setAdicionando(false)
      setNovaLinha({
        rotulo: '', formula_texto: '', negrito_totalizador: false, ordem: 0,
        modo_calculo: 'agrupamento', nivel: 4, agrupamento_slug: '',
      })
      carregar()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const rotulosDisponiveis = t.linhas.map(l => l.rotulo)

  return (
    <Modal titulo={`Editar Template: ${t.nome}`} onClose={onFechar}
           style={{ maxWidth: '95vw', width: 1400 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        <AlertTriangle size={13} />
        O relatório nunca é editado — toda alteração de fórmula, agrupamento ou hierarquia acontece aqui, no template.
      </div>
      <div style={{ maxHeight: '65vh', overflowY: 'auto', marginBottom: 12 }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
              <th style={{ textAlign: 'left', padding: '8px 16px' }}>Rótulo</th>
              <th style={{ textAlign: 'left', padding: '8px 16px' }}>Modo</th>
              <th style={{ textAlign: 'left', padding: '8px 16px', minWidth: 520 }}>Fórmula / Agrupamento</th>
              <th style={{ textAlign: 'center', padding: '8px 16px' }}>Ordem</th>
              <th style={{ textAlign: 'right', padding: '8px 16px' }}></th>
            </tr>
          </thead>
          <tbody>
            {t.linhas.sort((a, b) => a.ordem - b.ordem).map(l => (
              <LinhaRow key={l.id} linha={l} templateId={t.id}
                agrupamentos={agrupamentos} agrupamentosReais={agrupamentosReais}
                rotulosDisponiveis={rotulosDisponiveis}
                onRefresh={carregar} />
            ))}
          </tbody>
        </table>
      </div>

      {adicionando ? (
        <div style={{ border: '1px dashed var(--brand)', borderRadius: 8, padding: 16, marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12 }}>Rótulo da linha</label>
            <input value={novaLinha.rotulo} onChange={e => setNovaLinha(f => ({ ...f, rotulo: e.target.value }))} placeholder="ex: Margem Bruta" />
          </div>
          <CamposModoCalculo form={novaLinha} setForm={setNovaLinha} agrupamentosReais={agrupamentosReais}
            agrupamentos={agrupamentos} rotulosDisponiveis={rotulosDisponiveis}
            rotuloAtual={novaLinha.rotulo}
            inserirVar={v => setNovaLinha(f => ({ ...f, formula_texto: (f.formula_texto || '') + v }))} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <input type="checkbox" checked={novaLinha.negrito_totalizador}
              onChange={e => setNovaLinha(f => ({ ...f, negrito_totalizador: e.target.checked }))} />
            <label style={{ fontSize: 12 }}>Negrito</label>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => setAdicionando(false)}>Cancelar</button>
            <button className="btn btn-sm btn-primary" onClick={adicionarLinha}>Adicionar</button>
          </div>
        </div>
      ) : (
        <button className="btn btn-sm" onClick={() => setAdicionando(true)} style={{ marginBottom: 12 }}>
          <Plus size={13} /> Nova Linha
        </button>
      )}
    </Modal>
  )
}

export default function TemplatesRef() {
  const [templates, setTemplates] = useState([])
  const [segmentos, setSegmentos] = useState([])
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroSeg, setFiltroSeg] = useState('')
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [novoForm, setNovoForm] = useState({ tipo: 'dre', segmento_id: '', nome: '' })
  const [duplicando, setDuplicando] = useState(null)
  const [dupForm, setDupForm] = useState({ segmento_id: '', nome: '' })

  useEffect(() => {
    refSegmentosAPI.listar().then(r => setSegmentos(r.data))
    carregar()
  }, [filtroTipo, filtroSeg])

  const carregar = async () => {
    const r = await refTemplatesAPI.listar(filtroTipo || null, filtroSeg || null)
    setTemplates(r.data)
  }

  const criarTemplate = async () => {
    try {
      await refTemplatesAPI.criar({ ...novoForm, segmento_id: Number(novoForm.segmento_id) })
      toast.success('Template criado')
      setCriando(false)
      carregar()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const excluir = async (id) => {
    if (!confirm('Excluir template?')) return
    try {
      await refTemplatesAPI.deletar(id)
      toast.success('Template excluído')
      carregar()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const duplicarTemplate = async () => {
    try {
      await refTemplatesAPI.duplicar(duplicando.id, { segmento_id: Number(dupForm.segmento_id), nome: dupForm.nome || undefined })
      toast.success('Template duplicado')
      setDuplicando(null)
      carregar()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Templates de Demonstrativos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>DRE, Fluxo de Caixa e Orçamento por segmento</p>
        </div>
        <BotaoNovo onClick={() => setCriando(true)}>Novo Template</BotaoNovo>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtroSeg} onChange={e => setFiltroSeg(e.target.value)}>
          <option value="">Todos os segmentos</option>
          {segmentos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {templates.map(t => (
          <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{t.nome}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {TIPO_LABEL[t.tipo]} · {t.linhas?.length ?? 0} linha{(t.linhas?.length ?? 0) !== 1 ? 's' : ''}
                {' · '}{t.segmento_id ? (segmentos.find(s => s.id === t.segmento_id)?.nome || `Segmento ${t.segmento_id}`) : 'Universal'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <BotaoEditar onClick={() => setEditando(t)}>Editar Linhas</BotaoEditar>
              <button className="btn btn-sm" onClick={() => { setDuplicando(t); setDupForm({ segmento_id: '', nome: `${t.nome} (cópia)` }) }}
                title="Duplicar para outro segmento"><Copy size={12} /></button>
              <BotaoExcluir onClick={() => excluir(t.id)} />
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            Nenhum template. Clique em "Novo Template" para começar.
          </div>
        )}
      </div>

      {criando && (
        <Modal titulo="Novo Template" onClose={() => setCriando(false)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="form-group">
              <label>Nome</label>
              <input value={novoForm.nome} onChange={e => setNovoForm(f => ({ ...f, nome: e.target.value }))} placeholder="ex: DRE Varejo Alimentar" />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select value={novoForm.tipo} onChange={e => setNovoForm(f => ({ ...f, tipo: e.target.value }))}>
                {Object.entries(TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Segmento</label>
              <select value={novoForm.segmento_id} onChange={e => setNovoForm(f => ({ ...f, segmento_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {segmentos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setCriando(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={criarTemplate}>Criar</button>
            </div>
          </div>
        </Modal>
      )}

      {editando && (
        <EditorTemplate template={editando} onFechar={() => setEditando(null)} onRefresh={carregar} />
      )}

      {duplicando && (
        <Modal titulo={`Duplicar: ${duplicando.nome}`} onClose={() => setDuplicando(null)}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="form-group">
              <label>Nome da cópia</label>
              <input value={dupForm.nome} onChange={e => setDupForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Segmento de destino</label>
              <select value={dupForm.segmento_id} onChange={e => setDupForm(f => ({ ...f, segmento_id: e.target.value }))}>
                <option value="">Selecione...</option>
                {segmentos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDuplicando(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={duplicarTemplate}>Duplicar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
