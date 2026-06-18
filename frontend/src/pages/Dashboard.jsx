import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { dashboardAPI, projetosAPI, relatoriosAPI, tarefasAPI } from '../services/api'
import { Badge, Progress, LoadingPage } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import {
  PieChart, Pie, Cell, Tooltip, Legend, Label, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import toast from 'react-hot-toast'

// ── Tema escuro (gráficos) ───────────────────────────────
const D = {
  bg:     '#0D0D0D',
  card:   '#171717',
  card2:  '#1F1F1F',
  border: 'rgba(255,255,255,.08)',
  text:   '#EDECEA',
  text2:  '#9B9A94',
  grid:   '#2A2826',
  stripe: '#1C1C1A',
}

const COR = {
  verde:    '#4CAF50',
  amarelo:  '#FFC107',
  vermelho: '#E53935',
  azul:     '#1E88E5',
  cinza:    '#757575',
  bloqueada:'#444',
}

const STATUS_LABEL = {
  concluida: 'Concluída', em_andamento: 'Em andamento', pendente: 'Pendente',
  bloqueada: 'Bloqueada', atrasada: 'Atrasada', pausado: 'Pausado',
}

const STATUS_BAR = {
  concluida:    COR.verde,
  em_andamento: COR.azul,
  pendente:     '#555',
  bloqueada:    COR.bloqueada,
  atrasada:     COR.vermelho,
}

const cardDark = {
  background: D.card,
  border: `1px solid ${D.border}`,
  borderRadius: 12,
  padding: '16px 20px',
}

const sectionLabel = {
  fontSize: 10, fontWeight: 700, color: D.text2,
  textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12,
}

function LegendaPizza({ payload = [] }) {
  return (
    <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:7 }}>
      {payload.map((e, i) => {
        const cor   = e.color ?? e.payload?.color ?? ''
        const label = labelPizza(cor) ?? e.value ?? ''
        const valor = e.payload?.value ?? 0
        return (
          <li key={i} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
            <span style={{ width:10, height:10, borderRadius:2, background:cor, flexShrink:0, display:'inline-block' }}/>
            <span style={{ color:D.text2, flex:1 }}>{label}</span>
            <span style={{ fontWeight:700, color:D.text }}>{valor}</span>
          </li>
        )
      })}
    </ul>
  )
}

function TipBurndown({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:D.card2, border:`1px solid ${D.border}`, borderRadius:8,
      padding:'9px 14px', fontSize:12, boxShadow:'0 6px 20px rgba(0,0,0,.5)' }}>
      <div style={{ fontWeight:700, color:D.text, marginBottom:6 }}>{label}</div>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <span style={{ width:8, height:8, borderRadius:99, background:p.color, display:'inline-block' }}/>
          <span style={{ color:D.text2 }}>{p.name}:</span>
          <span style={{ fontWeight:700, color:D.text }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function DonutGeral({ data, total, perc }) {
  if (!total) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:190, color:D.text2, fontSize:12 }}>Sem tarefas</div>
  )
  return (
    <ResponsiveContainer width="100%" height={190}>
      <PieChart>
        <Pie data={data} cx="40%" cy="50%" innerRadius={52} outerRadius={78}
          dataKey="value" paddingAngle={3} strokeWidth={0}>
          {data.map((e, i) => <Cell key={i} fill={e.color}/>)}
          <Label position="center" content={({ viewBox: { cx, cy } }) => (
            <g>
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                fontSize={22} fontWeight={800} fill={D.text}>{perc}%</text>
              <text x={cx} y={cy + 18} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fill={D.text2}>{total} tarefas</text>
            </g>
          )}/>
        </Pie>
        <Legend content={LegendaPizza} layout="vertical" align="right" verticalAlign="middle"/>
      </PieChart>
    </ResponsiveContainer>
  )
}

function labelPizza(cor) {
  const c = (cor || '').toLowerCase()
  if (c.includes('a32d2d')) return 'Parado'
  if (c.includes('c97d10')) return 'Em andamento'
  if (c.includes('3b6d11')) return 'Feito'
  return null
}

function TooltipDonut({ active, payload }) {
  if (!active || !payload?.length) return null
  const item  = payload[0]
  const cor   = item?.payload?.color ?? item?.color ?? item?.fill ?? ''
  const nome  = labelPizza(cor) ?? 'Parado'
  const valor = item?.value ?? item?.payload?.value ?? 0
  return (
    <div style={{ background:D.card2, border:`1px solid ${D.border}`, borderRadius:8,
      padding:'7px 12px', fontSize:12, color:D.text }}>
      <span style={{ color:cor, marginRight:6 }}>●</span>{nome}: <strong>{valor}</strong>
    </div>
  )
}

function DonutFase({ data, total, perc }) {
  if (!total) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:140, color:D.text2, fontSize:12 }}>Sem tarefas</div>
  )
  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={58}
          dataKey="value" paddingAngle={3} strokeWidth={0}>
          {data.map((e, i) => <Cell key={i} fill={e.color}/>)}
          <Label position="center" content={({ viewBox: { cx, cy } }) => (
            <g>
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                fontSize={18} fontWeight={800} fill={D.text}>{perc}%</text>
              <text x={cx} y={cy + 15} textAnchor="middle" dominantBaseline="middle"
                fontSize={9} fill={D.text2}>{total} tar.</text>
            </g>
          )}/>
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  )
}

function ProgressoFases({ itens, porFase }) {
  const [aberto, setAberto] = useState({})

  const grupos = []
  let atual = null
  for (const item of itens) {
    if (item.tipo === 'fase') { atual = { fase: item, tarefas: [] }; grupos.push(atual) }
    else if (atual) atual.tarefas.push(item)
  }

  if (!grupos.length) return (
    <p style={{ color:D.text2, fontSize:12, padding:'20px 0', textAlign:'center' }}>
      Nenhuma fase cadastrada neste projeto.
    </p>
  )

  const cor    = s => STATUS_BAR[s] || '#555'
  const toggle = id => setAberto(p => ({ ...p, [id]: !p[id] }))

  // Quais fases estão expandidas
  const expandidas = grupos.filter(g => aberto[g.fase.id])

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, alignItems:'start' }}>

      {/* ── Esquerda: accordion de fases ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {grupos.map(({ fase, tarefas }) => {
          const exp = !!aberto[fase.id]
          return (
            <div key={fase.id} style={{ borderRadius:8, overflow:'hidden',
              border: exp ? `1px solid ${cor(fase.status)}55` : `1px solid ${D.border}`,
              background: exp ? 'rgba(255,255,255,.04)' : D.card2,
              transition:'border .2s, background .2s' }}>

              <div style={{ display:'flex', alignItems:'center', gap:12,
                padding:'10px 14px', cursor:'pointer' }} onClick={() => toggle(fase.id)}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:12, fontWeight:700, color:D.text }}>{fase.nome}</span>
                    <span style={{ fontSize:9, fontWeight:700, color:cor(fase.status),
                      background:`${cor(fase.status)}22`, padding:'1px 8px', borderRadius:99 }}>
                      {STATUS_LABEL[fase.status] || fase.status}
                    </span>
                    {tarefas.length > 0 && (
                      <span style={{ fontSize:9, color:D.text2 }}>{tarefas.length} tarefa(s)</span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ flex:1, height:8, background:'rgba(255,255,255,.08)',
                      borderRadius:99, overflow:'hidden' }}>
                      <div style={{ width:`${Math.min(fase.progresso,100)}%`, height:'100%',
                        borderRadius:99, background:cor(fase.status), transition:'width .4s' }}/>
                    </div>
                    <span style={{ fontSize:12, fontWeight:800, color:D.text, minWidth:38, textAlign:'right' }}>
                      {Math.round(fase.progresso)}%
                    </span>
                  </div>
                </div>
                <button style={{ background:'transparent', border:'none',
                  color:D.text2, cursor:'pointer', padding:4, display:'flex' }}>
                  {exp ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                </button>
              </div>

              {exp && (
                <div style={{ borderTop:`1px solid ${D.border}`, padding:'8px 14px 12px 24px' }}>
                  {tarefas.length === 0
                    ? <p style={{ color:D.text2, fontSize:11, margin:0 }}>Sem tarefas.</p>
                    : tarefas.map(t => (
                      <div key={t.id} style={{ display:'flex', alignItems:'center',
                        gap:10, padding:'5px 0', borderBottom:`0.5px solid ${D.border}` }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:11, color:D.text2, marginBottom:4 }}>{t.nome}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ flex:1, height:4, background:'rgba(255,255,255,.06)',
                              borderRadius:99, overflow:'hidden' }}>
                              <div style={{ width:`${Math.min(t.progresso,100)}%`, height:'100%',
                                borderRadius:99, background:cor(t.status) }}/>
                            </div>
                            <span style={{ fontSize:10, fontWeight:700, color:D.text2,
                              minWidth:28, textAlign:'right' }}>{Math.round(t.progresso)}%</span>
                          </div>
                        </div>
                        <span style={{ fontSize:9, fontWeight:700, color:cor(t.status),
                          background:`${cor(t.status)}22`, padding:'1px 7px',
                          borderRadius:99, whiteSpace:'nowrap' }}>
                          {STATUS_LABEL[t.status] || t.status}
                        </span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Direita: barras de progresso por fase (sempre o mesmo gráfico) ── */}
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:D.text2,
          textTransform:'uppercase', letterSpacing:'.07em', marginBottom:12 }}>
          Progresso por fase (%)
        </div>
        <ResponsiveContainer width="100%" height={Math.max(200, grupos.length * 52 + 60)}>
          <BarChart data={grupos.map(g => ({
            nome: g.fase.nome.length > 14 ? g.fase.nome.slice(0,14)+'…' : g.fase.nome,
            Progresso: Math.round(g.fase.progresso),
            status: g.fase.status,
            id: g.fase.id,
          }))} margin={{ left:0, right:16, top:8, bottom:40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={D.grid} vertical={false}/>
            <XAxis dataKey="nome" tick={{ fontSize:9, fill:D.text2 }}
              angle={-30} textAnchor="end" interval={0}/>
            <YAxis domain={[0,100]} tick={{ fontSize:9, fill:D.text2 }}
              tickFormatter={v => `${v}%`}/>
            <Tooltip
              cursor={false}
              formatter={v => [`${v}%`, 'Progresso']}
              contentStyle={{ background:D.card2, border:`1px solid ${D.border}`,
                color:D.text, borderRadius:8, fontSize:12 }}/>
            <Bar dataKey="Progresso" radius={[4,4,0,0]} maxBarSize={48}
              activeBar={false}
              background={props => <rect {...props} fill="transparent" stroke="none"/>}>
              {grupos.map(g => {
                const exp = !!aberto[g.fase.id]
                const temExp = expandidas.length > 0
                return (
                  <Cell key={g.fase.id}
                    fill={cor(g.fase.status)}
                    opacity={temExp ? (exp ? 1 : 0.25) : 0.85}
                    stroke={exp ? cor(g.fase.status) : 'none'}
                    strokeWidth={exp ? 2 : 0}/>
                )
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}

// ── Portal simplificado para Analista (UX-3) ─────────────────────────
function PortalAnalista({ usuario }) {
  const navigate = useNavigate()
  const [resumo,   setResumo]   = useState(null)
  const [projetos, setProjetos] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [confirmando, setConfirmando] = useState({})

  useEffect(() => {
    Promise.all([dashboardAPI.resumo(), projetosAPI.listar()])
      .then(([r, p]) => { setResumo(r.data); setProjetos(p.data) })
      .catch(() => toast.error('Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [])

  const confirmar = async (tarefaId) => {
    setConfirmando(s => ({ ...s, [tarefaId]: true }))
    try {
      await tarefasAPI.atualizar(tarefaId, { confirmado_cliente: true })
      toast.success('Tarefa confirmada!')
      // Recarregar projetos
      const { data } = await projetosAPI.listar()
      setProjetos(data)
    } catch { toast.error('Erro ao confirmar') }
    finally { setConfirmando(s => ({ ...s, [tarefaId]: false })) }
  }

  if (loading) return <LoadingPage />

  // Coletar tarefas pendentes de confirmação
  const tarefasPendentes = []
  projetos.forEach(p => {
    (p.fases || []).forEach(f => {
      (f.tarefas || []).forEach(t => {
        if (t.ativo !== false && !t.confirmado_cliente && t.status !== 'concluida') {
          tarefasPendentes.push({ ...t, fase_nome: f.nome, projeto: p })
        }
      })
    })
  })

  const atrasadas = tarefasPendentes.filter(t => t.status === 'atrasada' || t.status === 'bloqueada')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Olá, {usuario.nome.split(' ')[0]}</div>
          <div className="page-sub">Painel do analista — suas tarefas e confirmações pendentes</div>
        </div>
      </div>

      <div className="metric-grid" style={{ marginBottom: 20 }}>
        <div className="metric-card">
          <div className="metric-label">Projetos</div>
          <div className="metric-value" style={{ color: 'var(--brand)' }}>{resumo?.total_projetos ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tarefas pendentes</div>
          <div className="metric-value" style={{ color: 'var(--amber)' }}>{tarefasPendentes.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Atrasadas/Bloqueadas</div>
          <div className="metric-value" style={{ color: atrasadas.length ? 'var(--red)' : 'var(--green)' }}>{atrasadas.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Concluídas este mês</div>
          <div className="metric-value" style={{ color: 'var(--green)' }}>{resumo?.tarefas_concluidas_mes ?? 0}</div>
        </div>
      </div>

      {/* Projetos com progresso */}
      {projetos.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">Seus projetos</div>
          {projetos.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', borderBottom: '0.5px solid var(--border)', cursor: 'pointer' }}
              onClick={() => navigate(`/projetos/${p.id}`)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.nome}</div>
                <Progress value={p.progresso} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{p.progresso}%</span>
              <Badge status={p.status} />
            </div>
          ))}
        </div>
      )}

      {/* Tarefas pendentes de confirmação */}
      {tarefasPendentes.length > 0 && (
        <div className="card">
          <div className="section-title">Tarefas aguardando sua confirmação</div>
          {tarefasPendentes.map(t => {
            const atrasada = t.status === 'atrasada'
            const prazo = t.data_prazo ? new Date(t.data_prazo).toLocaleDateString('pt-BR') : null
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
                {atrasada
                  ? <AlertTriangle size={16} color="var(--red)" />
                  : <Clock size={16} color="var(--amber)" />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {t.projeto.nome} › {t.fase_nome}
                    {prazo && <span style={{ marginLeft: 8, color: atrasada ? 'var(--red)' : undefined }}>· prazo {prazo}</span>}
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={confirmando[t.id]}
                  onClick={() => confirmar(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                >
                  <CheckCircle2 size={13} />
                  {confirmando[t.id] ? '...' : 'Confirmar'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {tarefasPendentes.length === 0 && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <CheckCircle2 size={32} color="var(--green)" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Tudo em dia!</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>Não há tarefas pendentes de confirmação.</div>
        </div>
      )}
    </div>
  )
}

const PROJ_KEY = 'emais_dash_projeto'

export default function Dashboard() {
  const { usuario } = useAuth()
  const [resumo,      setResumo]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [projetos,    setProjetos]    = useState([])
  const [projetoId,   setProjetoId]   = useState('')
  const [dados,       setDados]       = useState(null)
  const [loadingGraf, setLoadingGraf] = useState(false)

  const isCliente = usuario?.perfil === 'analista'

  const handleProjeto = (id) => {
    setProjetoId(id)
    if (id) localStorage.setItem(PROJ_KEY, id)
  }

  useEffect(() => {
    if (isCliente) { setLoading(false); return }
    Promise.all([dashboardAPI.resumo(), projetosAPI.listar()])
      .then(([r, p]) => {
        setResumo(r.data)
        setProjetos(p.data)
        if (!p.data.length) return
        const saved  = localStorage.getItem(PROJ_KEY)
        const valido = saved && p.data.find(x => String(x.id) === saved)
        const id     = valido ? saved : String(p.data[0].id)
        setProjetoId(id)
        localStorage.setItem(PROJ_KEY, id)
      })
      .catch(() => toast.error('Erro ao carregar dashboard'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!projetoId) return
    setLoadingGraf(true); setDados(null)
    relatoriosAPI.graficos(projetoId)
      .then(r => setDados(r.data))
      .catch(() => toast.error('Erro ao carregar gráficos'))
      .finally(() => setLoadingGraf(false))
  }, [projetoId])

  // Portal analista simplificado (UX-3) — depois de todos os hooks
  if (isCliente) return <PortalAnalista usuario={usuario} />

  if (loading) return <LoadingPage />

  const total     = dados?.total_tarefas ?? 0
  const concl     = dados?.pizza_geral?.find(p => p.name === 'Feito')?.value ?? 0
  const percGeral = total > 0 ? Math.round(concl / total * 100) : 0

  return (
    <div className="page">
      {/* Métricas */}
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visão geral de todos os projetos</div>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Projetos ativos</div>
          <div className="metric-value" style={{ color:'var(--brand)' }}>{resumo?.projetos_ativos ?? 0}</div>
          <div className="text-sm text-muted" style={{ marginTop:4 }}>{resumo?.total_projetos} no total</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tarefas em andamento</div>
          <div className="metric-value" style={{ color:'var(--amber)' }}>{resumo?.tarefas_em_andamento ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Concluídas este mês</div>
          <div className="metric-value" style={{ color:'var(--green)' }}>{resumo?.tarefas_concluidas_mes ?? 0}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tarefas atrasadas</div>
          <div className="metric-value" style={{ color:'var(--red)' }}>{resumo?.tarefas_atrasadas ?? 0}</div>
        </div>
      </div>

      {/* Seletor de projeto + gráficos */}
      <div style={{ background: D.bg, borderRadius:12, padding:20, marginTop:8 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:700, color:D.text }}>Análise do projeto</div>
          {isCliente ? (
            <div style={{ fontSize:13, fontWeight:600, color:D.text,
              background:D.card2, border:`1px solid ${D.border}`,
              borderRadius:8, padding:'7px 14px', minWidth:270 }}>
              {projetos.find(p => String(p.id) === projetoId)?.nome ?? '—'}
            </div>
          ) : (
            <select value={projetoId} onChange={e => handleProjeto(e.target.value)}
              style={{ fontSize:13, padding:'7px 14px', minWidth:270, fontWeight:600,
                background:D.card2, color:D.text, border:`1px solid ${D.border}`,
                borderRadius:8, outline:'none' }}>
              {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          )}
        </div>

        {loadingGraf && (
          <div style={{ color:D.text2, textAlign:'center', padding:'60px 0', fontSize:14 }}>Carregando...</div>
        )}

        {!loadingGraf && dados && (<>
          {/* Pizza + Burndown */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:14, marginBottom:14 }}>
            <div style={cardDark}>
              <div style={sectionLabel}>Status das Tarefas</div>
              <DonutGeral data={dados.pizza_geral} total={total} perc={percGeral}/>
              <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                {[
                  { label:'Feito',        val: concl,                            cor: COR.verde   },
                  { label:'Em andamento', val: dados.pizza_geral[1]?.value ?? 0, cor: COR.amarelo },
                  { label:'Parado',       val: dados.pizza_geral[2]?.value ?? 0, cor: COR.vermelho},
                ].map(c => (
                  <span key={c.label} style={{ fontSize:10, fontWeight:600,
                    background:'rgba(255,255,255,.06)', color:c.cor,
                    borderRadius:99, padding:'3px 10px',
                    display:'flex', alignItems:'center', gap:5, border:`1px solid ${D.border}` }}>
                    <span style={{ width:6, height:6, borderRadius:99, background:c.cor, display:'inline-block' }}/>
                    {c.label} · {c.val}
                  </span>
                ))}
              </div>
            </div>

            <div style={cardDark}>
              <div style={sectionLabel}>Gráfico de Burndown — tarefas restantes</div>
              {dados.burndown.length < 2
                ? <p style={{ color:D.text2, fontSize:12, textAlign:'center', padding:'40px 0' }}>
                    Adicione datas de início e fim ao projeto para ver o burndown.
                  </p>
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dados.burndown} margin={{ top:4, right:12, bottom:0, left:-20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={D.grid}/>
                      <XAxis dataKey="data" tick={{ fontSize:9, fill:D.text2 }} interval="preserveStartEnd"/>
                      <YAxis tick={{ fontSize:9, fill:D.text2 }} allowDecimals={false}/>
                      <Tooltip content={<TipBurndown/>}/>
                      <Line type="monotone" dataKey="ideal" name="Ideal"
                        stroke={COR.azul} strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="real" name="Real"
                        stroke={COR.vermelho} strokeWidth={2.5} dot={false} connectNulls={false}/>
                      <Legend iconType="plainline" iconSize={16}
                        formatter={v => <span style={{ fontSize:11, color:D.text2 }}>{v}</span>}/>
                    </LineChart>
                  </ResponsiveContainer>
                )
              }
            </div>
          </div>

          {/* Progresso por Fase */}
          <div style={{ ...cardDark, marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={sectionLabel}>Progresso por Fase</div>
              <div style={{ display:'flex', gap:12 }}>
                {[
                  { cor: COR.verde,     label:'Concluída'    },
                  { cor: COR.azul,      label:'Em andamento' },
                  { cor: '#555',        label:'Pendente'     },
                  { cor: COR.bloqueada, label:'Bloqueada'    },
                  { cor: COR.vermelho,  label:'Atrasada'     },
                ].map(l => (
                  <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:D.text2 }}>
                    <span style={{ width:10, height:10, borderRadius:2, background:l.cor, display:'inline-block' }}/>
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
            <ProgressoFases itens={dados.gantt} porFase={dados.por_fase}/>
          </div>

        </>)}

        {!loadingGraf && !dados && projetos.length === 0 && (
          <div style={{ textAlign:'center', color:D.text2, padding:'60px 0', fontSize:14 }}>
            Nenhum projeto cadastrado.
          </div>
        )}
      </div>
    </div>
  )
}
