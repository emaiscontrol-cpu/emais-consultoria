import { useState } from 'react'
import { Sparkles, X, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { iaAPI } from '../services/api'
import toast from 'react-hot-toast'

// Converte markdown simples para JSX (bold, listas, quebras)
function MarkdownText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  return (
    <div style={{ lineHeight: 1.7, fontSize: 13, color: 'var(--text)' }}>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 8 }} />
        // Heading ##
        if (line.startsWith('## '))
          return <div key={i} style={{ fontWeight: 700, fontSize: 14, marginTop: 12, marginBottom: 4, color: 'var(--brand)' }}>{line.slice(3)}</div>
        if (line.startsWith('# '))
          return <div key={i} style={{ fontWeight: 700, fontSize: 15, marginTop: 14, marginBottom: 4 }}>{line.slice(2)}</div>
        // bullet - ou *
        if (/^[-*•]\s/.test(line))
          return (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: 'var(--brand)', flexShrink: 0, marginTop: 2 }}>•</span>
              <span>{formatInline(line.slice(2))}</span>
            </div>
          )
        // numbered list
        if (/^\d+\.\s/.test(line))
          return (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
              <span style={{ color: 'var(--brand)', flexShrink: 0, fontWeight: 600, minWidth: 18 }}>{line.match(/^\d+/)[0]}.</span>
              <span>{formatInline(line.replace(/^\d+\.\s/, ''))}</span>
            </div>
          )
        return <div key={i} style={{ marginBottom: 2 }}>{formatInline(line)}</div>
      })}
    </div>
  )
}

function formatInline(text) {
  // **bold** e *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*'))
      return <em key={i}>{p.slice(1, -1)}</em>
    return p
  })
}

// ─────────────────────────────────────────────────────────────────────────────
export default function AIButton({ titulo = '', dados = null, contextoExtra = '' }) {
  const [open,      setOpen]      = useState(false)
  const [pergunta,  setPergunta]  = useState('')
  const [resposta,  setResposta]  = useState('')
  const [modelo,    setModelo]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [showCtx,   setShowCtx]   = useState(false)

  const contexto = contextoExtra ||
    (dados ? JSON.stringify(dados, null, 2) : 'Nenhum dado disponível.')

  const handleAnalise = async () => {
    if (!pergunta.trim() && !dados && !contextoExtra) {
      toast.error('Nenhum dado para analisar nesta tela.')
      return
    }
    setLoading(true)
    setResposta('')
    try {
      const { data } = await iaAPI.analisar(titulo, contexto, pergunta)
      setResposta(data.resposta)
      setModelo(data.modelo)
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erro ao consultar a IA'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAnalise()
  }

  return (
    <>
      {/* ── Botão disparador ── */}
      <button
        onClick={() => setOpen(true)}
        title="Analisar com IA (Claude)"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8, border: '1px solid var(--brand)',
          background: 'transparent', color: 'var(--brand)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          transition: 'background .15s, color .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--brand)' }}
      >
        <Sparkles size={14} />
        Analisar com IA
      </button>

      {/* ── Drawer lateral ── */}
      {open && (
        <>
          {/* overlay */}
          <div onClick={() => setOpen(false)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)',
            zIndex: 1100, backdropFilter: 'blur(2px)',
          }} />

          {/* painel */}
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
            background: 'var(--surface)', borderLeft: '1px solid var(--border)',
            zIndex: 1101, display: 'flex', flexDirection: 'column',
            boxShadow: '-8px 0 32px rgba(0,0,0,.18)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Sparkles size={18} color="var(--brand)" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Análise com IA</div>
                  {titulo && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{titulo}</div>}
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, borderRadius: 6,
              }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Contexto (colapsável) */}
              <div>
                <button onClick={() => setShowCtx(v => !v)} style={{
                  display: 'flex', alignItems: 'center', gap: 5, background: 'transparent',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, padding: 0,
                }}>
                  {showCtx ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  Dados enviados para análise
                </button>
                {showCtx && (
                  <pre style={{
                    marginTop: 6, padding: 10, borderRadius: 7,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    fontSize: 11, color: 'var(--text-muted)', overflow: 'auto',
                    maxHeight: 160, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {contexto.length > 2000 ? contexto.slice(0, 2000) + '\n…(truncado)' : contexto}
                  </pre>
                )}
              </div>

              {/* Campo de pergunta */}
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Pergunta <span style={{ fontWeight: 400 }}>(opcional — Enter para enviar)</span>
                </label>
                <textarea
                  value={pergunta}
                  onChange={e => setPergunta(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex: Quais são os principais alertas? Qual mês teve melhor desempenho?"
                  rows={3}
                  style={{
                    width: '100%', resize: 'vertical', boxSizing: 'border-box',
                    padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)',
                    fontSize: 13, fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Botão analisar */}
              <button
                onClick={handleAnalise}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '10px 0', borderRadius: 8, border: 'none',
                  background: loading ? 'var(--border)' : 'var(--brand)',
                  color: '#fff', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity .15s',
                }}
              >
                {loading
                  ? <><Loader2 size={15} className="spin" /> Analisando...</>
                  : <><Send size={14} /> Analisar</>
                }
              </button>

              {/* Resposta */}
              {resposta && (
                <div style={{
                  borderTop: '1px solid var(--border)', paddingTop: 14,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>Resposta da IA</span>
                    {modelo && <span>{modelo.replace('claude-', '').replace(/-\d{8,}/, '')}</span>}
                  </div>
                  <MarkdownText text={resposta} />
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '10px 20px', borderTop: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', flexShrink: 0,
            }}>
              Powered by Claude · Anthropic
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite }
      `}</style>
    </>
  )
}
