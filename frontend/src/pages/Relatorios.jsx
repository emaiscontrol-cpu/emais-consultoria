import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, Label, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { projetosAPI, relatoriosAPI } from '../services/api'
import { LoadingPage } from '../components/shared'
import { BarChart2 } from 'lucide-react'
import toast from 'react-hot-toast'

// ── Tema escuro ──────────────────────────────────────────
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

// ── Cores de status ──────────────────────────────────────
const COR = {
  verde:    '#4CAF50',
  amarelo:  '#FFC107',
  vermelho: '#E53935',
  azul:     '#1E88E5',
  cinza:    '#757575',
  bloqueada:'#444',
}

const STATUS_BAR = {
  concluida:    COR.verde,
  em_andamento: COR.azul,
  pendente:     '#555',
  bloqueada:    COR.bloqueada,
  atrasada:     COR.vermelho,
}

// ── Legenda da pizza (dark) ──────────────────────────────
function LegendaPizza({ payload = [] }) {
  return (
    <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:7 }}>
      {payload.map(e => (
        <li key={e.value} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11 }}>
          <span style={{ width:10, height:10, borderRadius:2, background:e.color, flexShrink:0, display:'inline-block' }}/>
          <span style={{ color:D.text2, flex:1 }}>{e.value}</span>
          <span style={{ fontWeight:700, color:D.text }}>{e.payload?.value ?? 0}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Tooltip burndown (dark) ──────────────────────────────
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

// ── Donut geral (com legenda lateral) ────────────────────
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
        <Tooltip formatter={(v, n) => [v, n]}
          contentStyle={{ background:D.card2, border:`1px solid ${D.border}`, borderRadius:8, color:D.text }}/>
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Donut pequeno (sem legenda, para cards de fase) ──────
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
        <Tooltip formatter={(v, n) => [v, n]}
          contentStyle={{ background:D.card2, border:`1px solid ${D.border}`, borderRadius:8, color:D.text }}/>
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Gantt SVG (dark) ─────────────────────────────────────
function Gantt({ itens }) {
  const comDatas = itens.filter(g => g.inicio && g.fim)
  if (!comDatas.length) return (
    <p style={{ color:D.text2, fontSize:12, padding:'20px 0', textAlign:'center' }}>
      Adicione datas de início e fim às fases/tarefas para visualizar o cronograma.
    </p>
  )

  const ms   = d => new Date(d).getTime()
  const all  = comDatas.flatMap(g => [ms(g.inicio), ms(g.fim)])
  const min  = Math.min(...all), max = Math.max(...all)
  const span = Math.max(1, max - min)

  const LABEL = 180, CHART = 560, ROW = 30, PAD = 10

  const ticks = Array.from({ length: 7 }, (_, i) => ({
    x: LABEL + CHART * i / 6,
    label: new Date(min + span * i / 6).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }),
  }))

  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={LABEL + CHART} height={PAD * 2 + 22 + comDatas.length * ROW}
        style={{ fontFamily:'inherit', display:'block' }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <text x={t.x} y={14} fontSize={9} fill={D.text2} textAnchor="middle">{t.label}</text>
            <line x1={t.x} x2={t.x} y1={20} y2={PAD + 22 + comDatas.length * ROW}
              stroke={D.grid} strokeWidth={1}/>
          </g>
        ))}
        {comDatas.map((g, i) => {
          const y   = PAD + 22 + i * ROW
          const x1  = LABEL + ((ms(g.inicio) - min) / span) * CHART
          const x2  = LABEL + ((ms(g.fim)    - min) / span) * CHART
          const bW  = Math.max(6, x2 - x1)
          const cor = STATUS_BAR[g.status] || D.cinza
          const h   = g.tipo === 'fase' ? 16 : 10
          const bY  = y + (ROW - h) / 2 - 2
          return (
            <g key={g.id}>
              {i % 2 === 0 && <rect x={0} y={y - 2} width={LABEL + CHART} height={ROW} fill={D.stripe}/>}
              <text x={g.tipo === 'fase' ? 4 : 14} y={y + ROW / 2 - 1}
                fontSize={g.tipo === 'fase' ? 11 : 10}
                fontWeight={g.tipo === 'fase' ? 700 : 400}
                fill={g.tipo === 'fase' ? D.text : D.text2}
                dominantBaseline="middle">
                {g.nome.length > 25 ? g.nome.slice(0, 25) + '…' : g.nome}
              </text>
              <rect x={x1} y={bY} width={bW} height={h} rx={3} fill={cor} opacity={0.2}/>
              <rect x={x1} y={bY} width={Math.max(0, bW * g.progresso / 100)} height={h} rx={3} fill={cor}/>
              {bW > 32 && (
                <text x={x1 + bW / 2} y={bY + h / 2} fontSize={8} fill="#fff"
                  textAnchor="middle" dominantBaseline="middle" fontWeight={700}>
                  {Math.round(g.progresso)}%
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Estilos inline do card escuro ────────────────────────
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

// ── Página ───────────────────────────────────────────────
export default function Relatorios() {
  const [projetos,    setProjetos]    = useState([])
  const [projetoId,   setProjetoId]   = useState('')
  const [dados,       setDados]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
    projetosAPI.listar()
      .then(r => { setProjetos(r.data); if (r.data.length) setProjetoId(String(r.data[0].id)) })
      .catch(() => toast.error('Erro ao carregar projetos'))
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    if (!projetoId) return
    setLoading(true); setDados(null)
    relatoriosAPI.graficos(projetoId)
      .then(r => setDados(r.data))
      .catch(() => toast.error('Erro ao carregar dados'))
      .finally(() => setLoading(false))
  }, [projetoId])

  if (loadingList) return <LoadingPage/>

  const total     = dados?.total_tarefas ?? 0
  const concl     = dados?.pizza_geral?.find(p => p.name === 'Feito')?.value ?? 0
  const percGeral = total > 0 ? Math.round(concl / total * 100) : 0

  return (
    <div style={{ background: D.bg, minHeight: '100%', padding: 20 }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <BarChart2 size={20} color="#1E88E5"/>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:D.text }}>Relatórios</div>
            <div style={{ fontSize:12, color:D.text2, marginTop:2 }}>Análise visual do projeto</div>
          </div>
        </div>
        <select value={projetoId} onChange={e => setProjetoId(e.target.value)}
          style={{ fontSize:13, padding:'7px 14px', minWidth:270, fontWeight:600,
            background:D.card2, color:D.text, border:`1px solid ${D.border}`,
            borderRadius:8, outline:'none' }}>
          {projetos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

      {loading && <div style={{ color:D.text2, textAlign:'center', padding:'60px 0', fontSize:14 }}>Carregando...</div>}

      {!loading && dados && (<>

        {/* ── Linha 1: Pizza | Burndown ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:14, marginBottom:14 }}>

          {/* Pizza geral */}
          <div style={cardDark}>
            <div style={sectionLabel}>Status das Tarefas</div>
            <DonutGeral data={dados.pizza_geral} total={total} perc={percGeral}/>
            <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
              {[
                { label:'Feito',        val: concl,                           cor: COR.verde    },
                { label:'Em andamento', val: dados.pizza_geral[1]?.value ?? 0, cor: COR.amarelo  },
                { label:'Parado',       val: dados.pizza_geral[2]?.value ?? 0, cor: COR.vermelho },
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

          {/* Burndown */}
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

        {/* ── Linha 2: Cronograma Gantt ── */}
        <div style={{ ...cardDark, marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={sectionLabel}>Cronograma</div>
            <div style={{ display:'flex', gap:14 }}>
              {[
                { cor: COR.verde,    label:'Concluída'    },
                { cor: COR.azul,     label:'Em andamento' },
                { cor: '#555',       label:'Pendente'     },
                { cor: COR.bloqueada,label:'Bloqueada'    },
                { cor: COR.vermelho, label:'Atrasada'     },
              ].map(l => (
                <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:D.text2 }}>
                  <span style={{ width:12, height:6, borderRadius:3, background:l.cor, display:'inline-block' }}/>
                  {l.label}
                </div>
              ))}
            </div>
          </div>
          <Gantt itens={dados.gantt}/>
        </div>

        {/* ── Linha 3: Pizza por fase ── */}
        {dados.por_fase.length > 0 && (<>
          <div style={{ ...sectionLabel, marginBottom:12 }}>Status por Fase</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:12 }}>
            {dados.por_fase.map(fase => {
              const p = fase.total > 0 ? Math.round(fase.concluidas / fase.total * 100) : 0
              return (
                <div key={fase.nome} style={{ ...cardDark, padding:'16px 18px' }}>
                  <div style={{ fontSize:10, color:D.text2, marginBottom:3 }}>Fase {fase.ordem}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:D.text, marginBottom:6,
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {fase.nome}
                  </div>
                  <DonutFase data={fase.pizza} total={fase.total} perc={p}/>
                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
                    {[
                      { label:'Feito',        val: fase.concluidas,   cor: COR.verde    },
                      { label:'Em andamento', val: fase.em_andamento, cor: COR.amarelo  },
                      { label:'Parado',       val: fase.paradas,      cor: COR.vermelho },
                    ].map(l => (
                      <div key={l.label} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11 }}>
                        <span style={{ width:8, height:8, borderRadius:2, background:l.cor,
                          flexShrink:0, display:'inline-block' }}/>
                        <span style={{ color:D.text2, flex:1 }}>{l.label}</span>
                        <span style={{ fontWeight:700, color:D.text }}>{l.val}</span>
                        <span style={{ color:D.text2, minWidth:38, textAlign:'right' }}>
                          ({fase.total > 0 ? Math.round(l.val / fase.total * 100) : 0}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>)}

      </>)}

      {!loading && !dados && projetos.length === 0 && (
        <div style={{ textAlign:'center', color:D.text2, padding:'60px 0', fontSize:14 }}>
          Nenhum projeto cadastrado.
        </div>
      )}
    </div>
  )
}
