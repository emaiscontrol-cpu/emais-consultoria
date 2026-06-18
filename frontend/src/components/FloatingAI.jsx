import { useState } from 'react'
import { X, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { iaAPI, geminiAPI, openrouterAPI } from '../services/api'
import { getAIContext } from '../utils/aiContext'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const PANEL_W = 420

const OR_MODELS = [
  { id: 'openai/gpt-4o',                          label: 'GPT-4o',        tag: null   },
  { id: 'anthropic/claude-sonnet-4-5',             label: 'Claude 4.5',    tag: null   },
  { id: 'google/gemini-2.0-flash-001',             label: 'Gemini Flash',  tag: null   },
  { id: 'meta-llama/llama-3.3-70b-instruct',       label: 'Llama 3.3',     tag: null   },
  { id: 'deepseek/deepseek-chat',                  label: 'DeepSeek',      tag: null   },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct',  label: 'Nemotron 70B',  tag: 'free' },
]

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
function AIPanel({ zIndex, title, subtitle, accent, logo, callFn, onClose, models }) {
  const [pergunta,   setPergunta]   = useState('')
  const [resposta,   setResposta]   = useState('')
  const [modeloResp, setModeloResp] = useState('')
  const [loading,    setLoading]    = useState(false)
  const [showCtx,    setShowCtx]    = useState(false)
  const [selModel,   setSelModel]   = useState(models?.[0]?.id ?? null)

  const ctx    = getAIContext()
  const tela   = ctx?.tela   ?? ''
  const ctxStr = ctx?.dados != null ? JSON.stringify(ctx.dados, null, 2) : (ctx?.contexto ?? '')

  const handleSend = async () => {
    setLoading(true); setResposta('')
    try {
      const { data } = await callFn(tela, ctxStr, pergunta, selModel)
      setResposta(data.resposta); setModeloResp(data.modelo)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao consultar IA')
    } finally { setLoading(false) }
  }

  const modelLabel = modeloResp
    ? (OR_MODELS.find(m => m.id === modeloResp)?.label ?? modeloResp.split('/').pop().replace(/-\d{8,}/g,''))
    : ''

  return (
    <div style={{
      position:'fixed', top:0, bottom:0, right:0, width:PANEL_W,
      background:'var(--surface)', borderLeft:'1px solid var(--border)',
      zIndex, display:'flex', flexDirection:'column',
      boxShadow:'-6px 0 28px rgba(0,0,0,.18)',
    }}>
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0,
        background:`${accent}12`,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span>{logo}</span>
          <div>
            <div style={{ fontWeight:700, fontSize:15, color:accent }}>{title}</div>
            {tela
              ? <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{tela}</div>
              : <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{subtitle}</div>
            }
          </div>
        </div>
        <button onClick={onClose} style={{ background:'transparent', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4, borderRadius:6 }}>
          <X size={17} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflow:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>

        {/* Seletor de modelos — apenas OpenRouter */}
        {models && (
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:7 }}>Modelo</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {models.map(m => (
                <button key={m.id} onClick={() => setSelModel(m.id)} style={{
                  display:'flex', alignItems:'center', gap:4,
                  padding:'4px 10px', borderRadius:20, fontSize:11, cursor:'pointer',
                  border:`1px solid ${selModel === m.id ? accent : 'var(--border)'}`,
                  background: selModel === m.id ? `${accent}22` : 'transparent',
                  color: selModel === m.id ? accent : 'var(--text-muted)',
                  fontWeight: selModel === m.id ? 600 : 400,
                }}>
                  {m.label}
                  {m.tag === 'free' && (
                    <span style={{ fontSize:9, background:'#16a34a22', color:'#16a34a', padding:'1px 5px', borderRadius:4 }}>free</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

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
              {ctxStr
                ? (ctxStr.length > 2000 ? ctxStr.slice(0,2000)+'\n…(truncado)' : ctxStr)
                : '(nenhum dado registrado para esta tela)'}
            </pre>
          )}
        </div>

        {/* Pergunta */}
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
          cursor: loading ? 'not-allowed' : 'pointer',
        }}>
          {loading ? <><Loader2 size={15} className="ai-spin"/>Analisando...</> : <><Send size={14}/>Analisar</>}
        </button>

        {/* Resposta */}
        {resposta && (
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10, display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontWeight:600, color:accent }}>Resposta</span>
              {modelLabel && <span style={{ fontSize:10, color:'var(--text-muted)' }}>{modelLabel}</span>}
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

// ── Logos SVG oficiais ────────────────────────────────────────────────────────
// Anthropic — Simple Icons
function LogoClaude({ size = 22, color = '#7c3aed' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/>
    </svg>
  )
}

// Google Gemini — Simple Icons
function LogoGemini({ size = 22, color = '#1A73E8' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/>
    </svg>
  )
}

// OpenRouter — Simple Icons
function LogoOpenRouter({ size = 22, color = '#f59e0b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z"/>
    </svg>
  )
}

// ── Botão flutuante discreto ──────────────────────────────────────────────────
function FloatBtn({ bottom, logo, title, accent, onClick, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`float-ai-btn${active ? ' float-ai-active' : ''}`}
      style={{
        position:'fixed', bottom, right:20, zIndex:1050,
        width:38, height:38, borderRadius:'50%',
        border:`1.5px solid ${active ? accent : accent+'55'}`,
        cursor:'pointer',
        background: active ? accent : 'var(--surface)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow: active ? `0 2px 12px ${accent}55` : '0 1px 4px rgba(0,0,0,.1)',
        transition:'all .2s',
      }}
    >
      {logo}
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FloatingAI() {
  const { usuario } = useAuth()
  const [activePanel, setActivePanel] = useState(null)

  const isAdmin = usuario?.perfil === 'admin'

  // Permissões individuais (admin sempre tem acesso)
  const podeClaudeBtn = isAdmin || usuario?.ia_claude      === true
  const podeGemini    = isAdmin || usuario?.ia_gemini      === true
  const podeOR        = isAdmin || usuario?.ia_openrouter  === true

  const toggle = (name) => setActivePanel(p => p === name ? null : name)

  // Monta a lista de botões visíveis para calcular posições dinamicamente
  const btns = [
    podeClaudeBtn && 'claude',
    podeGemini    && 'gemini',
    podeOR        && 'openrouter',
  ].filter(Boolean)

  if (btns.length === 0) return null

  const BTN_H = 38, GAP = 10, BASE = 24
  const bottomOf = (key) => BASE + btns.indexOf(key) * (BTN_H + GAP)

  return (
    <>
      {/* Overlay */}
      {activePanel && (
        <div onClick={() => setActivePanel(null)} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.25)',
          zIndex:1099, backdropFilter:'blur(1px)',
        }}/>
      )}

      {/* Botões */}
      {podeClaudeBtn && (
        <FloatBtn
          bottom={bottomOf('claude')}
          title="Claude (Anthropic)" accent="#7c3aed"
          active={activePanel === 'claude'}
          onClick={() => toggle('claude')}
          logo={<LogoClaude size={20} color={activePanel === 'claude' ? '#fff' : '#7c3aed'} />}
        />
      )}
      {podeGemini && (
        <FloatBtn
          bottom={bottomOf('gemini')}
          title="Gemini (Google)" accent="#1A73E8"
          active={activePanel === 'gemini'}
          onClick={() => toggle('gemini')}
          logo={<LogoGemini size={20} color={activePanel === 'gemini' ? '#fff' : '#1A73E8'} />}
        />
      )}
      {podeOR && (
        <FloatBtn
          bottom={bottomOf('openrouter')}
          title="OpenRouter" accent="#f59e0b"
          active={activePanel === 'openrouter'}
          onClick={() => toggle('openrouter')}
          logo={<LogoOpenRouter size={20} color={activePanel === 'openrouter' ? '#fff' : '#f59e0b'} />}
        />
      )}

      {/* Painéis */}
      {activePanel === 'claude' && (
        <AIPanel
          zIndex={1102} title="Claude" subtitle="Powered by Anthropic"
          accent="#7c3aed" logo={<LogoClaude size={20} color="#7c3aed" />}
          callFn={(t,c,p) => iaAPI.analisar(t, c, p)}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === 'gemini' && (
        <AIPanel
          zIndex={1102} title="Gemini" subtitle="Powered by Google AI"
          accent="#1A73E8" logo={<LogoGemini size={20} color="#1A73E8" />}
          callFn={(t,c,p) => geminiAPI.analisar(t, c, p)}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === 'openrouter' && (
        <AIPanel
          zIndex={1102} title="OpenRouter" subtitle="Multi-model AI Gateway"
          accent="#f59e0b" logo={<LogoOpenRouter size={20} color="#f59e0b" />}
          callFn={(t,c,p,m) => openrouterAPI.analisar(t, c, p, m)}
          onClose={() => setActivePanel(null)}
          models={OR_MODELS}
        />
      )}

      <style>{`
        @keyframes ai-spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        .ai-spin { animation: ai-spin 1s linear infinite }
        .float-ai-btn { opacity: 0.5; }
        .float-ai-btn:hover, .float-ai-active { opacity: 1 !important; }
      `}</style>
    </>
  )
}
