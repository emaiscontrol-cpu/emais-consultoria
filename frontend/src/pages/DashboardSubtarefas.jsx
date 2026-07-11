import { useEffect, useState } from 'react'
import { projetosAPI, dashboardAPI, subtarefasAPI } from '../services/api'
import { LoadingPage } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import { GraficoRosca, GraficoBarras } from '../components/Graficos'
import toast from 'react-hot-toast'

const PROJ_KEY = 'emais_dash_projeto'

const D = {
  bg:     '#0D0D0D',
  card:   '#171717',
  card2:  '#1F1F1F',
  border: 'rgba(255,255,255,.08)',
  text:   '#EDECEA',
  text2:  '#9B9A94',
  grid:   '#2A2826',
}

const COR_STATUS = {
  concluida: '#4CAF50',
  pendente:  '#FFC107',
  a_fazer:   '#555',
}

const LABEL_STATUS = {
  concluida: 'Concluída',
  pendente:  'Pendente',
  a_fazer:   'A Fazer',
}

function MetricCard({ label, value, color, sub }) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12,
      padding: '18px 22px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: D.text2,
        textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: color || D.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: D.text2, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const TooltipEscuro = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: D.card2, border: `1px solid ${D.border}`, borderRadius: 8,
      padding: '10px 14px', fontSize: 12, color: D.text }}>
      {label && <div style={{ fontWeight: 700, marginBottom: 6, color: D.text2 }}>{label}</div>}
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill || p.color }} />
          <span style={{ color: D.text2 }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardSubtarefas() {
  const { usuario } = useAuth()
  const [projetos,   setProjetos]   = useState([])
  const [projetoId,  setProjetoId]  = useState('')
  const [projeto,    setProjeto]    = useState(null)
  const [subsPorFase, setSubsPorFase] = useState({})
  const [loading,    setLoading]    = useState(false)
  const [loadingSubs, setLoadingSubs] = useState(false)

  const isCliente = usuario?.perfil === 'analista'

  useEffect(() => {
    dashboardAPI.projetosResumo()
      .then(r => {
        setProjetos(r.data)
        if (!r.data.length) return
        const saved  = localStorage.getItem(PROJ_KEY)
        const valido = saved && r.data.find(p => String(p.id) === saved)
        if (valido) {
          setProjetoId(saved)
        } else if (isCliente || r.data.length === 1) {
          const id = String(r.data[0].id)
          setProjetoId(id)
          localStorage.setItem(PROJ_KEY, id)
        }
      })
      .catch(() => {})
  }, [])

  const handleProjeto = (id) => {
    setProjetoId(id)
    setProjeto(null)
    setSubsPorFase({})
    if (id) localStorage.setItem(PROJ_KEY, id)
    else localStorage.removeItem(PROJ_KEY)
  }

  // Carrega o projeto e depois todas as subtarefas em paralelo
  useEffect(() => {
    if (!projetoId) { setProjeto(null); setSubsPorFase({}); return }
    setLoading(true)
    projetosAPI.detalhe(projetoId)
      .then(async r => {
        const proj = r.data
        setProjeto(proj)

        const todasTarefas = (proj.fases || []).flatMap(f =>
          (f.tarefas || []).filter(t => t.ativo !== false).map(t => ({ ...t, faseId: f.id }))
        )

        if (todasTarefas.length === 0) { setSubsPorFase({}); return }

        setLoadingSubs(true)
        const resultados = await Promise.all(
          todasTarefas.map(t => subtarefasAPI.listar(t.id).then(r2 => ({ faseId: t.faseId, subs: r2.data })))
        )
        // Agrupa por fase
        const porFase = {}
        for (const { faseId, subs } of resultados) {
          if (!porFase[faseId]) porFase[faseId] = []
          porFase[faseId].push(...subs)
        }
        setSubsPorFase(porFase)
      })
      .catch(() => toast.error('Erro ao carregar projeto'))
      .finally(() => { setLoading(false); setLoadingSubs(false) })
  }, [projetoId])

  const fases = projeto?.fases || []

  // Todas as subtarefas do projeto
  const todasSubs = Object.values(subsPorFase).flat()
  const total = todasSubs.length
  const concl = todasSubs.filter(s => s.status === 'concluida').length
  const pend  = todasSubs.filter(s => s.status === 'pendente').length
  const aFaz  = todasSubs.filter(s => s.status === 'a_fazer').length
  const perc  = total > 0 ? Math.round((concl / total) * 100) : 0

  // Dados para o donut
  const pieData = [
    { name: 'Concluída', value: concl, color: '#4CAF50' },
    { name: 'Pendente',  value: pend,  color: '#FFC107' },
    { name: 'A Fazer',   value: aFaz,  color: '#555'    },
  ].filter(d => d.value > 0)

  // Dados para o bar chart por fase
  const barData = fases
    .filter(f => subsPorFase[f.id]?.length > 0)
    .map(f => {
      const subs = subsPorFase[f.id] || []
      return {
        name: `F${f.ordem}`,
        fullName: f.nome,
        Concluída: subs.filter(s => s.status === 'concluida').length,
        Pendente:  subs.filter(s => s.status === 'pendente').length,
        'A Fazer': subs.filter(s => s.status === 'a_fazer').length,
      }
    })

  // Heatmap por fase
  const faseComSubs = fases.filter(f => subsPorFase[f.id]?.length > 0)

  const isBusy = loading || loadingSubs

  return (
    <div style={{ background: D.bg, minHeight: '100vh', padding: '28px 32px', color: D.text }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: D.text, marginBottom: 4 }}>
          Dashboard — Por Atividade
        </div>
        <div style={{ fontSize: 13, color: D.text2 }}>
          Visão consolidada de todas as atividades do projeto
        </div>
      </div>

      {/* Seletor de projeto */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, alignItems: 'center', flexWrap: 'wrap' }}>
        {isCliente ? (
          <div style={{ background: D.card2, border: `1px solid ${D.border}`, borderRadius: 8,
            color: D.text, fontSize: 13, padding: '10px 16px', minWidth: 320, fontWeight: 600 }}>
            {projetos.find(p => String(p.id) === projetoId)?.nome ?? '—'}
          </div>
        ) : (
          <>
            <select value={projetoId} onChange={e => handleProjeto(e.target.value)}
              style={{ background: D.card2, border: `1px solid ${D.border}`, borderRadius: 8,
                color: D.text, fontSize: 13, padding: '10px 16px', minWidth: 320, cursor: 'pointer', outline: 'none' }}>
              <option value="">Selecione um projeto...</option>
              {projetos.map(p => (
                <option key={p.id} value={p.id}>{p.nome}{p.cliente ? ` — ${p.cliente}` : ''}</option>
              ))}
            </select>
            {projetoId && (
              <button onClick={() => handleProjeto('')}
                style={{ background: 'transparent', border: `1px solid ${D.border}`, color: D.text2,
                  borderRadius: 8, padding: '10px 14px', fontSize: 12, cursor: 'pointer' }}>
                Limpar
              </button>
            )}
          </>
        )}
      </div>

      {isBusy && <LoadingPage />}

      {!isBusy && projeto && total === 0 && (
        <div style={{ color: D.text2, textAlign: 'center', padding: '60px 0', fontSize: 14 }}>
          Nenhuma atividade cadastrada nas tarefas deste projeto.
        </div>
      )}

      {!isBusy && projeto && total > 0 && (
        <>
          {/* Cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
            <MetricCard label="Total"      value={total} sub={`${perc}% concluído`} />
            <MetricCard label="Concluídas" value={concl} color="#4CAF50" />
            <MetricCard label="Pendentes"  value={pend}  color="#FFC107" />
            <MetricCard label="A Fazer"    value={aFaz}  color="#555" />
          </div>

          {/* Gráficos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, marginBottom: 24 }}>

            {/* Donut — distribuição geral */}
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: D.text2, textTransform: 'uppercase',
                letterSpacing: '.08em', marginBottom: 16 }}>Distribuição por Status</div>
              <GraficoRosca
                dados={pieData} altura={220} innerRadius={55} outerRadius={85}
                tooltip tooltipContent={<TooltipEscuro />}
                legenda legendaContent={({ payload }) => (
                  <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
                    {(payload || []).map((e, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, flexShrink: 0 }} />
                        <span style={{ color: D.text2, fontSize: 11 }}>{e.value}</span>
                      </li>
                    ))}
                  </ul>
                )}
                dark
              />
              {/* % no centro — texto abaixo */}
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#4CAF50' }}>{perc}%</span>
                <div style={{ fontSize: 11, color: D.text2 }}>concluído</div>
              </div>
            </div>

            {/* Bar chart — subtarefas por fase */}
            <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12, padding: '20px 16px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: D.text2, textTransform: 'uppercase',
                letterSpacing: '.08em', marginBottom: 16 }}>Atividades por Fase</div>
              <GraficoBarras
                dados={barData} chaveX="name" altura={260}
                margin={{ top: 0, right: 8, left: -20, bottom: 0 }}
                tooltipContent={<TooltipEscuro />} tooltipCursor={{ fill: 'rgba(255,255,255,.04)' }}
                legenda
                dark
                barras={[
                  { chave: 'Concluída', cor: '#4CAF50', stackId: 'a', radius: [0, 0, 0, 0] },
                  { chave: 'Pendente', cor: '#FFC107', stackId: 'a', radius: [0, 0, 0, 0] },
                  { chave: 'A Fazer', nome: 'A Fazer', cor: '#555', stackId: 'a', radius: [4, 4, 0, 0] },
                ]}
              />
            </div>
          </div>

          {/* Heatmap por fase */}
          <div style={{ fontSize: 10, fontWeight: 700, color: D.text2, textTransform: 'uppercase',
            letterSpacing: '.08em', marginBottom: 12 }}>Progresso Visual por Fase</div>

          {faseComSubs.map(f => {
            const subs = subsPorFase[f.id] || []
            const fConc = subs.filter(s => s.status === 'concluida').length
            return (
              <div key={f.id} style={{ marginBottom: 10, padding: '14px 18px', background: D.card,
                border: `1px solid ${D.border}`, borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: D.text2, fontWeight: 600, minWidth: 52 }}>Fase {f.ordem}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: D.text, flex: 1 }}>{f.nome}</span>
                  <span style={{ fontSize: 11, color: D.text2 }}>{fConc}/{subs.length}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#4CAF50' }}>
                    {subs.length > 0 ? Math.round((fConc / subs.length) * 100) : 0}%
                  </span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,.07)', borderRadius: 99,
                  overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', borderRadius: 99, background: '#4CAF50',
                    width: `${subs.length > 0 ? (fConc / subs.length) * 100 : 0}%`,
                    transition: 'width .6s ease' }} />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {subs.map(s => (
                    <div key={s.id}
                      title={`${s.nome} — ${LABEL_STATUS[s.status] || s.status}`}
                      style={{ width: 18, height: 18, borderRadius: 4,
                        background: COR_STATUS[s.status] || '#333',
                        cursor: 'default', transition: 'transform .12s' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.4)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      {!isBusy && !projeto && (
        <div style={{ color: D.text2, textAlign: 'center', padding: '80px 0', fontSize: 14 }}>
          Selecione um projeto para visualizar o dashboard de atividades.
        </div>
      )}
    </div>
  )
}
