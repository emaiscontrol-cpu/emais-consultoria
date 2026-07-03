import { useState, useEffect } from 'react'
import { AlertTriangle, Lock, Unlock, RefreshCw } from 'lucide-react'
import { refDemonstrativosAPI, refTemplatesAPI, clientesAPI, refSegmentosAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function Demonstrativo() {
  const { usuario } = useAuth()
  const isAdminConsultor = ['admin', 'consultor'].includes(usuario?.perfil)
  const isCliente = ['analista', 'ger_projeto', 'ti'].includes(usuario?.perfil)

  const [clientes, setClientes] = useState([])
  const [templates, setTemplates] = useState([])
  const [templatesOrc, setTemplatesOrc] = useState([])

  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth() + 1

  const [clienteId, setClienteId] = useState(isCliente ? String(usuario?.cliente_id || '') : '')
  const [templateId, setTemplateId] = useState('')
  const [templateOrcId, setTemplateOrcId] = useState('')
  const [ano, setAno] = useState(anoAtual)
  const [mes, setMes] = useState(mesAtual)
  const [modoComparativo, setModoComparativo] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [periodosF, setPeriodosF] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isCliente) clientesAPI.listar({ modulo_analises_gerenciais: true }).then(r => setClientes(r.data))
    refTemplatesAPI.listar('dre', null).then(r => setTemplates(r.data))
    refTemplatesAPI.listar('orcamento', null).then(r => setTemplatesOrc(r.data))
  }, [])

  useEffect(() => {
    if (clienteId) refDemonstrativosAPI.periodos(clienteId).then(r => setPeriodosF(r.data)).catch(() => {})
  }, [clienteId])

  const estahFechado = periodosF.some(p => p.ano === Number(ano) && p.mes === Number(mes))

  const calcular = async () => {
    if (!clienteId || !templateId) return toast.error('Selecione cliente e template')
    setLoading(true)
    try {
      if (modoComparativo && templateOrcId) {
        const r = await refDemonstrativosAPI.comparativo(clienteId, ano, mes, templateId, templateOrcId)
        setResultado({ tipo: 'comparativo', dados: r.data })
      } else {
        const r = await refDemonstrativosAPI.calcular(clienteId, templateId, ano, mes)
        setResultado({ tipo: 'simples', dados: r.data })
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao calcular')
    } finally { setLoading(false) }
  }

  const fechar = async () => {
    if (!confirm(`Fechar o período ${MESES[mes - 1]}/${ano}? Isso impedirá novos lançamentos.`)) return
    try {
      await refDemonstrativosAPI.fecharPeriodo(clienteId, ano, mes)
      toast.success('Período fechado')
      refDemonstrativosAPI.periodos(clienteId).then(r => setPeriodosF(r.data))
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const reabrir = async () => {
    if (!confirm('Reabrir o período? Novos lançamentos serão permitidos.')) return
    try {
      await refDemonstrativosAPI.reabrirPeriodo(clienteId, ano, mes)
      toast.success('Período reaberto')
      refDemonstrativosAPI.periodos(clienteId).then(r => setPeriodosF(r.data))
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const linhas = resultado?.dados?.linhas || []

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Demonstrativo Gerencial</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            DRE · Fluxo de Caixa · Orçamento calculado pelo plano referencial
          </p>
        </div>
        {isAdminConsultor && clienteId && (
          <div style={{ display: 'flex', gap: 8 }}>
            {estahFechado ? (
              <button className="btn btn-sm" onClick={reabrir} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Unlock size={13} /> Reabrir {MESES[mes - 1]}/{ano}
              </button>
            ) : (
              <button className="btn btn-sm" onClick={fechar} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={13} /> Fechar Período
              </button>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        {!isCliente && (
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Cliente</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">Selecione...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
            </select>
          </div>
        )}
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Template</label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">Selecione...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Mês</label>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Ano</label>
          <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))} style={{ width: 80 }} />
        </div>
        {isAdminConsultor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={modoComparativo} onChange={e => setModoComparativo(e.target.checked)} />
            <label style={{ fontSize: 12 }}>Comparativo vs Orçado</label>
          </div>
        )}
        {modoComparativo && isAdminConsultor && (
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Template Orçado</label>
            <select value={templateOrcId} onChange={e => setTemplateOrcId(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Selecione...</option>
              {templatesOrc.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        )}
        <button className="btn btn-primary" onClick={calcular} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          {loading ? 'Calculando...' : 'Calcular'}
        </button>
      </div>

      {estahFechado && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#dc2626', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={13} /> Período {MESES[mes - 1]}/{ano} está fechado. Novos lançamentos não são permitidos.
        </div>
      )}

      {/* Tabela */}
      {resultado && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface)' }}>
                <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 700 }}>Linha</th>
                {resultado.tipo === 'simples' ? (
                  <th style={{ textAlign: 'right', padding: '10px 16px' }}>Valor (R$)</th>
                ) : (
                  <>
                    <th style={{ textAlign: 'right', padding: '10px 16px' }}>Realizado</th>
                    <th style={{ textAlign: 'right', padding: '10px 16px' }}>Orçado</th>
                    <th style={{ textAlign: 'right', padding: '10px 16px' }}>Desvio %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const negrito = l.negrito_totalizador
                const dzero = l.tem_divisao_por_zero
                const desvio = resultado.tipo === 'comparativo' ? l.desvio_percentual : null
                return (
                  <tr key={i} style={{
                    borderBottom: '1px solid var(--border)',
                    background: negrito ? 'var(--surface)' : 'transparent',
                  }}>
                    <td style={{ padding: '9px 16px', fontWeight: negrito ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {l.rotulo}
                      {dzero && <AlertTriangle size={12} color="#f59e0b" title="Divisão por zero — valor zerado" />}
                    </td>
                    {resultado.tipo === 'simples' ? (
                      <td style={{ textAlign: 'right', padding: '9px 16px', fontWeight: negrito ? 700 : 400, fontFamily: 'monospace' }}>
                        {fmt(l.valor)}
                      </td>
                    ) : (
                      <>
                        <td style={{ textAlign: 'right', padding: '9px 16px', fontFamily: 'monospace', fontWeight: negrito ? 700 : 400 }}>{fmt(l.realizado)}</td>
                        <td style={{ textAlign: 'right', padding: '9px 16px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{fmt(l.orcado)}</td>
                        <td style={{ textAlign: 'right', padding: '9px 16px', fontFamily: 'monospace',
                          color: desvio === null ? 'var(--text-muted)' : desvio >= 0 ? '#22c55e' : '#ef4444',
                          fontWeight: desvio !== null ? 600 : 400 }}>
                          {desvio === null ? '—' : `${desvio >= 0 ? '+' : ''}${desvio.toFixed(1)}%`}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!resultado && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 12 }}>
          Selecione os filtros e clique em "Calcular" para visualizar o demonstrativo.
        </div>
      )}
    </div>
  )
}
