import logo from '../assets/logo.jpeg'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Users, Building2, LogOut, KeyRound, Bell, History, BarChart2, BookOpen, Landmark, List, FileSpreadsheet, NotebookPen, PieChart, ChevronDown, ChevronUp, Layers, ListTodo, AlignLeft } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './shared'
import { authAPI, notificacoesAPI } from '../services/api'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const DASH_SUB = [
  { to: '/',                      label: 'Geral',         icon: LayoutDashboard, end: true },
  { to: '/dashboard/fases',       label: 'Por Fase',      icon: Layers },
  { to: '/dashboard/tarefas',     label: 'Por Tarefa',    icon: ListTodo },
  { to: '/dashboard/subtarefas',  label: 'Por Subtarefa', icon: AlignLeft },
]

function DashGroup() {
  const location = useLocation()
  const isDashActive = location.pathname === '/' || location.pathname.startsWith('/dashboard')
  const [open, setOpen] = useState(isDashActive)

  useEffect(() => { if (isDashActive) setOpen(true) }, [isDashActive])

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%',
          padding: '9px 14px', borderRadius: 7, cursor: 'pointer', border: 'none',
          background: isDashActive ? 'rgba(255,255,255,.13)' : 'transparent',
          color: isDashActive ? '#fff' : 'rgba(255,255,255,.62)',
          fontSize: 13, fontWeight: isDashActive ? 600 : 400,
          transition: 'background .15s, color .15s',
        }}
        onMouseEnter={e => { if (!isDashActive) e.currentTarget.style.background = 'rgba(255,255,255,.07)' }}
        onMouseLeave={e => { if (!isDashActive) e.currentTarget.style.background = 'transparent' }}
      >
        <LayoutDashboard size={16} />
        <span style={{ flex: 1, textAlign: 'left' }}>Dashboard</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div style={{ paddingLeft: 10, marginTop: 2 }}>
          {DASH_SUB.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
              <Icon size={13} /> {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [showSenha, setShowSenha] = useState(false)
  const [formSenha, setFormSenha] = useState({ senha_atual:'', nova_senha:'', confirmar:'' })
  const [salvando, setSalvando] = useState(false)

  const [qtdAlertas, setQtdAlertas] = useState(0)
  const [versao,     setVersao]     = useState('')

  useEffect(() => {
    notificacoesAPI.listar()
      .then(r => setQtdAlertas(r.data.length))
      .catch(() => {})
    fetch('/api/version', { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json()).then(d => setVersao(d.version)).catch(() => {})
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

  const isAdmin         = ['admin'].includes(usuario?.perfil)
  // perfis que têm acesso restrito ao cliente vinculado quando possuem cliente_id
  const isRestrito      = ['cliente','ger_projeto','ti'].includes(usuario?.perfil) && !!usuario?.cliente_id
  const isConsultor     = isRestrito || ['admin','consultor','ger_projeto','ti'].includes(usuario?.perfil)
  const isControladoria = isRestrito || ['admin','consultor','ger_projeto','ti'].includes(usuario?.perfil)

  return (
    <>
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:5 }}>
          <div style={{ width:40, height:40, overflow:'hidden', borderRadius:'50%', flexShrink:0 }}>
            <img src={logo} alt="E Mais" style={{ width:40, height:40, display:'block', objectFit:'cover' }} />
          </div>
          <div className="sidebar-brand-name">E Mais Consultoria</div>
        </div>
        <div className="sidebar-brand-sub">Sistema de Gestão</div>
        {versao && <div style={{ fontSize:10, color:'rgba(255,255,255,.30)', marginTop:2, letterSpacing:'.04em' }}>v{versao}</div>}
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">Principal</div>

        <DashGroup />

        <NavLink to="/projetos" className={({isActive})=>`nav-item${isActive?' active':''}`}>
          <FolderKanban size={16}/> Projetos
        </NavLink>

        <NavLink to="/dashboard-cliente" className={({isActive})=>`nav-item${isActive?' active':''}`}>
          <PieChart size={16}/> Dashboard Cliente
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

        {['admin','consultor'].includes(usuario?.perfil) && (
          <NavLink to="/clientes" className={({isActive})=>`nav-item${isActive?' active':''}`}>
            <Building2 size={16}/> Clientes
          </NavLink>
        )}

        {isControladoria && (
          <>
            <div className="nav-section">Controladoria</div>
            <NavLink to="/controladoria" end className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <Landmark size={16}/> Controladoria
            </NavLink>
            <NavLink to="/controladoria/planos" className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <List size={16}/> Modelos & Contas
            </NavLink>
            <NavLink to="/controladoria/balancetes" className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <FileSpreadsheet size={16}/> Balancetes
            </NavLink>
          </>
        )}

        {isConsultor && (
          <>
            <div className="nav-section">Clientes</div>
            <NavLink to="/anotacoes" className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <NotebookPen size={16}/> Anotações
            </NavLink>
          </>
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
            <NavLink to="/manual" className={({isActive})=>`nav-item${isActive?' active':''}`}>
              <BookOpen size={16}/> Manual
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
              {{ admin:'Administrador', consultor:'Consultor', ger_projeto:'Ger. Projeto', cliente:'Cliente', ti:'T.I' }[usuario?.perfil]}
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
