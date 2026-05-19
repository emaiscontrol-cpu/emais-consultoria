import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Users, Building2, LogOut, KeyRound, Bell, History, BarChart2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './shared'
import { authAPI, notificacoesAPI } from '../services/api'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [showSenha, setShowSenha] = useState(false)
  const [formSenha, setFormSenha] = useState({ senha_atual:'', nova_senha:'', confirmar:'' })
  const [salvando, setSalvando] = useState(false)

  const [qtdAlertas, setQtdAlertas] = useState(0)

  useEffect(() => {
    notificacoesAPI.listar()
      .then(r => setQtdAlertas(r.data.length))
      .catch(() => {})
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const handleAlterarSenha = async e => {
    e.preventDefault()
    if (formSenha.nova_senha !== formSenha.confirmar) {
      toast.error('As senhas não conferem'); return
    }
    setSalvando(true)
    try {
      await authAPI.alterarSenha(formSenha.senha_atual, formSenha.nova_senha)
      toast.success('Senha alterada com sucesso!')
      setShowSenha(false)
      setFormSenha({ senha_atual:'', nova_senha:'', confirmar:'' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao alterar senha')
    } finally { setSalvando(false) }
  }

  const isAdmin    = ['admin'].includes(usuario?.perfil)
  const isConsultor= ['admin','consultor','ger_projeto'].includes(usuario?.perfil)

  return (
    <>
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:5 }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink:0 }}>
            <rect width="28" height="28" rx="7" fill="#00A3DC"/>
            <rect x="6" y="6.5" width="11" height="2.5" rx="1.25" fill="white"/>
            <rect x="6" y="12.75" width="8" height="2.5" rx="1.25" fill="rgba(255,255,255,.65)"/>
            <rect x="6" y="19" width="11" height="2.5" rx="1.25" fill="white"/>
            <rect x="6" y="6.5" width="2.5" height="15" rx="1.25" fill="white"/>
            <rect x="19.5" y="10.5" width="6" height="2" rx="1" fill="white"/>
            <rect x="21.5" y="8.5" width="2" height="6" rx="1" fill="white"/>
          </svg>
          <div className="sidebar-brand-name">E Mais Consultoria</div>
        </div>
        <div className="sidebar-brand-sub">Sistema de Gestão</div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">Principal</div>

        <NavLink to="/" end className={({isActive})=>`nav-item${isActive?' active':''}`}>
          <LayoutDashboard size={16}/> Dashboard
        </NavLink>

        <NavLink to="/projetos" className={({isActive})=>`nav-item${isActive?' active':''}`}>
          <FolderKanban size={16}/> Projetos
        </NavLink>

        <NavLink to="/notificacoes" className={({isActive})=>`nav-item${isActive?' active':''}`}>
          <div style={{ position:'relative', display:'inline-flex' }}>
            <Bell size={16}/>
            {qtdAlertas > 0 && (
              <span style={{ position:'absolute', top:-6, right:-8, background:'var(--red)', color:'#fff', borderRadius:99, fontSize:9, fontWeight:700, padding:'1px 4px', minWidth:14, textAlign:'center' }}>
                {qtdAlertas}
              </span>
            )}
          </div>
          {' '}Notificações
        </NavLink>

        {isConsultor && (
          <NavLink to="/clientes" className={({isActive})=>`nav-item${isActive?' active':''}`}>
            <Building2 size={16}/> Clientes
          </NavLink>
        )}

        {isConsultor && (
          <>
            <div className="nav-section">Administração</div>
            <NavLink to="/relatorios" className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <BarChart2 size={16}/> Relatórios
            </NavLink>
            <NavLink to="/historico" className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <History size={16}/> Histórico
            </NavLink>
            {isAdmin && (
              <NavLink to="/usuarios" className={({isActive})=>`nav-item${isActive?' active':''}`}>
                <Users size={16}/> Usuários
              </NavLink>
            )}
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
          <Avatar nome={usuario?.nome} color="blue" />
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'rgba(255,255,255,.88)' }}>
              {usuario?.nome}
            </div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.40)' }}>
              {{ admin:'Administrador', consultor:'Consultor', ger_projeto:'Ger. Projeto', cliente:'Cliente' }[usuario?.perfil]}
            </div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'flex-start', marginBottom:4 }} onClick={() => setShowSenha(true)}>
          <KeyRound size={13}/> Alterar senha
        </button>
        <button className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'flex-start' }} onClick={handleLogout}>
          <LogOut size={13}/> Sair
        </button>
      </div>
    </aside>

    {showSenha && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ background:'#fff', borderRadius:8, padding:24, width:360, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
          <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>Alterar senha</div>
          <form onSubmit={handleAlterarSenha}>
            <div className="form-group">
              <label>Senha atual</label>
              <input type="password" value={formSenha.senha_atual} required
                onChange={e => setFormSenha(f => ({...f, senha_atual: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Nova senha</label>
              <input type="password" value={formSenha.nova_senha} required minLength={6}
                onChange={e => setFormSenha(f => ({...f, nova_senha: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Confirmar nova senha</label>
              <input type="password" value={formSenha.confirmar} required
                onChange={e => setFormSenha(f => ({...f, confirmar: e.target.value}))} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" className="btn" onClick={() => setShowSenha(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}
