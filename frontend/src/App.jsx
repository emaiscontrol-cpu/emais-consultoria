import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
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
import ImportacaoRealizado from './pages/controladoria/ImportacaoRealizado'
import Importacoes from './pages/controladoria/Importacoes'
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
import FloatingAI from './components/FloatingAI'
import './index.css'

// Compara versões semânticas "2.5.0k". Retorna true se a > b.
function versaoMaiorQue(a, b) {
  const parse = v => {
    const m = (v || '').match(/^(\d+)\.(\d+)\.(\d+)([a-z]?)/)
    if (!m) return [0, 0, 0, -1]
    return [+m[1], +m[2], +m[3], m[4] ? m[4].charCodeAt(0) : -1]
  }
  const pa = parse(a), pb = parse(b)
  for (let i = 0; i < 4; i++) {
    if (pa[i] > pb[i]) return true
    if (pa[i] < pb[i]) return false
  }
  return false
}

function AvisoNovaVersao() {
  useEffect(() => {
    // Verifica apenas uma vez por sessão do navegador (evita loop com ngrok pooling)
    if (sessionStorage.getItem('versao_checada')) return
    sessionStorage.setItem('versao_checada', '1')

    const versaoSalva = localStorage.getItem('emais_versao')
    fetch('/api/version', { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json())
      .then(d => {
        const v = d.version
        if (v.includes('-beta')) return
        if (!versaoSalva) {
          localStorage.setItem('emais_versao', v)
          return
        }
        if (versaoMaiorQue(v, versaoSalva)) {
          localStorage.setItem('emais_versao', v)
          toast(`Nova versão v${v} — pressione Ctrl+Shift+R para atualizar`, {
            duration: 10000,
            icon: '🔄',
            style: { fontSize: 13 },
          })
        }
      })
      .catch(() => {})
  }, [])

  return null
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
          <Route path="/controladoria/balancetes"  element={<Balancetes />} />
          <Route path="/controladoria/importacao-realizado" element={<Navigate to="/importacoes?aba=realizado" replace />} />
          <Route path="/importacoes" element={<Importacoes />} />
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
      <FloatingAI />
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
