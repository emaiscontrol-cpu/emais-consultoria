import logo from '../assets/logo.png'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const INPUT_STYLE = {
  width:'100%', padding:'10px 12px', border:'1.5px solid #D1D5DB',
  borderRadius:8, fontSize:13, fontFamily:'inherit', color:'#111827',
  background:'#fff', outline:'none', transition:'border-color .15s, box-shadow .15s',
}

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm] = useState({ email: '', senha: '' })
  const [loading, setLoading] = useState(false)
  const [versao, setVersao] = useState('')

  useEffect(() => {
    fetch('/api/version', { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json()).then(d => setVersao(d.version)).catch(() => {})
  }, [])

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.senha)
      navigate('/')
    } catch {
      toast.error('Email ou senha inválidos')
    } finally {
      setLoading(false)
    }
  }

  const onFocus = e => { e.target.style.borderColor='#0096CF'; e.target.style.boxShadow='0 0 0 3px rgba(0,150,207,.12)' }
  const onBlur  = e => { e.target.style.borderColor='#D1D5DB'; e.target.style.boxShadow='none' }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── Left branding panel ── */}
      <div style={{
        flex:'0 0 56%',
        background:'linear-gradient(145deg, #060F2E 0%, #0A1C4E 45%, #0D2461 100%)',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        padding:'48px 56px', position:'relative', overflow:'hidden',
      }}>
        {/* decorative rings */}
        {[[500,500,-150,-150,'right'],[350,350,-80,-80,'right'],[420,420,-160,-160,'bottom','left'],[620,620,-260,-260,'bottom','left']].map(([w,h,...pos], i) => (
          <div key={i} style={{
            position:'absolute', width:w, height:h, borderRadius:'50%',
            border:`1px solid rgba(0,163,220,${[.13,.08,.10,.05][i]})`,
            ...(i < 2 ? { top: pos[0], right: pos[1] } : { bottom: pos[0], left: pos[1] }),
            pointerEvents:'none',
          }} />
        ))}

        {/* Company logo mark */}
        <div style={{ width:84, height:84, overflow:'hidden', borderRadius:16, marginBottom:22, background:'rgba(255,255,255,0.95)' }}>
          <img src={logo} alt="E Mais" style={{ width:309, height:'auto', display:'block', marginLeft:-113 }} />
        </div>

        <div style={{ color:'#fff', fontSize:26, fontWeight:800, marginBottom:8, textAlign:'center', letterSpacing:'-.4px' }}>
          E Mais Consultoria
        </div>
        <div style={{ color:'rgba(255,255,255,.48)', fontSize:13, textAlign:'center', marginBottom:52, lineHeight:1.6 }}>
          Sistema de Gestão de Projetos
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:15, alignSelf:'stretch', maxWidth:300 }}>
          {[
            'Gestão completa de projetos e fases',
            'Acompanhamento de tarefas em tempo real',
            'Relatórios, gráficos e burndown',
          ].map((txt, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, color:'rgba(255,255,255,.60)', fontSize:13 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#00A3DC', flexShrink:0 }} />
              {txt}
            </div>
          ))}
        </div>

        <div style={{ position:'absolute', bottom:20, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
          <div style={{ color:'rgba(255,255,255,.18)', fontSize:11 }}>
            E Mais Consultoria © {new Date().getFullYear()}
          </div>
          {versao && (
            <div style={{ color:'rgba(255,255,255,.25)', fontSize:10, fontWeight:600, letterSpacing:'.05em' }}>
              v{versao}
            </div>
          )}
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        background:'#F4F6F9', padding:'48px 40px',
      }}>
        <div style={{ width:'100%', maxWidth:360 }}>
          <div style={{ marginBottom:30 }}>
            <div style={{ fontSize:22, fontWeight:800, color:'#0A1C4E', marginBottom:6, letterSpacing:'-.4px' }}>
              Bem-vindo
            </div>
            <div style={{ fontSize:13, color:'#6B7280' }}>Acesse sua conta para continuar</div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:5 }}>Email</label>
              <input
                type="email" placeholder="seu@email.com.br"
                value={form.email} required
                onChange={e => setForm(f=>({...f, email:e.target.value}))}
                onFocus={onFocus} onBlur={onBlur}
                style={INPUT_STYLE}
              />
            </div>
            <div style={{ marginBottom:26 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:5 }}>Senha</label>
              <input
                type="password" placeholder="••••••••"
                value={form.senha} required
                onChange={e => setForm(f=>({...f, senha:e.target.value}))}
                onFocus={onFocus} onBlur={onBlur}
                style={INPUT_STYLE}
              />
            </div>
            <button
              type="submit" disabled={loading}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background='#007BAD' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background='#0096CF' }}
              style={{
                width:'100%', padding:'11px', border:'none', borderRadius:8,
                background: loading ? '#7CBFDA' : '#0096CF',
                color:'#fff', fontSize:14, fontWeight:700,
                cursor: loading ? 'default' : 'pointer', transition:'background .15s',
                letterSpacing:'.01em',
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
