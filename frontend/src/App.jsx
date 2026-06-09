import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import DashboardExecutivo from './pages/DashboardExecutivo'
import Projetos from './pages/Projetos'
import ProjetoDetalhe from './pages/ProjetoDetalhe'
import Clientes from './pages/Clientes'
import Usuarios from './pages/Usuarios'
import Notificacoes from './pages/Notificacoes'
import HistoricoAtividades from './pages/HistoricoAtividades'
import Relatorios from './pages/Relatorios'
import Manual from './pages/Manual'
import ControladoriaIndex from './pages/controladoria/Index'
import FluxoCaixa from './pages/controladoria/FluxoCaixa'
import DRE from './pages/controladoria/DRE'
import DreDashboard2 from './pages/controladoria/DreDashboard2'
import Orcamento from './pages/controladoria/Orcamento'
import Planos from './pages/controladoria/Planos'
import Balancetes from './pages/controladoria/Balancetes'
import Anotacoes from './pages/Anotacoes'
import Arquivos from './pages/Arquivos'
import Procedimentos from './pages/Procedimentos'
import Modelos from './pages/Modelos'
import DashboardCliente from './pages/DashboardCliente'
import DashboardFases from './pages/DashboardFases'
import DashboardTarefas from './pages/DashboardTarefas'
import DashboardSubtarefas from './pages/DashboardSubtarefas'
import BuscaGlobal from './components/BuscaGlobal'
import './index.css'

function AvisoNovaVersao() {
  const [novaVersao, setNovaVersao] = useState(null)

  useEffect(() => {
    // Verifica versão uma única vez ao montar (quando o usuário loga)
    const versaoSalva = localStorage.getItem('emais_versao')
    fetch('/api/version', { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json())
      .then(d => {
        const v = d.version
        const isBeta = v.includes('-beta')
        if (!versaoSalva) {
          localStorage.setItem('emais_versao', v)
        } else if (v !== versaoSalva && !isBeta) {
          setNovaVersao(v)
        } else if (!isBeta) {
          localStorage.setItem('emais_versao', v)
        }
      })
      .catch(() => {})
  }, [])

  if (!novaVersao) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: '#0096CF', color: '#fff',
      padding: '10px 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', fontFamily: 'sans-serif',
      fontSize: 13, boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
    }}>
      <span>Nova versão disponível — <strong>v{novaVersao}</strong>. Deseja atualizar agora?</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => { localStorage.setItem('emais_versao', novaVersao); window.location.reload() }}
          style={{ background: '#fff', color: '#0096CF', border: 'none', padding: '6px 16px',
            borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          Atualizar agora
        </button>
        <button onClick={() => setNovaVersao(null)}
          style={{ background: 'transparent', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.4)',
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
          Agora não
        </button>
      </div>
    </div>
  )
}

function ProtectedLayout() {
  const { usuario, loading } = useAuth()
  const [showBusca, setShowBusca] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowBusca(v => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--brand)', fontSize:13 }}>Carregando...</div>
  if (!usuario) return <Navigate to="/login" replace />
  return (
    <div className="app-shell">
      <AvisoNovaVersao />
      <Sidebar onBusca={() => setShowBusca(true)} />
      <div className="main-area">
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/projetos"     element={<Projetos />} />
          <Route path="/projetos/:id" element={<ProjetoDetalhe />} />
          <Route path="/clientes"       element={<Clientes />} />
          <Route path="/usuarios"       element={<Usuarios />} />
          <Route path="/notificacoes"   element={<Notificacoes />} />
          <Route path="/historico"      element={<HistoricoAtividades />} />
          <Route path="/relatorios"     element={<Relatorios />} />
          <Route path="/manual"                        element={<Manual />} />
          <Route path="/controladoria"                 element={<ControladoriaIndex />} />
          <Route path="/controladoria/fluxo-de-caixa" element={<FluxoCaixa />} />
          <Route path="/controladoria/dre"             element={<DRE />} />
          <Route path="/controladoria/dre-dashboard"  element={<DreDashboard2 />} />
          <Route path="/controladoria/dre-dashboard2" element={<DreDashboard2 />} />
          <Route path="/controladoria/orcamento"       element={<Orcamento />} />
          <Route path="/controladoria/planos"      element={<Planos />} />
          <Route path="/controladoria/balancetes" element={<Balancetes />} />
          <Route path="/anotacoes"               element={<Anotacoes />} />
          <Route path="/arquivos"                element={<Arquivos />} />
          <Route path="/dashboard-cliente"        element={<DashboardCliente />} />
          <Route path="/dashboard-cliente/:id"    element={<DashboardCliente />} />
          <Route path="/dashboard-executivo"      element={<DashboardExecutivo />} />
          <Route path="/dashboard/fases"          element={<DashboardFases />} />
          <Route path="/dashboard/tarefas"        element={<DashboardTarefas />} />
          <Route path="/dashboard/subtarefas"     element={<DashboardSubtarefas />} />
          <Route path="/procedimentos"             element={<Procedimentos />} />
          <Route path="/modelos"                   element={<Modelos />} />
        </Routes>
      </div>
      {showBusca && <BuscaGlobal onClose={() => setShowBusca(false)} />}
    </div>
  )
}

function PublicRoute({ children }) {
  const { usuario, loading } = useAuth()
  if (loading) return null
  if (usuario) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style:{ fontSize:13 } }} />
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/*"     element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
