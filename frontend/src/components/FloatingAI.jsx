import { useState } from 'react'
import { X, Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { iaAPI, geminiAPI, openrouterAPI } from '../services/api'
import { getAIContext } from '../utils/aiContext'
import toast from 'react-hot-toast'
import iconClaude from '../assets/Claude.png'
import iconGemini from '../assets/Gemini.png'
import iconOpenRouter from '../assets/OpenRouter.png'
import iconGeminiFlash from '../assets/GeminiFlash.jpg'
import iconChatGPT from '../assets/ChatGPT.jpg'
import iconDeepSeek from '../assets/DeepSeek.jpg'
import iconLlama from '../assets/Llama.jpg'
import iconNemotron from '../assets/Nemotron.jpg'

const PANEL_W = 420

const OR_MODELS = [
  { id: 'openai/gpt-4o',                          label: 'GPT-4o',        tag: null,   icon: iconChatGPT    },
  { id: 'anthropic/claude-sonnet-4-5',             label: 'Claude 4.5',    tag: null,   icon: iconClaude     },
  { id: 'google/gemini-2.0-flash-001',             label: 'Gemini Flash',  tag: null,   icon: iconGeminiFlash },
  { id: 'meta-llama/llama-3.3-70b-instruct',       label: 'Llama 3.3',     tag: null,   icon: iconLlama      },
  { id: 'deepseek/deepseek-chat',                  label: 'DeepSeek',      tag: null,   icon: iconDeepSeek   },
  { id: 'nvidia/llama-3.1-nemotron-70b-instruct',  label: 'Nemotron 70B',  tag: 'free', icon: iconNemotron   },
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
                  <img src={m.icon} alt="" width={14} height={14} style={{ objectFit:'contain', verticalAlign:'middle' }} />
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

// ── Logos oficiais (ícones reais em assets) ─────────────────────────────────────
export function LogoClaude({ size = 22 }) {
  return <img src={iconClaude} alt="Claude" width={size} height={size} style={{ objectFit:'contain' }} />
}

export function LogoGemini({ size = 22 }) {
  return <img src={iconGemini} alt="Gemini" width={size} height={size} style={{ objectFit:'contain' }} />
}

export function LogoOpenRouter({ size = 22 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 6, height: size + 6, borderRadius: 6, flexShrink: 0,
      background: '#fff',
    }}>
      <img src={iconOpenRouter} alt="OpenRouter" width={size - 4} height={size - 4} style={{ objectFit:'contain' }} />
    </span>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function FloatingAI({ activePanel, setActivePanel }) {
  return (
    <>
      {/* Overlay */}
      {activePanel && (
        <div onClick={() => setActivePanel(null)} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.25)',
          zIndex:1099, backdropFilter:'blur(1px)',
        }}/>
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
      `}</style>
    </>
  )
}
