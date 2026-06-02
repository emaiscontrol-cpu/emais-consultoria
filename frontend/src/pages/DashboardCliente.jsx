import { useState, useEffect } from 'react'
import { clientesAPI, dashboardAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { LoadingPage } from '../components/shared'
import { ChevronDown, AlertTriangle, CheckCircle2, Clock, Layers } from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

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

function CardResumo({ icon: Icon, label, valor, cor }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 160,
    }}>
      <div style={{ background: `${cor}18`, borderRadius: 8, padding: 10 }}>
        <Icon size={20} color={cor} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#1f2937' }}>{valor}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

function BarraProgresso({ valor, cor }) {
  return (
    <div style={{ background: '#f3f4f6', borderRadius: 99, height: 8, width: '100%' }}>
      <div style={{
        width: `${Math.min(valor, 100)}%`, height: '100%',
        borderRadius: 99, background: cor || 'var(--brand)',
        transition: 'width .4s ease',
      }} />
    </div>
  )
}

export default function DashboardCliente() {
  const { usuario } = useAuth()

  const clienteVinculado = usuario?.cliente_id || null
  const isRestrito = clienteVinculado && ['cliente', 'ger_projeto', 'ti'].includes(usuario?.perfil)

  const [clientes, setClientes]   = useState([])
  const [clienteId, setClienteId] = useState(isRestrito ? String(clienteVinculado) : '')
  const [dados, setDados]         = useState(null)
  const [loading, setLoading]     = useState(false)

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

  const pieData = dados ? [
    { name: 'Concluídas',   value: dados.resumo.concluidas,  cor: '#4CAF50' },
    { name: 'Em andamento', value: dados.resumo.andamento,   cor: '#1E88E5' },
    { name: 'Pendentes',    value: dados.resumo.pendentes,   cor: '#9ca3af' },
    { name: 'Atrasadas',    value: dados.resumo.atrasadas,   cor: '#E53935' },
  ].filter(d => d.value > 0) : []

  const barData = dados?.projetos.map(p => ({
    name: p.nome.length > 18 ? p.nome.slice(0, 18) + '…' : p.nome,
    progresso: p.progresso,
  })) || []

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard por Cliente</div>
          <div className="page-sub">Evolução de projetos, fases e tarefas</div>
        </div>
      </div>

      {/* Seletor de cliente */}
      {!isRestrito && (
        <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Cliente</label>
            <div style={{ position: 'relative', maxWidth: 360 }}>
              <select value={clienteId} onChange={e => setClienteId(e.target.value)}
                style={{ width: '100%', paddingRight: 32, appearance: 'none' }}>
                <option value=''>Selecione um cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
              </select>
              <ChevronDown size={15} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
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

          {/* Gráficos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Pizza - tarefas por status */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 16 }}>
                Tarefas por Status
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.cor} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Barras - progresso por projeto */}
            <div className="card">
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 16 }}>
                Progresso por Projeto (%)
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
                  <Tooltip formatter={v => `${v}%`} />
                  <Bar dataKey="progresso" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Projetos e fases */}
          {dados.projetos.map(p => (
            <div key={p.id} className="card" style={{ marginBottom: 16 }}>
              {/* Cabeçalho do projeto */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#1f2937' }}>{p.nome}</span>
                  <span style={{
                    marginLeft: 10, fontSize: 11, fontWeight: 600, padding: '2px 8px',
                    borderRadius: 99, background: `${STATUS_COR[p.status]}20`, color: STATUS_COR[p.status],
                  }}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#6366f1' }}>{p.progresso}%</div>
              </div>
              <BarraProgresso valor={p.progresso} cor={STATUS_COR[p.status]} />

              {/* Mini stats */}
              <div style={{ display: 'flex', gap: 16, margin: '10px 0 16px', fontSize: 12, color: '#6b7280' }}>
                <span>✅ {p.concluidas} concluídas</span>
                <span>🔄 {p.andamento} em andamento</span>
                <span>⏳ {p.pendentes} pendentes</span>
                {p.atrasadas > 0 && <span style={{ color: '#E53935' }}>⚠️ {p.atrasadas} atrasadas</span>}
              </div>

              {/* Fases */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.fases.map(f => (
                  <div key={f.id} style={{
                    background: '#f9fafb', borderRadius: 8, padding: '10px 14px',
                    border: '1px solid #e5e7eb',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>F{f.ordem}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{f.nome}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                          background: `${STATUS_COR[f.status]}20`, color: STATUS_COR[f.status],
                        }}>
                          {STATUS_LABEL[f.status] || f.status}
                        </span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{f.progresso}%</span>
                    </div>
                    <BarraProgresso valor={f.progresso} cor={STATUS_COR[f.status]} />
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
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
            <div className="card">
              <div className="empty-state">Nenhum projeto encontrado para este cliente.</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
