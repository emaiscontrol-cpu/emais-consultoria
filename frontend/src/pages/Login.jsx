// PADRÃO DO SISTEMA: Em formulários com múltiplos campos, Enter avança para o próximo campo.
// No último campo, Enter submete. Usar onKeyDown + useRef. Ver DESIGN_SYSTEM.md.
import logo from '../assets/logo.jpeg'
import eIcon from '../assets/icon.png'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

const isElectron = typeof window !== 'undefined' && typeof window.electronAPI !== 'undefined'

const CARD_STYLE = {
  width: 340,
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

function SearchableSelect({ options, value, onChange, placeholder, disabled, onFocus, onBlur }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const filtered = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOpt = options.find(o => o.id === value)
  const displayValue = isOpen ? search : (selectedOpt ? selectedOpt.label : '')

  const handleSelect = (opt) => {
    onChange(opt.id)
    setIsOpen(false)
    setSearch('')
    setActiveIndex(-1)
  }

  const handleBlur = (e) => {
    setTimeout(() => {
      setIsOpen(false)
      // Se tiver termo pesquisado e não estiver selecionado nada ainda
      if (!value && search) {
        const exactMatch = filtered.find(opt => opt.label.toLowerCase() === search.toLowerCase())
        if (exactMatch) {
          handleSelect(exactMatch)
        } else if (filtered.length > 0) {
          handleSelect(filtered[0])
        }
      }
      if (onBlur) onBlur(e)
    }, 200)
  }

  const handleKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
      } else {
        setActiveIndex(prev => (prev + 1) % filtered.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (isOpen) {
        setActiveIndex(prev => (prev - 1 + filtered.length) % filtered.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (isOpen && activeIndex >= 0 && activeIndex < filtered.length) {
        handleSelect(filtered[activeIndex])
      } else if (!isOpen) {
        setIsOpen(true)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex]
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [activeIndex])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={displayValue}
          onChange={e => {
            if (!isOpen) setIsOpen(true)
            setSearch(e.target.value)
            setActiveIndex(0)
          }}
          onFocus={(e) => {
            setIsOpen(true)
            setSearch('')
            if (onFocus) onFocus(e)
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          style={{
            ...INPUT_BASE,
            paddingRight: '30px',
            borderColor: isOpen ? 'var(--brand)' : 'var(--border)',
            boxShadow: isOpen ? '0 0 0 3px rgba(0,150,207,.15)' : 'none',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />
        <span 
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'pointer',
            borderTop: isOpen ? '0' : '5px solid #999',
            borderBottom: isOpen ? '5px solid #999' : '0',
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            display: 'inline-block',
            width: '0',
            height: '0',
          }}
        />
      </div>
      {isOpen && !disabled && (
        <div 
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            maxHeight: '180px',
            overflowY: 'auto',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            marginTop: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,.08)',
            zIndex: 1000,
            boxSizing: 'border-box',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
              Nenhuma empresa encontrada
            </div>
          ) : (
            filtered.map((opt, idx) => {
              const isActive = idx === activeIndex
              const isSelected = opt.id === value
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  style={{
                    padding: '8px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                    background: isSelected ? 'var(--brand-light, #e0f2fe)' : (isActive ? '#f3f4f6' : '#fff'),
                    color: isSelected ? 'var(--text)' : 'var(--text)',
                    fontWeight: isSelected ? '600' : 'normal',
                  }}
                >
                  {opt.label}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const codeRef    = useRef(null)
  const senhaRef   = useRef(null)

  const [form, setForm]                 = useState({ codigo: '', senha: '' })
  const [empresas, setEmpresas]         = useState([])
  const [empresaId, setEmpresaId]       = useState('')
  const [isInterno, setIsInterno]       = useState(false)
  const [remember, setRemember]       = useState(true)
  const [loading, setLoading]         = useState(false)
  const [temCredSalva, setTemCredSalva] = useState(false)
  const [versao, setVersao]           = useState('')

  useEffect(() => {
    fetch('/api/version', { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json()).then(d => setVersao(d.version)).catch(() => {})

    authAPI.empresasPublico()
      .then(r => setEmpresas(r.data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const loadSaved = async () => {
      let savedEmpresaId = localStorage.getItem('saved_empresa_id') || ''
      let savedCodigo    = localStorage.getItem('saved_codigo') || ''
      let savedSenha     = ''

      if (isElectron && window.electronAPI) {
        try {
          const creds = await window.electronAPI.getCredentials()
          if (creds) {
            savedEmpresaId = creds.empresa_id || savedEmpresaId
            savedCodigo = creds.codigo || savedCodigo
            savedSenha = creds.senha || ''
          }
        } catch {}
      }

      const savedRemember = localStorage.getItem('remember_credentials')
      if (savedRemember === 'true' || (isElectron && savedCodigo)) {
        if (savedCodigo) {
          setForm({ codigo: savedCodigo, senha: savedSenha })
          if (savedEmpresaId === 'interno') {
            setIsInterno(true)
            setEmpresaId('interno')
          } else if (savedEmpresaId) {
            setIsInterno(false)
            setEmpresaId(Number(savedEmpresaId))
          }
          setRemember(true)
          setTemCredSalva(true)
          setTimeout(() => senhaRef.current?.focus(), 150)
        }
      }
    }
    loadSaved()
  }, [])

  const doLogin = async (payload) => {
    setLoading(true)
    try {
      await login(payload)
      if (remember && payload.codigo) {
        localStorage.setItem('saved_codigo', payload.codigo)
        localStorage.setItem('saved_empresa_id', isInterno ? 'interno' : String(empresaId))
        localStorage.setItem('remember_credentials', 'true')
        window.electronAPI?.setCredentials({
          codigo: payload.codigo,
          senha: payload.senha,
          empresa_id: isInterno ? 'interno' : String(empresaId)
        }).catch(() => {})
      } else {
        localStorage.removeItem('saved_codigo')
        localStorage.removeItem('saved_empresa_id')
        localStorage.removeItem('remember_credentials')
        window.electronAPI?.clearCredentials().catch(() => {})
      }
      navigate('/')
    } catch (err) {
      if (!err.response) {
        toast.error('Servidor indisponível. Aguarde e tente novamente.')
      } else {
        toast.error(err.response.data?.detail || 'Código ou senha inválidos')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = () => handleSubmit()

  const handleSubmit = async e => {
    e?.preventDefault()
    if (!isInterno && !empresaId) {
      toast.error('Por favor, selecione uma empresa')
      return
    }
    const codigoVal = codeRef.current?.value || form.codigo
    const senhaVal = senhaRef.current?.value || form.senha

    if (!codigoVal) {
      toast.error('Por favor, informe o código de acesso')
      return
    }
    if (!senhaVal) {
      toast.error('Por favor, informe a senha')
      return
    }
    await doLogin({
      codigo: codigoVal,
      senha: senhaVal,
      cliente_id: isInterno ? null : empresaId,
      is_interno: isInterno
    })
  }

  const handleTrocarUsuario = () => {
    localStorage.removeItem('saved_codigo')
    localStorage.removeItem('saved_empresa_id')
    localStorage.removeItem('remember_credentials')
    window.electronAPI?.clearCredentials().catch(() => {})
    setTemCredSalva(false)
    setRemember(true)
    setForm({ codigo: '', senha: '' })
    setEmpresaId('')
    setIsInterno(false)
    setTimeout(() => codeRef.current?.focus(), 50)
  }

  const onFocus = e => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,150,207,.15)' }
  const onBlur  = e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }

  // Combina opções de empresas
  const empresaOptions = [
    { id: 'interno', label: 'Equipe E Mais (interno)' },
    ...empresas.map(e => ({ id: e.id, label: e.razao_social }))
  ]

  const handleEmpresaChange = (val) => {
    setEmpresaId(val)
    if (val === 'interno') {
      setIsInterno(true)
    } else {
      setIsInterno(false)
    }
    // Foca automaticamente no código após escolher a empresa
    setTimeout(() => codeRef.current?.focus(), 100)
  }

  const isButtonDisabled = loading

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

        <div style={CARD_STYLE}>

            {/* ── Logo ── */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24 }}>
              <img src={eIcon} style={{ width: 52, height: 52, borderRadius: 14, marginBottom: 12 }} alt="E Mais" />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0A1C4E', marginBottom: 2 }}>E Mais Consultoria</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sistema de Gestão</div>
            </div>

            {/* Empresa */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '.02em' }}>
                Empresa / Cliente
              </label>
              <SearchableSelect
                options={empresaOptions}
                value={empresaId}
                onChange={handleEmpresaChange}
                placeholder="Selecione ou busque a empresa..."
                onFocus={onFocus}
                onBlur={onBlur}
                disabled={loading}
              />
            </div>

            <form onSubmit={handleSubmit}>

              {/* Código */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6, letterSpacing: '.02em' }}>
                  Código de acesso
                </label>
                <input
                  ref={codeRef}
                  type="text"
                  name="username"
                  autoComplete="username"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="000"
                  value={form.codigo}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 3)
                    setForm(f => ({ ...f, codigo: val }))
                    const currentSenha = senhaRef.current?.value || form.senha
                    if (val.length === 3 && !currentSenha) {
                      setTimeout(() => senhaRef.current?.focus(), 50)
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const currentSenha = senhaRef.current?.value || form.senha
                      if (currentSenha) {
                        handleSubmit(e)
                      } else {
                        senhaRef.current?.focus()
                      }
                    }
                  }}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  disabled={loading}
                  style={{ ...INPUT_BASE, fontSize: 20, fontWeight: 800, textAlign: 'center', letterSpacing: 10 }}
                />
              </div>

              {/* Senha */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>Senha</label>
                <input
                  ref={senhaRef}
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={form.senha}
                  onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  onFocus={onFocus} onBlur={onBlur}
                  disabled={loading}
                  style={{ ...INPUT_BASE, fontSize: 13 }}
                />
              </div>

              {/* Checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="remember" style={{ fontSize: 11.5, color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none' }}>
                  Lembrar minhas credenciais
                </label>
              </div>

              <button
                type="submit"
                disabled={isButtonDisabled}
                style={{
                  width: '100%', padding: '11px', border: 'none', borderRadius: 8,
                  background: isButtonDisabled ? 'rgba(0,150,207,.45)' : 'var(--brand)',
                  color: '#fff', fontSize: 13.5, fontWeight: 700,
                  cursor: isButtonDisabled ? 'default' : 'pointer',
                  transition: 'background .15s', letterSpacing: '.01em',
                }}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            {/* Rodapé */}
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              {temCredSalva && (
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
      </div>
    </div>
  )
}
