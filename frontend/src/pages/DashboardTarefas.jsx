import { useEffect, useState } from 'react'
import { projetosAPI, dashboardAPI } from '../services/api'
import { LoadingPage } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const D = {
  bg:     '#0D0D0D',
  card:   '#171717',
  card2:  '#1F1F1F',
  border: 'rgba(255,255,255,.08)',
  text:   '#EDECEA',
  text2:  '#9B9A94',
}

const STATUS_COR = {
  concluida:        '#4CAF50',
  em_andamento:     '#1E88E5',
  aguard_validacao: '#7C3AED',
  aguard_valid:     '#7C3AED',
  pendente:         '#555',
  atrasada:         '#E53935',
}

const STATUS_LABEL = {
  concluida:        'Concluída',
  em_andamento:     'Em andamento',
  aguard_validacao: 'Aguard. validação',
  aguard_valid:     'Aguard. validação',
  pendente:         'Pendente',
  atrasada:         'Atrasada',
}

function MetricCard({ label, value, color, sub }) {
  return (
    <div style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: 12,
      padding: '18px 22px', flex: 1, minWidth: 110 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: D.text2,
        textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: color || D.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: D.text2, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const PROJ_KEY = 'emais_dash_projeto'

export default function DashboardTarefas() {
  const { usuario } = useAuth()
  const [projetos,   setProjetos]   = useState([])
  const [projetoId,  setProjetoId]  = useState('')
  const [faseId,     setFaseId]     = useState('')
  const [projeto,    setProjeto]    = useState(null)
  const [loading,    setLoading]    = useState(false)

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
    setFaseId('')
    if (id) localStorage.setItem(PROJ_KEY, id)
    else localStorage.removeItem(PROJ_KEY)
  }

  useEffect(() => {
    if (!projetoId) { setProjeto(null); setFaseId(''); return }
    setLoading(true)
    setFaseId('')
    projetosAPI.detalhe(projetoId)
      .then(r => setProjeto(r.data))
      .catch(() => toast.error('Erro ao carregar projeto'))
      .finally(() => setLoading(false))
  }, [projetoId])

  const fases = projeto?.fases || []
  const agora = new Date()

  const tarefasFiltradas = faseId
    ? (fases.find(f => String(f.id) === faseId)?.tarefas || []).filter(t => t.ativo !== false)
    : fases.flatMap(f => (f.tarefas || []).filter(t => t.ativo !== false))

  const total  = tarefasFiltradas.length
  const concl  = tarefasFiltradas.filter(t => t.status === 'concluida').length
  const andmn  = tarefasFiltradas.filter(t => t.status === 'em_andamento').length
  const atras  = tarefasFiltradas.filter(t =>
    t.status !== 'concluida' && t.data_prazo && new Date(t.data_prazo) < agora).length
  const aguard = tarefasFiltradas.filter(t =>
    t.status === 'aguard_validacao' || t.status === 'aguard_valid').length

  const grupos = faseId
    ? [{ fase: fases.find(f => String(f.id) === faseId), tarefas: tarefasFiltradas }].filter(g => g.fase)
    : fases
        .map(f => ({ fase: f, tarefas: (f.tarefas || []).filter(t => t.ativo !== false) }))
        .filter(g => g.tarefas.length > 0)

  return (
    <div style={{ background: D.bg, minHeight: '100vh', padding: '28px 32px', color: D.text }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: D.text, marginBottom: 4 }}>
          Dashboard — Por Tarefa
        </div>
        <div style={{ fontSize: 13, color: D.text2 }}>
          Status detalhado de todas as tarefas — filtre por projeto e fase
        </div>
      </div>

      {/* Seletores */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        {isCliente ? (
          <div style={{ background: D.card2, border: `1px solid ${D.border}`, borderRadius: 8,
            color: D.text, fontSize: 13, padding: '10px 16px', minWidth: 300, fontWeight: 600 }}>
            {projetos.find(p => String(p.id) === projetoId)?.nome ?? '—'}
          </div>
        ) : (
          <select value={projetoId} onChange={e => handleProjeto(e.target.value)}
            style={{ background: D.card2, border: `1px solid ${D.border}`, borderRadius: 8,
              color: D.text, fontSize: 13, padding: '10px 16px', minWidth: 300, cursor: 'pointer', outline: 'none' }}>
            <option value="">Selecione um projeto...</option>
            {projetos.map(p => (
              <option key={p.id} value={p.id}>{p.nome}{p.cliente ? ` — ${p.cliente}` : ''}</option>
            ))}
          </select>
        )}

        {projeto && (
          <select value={faseId} onChange={e => setFaseId(e.target.value)}
            style={{ background: D.card2, border: `1px solid ${D.border}`, borderRadius: 8,
              color: D.text, fontSize: 13, padding: '10px 16px', minWidth: 230, cursor: 'pointer', outline: 'none' }}>
            <option value="">Todas as fases</option>
            {fases.map(f => (
              <option key={f.id} value={f.id}>Fase {f.ordem} — {f.nome}</option>
            ))}
          </select>
        )}
      </div>

      {loading && <LoadingPage />}

      {!loading && projeto && (
        <>
          {/* Cards */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 28, flexWrap: 'wrap' }}>
            <MetricCard label="Total"            value={total}  sub={`${concl ? Math.round((concl/total)*100) : 0}% concluído`} />
            <MetricCard label="Concluídas"       value={concl}  color="#4CAF50" />
            <MetricCard label="Em Andamento"     value={andmn}  color="#1E88E5" />
            <MetricCard label="Atrasadas"        value={atras}  color="#E53935" />
            <MetricCard label="Aguard. Validação" value={aguard} color="#7C3AED" />
          </div>

          {/* Lista por fase */}
          {grupos.map(({ fase, tarefas }) => (
            <div key={fase.id} style={{ marginBottom: 16, background: D.card,
              border: `1px solid ${D.border}`, borderRadius: 10, overflow: 'hidden' }}>

              {/* Cabeçalho da fase */}
              <div style={{ padding: '11px 18px', borderBottom: `1px solid ${D.border}`,
                display: 'flex', alignItems: 'center', gap: 10, background: D.card2 }}>
                <span style={{ fontSize: 11, color: D.text2, fontWeight: 600 }}>Fase {fase.ordem}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: D.text, flex: 1 }}>{fase.nome}</span>
                <span style={{ fontSize: 11, color: D.text2 }}>{tarefas.length} tarefa(s)</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: D.text2 }}>
                  {Math.round(fase.progresso)}%
                </span>
              </div>

              {/* Tarefas */}
              {tarefas.map((t, i) => {
                const prazoAtrasado = t.status !== 'concluida' && t.data_prazo && new Date(t.data_prazo) < agora
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 18px',
                    borderBottom: i < tarefas.length - 1 ? `1px solid ${D.border}` : 'none',
                  }}>
                    {/* Bolinha de status */}
                    <div style={{ width: 9, height: 9, borderRadius: '50%',
                      background: STATUS_COR[t.status] || '#555', flexShrink: 0 }} />

                    {/* Nome */}
                    <span style={{ flex: 1, fontSize: 13,
                      color: t.status === 'concluida' ? D.text2 : D.text,
                      textDecoration: t.status === 'concluida' ? 'line-through' : 'none',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.nome}
                    </span>

                    {/* Prazo */}
                    {t.data_prazo && (
                      <span style={{ fontSize: 11, color: prazoAtrasado ? '#E53935' : D.text2,
                        fontWeight: prazoAtrasado ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {prazoAtrasado ? '⚠ ' : ''}{new Date(t.data_prazo).toLocaleDateString('pt-BR')}
                      </span>
                    )}

                    {/* % */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 60 }}>
                      <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,.08)', borderRadius: 99, overflow: 'hidden', minWidth: 36 }}>
                        <div style={{ height: '100%', width: `${t.percentual}%`,
                          background: STATUS_COR[t.status] || '#555', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, color: D.text2, minWidth: 24, textAlign: 'right' }}>
                        {t.percentual}%
                      </span>
                    </div>

                    {/* Badge status */}
                    <span style={{ fontSize: 11, fontWeight: 600,
                      color: STATUS_COR[t.status] || '#777',
                      background: `${STATUS_COR[t.status] || '#777'}22`,
                      padding: '2px 9px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}

          {tarefasFiltradas.length === 0 && (
            <div style={{ color: D.text2, textAlign: 'center', padding: '48px 0', fontSize: 14 }}>
              Nenhuma tarefa encontrada.
            </div>
          )}
        </>
      )}

      {!loading && !projeto && (
        <div style={{ color: D.text2, textAlign: 'center', padding: '80px 0', fontSize: 14 }}>
          Selecione um projeto para visualizar o dashboard de tarefas.
        </div>
      )}
    </div>
  )
}
