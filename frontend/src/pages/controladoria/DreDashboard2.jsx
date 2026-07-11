import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { GraficoComposto, GraficoBarras, GraficoLinha } from '../../components/Graficos'
import { clientesAPI, orcamentoAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const ANO_ATUAL = new Date().getFullYear()
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANOS  = Array.from({ length: 5 }, (_, i) => 2024 + i)

const UNIT_COLORS = [
  '#378ADD','#639922','#BA7517','#E24B4A','#7F77DD',
  '#1D9E75','#D85A30','#D4537E','#5DCAA5','#888780',
]

const C = {
  bg:     '#0f1117',
  card:   '#1a1d27',
  card2:  '#22263a',
  border: 'rgba(255,255,255,0.08)',
  text:   '#e8eaf0',
  muted:  '#7a7f99',
  blue:   '#378ADD',
  green:  '#639922',
  greenL: '#C0DD97',
  amber:  '#BA7517',
  amberL: '#FAC775',
  red:    '#E24B4A',
  redL:   '#F7C1C1',
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
const fmt  = v => (v !== 0 && v != null)
  ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits:0, maximumFractionDigits:0 }).format(v)
  : '—'
const fmtK = v => {
  if (v == null) return '—'
  const abs = Math.abs(v), s = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${s}${(abs/1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${s}${(abs/1_000).toFixed(0)}K`
  return fmt(v)
}
const fmtPct = v => v == null ? '—' : `${v.toFixed(1)}%`
const norm   = s => (s||'').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
const totalAnual = (vc, id) =>
  Object.values((vc||{})[id]||{}).reduce((s,v)=>s+(v||0),0)

function findItem(linhas, patterns) {
  for (const p of patterns) {
    const f = linhas.find(l => {
      if (p.agr && l.agrupamento === p.agr) return true
      if (p.kw)  return p.kw.every(w => norm(l.descricao).includes(norm(w)))
      return false
    })
    if (f) return f
  }
  return null
}

// Backend já calcula TT/RES — frontend apenas repassa
function computeValsCalc(valsById) { return {...valsById} }

function buildHierarquia(linhas) {
  const nivel={}, paiL1={}, filhosL2={}, filhosL1={}
  const ttSimples={}, ttDot={}
  for (const l of linhas) {
    if (l.tipo!=='TT'&&l.tipo!=='RES') continue
    const agr=l.agrupamento||''
    if (agr.includes('.')) { if (ttDot[agr]==null) ttDot[agr]=l.item_id }
    else                   { if (ttSimples[agr]==null) ttSimples[agr]=l.item_id }
  }
  const l1DeAgr={}; let ttUlt=null
  for (const l of linhas) {
    if (l.tipo==='TT'||l.tipo==='RES') {
      const agr=l.agrupamento||String(l.item_id), dot=agr.indexOf('.')
      if (dot>0) {
        const pid=ttSimples[agr.slice(0,dot)]
        if (pid!=null){nivel[l.item_id]=2;paiL1[l.item_id]=pid;ttUlt=l.item_id;continue}
      }
      if (!l1DeAgr[agr]){l1DeAgr[agr]=l.item_id;nivel[l.item_id]=1}
      else {nivel[l.item_id]=2;paiL1[l.item_id]=l1DeAgr[agr]}
      ttUlt=l.item_id
    } else if (l.tipo==='AN') {
      const agr=l.agrupamento||''
      const pai=(agr.includes('.')&&ttDot[agr]!=null)?ttDot[agr]:ttUlt
      if (pai==null) continue
      if (nivel[pai]===2){
        const l1=paiL1[pai]; paiL1[l.item_id]=l1
        filhosL2[pai]=filhosL2[pai]||[]; filhosL2[pai].push(l.item_id)
        if (l1!=null){filhosL1[l1]=filhosL1[l1]||[];filhosL1[l1].push(l.item_id)}
      } else {
        paiL1[l.item_id]=pai
        filhosL1[pai]=filhosL1[pai]||[];filhosL1[pai].push(l.item_id)
      }
    }
  }
  return {nivel,paiL1,filhosL2,filhosL1}
}


/* ── Heat map coloring ───────────────────────────────────────────────────── */
const hmColor = pct => {
  if (pct == null || isNaN(pct)) return { bg: C.card2, color: C.muted }
  if (pct >= 20) return { bg: '#1e3d0d', color: C.greenL }
  if (pct >= 10) return { bg: '#3d2800', color: C.amberL }
  if (pct >= 0)  return { bg: '#2d1c00', color: '#e8c07a' }
  return { bg: '#3d0e0e', color: C.redL }
}

const ebitdaBarColor = (val, media) => {
  if (val >= media * 1.1) return '#4a7c20'
  if (val >= media * 0.9) return '#185FA5'
  return '#9e2c2b'
}

/* ── Tooltips ─────────────────────────────────────────────────────────────── */
function EvolTooltip({ active, payload }) {
  if (!active||!payload?.length) return null
  const d = payload[0]?.payload||{}
  const rows=[
    {label:'Receita Líquida',       value:d.receita, color:C.blue},
    {label:'Custos Variáveis',       value:d.custos,  color:C.red},
    {label:'Margem de Contribuição', value:d.margem,  color:C.green, sep:true},
  ].filter(r=>r.value!=null)
  return (
    <div style={{background:'#1e2235',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:12,color:C.text,minWidth:220,boxShadow:'0 6px 24px rgba(0,0,0,.6)'}}>
      <div style={{fontWeight:700,marginBottom:8,color:C.muted}}>{d.mes}</div>
      {rows.map(r=>(
        <div key={r.label}>
          {r.sep&&<div style={{borderTop:`1px solid ${C.border}`,margin:'5px 0'}}/>}
          <div style={{display:'flex',justifyContent:'space-between',gap:20,marginBottom:4}}>
            <span style={{display:'flex',alignItems:'center',gap:5,color:C.muted}}>
              <span style={{width:8,height:8,borderRadius:2,background:r.color,display:'inline-block'}}/>
              {r.label}
            </span>
            <span style={{fontWeight:700,color:C.text}}>{fmtK(r.value)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CompTooltip({ active, payload, label }) {
  if (!active||!payload?.length) return null
  return (
    <div style={{background:'#1e2235',border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',fontSize:12,color:C.text,minWidth:180,boxShadow:'0 6px 24px rgba(0,0,0,.6)'}}>
      <div style={{fontWeight:700,marginBottom:8,color:C.muted}}>{label}</div>
      {payload.map(p=>(
        <div key={p.dataKey} style={{display:'flex',justifyContent:'space-between',gap:18,marginBottom:3}}>
          <span style={{display:'flex',alignItems:'center',gap:5,color:C.muted}}>
            <span style={{width:8,height:2,background:p.color,display:'inline-block'}}/>
            {p.name}
          </span>
          <span style={{fontWeight:700,color:p.color}}>{p.value!=null?fmtK(p.value):'—'}</span>
        </div>
      ))}
    </div>
  )
}

/* ── KPI Card ─────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, suffix='', pct, loading }) {
  const isUp = pct > 0, isDown = pct < 0
  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 16px'}}>
      <div style={{fontSize:12,color:C.muted,marginBottom:6}}>{label}</div>
      {loading
        ? <div style={{height:26,width:100,background:C.card2,borderRadius:4}}/>
        : <div style={{fontSize:26,fontWeight:500,color:C.text,lineHeight:1,fontVariantNumeric:'tabular-nums'}}>
            {value}{suffix}
          </div>
      }
      {pct!=null&&!loading&&(
        <div style={{fontSize:12,marginTop:6,display:'flex',alignItems:'center',gap:4,
          color:isUp?'#7fc97a':isDown?'#e06c6b':C.muted}}>
          {isUp?'▲':isDown?'▼':'●'} {Math.abs(pct).toFixed(1)}% vs {suffix?'anterior':'anterior'}
        </div>
      )}
    </div>
  )
}

const axisSt = { fill:C.muted, fontSize:10 }
const CARD = { background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'16px' }

/* ══ Main Dashboard V2 ════════════════════════════════════════════════════════ */
export default function DreDashboard2() {
  const { usuario } = useAuth()
  const isCliente   = usuario?.perfil === 'analista'
  const location    = useLocation()
  const navigate    = useNavigate()

  const initCid = location.state?.clienteId
    ? String(location.state.clienteId)
    : isCliente ? String(usuario?.cliente_id||'') : ''
  const initUnid = location.state?.unidade || 'CONSOLIDADO'
  const unidPreset = useRef(!!location.state?.unidade)

  const [clientes,     setClientes]     = useState([])
  const [clienteId,    setClienteId]    = useState(initCid)
  const [unidades,     setUnidades]     = useState([])
  const [unidade,      setUnidade]      = useState(initUnid)
  const [ano,          setAno]          = useState(ANO_ATUAL - 1)
  const [anoComp,      setAnoComp]      = useState(ANO_ATUAL)
  const [subTab,       setSubTab]       = useState('resumo')
  const [showUnidades, setShowUnidades] = useState(false)
  const [selFlags,     setSelFlags]     = useState(new Set())

  const [dados,        setDados]        = useState(null)
  const [valsById,     setValsById]     = useState({})
  const [dadosComp,    setDadosComp]    = useState(null)
  const [valsByIdComp, setValsByIdComp] = useState({})
  const [dadosPorUni,  setDadosPorUni]  = useState({})
  const [loading,      setLoading]      = useState(false)
  const [loadingAll,   setLoadingAll]   = useState(false)
  const [multiKey,     setMultiKey]     = useState(null)  // key = clienteId+ano; carregamento por demanda

  const unidRef = useRef(null)

  /* CSS scrollbar */
  useEffect(() => {
    const s = document.createElement('style')
    s.id = 'dre-dash2-css'
    s.textContent = `
      .dre2 { scrollbar-width: thin; scrollbar-color: #2a2a45 transparent; }
      .dre2::-webkit-scrollbar { width: 5px; height: 5px; }
      .dre2::-webkit-scrollbar-track { background: transparent; }
      .dre2::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 3px; }
      .dre2::-webkit-scrollbar-thumb:hover { background: rgba(99,153,34,.4); }
      .dre2-unit-list { scrollbar-width: thin; scrollbar-color: #2a2a45 transparent; }
      .dre2-unit-list::-webkit-scrollbar { width: 4px; }
      .dre2-unit-list::-webkit-scrollbar-thumb { background: #2a2a45; border-radius: 2px; }
    `
    document.head.appendChild(s)
    return () => document.getElementById('dre-dash2-css')?.remove()
  }, [])

  /* close unit dropdown */
  useEffect(() => {
    const h = e => { if (unidRef.current && !unidRef.current.contains(e.target)) setShowUnidades(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  /* load clients */
  useEffect(() => {
    if (isCliente) return
    clientesAPI.listar({ modulo_analises_gerenciais: true })
      .then(r => { setClientes(r.data||[]); if ((r.data||[]).length===1&&!clienteId) setClienteId(String(r.data[0].id)) })
      .catch(()=>{})
  }, [])

  /* detect first year + units */
  useEffect(() => {
    if (!clienteId) { setUnidades([]); return }
    const preset = unidPreset.current; unidPreset.current = false
    const detect = async () => {
      for (let a = ANO_ATUAL-1; a >= ANO_ATUAL-5; a--) {
        try {
          const r = await orcamentoAPI.unidades(clienteId, a)
          if ((r.data||[]).length > 0) {
            setAno(a); setUnidades(r.data)
            if (!preset) setUnidade(r.data.includes('CONSOLIDADO')?'CONSOLIDADO':r.data[0])
            return
          }
        } catch { break }
      }
    }
    detect()
  }, [clienteId])

  /* reload units on year change */
  useEffect(() => {
    if (!clienteId) return
    orcamentoAPI.unidades(clienteId, ano)
      .then(r => {
        const l = r.data||[]
        setUnidades(l)
        if (!l.includes(unidade)) setUnidade(l.includes('CONSOLIDADO')?'CONSOLIDADO':(l[0]||''))
      })
      .catch(()=>{})
  }, [ano, clienteId])

  /* resetar multi ao trocar cliente/ano */
  useEffect(() => { setMultiKey(null); setDadosPorUni({}) }, [clienteId, ano])

  /* load main DRE */
  useEffect(() => {
    if (!clienteId||!unidade) return
    setLoading(true)
    orcamentoAPI.obterDre(clienteId, ano, unidade)
      .then(r => {
        setDados(r.data)
        const m={}; for(const ln of r.data.linhas||[]) m[ln.item_id]=ln.valores
        setValsById(m)
      })
      .catch(()=>toast.error('Erro ao carregar DRE'))
      .finally(()=>setLoading(false))
  }, [clienteId, ano, unidade])

  /* load comparison year */
  useEffect(() => {
    if (!clienteId||!unidade||anoComp===ano) { setDadosComp(null); setValsByIdComp({}); return }
    orcamentoAPI.obterDre(clienteId, anoComp, unidade)
      .then(r => {
        setDadosComp(r.data)
        const m={}; for(const ln of r.data.linhas||[]) m[ln.item_id]=ln.valores
        setValsByIdComp(m)
      })
      .catch(()=>{})
  }, [clienteId, anoComp, unidade])

  /* load all units — ativado por demanda (multiKey) */
  useEffect(() => {
    if (!multiKey || !clienteId || !dados || unidades.length===0) return
    const list = unidades.filter(u => u !== 'CONSOLIDADO').slice(0, 15)
    if (!list.length) return
    setLoadingAll(true)
    setDadosPorUni({})
    const loadUnit = async u => {
      if (u === unidade) return { u, vc: computeValsCalc(valsById) }
      try {
        const r = await orcamentoAPI.obterDre(clienteId, ano, u)
        const vb = {}; for(const ln of r.data.linhas||[]) vb[ln.item_id]=ln.valores
        return { u, vc: computeValsCalc(vb) }
      } catch { return { u, vc: {} } }
    }
    // carrega em lotes de 5 para não sobrecarregar o backend
    const batches = []
    for (let i = 0; i < list.length; i += 5) batches.push(list.slice(i, i+5))
    const allResults = []
    const runBatches = async () => {
      for (const batch of batches) {
        const results = await Promise.all(batch.map(loadUnit))
        allResults.push(...results)
        const partial = {}; for(const {u,vc} of allResults) partial[u]=vc
        setDadosPorUni({...partial})
      }
      setSelFlags(new Set(list.slice(0,3)))
    }
    runBatches().finally(() => setLoadingAll(false))
  }, [multiKey])

  /* ── computed ──────────────────────────────────────────────────────────── */
  const hierarquia  = useMemo(()=>buildHierarquia(dados?.linhas||[]),[dados?.linhas])
  const valsCalc    = useMemo(()=>computeValsCalc(valsById),[valsById])
  const hierComp    = useMemo(()=>buildHierarquia(dadosComp?.linhas||[]),[dadosComp?.linhas])
  const valsCalcComp= useMemo(()=>computeValsCalc(valsByIdComp),[valsByIdComp])

  const items = useMemo(()=>{
    const L = dados?.linhas||[]
    return {
      fat: findItem(L,[{agr:'TOTAL_RECEITA'},{kw:['FATURAMENTO','LIQUID']},{kw:['RECEITA','LIQUID']},{kw:['FATURAMENTO']},{kw:['RECEITA']}]),
      cv:  findItem(L,[{kw:['CUSTO','VARIAV']},{kw:['CUSTOS','VARIAV']},{kw:['VARIAV']}]),
      mc:  findItem(L,[{kw:['MARGEM','CONTRIBU']},{kw:['MARGEM']},{kw:['CONTRIBU']}]),
      ebt: findItem(L,[{kw:['EBITDA']},{kw:['RESULTADO','OPERA']},{kw:['LUCRO','OPERA']},{kw:['RESULTADO','BRUT']}]),
    }
  },[dados?.linhas])

  /* KPI totals */
  const totFat  = items.fat ? totalAnual(valsCalc, items.fat.item_id) : null
  const totCV   = items.cv  ? totalAnual(valsCalc, items.cv.item_id)  : null
  const totMC   = items.mc  ? totalAnual(valsCalc, items.mc.item_id)  : null
  const totEBT  = items.ebt ? totalAnual(valsCalc, items.ebt.item_id) : null
  const totFatC = items.fat ? totalAnual(valsCalcComp, items.fat.item_id) : null
  const totMCC  = items.mc  ? totalAnual(valsCalcComp, items.mc.item_id)  : null
  const totEBTC = items.ebt ? totalAnual(valsCalcComp, items.ebt.item_id) : null

  const margemBrutaPct = (totFat && totCV && totFat!==0) ? ((totFat-totCV)/totFat*100) : null
  const ebitdaPct      = (totFat && totEBT && totFat!==0) ? (totEBT/totFat*100) : null
  const mcPct          = (totFat && totMC  && totFat!==0) ? (totMC/totFat*100)  : null

  /* % changes */
  const pctChg = (a,b) => (b&&b!==0) ? ((a-b)/Math.abs(b)*100) : null

  /* evolução mensal (Receita + Custos Var + Margem area) */
  const evolData = useMemo(()=>MESES.map((mes,i)=>{
    const m=i+1
    return {
      mes,
      receita: items.fat?(valsCalc[items.fat.item_id]?.[m]??0):0,
      custos:  items.cv ?(valsCalc[items.cv.item_id]?.[m] ??0):0,
      margem:  items.mc ?(valsCalc[items.mc.item_id]?.[m] ??0):0,
    }
  }),[valsCalc,items])

  /* ranking horizontal — usa EBITDA, fallback MC, fallback Faturamento */
  const rankItem  = items.ebt || items.mc || items.fat
  const rankLabel = items.ebt ? 'EBITDA' : items.mc ? 'Margem Contrib.' : 'Faturamento'
  const rankData = useMemo(()=>{
    if (!Object.keys(dadosPorUni).length || !rankItem) return []
    const vals = Object.entries(dadosPorUni)
      .map(([u,vc])=>({
        unidade: u.length > 6 ? u.slice(0,6) : u,
        fullName: u,
        valor: Math.round(totalAnual(vc, rankItem.item_id) / 1000),
      }))
      .filter(d => d.valor !== 0)
      .sort((a,b)=>b.valor-a.valor)
      .slice(0,10)
    if (!vals.length) return []
    const media = vals.reduce((s,d)=>s+d.valor,0) / vals.length
    return vals.map(d=>({...d, color: ebitdaBarColor(d.valor, media)}))
  },[dadosPorUni, rankItem])

  /* comparison line — Faturamento Líquido por unidade */
  const compLineData = useMemo(()=>{
    if (!items.fat) return MESES.map(mes=>({mes}))
    return MESES.map((mes,i)=>{
      const m=i+1, obj={mes}
      for (const u of selFlags) {
        const vc = dadosPorUni[u]||{}
        const v = vc[items.fat.item_id]?.[m]
        obj[u] = (v != null && v !== 0) ? v : null
      }
      return obj
    })
  },[dadosPorUni,selFlags,items.fat])

  /* heat map — EBITDA% ou MC% por unidade × mês */
  const heatItem = items.ebt || items.mc
  const heatLabel = items.ebt ? 'EBITDA %' : items.mc ? 'Margem Contrib. %' : ''
  const heatmapRows = useMemo(()=>{
    if (!heatItem || !items.fat) return []
    return Object.entries(dadosPorUni).slice(0,16).map(([u,vc])=>({
      unidade: u,
      months: MESES.map((_,i)=>{
        const m=i+1
        const fat = vc[items.fat.item_id]?.[m]||0
        if (!fat) return null
        return parseFloat(((vc[heatItem.item_id]?.[m]||0)/fat*100).toFixed(1))
      }),
    }))
  },[dadosPorUni, heatItem, items.fat])

  const temDados = !!(dados?.plano&&dados.linhas?.length>0&&unidades.length>0)
  const unidLabel = unidade==='CONSOLIDADO'?'Consolidado':unidade
  const flagList  = unidades.filter(u=>u!=='CONSOLIDADO')

  /* toggle flag */
  const toggleFlag = u => {
    setSelFlags(prev => {
      const next = new Set(prev)
      if (next.has(u)) { if (next.size > 1) next.delete(u) }
      else next.add(u)
      return next
    })
  }

  /* ── render ────────────────────────────────────────────────────────────── */
  return (
    <div className="dre2" style={{
      position:'fixed',inset:0,zIndex:201,
      background:C.bg,color:C.text,overflowY:'auto',fontFamily:'inherit',
    }}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{
        position:'sticky',top:0,zIndex:10,
        background:`${C.bg}f2`,backdropFilter:'blur(8px)',
        borderBottom:`1px solid ${C.border}`,padding:'10px 22px 0',
      }}>
        {/* Row 1 */}
        <div style={{display:'flex',alignItems:'center',gap:10,paddingBottom:4}}>
          <button onClick={()=>navigate('/controladoria/dre', { state: { clienteId, unidade } })}
            style={{background:'transparent',border:'none',color:C.muted,cursor:'pointer',fontSize:12,padding:'4px 8px',borderRadius:5}}>
            ← DRE
          </button>
          <div style={{width:1,height:14,background:C.border}}/>
          <div style={{fontSize:16,fontWeight:500,color:C.text}}>Dashboard DRE</div>
          {temDados&&<>
            <div style={{width:1,height:12,background:C.border}}/>
            <span style={{fontSize:11,color:C.green,fontWeight:600,background:`${C.green}18`,padding:'2px 10px',borderRadius:99,border:`1px solid ${C.green}30`}}>
              {unidLabel}
            </span>
            {dados?.plano&&<span style={{fontSize:11,color:C.muted}}>· {dados.plano.nome} · {ano}</span>}
          </>}
        </div>

        {/* Row 2: selectors */}
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0 0',flexWrap:'wrap'}}>
          {!isCliente&&(
            <select value={clienteId} onChange={e=>setClienteId(e.target.value)}
              style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:C.card,color:C.text,cursor:'pointer',outline:'none',maxWidth:220}}>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c=><option key={c.id} value={c.id}>{c.razao_social}</option>)}
            </select>
          )}
          {/* Units dropdown */}
          <div ref={unidRef} style={{position:'relative'}}>
            <button onClick={()=>setShowUnidades(v=>!v)}
              style={{fontSize:11,padding:'4px 12px',borderRadius:6,cursor:'pointer',display:'flex',alignItems:'center',gap:6,
                border:`1px solid ${showUnidades?C.green:C.border}`,
                background:showUnidades?`${C.green}15`:C.card,
                color:showUnidades?C.green:C.text}}>
              {unidLabel} <span style={{fontSize:9,opacity:.6}}>{showUnidades?'▲':'▼'}</span>
            </button>
            {showUnidades&&(
              <div className="dre2-unit-list" style={{
                position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:30,
                background:C.card,border:`1px solid ${C.border}`,borderRadius:8,
                padding:'6px 0',maxHeight:200,overflowY:'auto',minWidth:160,
                boxShadow:'0 8px 24px rgba(0,0,0,.55)',
              }}>
                {unidades.map(u=>(
                  <div key={u} onClick={()=>{setUnidade(u);setShowUnidades(false)}}
                    style={{padding:'6px 14px',cursor:'pointer',fontSize:12,
                      background:unidade===u?`${C.green}18`:'transparent',
                      color:unidade===u?C.green:C.text}}>
                    {u==='CONSOLIDADO'?'Consolidado':u}
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Ano principal */}
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:10,color:C.muted}}>Ano</span>
            {ANOS.map(a=>(
              <button key={a} onClick={()=>setAno(a)} style={{
                fontSize:11,padding:'3px 10px',borderRadius:5,cursor:'pointer',
                border:`1px solid ${ano===a?C.blue:C.border}`,
                background:ano===a?`${C.blue}20`:'transparent',
                color:ano===a?C.blue:C.muted,fontWeight:ano===a?700:400,
              }}>{a}</button>
            ))}
          </div>
          <span style={{fontSize:10,color:C.muted}}>vs</span>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            {ANOS.map(a=>(
              <button key={a} onClick={()=>setAnoComp(a)} style={{
                fontSize:11,padding:'3px 10px',borderRadius:5,cursor:'pointer',
                border:`1px solid ${anoComp===a?'#9e6bdd':C.border}`,
                background:anoComp===a?'#9e6bdd20':'transparent',
                color:anoComp===a?'#c084fc':C.muted,fontWeight:anoComp===a?700:400,
              }}>{a}</button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:0,marginTop:8}}>
          {[['resumo','Resumo'],['evolucao','Evolução'],['comparativo','Comparativo'],['heatmap','Heat Map']].map(([k,l])=>(
            <button key={k} onClick={()=>setSubTab(k)}
              style={{padding:'8px 16px',fontSize:12,fontWeight:subTab===k?700:400,cursor:'pointer',
                border:'none',background:'transparent',
                color:subTab===k?C.text:C.muted,
                borderBottom:`2px solid ${subTab===k?C.green:'transparent'}`,
                marginBottom:-1,transition:'color .12s'}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div style={{padding:'18px 22px 40px'}}>

        {!clienteId&&<div style={{textAlign:'center',padding:'60px 0',color:C.muted,fontSize:13}}>Selecione um cliente para visualizar o Dashboard.</div>}
        {clienteId&&loading&&!dados&&<div style={{textAlign:'center',padding:'60px 0',color:C.muted,fontSize:13}}>Carregando...</div>}
        {clienteId&&!loading&&!temDados&&<div style={{textAlign:'center',padding:'60px 0',color:C.muted,fontSize:13}}>Sem dados para {ano}.</div>}

        {temDados&&(
          <>
            {/* ── Botão carga multi-unidade ─────────────────────────────── */}
            {!multiKey && !loadingAll && flagList.length > 0 && (
              <div style={{textAlign:'center',padding:'6px 0 16px'}}>
                <button
                  onClick={()=>setMultiKey(`${clienteId}_${ano}`)}
                  style={{fontSize:12,padding:'7px 20px',borderRadius:7,cursor:'pointer',
                    border:`1px solid ${C.green}`,background:`${C.green}18`,color:C.green,fontWeight:600}}>
                  Carregar análise por unidade (Ranking · Comparativo · Heat Map)
                </button>
              </div>
            )}

            {/* ── KPI GRID (sempre visível) ─────────────────────────────── */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:20}}>
              <KpiCard label="Receita Líquida" value={fmtK(totFat)}
                pct={pctChg(totFat,totFatC)} loading={loading}/>
              <KpiCard label="Margem Bruta" value={fmtPct(margemBrutaPct)} loading={loading}/>
              <KpiCard label="EBITDA %" value={fmtPct(ebitdaPct)}
                pct={pctChg(totEBT,totEBTC)} loading={loading}/>
              <KpiCard label="Margem Contrib." value={fmtPct(mcPct)}
                pct={pctChg(totMC,totMCC)} loading={loading}/>
              <KpiCard label="Custos Variáveis" value={fmtK(totCV)} loading={loading}/>
              <KpiCard label="EBITDA" value={fmtK(totEBT)}
                pct={pctChg(totEBT,totEBTC)} loading={loading}/>
            </div>

            {/* ── RESUMO / EVOLUÇÃO ─────────────────────────────────────── */}
            {(subTab==='resumo'||subTab==='evolucao')&&(
              <div style={{display:'grid',gridTemplateColumns:subTab==='evolucao'?'1fr':'1fr 1fr',gap:14,marginBottom:14}}>

                {/* Evolução mensal */}
                <div style={CARD}>
                  <div style={{fontSize:13,fontWeight:500,color:C.text,marginBottom:14}}>
                    Receita Líquida × Custos Variáveis — mensal
                  </div>
                  <GraficoComposto
                    dados={evolData}
                    chaveX="mes"
                    altura={subTab==='evolucao'?280:200}
                    margin={{top:2,right:4,left:0,bottom:0}}
                    xAxisProps={{ tick: axisSt, axisLine:false, tickLine:false }}
                    yAxisProps={{ tick: axisSt, axisLine:false, tickLine:false, width:44 }}
                    formatoY={fmtK}
                    tooltipContent={<EvolTooltip/>}
                    series={[
                      { tipo:'area', chave:'margem', cor:C.green, opacidade:0.28, nome:'Margem' },
                      { tipo:'linha', chave:'receita', cor:C.blue, dot:{r:3,fill:C.blue}, activeDot:{r:5}, nome:'Receita Líquida' },
                      { tipo:'linha', chave:'custos', cor:C.red, tracejado:true, dot:{r:3,fill:C.red}, activeDot:{r:5}, nome:'Custos Variáveis' },
                    ]}
                  />
                  <div style={{display:'flex',gap:16,marginTop:8,fontSize:11,color:C.muted}}>
                    {[[C.blue,'Receita Líquida'],[C.red,'Custos Variáveis'],['rgba(99,153,34,0.5)','Margem']].map(([c,l])=>(
                      <span key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                        <span style={{width:10,height:10,borderRadius:2,background:c,display:'inline-block'}}/>
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Ranking horizontal */}
                {subTab==='resumo'&&(
                  <div style={CARD}>
                    <div style={{fontSize:13,fontWeight:500,color:C.text,marginBottom:14}}>
                      Top {rankData.length||'10'} unidades — {rankLabel} (R$k)
                    </div>
                    {loadingAll&&<div style={{textAlign:'center',padding:'30px 0',color:C.muted,fontSize:12}}>Carregando unidades...</div>}
                    {!loadingAll&&rankData.length===0&&<div style={{textAlign:'center',padding:'30px 0',color:C.muted,fontSize:12}}>Sem dados de unidades para exibir.</div>}
                    {!loadingAll&&rankData.length>0&&(
                      <GraficoBarras
                        dados={rankData}
                        chaveX="unidade"
                        layout="vertical"
                        altura={Math.max(160, rankData.length*26)}
                        margin={{top:0,right:30,left:0,bottom:0}}
                        xAxisProps={{ tick: axisSt, axisLine:false, tickLine:false }}
                        yAxisProps={{ tick: axisSt, axisLine:false, tickLine:false, width:38 }}
                        formatoY={v=>`R$${v}k`}
                        tooltipContent={({active,payload})=>active&&payload?.length
                          ?<div style={{background:'#1e2235',border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 12px',fontSize:12,color:C.text}}>
                             <div style={{color:C.muted,marginBottom:4}}>{payload[0]?.payload?.fullName}</div>
                             <div style={{fontWeight:700,color:payload[0]?.color}}>{rankLabel}: R${payload[0]?.value}k</div>
                           </div>:null}
                        barras={[{
                          chave:'valor', radius:[0,4,4,0], maxBarSize:18,
                          cellProps: d => ({ fill: d.color }),
                        }]}
                      />
                    )}
                    <div style={{display:'flex',gap:14,marginTop:8,fontSize:11,color:C.muted}}>
                      {[['#4a7c20','Acima da média'],['#185FA5','Na média'],['#9e2c2b','Abaixo']].map(([c,l])=>(
                        <span key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                          <span style={{width:10,height:10,borderRadius:2,background:c,display:'inline-block'}}/>
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── COMPARATIVO COM FLAGS ─────────────────────────────────── */}
            {(subTab==='resumo'||subTab==='comparativo')&&(
              <div style={{...CARD,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:500,color:C.text,marginBottom:12}}>
                  Comparativo de unidades — Faturamento Líquido
                </div>
                {/* Flag buttons */}
                <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:14}}>
                  {flagList.map((u,i)=>{
                    const ativo = selFlags.has(u)
                    const cor = UNIT_COLORS[Array.from(selFlags).indexOf(u) % UNIT_COLORS.length] || C.muted
                    return (
                      <button key={u} onClick={()=>toggleFlag(u)} style={{
                        fontSize:11,padding:'4px 12px',borderRadius:20,cursor:'pointer',
                        border:`1px solid ${ativo?cor:C.border}`,
                        background:ativo?`${cor}25`:'transparent',
                        color:ativo?cor:C.muted,transition:'all .15s',
                      }}>
                        {u}
                      </button>
                    )
                  })}
                </div>
                {loadingAll&&<div style={{textAlign:'center',padding:'20px 0',color:C.muted,fontSize:12}}>Carregando dados de unidades...</div>}
                {!loadingAll&&(
                  <GraficoLinha
                    dados={compLineData}
                    chaveX="mes"
                    altura={subTab==='comparativo'?260:180}
                    margin={{top:4,right:8,left:0,bottom:0}}
                    xAxisProps={{ tick: axisSt, axisLine:false, tickLine:false }}
                    yAxisProps={{ tick: axisSt, axisLine:false, tickLine:false, width:46 }}
                    formatoY={fmtK}
                    tooltipContent={<CompTooltip/>}
                    linhas={Array.from(selFlags).map((u,i)=>({
                      chave: u, nome: u, cor: UNIT_COLORS[i % UNIT_COLORS.length], strokeWidth:2,
                    }))}
                  />
                )}
              </div>
            )}

            {/* ── HEAT MAP ─────────────────────────────────────────────────── */}
            {(subTab==='resumo'||subTab==='heatmap')&&(
              <div style={CARD}>
                <div style={{fontSize:13,fontWeight:500,color:C.text,marginBottom:14}}>
                  Heat Map — {heatLabel||'Performance'} por unidade × mês
                </div>
                {loadingAll&&<div style={{textAlign:'center',padding:'20px 0',color:C.muted,fontSize:12}}>Carregando...</div>}
                {!loadingAll&&heatmapRows.length===0&&(
                  <div style={{textAlign:'center',padding:'20px 0',color:C.muted,fontSize:12}}>Sem dados multi-unidade.</div>
                )}
                {!loadingAll&&heatmapRows.length>0&&(
                  <div style={{overflowX:'auto'}}>
                    <table style={{borderCollapse:'separate',borderSpacing:3,minWidth:600,width:'100%'}}>
                      <thead>
                        <tr>
                          <th style={{fontSize:10,color:C.muted,textAlign:'left',padding:'2px 6px',fontWeight:500,width:64}}>Unidade</th>
                          {MESES.map(m=>(
                            <th key={m} style={{fontSize:10,color:C.muted,textAlign:'center',padding:'2px',fontWeight:500,width:52}}>{m.slice(0,1)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatmapRows.map(({unidade:u, months})=>(
                          <tr key={u}>
                            <td style={{fontSize:11,color:C.muted,padding:'2px 6px',whiteSpace:'nowrap'}}>{u}</td>
                            {months.map((pct,i)=>{
                              const {bg,color} = hmColor(pct)
                              return (
                                <td key={i} style={{padding:0}}>
                                  <div style={{
                                    background:bg,color,borderRadius:4,
                                    height:26,display:'flex',alignItems:'center',justifyContent:'center',
                                    fontSize:10,fontWeight:500,minWidth:48,
                                  }}>
                                    {pct!=null ? pct.toFixed(0)+'%' : '—'}
                                  </div>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{display:'flex',gap:16,marginTop:12,fontSize:11,color:C.muted}}>
                  {[['#1e3d0d',C.greenL,'≥ 20%'],['#3d2800',C.amberL,'10–20%'],['#3d0e0e',C.redL,'< 10%']].map(([bg,c,l])=>(
                    <span key={l} style={{display:'flex',alignItems:'center',gap:5}}>
                      <span style={{width:10,height:10,borderRadius:2,background:bg,border:`1px solid ${c}40`,display:'inline-block'}}/>
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{padding:'0 22px 16px',fontSize:11,color:C.muted,textAlign:'right'}}>
        Dashboard DRE V2 · {dados?.plano?.nome||''} · {ano}
      </div>
    </div>
  )
}
