import logo from '../assets/logo.jpeg'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, Users, Building2, LogOut, KeyRound, Bell,
  History, BarChart2, BookOpen, List, FileSpreadsheet, NotebookPen,
  ChevronDown, ChevronUp, Layers, ListTodo, AlignLeft, DatabaseBackup,
  Camera, Copy, Search, Globe, FolderOpen, Target, Download,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Avatar } from './shared'
import { authAPI, notificacoesAPI } from '../services/api'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

// ── Botão de título de seção colapsável ──────────────────────────────────────
function SectionBtn({ emoji, label, open, isActive, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      width: '100%', padding: '6px 14px', border: 'none', cursor: 'pointer',
      background: 'transparent', marginTop: 4,
    }}>
      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
        color: isActive ? 'rgba(255,255,255,.82)' : 'rgba(255,255,255,.45)',
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'color .15s',
      }}>
        <span style={{ fontSize: 13 }}>{emoji}</span> {label}
      </span>
      {open
        ? <ChevronUp   size={11} color={isActive ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.35)'} />
        : <ChevronDown size={11} color={isActive ? 'rgba(255,255,255,.65)' : 'rgba(255,255,255,.35)'} />
      }
    </button>
  )
}

// ── Sub-seção Dashboards colapsável (dentro do bloco Projetos) ────────────────
const DASH_SUB = [
  { to: '/',                     label: 'Geral',         icon: LayoutDashboard, end: true },
  { to: '/dashboard/fases',      label: 'Por Fase',      icon: Layers },
  { to: '/dashboard/tarefas',    label: 'Por Tarefa',    icon: ListTodo },
  { to: '/dashboard/subtarefas', label: 'Por Atividade', icon: AlignLeft },
]

// ── Bloco principal: PROJETOS + Dashboards ────────────────────────────────────
function ProjetosSection({ isAdminConsultor }) {
  const location = useLocation()

  const isDashActive = location.pathname === '/' ||
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/dashboard-executivo')

  const [dashOpen, setDashOpen] = useState(isDashActive)
  useEffect(() => { if (isDashActive) setDashOpen(true) }, [isDashActive])

  return (
    <div style={{ marginBottom: 4 }}>
      {/* ── Link principal Projetos com destaque visual ── */}
      <NavLink
        to="/projetos"
        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        style={({ isActive }) => ({
          fontWeight: 700,
          fontSize: 14,
          padding: '10px 14px',
          background: isActive
            ? 'rgba(255,255,255,.18)'
            : 'rgba(255,255,255,.07)',
          borderRadius: 8,
          marginBottom: 2,
          border: '1px solid rgba(255,255,255,.10)',
        })}
      >
        <FolderKanban size={17} />
        <span style={{ flex: 1 }}>Projetos</span>
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
          background: 'var(--brand)', color: '#fff',
          borderRadius: 99, padding: '2px 7px',
        }}>
          trabalho
        </span>
      </NavLink>

      {/* ── Sub-seção Dashboards ── */}
      <div style={{ paddingLeft: 10 }}>
        <button
          onClick={() => setDashOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '5px 10px', border: 'none', cursor: 'pointer',
            background: 'transparent', marginTop: 2,
          }}
        >
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
            color: isDashActive ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.38)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <LayoutDashboard size={11} /> Dashboards
          </span>
          {dashOpen
            ? <ChevronUp   size={10} color="rgba(255,255,255,.35)" />
            : <ChevronDown size={10} color="rgba(255,255,255,.35)" />
          }
        </button>

        {dashOpen && (
          <div style={{ paddingLeft: 8, marginTop: 2 }}>
            {DASH_SUB.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
                <Icon size={13} /> {label}
              </NavLink>
            ))}
            {isAdminConsultor && (
              <NavLink to="/dashboard-executivo"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
                <Globe size={13} /> Por Cliente
              </NavLink>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Análises Gerenciais ───────────────────────────────────────────────────────
function AnalisesSection() {
  const location = useLocation()
  const isActive = location.pathname.startsWith('/controladoria') && !location.pathname.startsWith('/controladoria/planos')
  const [open, setOpen] = useState(isActive)
  useEffect(() => { if (isActive) setOpen(true) }, [isActive])

  return (
    <div>
      <SectionBtn emoji="📈" label="Análises Gerenciais" open={open} isActive={isActive} onClick={() => setOpen(v => !v)} />
      {open && (
        <div style={{ paddingLeft: 10, marginTop: 2 }}>
          <NavLink to="/controladoria/fluxo-de-caixa"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <span style={{ fontSize: 14 }}>💲</span> Fluxo de Caixa Executivo
          </NavLink>
          <NavLink to="/controladoria/dre"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <BarChart2 size={13} /> DRE Gerencial
          </NavLink>
          <NavLink to="/controladoria/balancetes"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <FileSpreadsheet size={13} /> Balancete
          </NavLink>
          <NavLink to="/controladoria/orcamento"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <Target size={13} /> Controle Orçamentário
          </NavLink>
        </div>
      )}
    </div>
  )
}

// ── Administração ─────────────────────────────────────────────────────────────
function AdminSection() {
  const location = useLocation()
  const isActive = ['/relatorios', '/historico', '/usuarios', '/clientes'].some(p => location.pathname.startsWith(p))
  const [open, setOpen] = useState(isActive)
  useEffect(() => { if (isActive) setOpen(true) }, [isActive])

  return (
    <div>
      <SectionBtn emoji="🏢" label="Administração" open={open} isActive={isActive} onClick={() => setOpen(v => !v)} />
      {open && (
        <div style={{ paddingLeft: 10, marginTop: 2 }}>
          <NavLink to="/relatorios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <BarChart2 size={13} /> Relatórios
          </NavLink>
          <NavLink to="/historico" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <History size={13} /> Histórico
          </NavLink>
          <NavLink to="/usuarios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <Users size={13} /> Usuários
          </NavLink>
          <NavLink to="/clientes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <Building2 size={13} /> Clientes
          </NavLink>
        </div>
      )}
    </div>
  )
}

// ── Procedimentos ─────────────────────────────────────────────────────────────
function ProcSection() {
  const location = useLocation()
  const isActive = location.pathname.startsWith('/procedimentos') ||
    location.pathname.startsWith('/controladoria/planos') ||
    location.pathname.startsWith('/modelos') ||
    location.pathname.startsWith('/importacoes')
  const [open, setOpen] = useState(isActive)
  useEffect(() => { if (isActive) setOpen(true) }, [isActive])

  return (
    <div>
      <SectionBtn emoji="⚙️" label="Procedimentos" open={open} isActive={isActive} onClick={() => setOpen(v => !v)} />
      {open && (
        <div style={{ paddingLeft: 10, marginTop: 2 }}>
          <NavLink to="/modelos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <Copy size={13} /> Templates de Projeto
          </NavLink>
          <NavLink to="/controladoria/planos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <List size={13} /> Modelos & Contas
          </NavLink>
          <NavLink to="/procedimentos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <DatabaseBackup size={13} /> Backup
          </NavLink>
          <NavLink to="/importacoes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} style={{ fontSize: 12, paddingTop: 7, paddingBottom: 7, gap: 7 }}>
            <Download size={13} /> Importações
          </NavLink>
        </div>
      )}
    </div>
  )
}

// ── Sidebar principal ─────────────────────────────────────────────────────────
export default function Sidebar({ onBusca }) {
  const { usuario, logout, atualizarUsuario, temModulo } = useAuth()
  const navigate = useNavigate()
  const [showSenha, setShowSenha] = useState(false)
  const [formSenha, setFormSenha] = useState({ senha_atual: '', nova_senha: '', confirmar: '' })
  const [salvando, setSalvando] = useState(false)
  const [qtdAlertas, setQtdAlertas] = useState(0)
  const [versao, setVersao] = useState('')

  useEffect(() => {
    notificacoesAPI.listar().then(r => setQtdAlertas(r.data.length)).catch(() => {})
    fetch('/api/version', { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json()).then(d => setVersao(d.version)).catch(() => {})
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  const handleAlterarSenha = async e => {
    e.preventDefault()
    if (formSenha.nova_senha !== formSenha.confirmar) { toast.error('As senhas não conferem'); return }
    setSalvando(true)
    try {
      await authAPI.alterarSenha(formSenha.senha_atual, formSenha.nova_senha)
      toast.success('Senha alterada com sucesso!')
      setShowSenha(false)
      setFormSenha({ senha_atual: '', nova_senha: '', confirmar: '' })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao alterar senha')
    } finally { setSalvando(false) }
  }

  const isAdmin          = ['admin'].includes(usuario?.perfil)
  const isAdminConsultor = ['admin', 'consultor'].includes(usuario?.perfil)
  const isRestrito       = ['analista', 'ger_projeto', 'ti'].includes(usuario?.perfil) && !!usuario?.cliente_id
  const isConsultor      = isRestrito || ['admin', 'consultor', 'ger_projeto', 'ti'].includes(usuario?.perfil)
  const isControladoria  = isRestrito || ['admin', 'consultor', 'ger_projeto', 'ti'].includes(usuario?.perfil)

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
            <div style={{ width: 40, height: 40, overflow: 'hidden', borderRadius: '50%', flexShrink: 0 }}>
              <img src={logo} alt="E Mais" style={{ width: 40, height: 40, display: 'block', objectFit: 'cover' }} />
            </div>
            <div className="sidebar-brand-name">E Mais Consultoria</div>
          </div>
          <div className="sidebar-brand-sub">Sistema de Gestão</div>
          {versao && <div style={{ fontSize: 10, color: 'rgba(255,255,255,.30)', marginTop: 2, letterSpacing: '.04em' }}>v{versao}</div>}
        </div>

        <nav className="sidebar-nav">
          {/* ── Marca da seção: círculo "E" ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 14px', marginBottom: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 12, color: '#fff', letterSpacing: '-.02em',
            }}>E</div>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase',
              color: 'rgba(255,255,255,.38)',
            }}>
              E Mais
            </span>
          </div>

          {/* ── Busca global ── */}
          <button onClick={onBusca} style={{
            display: 'flex', alignItems: 'center', gap: 9, width: '100%',
            padding: '9px 14px', borderRadius: 7, cursor: 'pointer', border: 'none',
            background: 'transparent', color: 'rgba(255,255,255,.45)',
            fontSize: 13, transition: 'background .15s, color .15s', marginBottom: 6,
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.07)'; e.currentTarget.style.color = 'rgba(255,255,255,.8)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.45)' }}>
            <Search size={15} />
            <span style={{ flex: 1, textAlign: 'left' }}>Buscar...</span>
            <span style={{ fontSize: 10, background: 'rgba(255,255,255,.12)', borderRadius: 4, padding: '1px 6px', letterSpacing: '.02em' }}>Ctrl+K</span>
          </button>

          {/* ── Projetos (destaque) + Dashboards + Notificações — módulo "projetos" ── */}
          {temModulo('projetos') && (
            <>
              <ProjetosSection isAdminConsultor={isAdminConsultor} />

              <NavLink to="/notificacoes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  <Bell size={16} />
                  {qtdAlertas > 0 && (
                    <span style={{
                      position: 'absolute', top: -6, right: -8, background: 'var(--red)', color: '#fff',
                      borderRadius: 99, fontSize: 9, fontWeight: 700, padding: '1px 4px', minWidth: 14, textAlign: 'center',
                    }}>
                      {qtdAlertas}
                    </span>
                  )}
                </div>
                {' '}Notificações
              </NavLink>
            </>
          )}

          {/* ── Inteligência de Mercado — módulo "inteligencia_mercado" (seção a implementar) ── */}

          {/* ── Análises Gerenciais — módulo "analises_gerenciais" ── */}
          {isControladoria && temModulo('analises_gerenciais') && <AnalisesSection />}

          {isConsultor && (
            <NavLink to="/anotacoes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <NotebookPen size={16} /> Anotações
            </NavLink>
          )}

          {isAdminConsultor && (
            <NavLink to="/arquivos" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <FolderOpen size={16} /> Arquivos
            </NavLink>
          )}

          {isAdminConsultor && <AdminSection />}

          {isAdmin && <ProcSection />}
        </nav>

        <div className="sidebar-footer">
          <input type="file" accept="image/*" id="foto-upload" style={{ display: 'none' }}
            onChange={async e => {
              const file = e.target.files?.[0]
              if (!file) return
              const reader = new FileReader()
              reader.onload = async ev => {
                try {
                  const { data } = await authAPI.atualizarFoto(ev.target.result)
                  atualizarUsuario({ foto: data.foto })
                  toast.success('Foto atualizada!')
                } catch { toast.error('Erro ao salvar foto') }
              }
              reader.readAsDataURL(file)
              e.target.value = ''
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
              title="Clique para alterar sua foto"
              onClick={() => document.getElementById('foto-upload').click()}>
              {usuario?.foto
                ? <img src={usuario.foto} alt={usuario.nome}
                    style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                : <Avatar nome={usuario?.nome} color="blue" />
              }
              <div style={{
                position: 'absolute', bottom: -2, right: -2, background: 'rgba(0,0,0,0.6)',
                borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Camera size={9} color="#fff" />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255,255,255,.88)' }}>
                {usuario?.nome}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.40)' }}>
                {{ admin: 'Administrador', consultor: 'Consultor', ger_projeto: 'Ger. Projeto', analista: 'Analista', ti: 'T.I' }[usuario?.perfil]}
              </div>
            </div>
          </div>
          <NavLink to="/manual" className={({ isActive }) => `btn btn-ghost btn-sm${isActive ? ' active' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4, textDecoration: 'none' }}>
            <BookOpen size={13} /> Manual
          </NavLink>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }} onClick={() => setShowSenha(true)}>
            <KeyRound size={13} /> Alterar senha
          </button>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={handleLogout}>
            <LogOut size={13} /> Sair
          </button>
        </div>
      </aside>

      {showSenha && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Alterar senha</div>
            <form onSubmit={handleAlterarSenha}>
              <div className="form-group">
                <label>Senha atual</label>
                <input type="password" value={formSenha.senha_atual} required
                  onChange={e => setFormSenha(f => ({ ...f, senha_atual: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Nova senha</label>
                <input type="password" value={formSenha.nova_senha} required minLength={6}
                  onChange={e => setFormSenha(f => ({ ...f, nova_senha: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Confirmar nova senha</label>
                <input type="password" value={formSenha.confirmar} required
                  onChange={e => setFormSenha(f => ({ ...f, confirmar: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
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
