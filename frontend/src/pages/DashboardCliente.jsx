import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { clientesAPI, dashboardAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { LoadingPage } from '../components/shared'
import { GraficoRosca, GraficoBarras, GraficoProgresso, fmtNumeroBR } from '../components/Graficos'
import { ChevronDown, AlertTriangle, CheckCircle2, Clock, Layers } from 'lucide-react'

const STATUS_COR = {
  concluido:    '#4CAF50',
  em_andamento: '#1E88E5',
  pendente:     '#9ca3af',
  planejamento: '#9ca3af',
  atrasado:     '#E53935',
  pausado:      '#FFC107',
  bloqueada:    '#555',
  concluida:    '#4CAF50',
}

const STATUS_LABEL = {
  concluido: 'Concluído', em_andamento: 'Em andamento', pendente: 'Pendente',
  planejamento: 'Planejamento', atrasado: 'Atrasado', pausado: 'Pausado',
  bloqueada: 'Bloqueada', concluida: 'Concluída',
}

const DARK_BG   = '#0f0f15'
const DARK_CARD = '#16161f'

function CardResumo({ icon: Icon, label, valor, cor }) {
  return (
    <div style={{
      background: DARK_CARD, border: `1px solid ${cor}30`, borderRadius: 10,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 160,
    }}>
      <div style={{ background: `${cor}22`, borderRadius: 8, padding: 10 }}>
        <Icon size={20} color={cor} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#e6edf3' }}>{valor}</div>
        <div style={{ fontSize: 12, color: '#8b949e', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

export default function DashboardCliente() {
  const { usuario } = useAuth()
  const { id: idParam } = useParams()

  const clienteVinculado = usuario?.cliente_id || null
  const isRestrito = clienteVinculado && ['analista', 'ger_projeto', 'ti'].includes(usuario?.perfil)

  const [clientes,  setClientes]  = useState([])
  const [clienteId, setClienteId] = useState(isRestrito ? String(clienteVinculado) : (idParam || ''))
  const [dados,     setDados]     = useState(null)
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    if (!isRestrito) clientesAPI.listar().then(r => setClientes(r.data.filter(c => c.ativo)))
  }, [])

  useEffect(() => {
    if (!clienteId) { setDados(null); return }
    setLoading(true)
    dashboardAPI.cliente(clienteId)
      .then(r => setDados(r.data))
      .finally(() => setLoading(false))
  }, [clienteId])

// ── dados dos gráficos ───────────────────────────────────────────────────
  const pieDados = dados ? [
    { name: 'Concluídas',    value: dados.resumo.concluidas, color: '#4CAF50' },
    { name: 'Em andamento',  value: dados.resumo.andamento,  color: '#1E88E5' },
    { name: 'Pendentes',     value: dados.resumo.pendentes,  color: '#9ca3af' },
    { name: 'Atrasadas',     value: dados.resumo.atrasadas,  color: '#E53935' },
  ].filter(d => d.value > 0) : []

  const totalTarefas = pieDados.reduce((s, d) => s + d.value, 0)
  const percConcluido = totalTarefas > 0 ? Math.round((dados?.resumo.concluidas ?? 0) / totalTarefas * 100) : 0

  const barDados = dados ? dados.projetos.map(p => ({
    nome: p.nome.length > 22 ? p.nome.slice(0, 22) + '…' : p.nome,
    progresso: p.progresso,
    status: p.status,
  })) : []

  return (
    <div className="page" style={{ background: DARK_BG }}>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ color: '#e6edf3' }}>Dashboard por Cliente</div>
          <div className="page-sub" style={{ color: '#8b949e' }}>Evolução de projetos, fases e tarefas</div>
        </div>
      </div>

      {/* Seletor de cliente */}
      {!isRestrito && (
        <div style={{ background: DARK_CARD, border: '1px solid #30363d', borderRadius: 10, marginBottom: 20, padding: '16px 20px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ color: '#8b949e' }}>Cliente</label>
            <div style={{ position: 'relative', maxWidth: 360 }}>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                style={{
                  width: '100%', paddingRight: 32, appearance: 'none',
                  background: '#0d1117', color: '#e6edf3', border: '1px solid #30363d',
                  borderRadius: 7, padding: '8px 32px 8px 12px', fontSize: 13,
                }}>
                <option value=''>Selecione um cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </select>
              <ChevronDown size={15} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      )}

      {loading && <LoadingPage />}

      {dados && !loading && (
        <>
          {/* Cards de resumo */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <CardResumo icon={Layers}        label="Projetos"           valor={dados.resumo.total_projetos} cor="#6366f1" />
            <CardResumo icon={CheckCircle2}  label="Tarefas concluídas" valor={dados.resumo.concluidas}     cor="#4CAF50" />
            <CardResumo icon={Clock}         label="Em andamento"       valor={dados.resumo.andamento}      cor="#1E88E5" />
            <CardResumo icon={AlertTriangle} label="Atrasadas"          valor={dados.resumo.atrasadas}      cor="#E53935" />
          </div>

          {/* Gráficos Plotly */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Pizza — tarefas por status */}
            <div style={{
              background: DARK_CARD, border: '1px solid #30363d', borderRadius: 12,
              padding: '20px 16px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c9d1d9', marginBottom: 12 }}>
                Tarefas por Status
              </div>
              <GraficoRosca
                dados={pieDados}
                altura={260}
                legenda legendaDetalhada
                tooltip tooltipFormatter={fmtNumeroBR}
                valorCentro={`${percConcluido}%`}
                rotuloCentro={`${totalTarefas} tarefas`}
                dark
              />
            </div>

            {/* Barras — progresso por projeto */}
            <div style={{
              background: DARK_CARD, border: '1px solid #30363d', borderRadius: 12,
              padding: '20px 16px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c9d1d9', marginBottom: 12 }}>
                Progresso por Projeto (%)
              </div>
              <GraficoBarras
                dados={barDados}
                chaveX="nome"
                layout="vertical"
                altura={260}
                formatoY={v => `${v}%`}
                tooltipFormatter={v => `${v}%`}
                barras={[{
                  chave: 'progresso', nome: 'Progresso',
                  cellProps: entry => ({ fill: STATUS_COR[entry.status] || '#6366f1' }),
                }]}
                dark
              />
            </div>
          </div>

          {/* Projetos e fases */}
          {dados.projetos.map(p => (
            <div key={p.id} style={{
              background: DARK_CARD, border: '1px solid #21262d', borderRadius: 12,
              padding: '18px 20px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#e6edf3' }}>{p.nome}</span>
                  <span style={{
                    marginLeft: 10, fontSize: 11, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 99, background: `${STATUS_COR[p.status]}22`, color: STATUS_COR[p.status],
                  }}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: STATUS_COR[p.status] || '#6366f1' }}>{p.progresso}%</div>
              </div>
              <GraficoProgresso valor={p.progresso} cor={STATUS_COR[p.status]} corTrilho="#21262d" />

              <div style={{ display: 'flex', gap: 16, margin: '10px 0 16px', fontSize: 12, color: '#6b7280' }}>
                <span style={{ color: '#4CAF50' }}>&#10003; {p.concluidas} concluídas</span>
                <span style={{ color: '#1E88E5' }}>&#8635; {p.andamento} em andamento</span>
                <span>&#8230; {p.pendentes} pendentes</span>
                {p.atrasadas > 0 && <span style={{ color: '#E53935' }}>&#9888; {p.atrasadas} atrasadas</span>}
              </div>

              {/* Fases */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.fases.map(f => (
                  <div key={f.id} style={{
                    background: '#0d1117', borderRadius: 8, padding: '10px 14px',
                    border: '1px solid #21262d',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#484f58', fontWeight: 600 }}>F{f.ordem}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>{f.nome}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                          background: `${STATUS_COR[f.status]}22`, color: STATUS_COR[f.status],
                        }}>
                          {STATUS_LABEL[f.status] || f.status}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>{f.progresso}%</span>
                    </div>
                    <GraficoProgresso valor={f.progresso} cor={STATUS_COR[f.status]} corTrilho="#21262d" />
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: '#484f58' }}>
                      <span>{f.total} tarefa(s)</span>
                      <span style={{ color: '#4CAF50' }}>{f.concluidas} concluídas</span>
                      {f.atrasadas > 0 && <span style={{ color: '#E53935' }}>{f.atrasadas} atrasadas</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {dados.projetos.length === 0 && (
            <div style={{ background: DARK_CARD, border: '1px solid #21262d', borderRadius: 12, padding: 40, textAlign: 'center', color: '#6b7280' }}>
              Nenhum projeto encontrado para este cliente.
            </div>
          )}
        </>
      )}
    </div>
  )
}
