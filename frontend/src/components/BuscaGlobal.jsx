import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, FolderOpen, CheckSquare, Users, MessageSquare } from 'lucide-react'
import { buscaAPI } from '../services/api'

const ICONE = {
  projeto:    <FolderOpen size={14} color="var(--brand)" />,
  tarefa:     <CheckSquare size={14} color="var(--amber)" />,
  cliente:    <Users size={14} color="var(--green)" />,
  comentario: <MessageSquare size={14} color="var(--text-3)" />,
}

const LABEL = {
  projeto: 'Projetos', tarefa: 'Tarefas', cliente: 'Clientes', comentario: 'Comentários',
}

export default function BuscaGlobal({ onClose }) {
  const navigate  = useNavigate()
  const inputRef  = useRef(null)
  const [q,       setQ]       = useState('')
  const [dados,   setDados]   = useState(null)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const buscar = useCallback(async (termo) => {
    if (termo.length < 2) { setDados(null); return }
    setLoading(true)
    try {
      const { data } = await buscaAPI.buscar(termo)
      setDados(data)
    } catch { setDados(null) }
    finally { setLoading(false) }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQ(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => buscar(val), 300)
  }

  const irPara = (url) => {
    onClose()
    navigate(url)
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const grupos = dados
    ? ['projeto', 'tarefa', 'cliente', 'comentario']
        .map(tipo => ({ tipo, itens: dados[tipo + 's'] || [] }))
        .filter(g => g.itens.length > 0)
    : []

  const total = grupos.reduce((acc, g) => acc + g.itens.length, 0)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '10vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--card)', borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 24px 64px rgba(0,0,0,.5)',
          overflow: 'hidden',
        }}
      >
        {/* Campo de busca */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={18} color="var(--text-3)" />
          <input
            ref={inputRef}
            value={q}
            onChange={handleChange}
            placeholder="Buscar projetos, tarefas, clientes..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text)',
            }}
          />
          {loading && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Buscando...</span>}
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Resultados */}
        <div style={{ maxHeight: 380, overflowY: 'auto' }}>
          {q.length < 2 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Digite pelo menos 2 caracteres para buscar
            </div>
          )}

          {q.length >= 2 && !loading && total === 0 && (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              Nenhum resultado para "{q}"
            </div>
          )}

          {grupos.map(({ tipo, itens }) => (
            <div key={tipo}>
              <div style={{
                padding: '8px 16px 4px',
                fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
                textTransform: 'uppercase', color: 'var(--text-3)',
                borderTop: '1px solid var(--border)',
              }}>
                {LABEL[tipo]}
              </div>
              {itens.map(item => (
                <button
                  key={`${tipo}-${item.id}`}
                  onClick={() => irPara(item.url)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 16px', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                    borderBottom: '0.5px solid var(--border)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ flexShrink: 0 }}>{ICONE[tipo]}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.titulo}
                    </div>
                    {item.subtitulo && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.subtitulo}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Ctrl+K para abrir · Esc para fechar</span>
          {total > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{total} resultado(s)</span>}
        </div>
      </div>
    </div>
  )
}
