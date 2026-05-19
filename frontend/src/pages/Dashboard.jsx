import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardAPI } from '../services/api'
import { Badge, Progress, LoadingPage } from '../components/shared'
import { TrendingUp, FolderKanban, CheckSquare, AlertTriangle, Clock } from 'lucide-react'

export default function Dashboard() {
  const [resumo,   setResumo]   = useState(null)
  const [projetos, setProjetos] = useState([])
  const [loading,  setLoading]  = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([dashboardAPI.resumo(), dashboardAPI.projetosResumo()])
      .then(([r, p]) => { setResumo(r.data); setProjetos(p.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Visão geral de todos os projetos</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/projetos')}>
          + Novo projeto
        </button>
      </div>

      {/* Métricas */}
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

      {/* Projetos recentes */}
      <div className="card">
        <div className="section-title">Projetos recentes</div>
        {projetos.length === 0 ? (
          <div className="empty-state">Nenhum projeto encontrado</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Fases</th>
                  <th>Progresso</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projetos.map(p => (
                  <tr key={p.id} style={{ cursor:'pointer' }} onClick={() => navigate(`/projetos/${p.id}`)}>
                    <td style={{ fontWeight:500 }}>{p.nome}</td>
                    <td className="text-muted">{p.cliente}</td>
                    <td><Badge status={p.status} /></td>
                    <td className="text-muted text-sm">{p.fases_concluidas}/{p.total_fases} fases</td>
                    <td style={{ minWidth:120 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <Progress value={p.progresso} />
                        <span className="text-sm text-muted">{p.progresso}%</span>
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-ghost">Ver →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
