import logo from '../assets/logo.jpeg'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'

const CARD_STYLE = {
  width: 320,
  background: '#fff',
  borderRadius: 16,
  padding: '32px 28px',
  boxShadow: '0 4px 24px rgba(0,0,0,.10)',
}

const CODE_INPUT_STYLE = {
  width: '100%', padding: '12px 0', border: 'none', borderBottom: '2.5px solid #D1D5DB',
  borderRadius: 0, fontSize: 22, fontWeight: 600, textAlign: 'center',
  letterSpacing: 12, fontFamily: 'inherit', color: '#111827',
  background: 'transparent', outline: 'none', transition: 'border-color .15s',
  boxSizing: 'border-box',
}

const PASS_INPUT_STYLE = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #D1D5DB',
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', color: '#111827',
  background: '#fff', outline: 'none', transition: 'border-color .15s, box-shadow .15s',
  boxSizing: 'border-box',
}

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const codeRef    = useRef(null)

  const [form, setForm]               = useState({ codigo: '', senha: '' })
  const [loading, setLoading]         = useState(false)
  const [autoLogging, setAutoLogging] = useState(false)
  const [temCredSalva, setTemCredSalva] = useState(false)
  const [versao, setVersao]           = useState('')
  const [telaReset, setTelaReset]     = useState(false)
  const [emailReset, setEmailReset]   = useState('')
  const [enviando, setEnviando]       = useState(false)
  const [enviado, setEnviado]         = useState(false)

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
      if (isElectron && !isAuto && payload.codigo) {
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

  const handleEnviarReset = async e => {
    e.preventDefault()
    setEnviando(true)
    try {
      await authAPI.esqueciSenha(emailReset)
      setEnviado(true)
    } catch {
      toast.error('Erro ao enviar solicitação.')
    } finally { setEnviando(false) }
  }

  const onCodeFocus = e => { e.target.style.borderBottomColor = '#0096CF' }
  const onCodeBlur  = e => { e.target.style.borderBottomColor = '#D1D5DB' }
  const onPassFocus = e => { e.target.style.borderColor = '#0096CF'; e.target.style.boxShadow = '0 0 0 3px rgba(0,150,207,.12)' }
  const onPassBlur  = e => { e.target.style.borderColor = '#D1D5DB'; e.target.style.boxShadow = 'none' }

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
          {versao && <div style={{ color: 'rgba(255,255,255,.25)', fontSize: 10, fontWeight: 600, letterSpacing: '.05em' }}>v{versao}</div>}
        </div>
      </div>

      {/* ── Painel direito (formulário) ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F6F9', padding: '48px 40px' }}>

        {autoLogging ? (
          <div style={CARD_STYLE}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 16 }}>Entrando automaticamente...</div>
              <div style={{ width: 32, height: 32, border: '3px solid #E5E7EB', borderTopColor: '#0096CF', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto' }} />
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>

        ) : telaReset ? (
          <div style={CARD_STYLE}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0A1C4E', marginBottom: 6, letterSpacing: '-.4px' }}>Esqueci minha senha</div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
                {enviado ? 'Solicitação enviada! O administrador foi notificado.' : 'Informe seu e-mail e o administrador será avisado.'}
              </div>
            </div>
            {!enviado && (
              <form onSubmit={handleEnviarReset}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>E-mail</label>
                  <input type="email" placeholder="seu@email.com.br" value={emailReset} required
                    onChange={e => setEmailReset(e.target.value)} onFocus={onPassFocus} onBlur={onPassBlur} style={PASS_INPUT_STYLE} />
                </div>
                <button type="submit" disabled={enviando} style={{
                  width: '100%', padding: '11px', border: 'none', borderRadius: 8,
                  background: enviando ? '#7CBFDA' : '#0096CF', color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: enviando ? 'default' : 'pointer', transition: 'background .15s',
                }}>
                  {enviando ? 'Enviando...' : 'Solicitar redefinição'}
                </button>
              </form>
            )}
            <button onClick={() => { setTelaReset(false); setEnviado(false); setEmailReset('') }}
              style={{ marginTop: 16, background: 'none', border: 'none', color: '#0096CF', fontSize: 13, cursor: 'pointer', padding: 0 }}>
              ← Voltar ao login
            </button>
          </div>

        ) : (
          <div style={CARD_STYLE}>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0A1C4E', marginBottom: 4, letterSpacing: '-.4px' }}>Bem-vindo</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>Acesse sua conta para continuar</div>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10, letterSpacing: '.03em' }}>
                  Código de acesso
                </label>
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="···"
                  value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                  onFocus={onCodeFocus}
                  onBlur={onCodeBlur}
                  style={CODE_INPUT_STYLE}
                  autoFocus
                  autoComplete="off"
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>Senha</label>
                <input type="password" placeholder="••••••••" value={form.senha}
                  onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                  onFocus={onPassFocus} onBlur={onPassBlur}
                  style={PASS_INPUT_STYLE} autoComplete="current-password" />
              </div>

              <button
                type="submit"
                disabled={loading || !form.codigo || !form.senha}
                onMouseEnter={e => { if (!loading && form.codigo && form.senha) e.currentTarget.style.background = '#007BAD' }}
                onMouseLeave={e => { if (!loading && form.codigo && form.senha) e.currentTarget.style.background = '#0096CF' }}
                style={{
                  width: '100%', padding: '11px', border: 'none', borderRadius: 8,
                  background: (loading || !form.codigo || !form.senha) ? '#7CBFDA' : '#0096CF',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: (loading || !form.codigo || !form.senha) ? 'default' : 'pointer',
                  transition: 'background .15s', letterSpacing: '.01em',
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {isElectron && temCredSalva && (
                <button onClick={handleTrocarUsuario}
                  style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                  Trocar usuário
                </button>
              )}
              <button onClick={() => setTelaReset(true)}
                style={{ background: 'none', border: 'none', color: '#0096CF', fontSize: 12, cursor: 'pointer', padding: 0 }}>
                Esqueci minha senha
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
