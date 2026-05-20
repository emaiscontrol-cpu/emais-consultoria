import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projetos from './pages/Projetos'
import ProjetoDetalhe from './pages/ProjetoDetalhe'
import Clientes from './pages/Clientes'
import Usuarios from './pages/Usuarios'
import Notificacoes from './pages/Notificacoes'
import HistoricoAtividades from './pages/HistoricoAtividades'
import Relatorios from './pages/Relatorios'
import Manual from './pages/Manual'
import './index.css'

function ProtectedLayout() {
  const { usuario, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--brand)', fontSize:13 }}>Carregando...</div>
  if (!usuario) return <Navigate to="/login" replace />
  return (
    <div className="app-shell">
      <Sidebar />
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
          <Route path="/manual"         element={<Manual />} />
        </Routes>
      </div>
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
