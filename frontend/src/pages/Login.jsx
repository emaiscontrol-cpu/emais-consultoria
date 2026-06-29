// PADRÃO DO SISTEMA: Em formulários com múltiplos campos, Enter avança para o próximo campo.
// No último campo, Enter submete. Usar onKeyDown + useRef. Ver DESIGN_SYSTEM.md.
import logo from '../assets/logo.jpeg'
import eIcon from '../assets/icon.png'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'

const CARD_STYLE = {
  width: 320,
  background: '#fff',
  borderRadius: 16,
  padding: '32px 28px',
  boxShadow: '0 4px 24px rgba(0,0,0,.10)',
}

const INPUT_BASE = {
  width: '100%', padding: '10px 12px',
  border: '0.5px solid var(--border)', borderRadius: 8,
  fontFamily: 'inherit', color: 'var(--text)',
  background: '#fff', outline: 'none',
  transition: 'border-color .15s, box-shadow .15s',
  boxSizing: 'border-box',
}

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const codeRef    = useRef(null)
  const senhaRef   = useRef(null)

  const [form, setForm]               = useState({ codigo: '', senha: '' })
  const [remember, setRemember]       = useState(true)
  const [loading, setLoading]         = useState(false)
  const [autoLogging, setAutoLogging] = useState(false)
  const [temCredSalva, setTemCredSalva] = useState(false)
  const [versao, setVersao]           = useState('')

  useEffect(() => {
    fetch('/api/version', { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json()).then(d => setVersao(d.version)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.getCredentials().then(creds => {
      if (creds?.codigo && creds?.senha) {
        setTemCredSalva(true)
        setAutoLogging(true)
        doLogin({ codigo: creds.codigo, senha: creds.senha }, true)
      }
    }).catch(() => {})
  }, [])

  const doLogin = async (payload, isAuto = false) => {
    setLoading(true)
    try {
      await login(payload)
      if (isElectron && !isAuto && remember && payload.codigo) {
        window.electronAPI.setCredentials({ codigo: payload.codigo, senha: payload.senha }).catch(() => {})
      }
      navigate('/')
    } catch (err) {
      if (isAuto) {
        window.electronAPI?.clearCredentials().catch(() => {})
        setTemCredSalva(false)
        setAutoLogging(false)
      } else {
        if (!err.response) {
          toast.error('Servidor indisponível. Aguarde e tente novamente.')
        } else {
          toast.error(err.response.data?.detail || 'Código ou senha inválidos')
        }
      }
    } finally {
      setLoading(false)
      if (isAuto) setAutoLogging(false)
    }
  }

  const handleLogin = () => handleSubmit()

  const handleSubmit = async e => {
    e?.preventDefault()
    if (!form.codigo || !form.senha) return
    await doLogin({ codigo: form.codigo, senha: form.senha })
  }

  const handleTrocarUsuario = () => {
    window.electronAPI?.clearCredentials().catch(() => {})
    setTemCredSalva(false)
    setForm({ codigo: '', senha: '' })
    setTimeout(() => codeRef.current?.focus(), 50)
  }

  const onFocus = e => { e.target.style.borderColor = 'var(--module-projetos)'; e.target.style.boxShadow = '0 0 0 3px rgba(93,202,165,.15)' }
  const onBlur  = e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── Painel esquerdo (branding) ── */}
      <div style={{
        flex: '0 0 56%',
        background: 'linear-gradient(145deg, #060F2E 0%, #0A1C4E 45%, #0D2461 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '48px 56px', position: 'relative', overflow: 'hidden',
      }}>
        {[[500,500,-150,-150],[350,350,-80,-80],[420,420,-160,-160],[620,620,-260,-260]].map(([w,h,a,b], i) => (
          <div key={i} style={{
            position: 'absolute', width: w, height: h, borderRadius: '50%',
            border: `1px solid rgba(0,163,220,${[.13,.08,.10,.05][i]})`,
            ...(i < 2 ? { top: a, right: b } : { bottom: a, left: b }),
            pointerEvents: 'none',
          }} />
        ))}

        <div style={{ width: 84, height: 84, marginBottom: 22 }}>
          <img src={logo} alt="E Mais" style={{ width: 84, height: 84, display: 'block', borderRadius: '50%', objectFit: 'cover' }} />
        </div>
        <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 8, textAlign: 'center', letterSpacing: '-.4px' }}>
          E Mais Consultoria
        </div>
        <div style={{ color: 'rgba(255,255,255,.48)', fontSize: 13, textAlign: 'center', marginBottom: 52, lineHeight: 1.6 }}>
          Sistema de Gestão de Projetos
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, alignSelf: 'stretch', maxWidth: 300 }}>
          {['Gestão completa de projetos e fases', 'Acompanhamento de tarefas em tempo real', 'Relatórios, gráficos e burndown'].map((txt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,.60)', fontSize: 13 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00A3DC', flexShrink: 0 }} />
              {txt}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ color: 'rgba(255,255,255,.18)', fontSize: 11 }}>E Mais Consultoria © {new Date().getFullYear()}</div>
        </div>
      </div>

      {/* ── Painel direito (formulário) ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', padding: '48px 40px' }}>

        {autoLogging ? (
          <div style={CARD_STYLE}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Entrando automaticamente...</div>
              <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>

        ) : (
          <div style={CARD_STYLE}>

            {/* ── Logo ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
              <img src={eIcon} style={{ width: 52, height: 52, borderRadius: 14, marginBottom: 12 }} alt="E Mais" />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0A1C4E', marginBottom: 2 }}>E Mais Consultoria</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sistema de Gestão</div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Código */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '.03em' }}>
                  Código de acesso
                </label>
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="000"
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                  onKeyDown={e => e.key === 'Enter' && senhaRef.current?.focus()}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  style={{ ...INPUT_BASE, fontSize: 22, fontWeight: 600, textAlign: 'center', letterSpacing: 12 }}
                  autoFocus
                  autoComplete="off"
                />
              </div>

              {/* Senha */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>Senha</label>
                <input
                  ref={senhaRef}
                  type="password" placeholder="••••••••" value={form.senha}
                  onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  onFocus={onFocus} onBlur={onBlur}
                  style={{ ...INPUT_BASE, fontSize: 13 }}
                  autoComplete="current-password"
                />
              </div>

              {/* Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                />
                <label htmlFor="remember" style={{ fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
                  Lembrar minhas credenciais neste computador
                </label>
              </div>

              <button
                type="submit"
                disabled={loading || !form.codigo || !form.senha}
                style={{
                  width: '100%', padding: '11px', border: 'none', borderRadius: 8,
                  background: (loading || !form.codigo || !form.senha) ? 'rgba(0,150,207,.45)' : 'var(--brand)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: (loading || !form.codigo || !form.senha) ? 'default' : 'pointer',
                  transition: 'background .15s', letterSpacing: '.01em',
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            {/* Rodapé */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {isElectron && temCredSalva && (
                <button onClick={handleTrocarUsuario}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                  Trocar usuário
                </button>
              )}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                Esqueceu seu código ou senha? Fale com o administrador.
              </p>
              {versao && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: .5 }}>v{versao}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
