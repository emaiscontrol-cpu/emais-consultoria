import { useState } from 'react'
import { X, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { iaAPI, geminiAPI } from '../services/api'
import { getAIContext } from '../utils/aiContext'
import toast from 'react-hot-toast'

const PANEL_W = 420  // largura de cada painel

// ── Renderizador de markdown simples ─────────────────────────────────────────
function Md({ text }) {
  if (!text) return null
  return (
    <div style={{ lineHeight: 1.75, fontSize: 13, color: 'var(--text)' }}>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 7 }} />
        if (line.startsWith('## ')) return <div key={i} style={{ fontWeight: 700, fontSize: 14, marginTop: 12, marginBottom: 3 }}>{inl(line.slice(3))}</div>
        if (line.startsWith('# '))  return <div key={i} style={{ fontWeight: 700, fontSize: 15, marginTop: 14, marginBottom: 4 }}>{inl(line.slice(2))}</div>
        if (/^[-*•]\s/.test(line))  return <div key={i} style={{ display:'flex', gap:6, marginBottom:3 }}><span style={{ color:'var(--brand)', flexShrink:0 }}>•</span><span>{inl(line.slice(2))}</span></div>
        if (/^\d+\.\s/.test(line))  return <div key={i} style={{ display:'flex', gap:6, marginBottom:3 }}><span style={{ color:'var(--brand)', fontWeight:600, minWidth:18, flexShrink:0 }}>{line.match(/^\d+/)[0]}.</span><span>{inl(line.replace(/^\d+\.\s/,''))}</span></div>
        return <div key={i} style={{ marginBottom:2 }}>{inl(line)}</div>
      })}
    </div>
  )
}
function inl(t) {
  return t.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((p,i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2,-2)}</strong>
    if (p.startsWith('*')  && p.endsWith('*'))  return <em key={i}>{p.slice(1,-1)}</em>
    return p
  })
}

// ── Painel genérico ───────────────────────────────────────────────────────────
function AIPanel({ right, zIndex, title, subtitle, accent, logo, callFn, onClose }) {
  const [pergunta,  setPergunta]  = useState('')
  const [resposta,  setResposta]  = useState('')
  const [modelo,    setModelo]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [showCtx,   setShowCtx]   = useState(false)

  const ctx     = getAIContext()
  const tela    = ctx?.tela    ?? ''
  const ctxStr  = ctx?.dados != null ? JSON.stringify(ctx.dados, null, 2) : (ctx?.contexto ?? '')

  const handleSend = async () => {
    setLoading(true); setResposta('')
    try {
      const { data } = await callFn(tela, ctxStr, pergunta)
      setResposta(data.resposta); setModelo(data.modelo)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao consultar IA')
    } finally { setLoading(false) }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, bottom: 0, right, width: PANEL_W,
      background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      zIndex, display: 'flex', flexDirection: 'column',
      boxShadow: '-6px 0 28px rgba(0,0,0,.18)',
      transition: 'right .25s ease',
    }}>
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0,
        background: `${accent}12`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>{logo}</span>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color: accent }}>{title}</div>
            {tela && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{tela}</div>}
            {subtitle && !tela && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{subtitle}</div>}
          </div>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, borderRadius:6 }}>
          <X size={17} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflow:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Contexto colapsável */}
        <div>
          <button onClick={() => setShowCtx(v => !v)} style={{
            display:'flex', alignItems:'center', gap:5, background:'transparent',
            border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:12, padding:0,
          }}>
            {showCtx ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
            Dados enviados para análise
          </button>
          {showCtx && (
            <pre style={{
              marginTop:6, padding:10, borderRadius:7,
              background:'var(--bg)', border:'1px solid var(--border)',
              fontSize:11, color:'var(--text-muted)', overflow:'auto',
              maxHeight:160, whiteSpace:'pre-wrap', wordBreak:'break-word',
            }}>
              {ctxStr ? (ctxStr.length > 2000 ? ctxStr.slice(0,2000)+'\n…(truncado)' : ctxStr) : '(nenhum dado registrado para esta tela)'}
            </pre>
          )}
        </div>

        {/* Campo de pergunta */}
        <div>
          <label style={{ fontSize:12, color:'var(--text-muted)', display:'block', marginBottom:6 }}>
            Pergunta <span style={{ fontWeight:400 }}>(opcional · Ctrl+Enter envia)</span>
          </label>
          <textarea
            value={pergunta} onChange={e => setPergunta(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && (e.ctrlKey||e.metaKey)) handleSend() }}
            placeholder="Ex: Quais os principais alertas? Qual mês teve melhor resultado?"
            rows={3}
            style={{
              width:'100%', resize:'vertical', boxSizing:'border-box',
              padding:'9px 12px', borderRadius:8, border:'1px solid var(--border)',
              background:'var(--bg)', color:'var(--text)', fontSize:13, fontFamily:'inherit',
            }}
          />
        </div>

        {/* Botão enviar */}
        <button onClick={handleSend} disabled={loading} style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:7,
          padding:'10px 0', borderRadius:8, border:'none',
          background: loading ? 'var(--border)' : accent,
          color:'#fff', fontSize:14, fontWeight:600,
          cursor: loading ? 'not-allowed' : 'pointer', transition:'opacity .15s',
        }}>
          {loading ? <><Loader2 size={15} className="ai-spin"/>Analisando...</> : <><Send size={14}/>Analisar</>}
        </button>

        {/* Resposta */}
        {resposta && (
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontWeight:600, color: accent }}>Resposta</span>
              {modelo && <span style={{ fontSize:10 }}>{modelo.replace('claude-','').replace(/-\d{8,}/,'').replace('gemini-','Gemini ')}</span>}
            </div>
            <Md text={resposta} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding:'8px 20px', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--text-muted)', textAlign:'center', flexShrink:0 }}>
        {subtitle}
      </div>
    </div>
  )
}

// ── Botão flutuante ───────────────────────────────────────────────────────────
function FloatBtn({ bottom, label, accent, onClick, active }) {
  return (
    <button onClick={onClick} title={label} style={{
      position:'fixed', bottom, right:28, zIndex:1050,
      width:52, height:52, borderRadius:'50%', border:'none', cursor:'pointer',
      background: active ? accent : `${accent}22`,
      color: active ? '#fff' : accent,
      fontSize:22, display:'flex', alignItems:'center', justifyContent:'center',
      boxShadow: active ? `0 4px 18px ${accent}66` : '0 2px 10px rgba(0,0,0,.18)',
      transition:'background .2s, color .2s, box-shadow .2s',
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = accent; e.currentTarget.style.color='#fff' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = `${accent}22`; e.currentTarget.style.color = accent } }}
    >
      {label}
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FloatingAI() {
  const [claudeOpen,  setClaudeOpen]  = useState(false)
  const [geminiOpen,  setGeminiOpen]  = useState(false)

  // Quando os dois estão abertos, o painel do Gemini desloca para a esquerda
  const geminiRight  = claudeOpen ? PANEL_W + 8 : 0
  const claudeZIndex = 1102
  const geminiZIndex = claudeOpen ? 1101 : 1102

  return (
    <>
      {/* Overlay clica para fechar tudo */}
      {(claudeOpen || geminiOpen) && (
        <div onClick={() => { setClaudeOpen(false); setGeminiOpen(false) }} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.3)',
          zIndex:1099, backdropFilter:'blur(1px)',
        }}/>
      )}

      {/* Botões flutuantes */}
      <FloatBtn bottom={28} label="✦" accent="#7c3aed" active={claudeOpen}  onClick={() => setClaudeOpen(v => !v)} />
      <FloatBtn bottom={92} label="◆" accent="#0ea5e9" active={geminiOpen}  onClick={() => setGeminiOpen(v => !v)} />

      {/* Painel Claude */}
      {claudeOpen && (
        <AIPanel
          right={0}
          zIndex={claudeZIndex}
          title="Claude"
          subtitle="Powered by Anthropic"
          accent="#7c3aed"
          logo="✦"
          callFn={(t,c,p) => iaAPI.analisar(t, c, p)}
          onClose={() => setClaudeOpen(false)}
        />
      )}

      {/* Painel Gemini */}
      {geminiOpen && (
        <AIPanel
          right={geminiRight}
          zIndex={geminiZIndex}
          title="Gemini"
          subtitle="Powered by Google AI"
          accent="#0ea5e9"
          logo="◆"
          callFn={(t,c,p) => geminiAPI.analisar(t, c, p)}
          onClose={() => setGeminiOpen(false)}
        />
      )}

      <style>{`
        @keyframes ai-spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        .ai-spin { animation: ai-spin 1s linear infinite }
      `}</style>
    </>
  )
}
