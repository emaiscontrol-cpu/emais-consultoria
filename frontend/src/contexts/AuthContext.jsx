import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp ? payload.exp * 1000 : null
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try { return JSON.parse(localStorage.getItem('usuario')) } catch { return null }
  })
  const [modulos, setModulos] = useState(() => {
    try { return JSON.parse(localStorage.getItem('modulos')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const refreshTimer = useRef(null)

  const agendarRefresh = (token) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const exp = getTokenExpiry(token)
    if (!exp) return
    // Renova 1 hora antes de expirar
    const delay = exp - Date.now() - 60 * 60 * 1000
    if (delay <= 0) return
    refreshTimer.current = setTimeout(async () => {
      try {
        const { data } = await authAPI.refresh()
        localStorage.setItem('token', data.access_token)
        if (data.modulos !== undefined) {
          setModulos(data.modulos)
          localStorage.setItem('modulos', JSON.stringify(data.modulos))
        }
        agendarRefresh(data.access_token)
      } catch { /* silencioso — interceptor redireciona para login se 401 */ }
    }, delay)
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      authAPI.me()
        .then(r => {
          setUsuario(r.data)
          localStorage.setItem('usuario', JSON.stringify(r.data))
          agendarRefresh(token)
        })
        .catch(err => {
          if (err.response?.status === 401 || err.response?.status === 403) {
            localStorage.removeItem('token')
            localStorage.removeItem('usuario')
            setUsuario(null)
          }
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
  }, [])

  const login = async (email, senha) => {
    const { data } = await authAPI.login(email, senha)
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('usuario', JSON.stringify(data.usuario))
    localStorage.setItem('modulos', JSON.stringify(data.modulos ?? null))
    setUsuario(data.usuario)
    setModulos(data.modulos ?? null)
    agendarRefresh(data.access_token)
    return data.usuario
  }

  const logout = () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    localStorage.removeItem('modulos')
    setUsuario(null)
    setModulos(null)
  }

  const atualizarUsuario = (dados) => {
    const novo = { ...usuario, ...dados }
    setUsuario(novo)
    localStorage.setItem('usuario', JSON.stringify(novo))
  }

  // modulos === null → usuário sem cliente_id (admin/consultor) → acesso irrestrito
  // modulos === objeto → respeitar os flags do cliente contratante
  const temModulo = (mod) => modulos === null ? true : Boolean(modulos[mod])

  return (
    <AuthContext.Provider value={{ usuario, modulos, temModulo, login, logout, loading, atualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
