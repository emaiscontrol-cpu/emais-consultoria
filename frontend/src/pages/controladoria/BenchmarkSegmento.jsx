import { useState, useEffect } from 'react'
import { BarChart2, RefreshCw } from 'lucide-react'
import { refBenchmarkAPI, refSegmentosAPI, refTemplatesAPI } from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function BarraBenchmark({ valor, min, max, label }) {
  const range = max - min
  const pct = range > 0 ? ((valor - min) / range) * 100 : 50
  return (
    <div style={{ margin: '4px 0' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ position: 'relative', height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'visible' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: '100%', background: 'linear-gradient(to right, #ef4444, #f59e0b, #22c55e)', borderRadius: 99, opacity: 0.25 }} />
        <div style={{
          position: 'absolute', top: -4, left: `${pct}%`,
          width: 16, height: 16, background: 'var(--brand)', borderRadius: '50%',
          border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)',
          transform: 'translateX(-50%)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
        <span>min {fmt(min)}</span><span>max {fmt(max)}</span>
      </div>
    </div>
  )
}

export default function BenchmarkSegmento() {
  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth() + 1

  const [segmentos, setSegmentos] = useState([])
  const [templates, setTemplates] = useState([])
  const [segId, setSegId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [ano, setAno] = useState(anoAtual)
  const [mes, setMes] = useState(mesAtual)
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refSegmentosAPI.listar().then(r => setSegmentos(r.data))
    refTemplatesAPI.listar('dre', null).then(r => setTemplates(r.data))
  }, [])

  const calcular = async () => {
    if (!segId || !templateId) return toast.error('Selecione segmento e template')
    setLoading(true)
    try {
      const r = await refBenchmarkAPI.calcular(segId, ano, mes, templateId)
      setResultado(r.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao calcular benchmark')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Benchmark por Segmento</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
          Comparativo anônimo entre clientes do mesmo segmento — sem identificar nenhum individualmente
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Segmento</label>
          <select value={segId} onChange={e => setSegId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">Selecione...</option>
            {segmentos.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Template DRE</label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ minWidth: 200 }}>
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
        <button className="btn btn-primary" onClick={calcular} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
          <RefreshCw size={13} /> {loading ? 'Calculando...' : 'Calcular'}
        </button>
      </div>

      {resultado && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart2 size={16} color="var(--brand)" />
            <span style={{ fontWeight: 700 }}>
              {resultado.segmento_nome} · {MESES[resultado.mes - 1]}/{resultado.ano}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
              (dados anônimos de todos os clientes do segmento com lançamentos no período)
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px' }}>Linha</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px' }}>Média</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px' }}>Mínimo</th>
                  <th style={{ textAlign: 'right', padding: '10px 16px' }}>Máximo</th>
                  <th style={{ textAlign: 'center', padding: '10px 16px' }}>Clientes</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', minWidth: 160 }}>Faixa</th>
                </tr>
              </thead>
              <tbody>
                {resultado.linhas.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px' }}>{l.rotulo}</td>
                    <td style={{ textAlign: 'right', padding: '10px 16px', fontFamily: 'monospace', fontWeight: 600 }}>
                      {fmt(l.media)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px', fontFamily: 'monospace', color: '#ef4444' }}>
                      {fmt(l.minimo)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 16px', fontFamily: 'monospace', color: '#22c55e' }}>
                      {fmt(l.maximo)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 16px', color: 'var(--text-muted)' }}>
                      {l.qtd_clientes}
                    </td>
                    <td style={{ padding: '10px 16px', minWidth: 160 }}>
                      <BarraBenchmark valor={l.media} min={l.minimo} max={l.maximo} label="" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 size={11} />
            Os valores são agregados anônimos. Nenhum cliente é identificado individualmente nesta tela.
          </div>
        </>
      )}

      {!resultado && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 12 }}>
          Selecione segmento, template e período, depois clique em "Calcular" para ver o benchmark.
        </div>
      )}
    </div>
  )
}
