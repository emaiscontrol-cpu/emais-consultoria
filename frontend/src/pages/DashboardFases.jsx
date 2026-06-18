import { useEffect, useState } from 'react'
import { projetosAPI, dashboardAPI, relatoriosAPI } from '../services/api'
import { LoadingPage } from '../components/shared'
import { PieChart, Pie, Cell, Label, ResponsiveContainer } from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const PROJ_KEY = 'emais_dash_projeto'

const D = {
  bg:     '#0D0D0D',
  card:   '#171717',
  card2:  '#1F1F1F',
  border: 'rgba(255,255,255,.08)',
  text:   '#EDECEA',
  text2:  '#9B9A94',
}

const COR = {
  verde:    '#4CAF50',
  amarelo:  '#FFC107',
  vermelho: '#E53935',
  azul:     '#1E88E5',
  bloqueada:'#444',
}

const FASE_COR = {
  concluida:    COR.verde,
  em_andamento: COR.azul,
  pendente:     COR.amarelo,
  bloqueada:    COR.bloqueada,
}

const TAR_COR = {
  concluida:        COR.verde,
  em_andamento:     COR.azul,
  aguard_validacao: '#7C3AED',
  aguard_valid:     '#7C3AED',
  pendente:         '#444',
  atrasada:         COR.vermelho,
}

const TAR_LABEL = {
  concluida: 'Concluída', em_andamento: 'Em andamento',
  aguard_validacao: 'Aguard. validação', aguard_valid: 'Aguard. validação',
  pendente: 'Pendente', atrasada: 'Atrasada',
}

const FASE_LABEL = {
  concluida: 'Concluída', em_andamento: 'Em andamento',
  pendente: 'Pendente', bloqueada: 'Bloqueada',
}

// ─── Donut por fase (componente igual ao Dashboard Geral) ───────────────────
function DonutFase({ data, total, perc }) {
  if (!total) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height: 150, color: D.text2, fontSize: 12 }}>Sem tarefas</div>
  )
  return (
    <ResponsiveContainer width="100%" height={150}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={62}
          dataKey="value" paddingAngle={3} strokeWidth={0}>
          {data.map((e, i) => <Cell key={i} fill={e.color} />)}
          <Label position="center" content={({ viewBox: { cx, cy } }) => (
            <g>
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                fontSize={20} fontWeight={800} fill={D.text}>{perc}%</text>
              <text x={cx} y={cy + 16} textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fill={D.text2}>{total} tar.</text>
            </g>
          )} />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

// ─── Card de métricas ────────────────────────────────────────────────────────
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

// ─── Heatmap de tarefas dentro de uma fase ──────────────────────────────────
function HeatmapFase({ fase }) {
  const tarefas = (fase.tarefas || []).filter(t => t.ativo !== false)
  const cor     = FASE_COR[fase.status] || '#555'

  return (
    <div style={{ marginBottom: 10, padding: '14px 18px', background: D.card,
      border: `1px solid ${D.border}`, borderRadius: 10 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: D.text2, fontWeight: 600, minWidth: 52, flexShrink: 0 }}>
          Fase {fase.ordem}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: D.text, flex: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fase.nome}</span>
        {tarefas.length > 0 && (
          <span style={{ fontSize: 11, color: D.text2, whiteSpace: 'nowrap' }}>
            {tarefas.filter(t => t.status === 'concluida').length}/{tarefas.length}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 700, color: cor, background: `${cor}22`,
          padding: '2px 10px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {FASE_LABEL[fase.status] || fase.status}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: cor, minWidth: 38,
          textAlign: 'right', flexShrink: 0 }}>
          {Math.round(fase.progresso)}%
        </span>
      </div>

      <div style={{ height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 99,
        marginBottom: tarefas.length ? 12 : 0, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${fase.progresso}%`, background: cor,
          borderRadius: 99, transition: 'width .6s ease' }} />
      </div>

      {tarefas.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {tarefas.map(t => (
            <div key={t.id}
              title={`${t.nome}\n${TAR_LABEL[t.status] || t.status}${t.data_prazo ? '\nPrazo: ' + new Date(t.data_prazo).toLocaleDateString('pt-BR') : ''}`}
              style={{ width: 20, height: 20, borderRadius: 5, background: TAR_COR[t.status] || '#333',
                cursor: 'default', transition: 'transform .12s',
                opacity: t.status === 'bloqueada' ? .4 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.35)'; e.currentTarget.style.zIndex = 2 }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = 1 }}
            />
          ))}
        </div>
      )}

      {fase.status === 'bloqueada' && tarefas.length === 0 && (
        <div style={{ fontSize: 11, color: D.text2, fontStyle: 'italic', marginTop: 4 }}>
          Aguardando progresso da fase anterior para desbloquear.
        </div>
      )}
    </div>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function DashboardFases() {
  const { usuario } = useAuth()
  const [projetos,    setProjetos]    = useState([])
  const [projetoId,   setProjetoId]   = useState('')
  const [projeto,     setProjeto]     = useState(null)
  const [dados,       setDados]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [loadingProj, setLoadingProj] = useState(true)

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
      .catch(() => toast.error('Erro ao carregar projetos'))
      .finally(() => setLoadingProj(false))
  }, [])

  const handleProjeto = (id) => {
    setProjetoId(id)
    if (id) localStorage.setItem(PROJ_KEY, id)
    else localStorage.removeItem(PROJ_KEY)
  }

  useEffect(() => {
    if (!projetoId) { setProjeto(null); setDados(null); return }
    setLoading(true)
    Promise.all([
      projetosAPI.detalhe(projetoId),
      relatoriosAPI.graficos(projetoId),
    ])
      .then(([pRes, gRes]) => {
        setProjeto(pRes.data)
        setDados(gRes.data)
      })
      .catch(() => toast.error('Erro ao carregar projeto'))
      .finally(() => setLoading(false))
  }, [projetoId])

  const fases      = projeto?.fases || []
  const porFase    = dados?.por_fase || []
  const totalFases = fases.length
  const conclFases = fases.filter(f => f.status === 'concluida').length
  const andFases   = fases.filter(f => f.status === 'em_andamento').length
  const bloqFases  = fases.filter(f => f.status === 'bloqueada').length
  const percGeral  = totalFases
    ? Math.round(fases.reduce((s, f) => s + f.progresso, 0) / totalFases)
    : 0

  const LEGENDA_TAR = [
    ['Concluída',         '#4CAF50'],
    ['Em andamento',      '#1E88E5'],
    ['Aguard. validação', '#7C3AED'],
    ['Pendente',          '#444'],
    ['Atrasada',          '#E53935'],
  ]

  return (
    <div style={{ background: D.bg, minHeight: '100vh', padding: '28px 32px', color: D.text }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: D.text, marginBottom: 4 }}>
          Dashboard — Por Fase
        </div>
        <div style={{ fontSize: 13, color: D.text2 }}>
          Progresso e status detalhado de cada fase do projeto
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
                color: D.text, fontSize: 13, padding: '10px 16px', minWidth: 320,
                cursor: 'pointer', outline: 'none' }}>
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

      {loading && <LoadingPage />}

      {!loading && projeto && (
        <>
          {/* Cards de métricas */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 32, flexWrap: 'wrap' }}>
            <MetricCard label="Total de Fases"  value={totalFases} sub={`${percGeral}% concluído`} />
            <MetricCard label="Concluídas"      value={conclFases} color={COR.verde} />
            <MetricCard label="Em Andamento"    value={andFases}   color={COR.azul} />
            <MetricCard label="Bloqueadas"      value={bloqFases}  color="#555" />
          </div>

          {/* ── STATUS POR FASE — cards donut ─────────────────────────── */}
          {porFase.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: D.text2, textTransform: 'uppercase',
                letterSpacing: '.08em', marginBottom: 14 }}>Status por Fase</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12, marginBottom: 32 }}>
                {porFase.map(fase => {
                  const p = fase.total > 0 ? Math.round(fase.concluidas / fase.total * 100) : 0
                  return (
                    <div key={fase.nome} style={{ background: D.card, border: `1px solid ${D.border}`,
                      borderRadius: 12, padding: '16px 18px' }}>
                      <div style={{ fontSize: 10, color: D.text2, marginBottom: 3 }}>Fase {fase.ordem}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: D.text, marginBottom: 8,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {fase.nome}
                      </div>
                      <DonutFase data={fase.pizza} total={fase.total} perc={p} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                        {[
                          { label: 'Feito',        val: fase.concluidas,   cor: COR.verde   },
                          { label: 'Em andamento', val: fase.em_andamento, cor: COR.amarelo },
                          { label: 'Parado',       val: fase.paradas,      cor: COR.vermelho },
                        ].map(l => (
                          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: l.cor,
                              flexShrink: 0, display: 'inline-block' }} />
                            <span style={{ color: D.text2, flex: 1 }}>{l.label}</span>
                            <span style={{ fontWeight: 700, color: D.text }}>{l.val}</span>
                            <span style={{ color: D.text2, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              ({fase.total > 0 ? Math.round(l.val / fase.total * 100) : 0}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ── DETALHE — heatmap de tarefas por fase ─────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: D.text2,
              textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Detalhe de Tarefas por Fase
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {LEGENDA_TAR.map(([label, cor]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 11, color: D.text2 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: cor, flexShrink: 0 }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {fases.map(f => <HeatmapFase key={f.id} fase={f} />)}

          {fases.length === 0 && (
            <div style={{ color: D.text2, textAlign: 'center', padding: '48px 0', fontSize: 14 }}>
              Nenhuma fase cadastrada neste projeto.
            </div>
          )}
        </>
      )}

      {!loading && !projeto && !loadingProj && (
        <div style={{ color: D.text2, textAlign: 'center', padding: '80px 0', fontSize: 14 }}>
          Selecione um projeto para visualizar o dashboard de fases.
        </div>
      )}
    </div>
  )
}
