import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dashboardAPI, clientesAPI } from '../services/api'
import { Progress, LoadingPage } from '../components/shared'
import { AlertTriangle, TrendingUp, FolderOpen, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

function BadgeAtrasadas({ n }) {
  if (!n) return null
  return (
    <span style={{
      background: 'var(--red-light)', color: 'var(--red)',
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <AlertTriangle size={11} /> {n} atrasada{n !== 1 ? 's' : ''}
    </span>
  )
}

export default function DashboardExecutivo() {
  const navigate = useNavigate()
  const [clientes, setClientes] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    dashboardAPI.executivo()
      .then(r => setClientes(r.data))
      .catch(() => toast.error('Erro ao carregar dashboard executivo'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingPage />

  const totalAtrasadas = clientes.reduce((a, c) => a + c.tarefas_atrasadas, 0)
  const totalProjetos  = clientes.reduce((a, c) => a + c.projetos_ativos, 0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard Executivo</div>
          <div className="page-sub">Visão consolidada por cliente — clique para detalhar</div>
        </div>
      </div>

      {/* KPIs topo */}
      <div className="metric-grid" style={{ marginBottom: 20 }}>
        <div className="metric-card">
          <div className="metric-label">Clientes com projetos</div>
          <div className="metric-value" style={{ color: 'var(--brand)' }}>{clientes.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Projetos em andamento</div>
          <div className="metric-value" style={{ color: 'var(--amber)' }}>{totalProjetos}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tarefas atrasadas (total)</div>
          <div className="metric-value" style={{ color: totalAtrasadas ? 'var(--red)' : 'var(--green)' }}>{totalAtrasadas}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Progresso médio geral</div>
          <div className="metric-value" style={{ color: 'var(--brand)' }}>
            {clientes.length ? Math.round(clientes.reduce((a, c) => a + c.progresso_medio, 0) / clientes.length) : 0}%
          </div>
        </div>
      </div>

      {/* Grid de clientes */}
      {clientes.length === 0 ? (
        <div className="empty-state">Nenhum cliente com projetos ativos.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {clientes.map(c => (
            <div
              key={c.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'border-color .2s', borderColor: c.tarefas_atrasadas ? 'var(--red)' : undefined }}
              onClick={() => navigate(`/dashboard-cliente/${c.id}`)}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = c.tarefas_atrasadas ? 'var(--red)' : 'var(--border)'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                    {c.razao_social}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FolderOpen size={11} /> {c.projetos_ativos} ativo{c.projetos_ativos !== 1 ? 's' : ''} / {c.total_projetos} total
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-3)" />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Progresso médio</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{c.progresso_medio}%</span>
                </div>
                <Progress value={c.progresso_medio} color={c.progresso_medio >= 75 ? 'green' : ''} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <BadgeAtrasadas n={c.tarefas_atrasadas} />
                {!c.tarefas_atrasadas && (
                  <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TrendingUp size={12} /> Em dia
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
