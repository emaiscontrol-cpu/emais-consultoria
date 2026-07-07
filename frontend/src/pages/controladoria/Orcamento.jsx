import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Percent, ChevronsDown, ChevronsUp, LayoutDashboard, LogOut, Pencil } from 'lucide-react'
import { orcamentoAPI, clientesAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

import BotaoExportarPDF from '../../components/BotaoExportarPDF'
import PainelDetalheOrcamento from '../../components/PainelDetalheOrcamento'
import CelulaValorPct from '../../components/CelulaValorPct'
import { LogoClaude, LogoGemini, LogoOpenRouter } from '../../components/FloatingAI'

const ANO_ATUAL = new Date().getFullYear()
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_N = Array.from({ length: 12 }, (_, i) => i + 1)

// Linhas de dados que devem GANHAR APARÊNCIA de título (negrito + fundo destacado + borda
// superior), sem virar `tipo === 'titulo'` de verdade — continuam mostrando valores e %.
// Promover outra linha no futuro = só adicionar o slug aqui. Ver mesma constante em FluxoCaixa.jsx.
const SLUGS_DESTAQUE_TITULO = ['compras']

// Helper para determinar se a linha é de saída/despesa
const isOutflow = (label) => {
  const lower = label.toLowerCase();
  return lower.includes('( - )') || 
         lower.includes('despesa') || 
         lower.includes('pessoal') || 
         lower.includes('custos') || 
         lower.includes('gasto') || 
         lower.includes('aluguel') || 
         lower.includes('tributária') ||
         lower.includes('energia') ||
         lower.includes('utilidades') ||
         lower.includes('manutenç') ||
         lower.includes('veículo') ||
         lower.includes('marketing') ||
         lower.includes('informática') ||
         lower.includes('viagens') ||
         lower.includes('expediente') ||
         lower.includes('frete') ||
         lower.includes('seguro');
};

// Para cada agrupamento: qual totalizador fecha sua seção (collapse e % de participação)
function buildGroupings(linhas) {
  const parentOf        = {}
  const sectionRefOrdem = {}
  let pending = []
  for (const l of linhas) {
    if (l.tipo === 'titulo') {
      pending = []
    } else if (l.tipo === 'agrupamento') {
      pending.push(l.ordem)
    } else if (l.tipo === 'totalizador') {
      for (const o of pending) {
        parentOf[o]        = l.ordem
        sectionRefOrdem[o] = l.ordem
      }
      pending = []
    }
  }
  return { parentOf, sectionRefOrdem }
}

function SegControl({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden',
      border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{ padding: '5px 14px', fontSize: 12, border: 'none', cursor: 'pointer',
            fontWeight: value === o.value ? 700 : 400,
            background: value === o.value ? 'var(--brand)' : 'transparent',
            color: value === o.value ? '#fff' : 'var(--text-muted)',
            transition: 'all .15s' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function Orcamento({ aiPanel, setAiPanel }) {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const isCliente = usuario?.perfil === 'analista'
  const isAdmin = usuario?.perfil === 'admin'
  const podeClaude = isAdmin || usuario?.ia_claude === true
  const podeGemini = isAdmin || usuario?.ia_gemini === true
  const podeOR     = isAdmin || usuario?.ia_openrouter === true

  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [ano, setAno] = useState(2026) // Padrão 2026 conforme dados importados
  const [versao, setVersao] = useState('Original')
  const [linhas, setLinhas] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('comparativo') // 'comparativo', 'realizado', 'orcado'
  
  // Custom states matching FluxoCaixa
  const [showDashboard, setShowDashboard] = useState(false)
  const [showPct, setShowPct] = useState(false)
  const [collapsedTotais, setCollapsedTotais] = useState(new Set())
  const [activeDetail, setActiveDetail] = useState(null)

  // Controla exibição da sidebar global do sistema
  useEffect(() => {
    const shell = document.querySelector('.app-shell')
    if (shell) {
      if (clienteId) {
        shell.classList.add('hide-sidebar')
      } else {
        shell.classList.remove('hide-sidebar')
      }
    }
    return () => {
      if (shell) shell.classList.remove('hide-sidebar')
    }
  }, [clienteId])

  // Carrega lista de clientes
  useEffect(() => {
    if (isCliente) {
      setClienteId(String(usuario.cliente_id))
    } else {
      clientesAPI.listar({ modulo_analises_gerenciais: true })
        .then(r => {
          setClientes(r.data)
          if (r.data.length > 0) {
            const rdp = r.data.find(c => c.id === 10)
            setClienteId(rdp ? '10' : String(r.data[0].id))
          }
        })
        .catch(() => {})
    }
  }, [isCliente, usuario])

  // Carrega dados comparativos
  const carregarComparativo = useCallback(() => {
    if (!clienteId) return
    setLoading(true)
    setActiveDetail(null)
    orcamentoAPI.obterComparativo(clienteId, ano, versao)
      .then(r => {
        setLinhas(r.data)
      })
      .catch(() => {
        toast.error('Erro ao carregar comparativo orçamentário.')
        setLinhas([])
      })
      .finally(() => setLoading(false))
  }, [clienteId, ano, versao])

  useEffect(() => {
    carregarComparativo()
  }, [carregarComparativo])

  // Formatação de valores
  const fmt = (v) => {
    if (v === 0 || v == null) return '—'
    return Math.abs(v) >= 1000 && v % 1 === 0
      ? v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const fmtPct = (v) => {
    if (v == null) return ''
    return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  }

  // Cálculos de estruturas e totalizadores
  const { parentOf, sectionRefOrdem, totalizadorMap, allTotalizadores } = useMemo(() => {
    if (!linhas || linhas.length === 0) return { parentOf: {}, sectionRefOrdem: {}, totalizadorMap: {}, allTotalizadores: new Set() }
    const { parentOf, sectionRefOrdem } = buildGroupings(linhas)
    const totalizadorMap = Object.fromEntries(linhas.map(l => [l.ordem, l]))
    const allTotalizadores = new Set(
      linhas.filter(l => l.tipo === 'totalizador').map(l => l.ordem)
    )
    return { parentOf, sectionRefOrdem, totalizadorMap, allTotalizadores }
  }, [linhas])

  // KPI cards calculation
  const kpis = useMemo(() => {
    const defaultKpi = { real: 0, orc: 0, dev: 0, pct: 0 }
    const result = {
      vendas: { ...defaultKpi },
      lucro: { ...defaultKpi },
      custos: { ...defaultKpi },
      ebitda: { ...defaultKpi }
    }
    if (!linhas || linhas.length === 0) return result

    const findRow = (ordem) => linhas.find(l => l.ordem === ordem)
    
    const fillKpi = (row, kpiObj) => {
      if (!row) return
      kpiObj.real = Object.values(row.realizado || {}).reduce((s, v) => s + (v || 0), 0)
      kpiObj.orc = Object.values(row.orcado || {}).reduce((s, v) => s + (v || 0), 0)
      kpiObj.dev = kpiObj.real - kpiObj.orc
      kpiObj.pct = kpiObj.orc !== 0 ? (kpiObj.dev / Math.abs(kpiObj.orc)) * 100 : 0
    }

    fillKpi(findRow(12), result.vendas)
    fillKpi(findRow(26), result.lucro)
    fillKpi(findRow(58), result.custos)
    fillKpi(findRow(59), result.ebitda)

    return result
  }, [linhas])

  // Helpers de participação baseada em Vendas Totais (até ordem 15) e Vendas Líquidas Recebidas (acima)
  const getBaseRow = (linha) => {
    if (!linhas || !linha) return null
    if (linha.ordem <= 15) {
      return linhas.find(l => l.ordem === 12 || l.rotulo.toLowerCase().includes('vendas - totais') || l.rotulo.toLowerCase().includes('vendas totais'))
    }
    return linhas.find(l => {
      const clean = l.rotulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')
      return clean.includes('vendasliquidasrecebidas') || clean.includes('vendasliquidas')
    })
  }

  const getParticipacao = (linha, isReal) => {
    if (linha.tipo === 'titulo') return null
    const baseRow = getBaseRow(linha)
    if (!baseRow) return null
    
    if (isReal) {
      const lineVal = Object.values(linha.realizado || {}).reduce((s, v) => s + (v || 0), 0)
      const refVal = Object.values(baseRow.realizado || {}).reduce((s, v) => s + (v || 0), 0)
      return refVal !== 0 ? (lineVal / refVal) * 100 : 0
    } else {
      const lineVal = Object.values(linha.orcado || {}).reduce((s, v) => s + (v || 0), 0)
      const refVal = Object.values(baseRow.orcado || {}).reduce((s, v) => s + (v || 0), 0)
      return refVal !== 0 ? (lineVal / refVal) * 100 : 0
    }
  }

  const getMonthlyPct = (linha, m, isReal) => {
    if (linha.tipo === 'titulo') return null
    const baseRow = getBaseRow(linha)
    if (!baseRow) return null
    
    if (isReal) {
      const lineVal = linha.realizado[m] ?? 0
      const refVal = baseRow.realizado[m] ?? 0
      return refVal !== 0 ? (lineVal / refVal) * 100 : null
    } else {
      const lineVal = linha.orcado[m] ?? 0
      const refVal = baseRow.orcado[m] ?? 0
      return refVal !== 0 ? (lineVal / refVal) * 100 : null
    }
  }

  // Exportação PDF
  const dadosExportacao = useMemo(() => {
    if (!linhas || linhas.length === 0) return { colunas: [], linhas: [] }
    
    const colunas = [...MESES, 'Total']
    const exportLinhas = []
    
    linhas.forEach(l => {
      if (l.tipo === 'titulo') {
        exportLinhas.push({ rotulo: l.rotulo, tipo: 'titulo', valores: [] })
        return
      }
      
      const realTotal = Object.values(l.realizado || {}).reduce((s, v) => s + (v || 0), 0)
      const orcTotal = Object.values(l.orcado || {}).reduce((s, v) => s + (v || 0), 0)
      const devTotal = realTotal - orcTotal
      const devPctTotal = orcTotal !== 0 ? (devTotal / Math.abs(orcTotal)) * 100 : 0
      
      // Line 1: Categoria - Realizado
      exportLinhas.push({
        rotulo: `${l.rotulo} (Realizado)`,
        tipo: l.tipo === 'totalizador' ? 'totalizador' : 'agrupamento',
        valores: [...Array.from({ length: 12 }, (_, i) => l.realizado[i + 1] ?? 0), realTotal]
      })
      
      // Line 2: Categoria - Planejado
      exportLinhas.push({
        rotulo: `${l.rotulo} (Orçado)`,
        tipo: 'agrupamento',
        valores: [...Array.from({ length: 12 }, (_, i) => l.orcado[i + 1] ?? 0), orcTotal]
      })

      // Line 3: Categoria - Desvio %
      exportLinhas.push({
        rotulo: `${l.rotulo} (Desvio %)`,
        tipo: 'agrupamento',
        valores: [...Array.from({ length: 12 }, (_, i) => {
          const r = l.realizado[i + 1] ?? 0
          const o = l.orcado[i + 1] ?? 0
          const diff = r - o
          return o !== 0 ? (diff / Math.abs(o)) * 100 : 0
        }), devPctTotal]
      })
    })
    
    return { colunas, linhas: exportLinhas }
  }, [linhas])

  const handleCellClick = (linha, clickedMes) => {
    let targetLinha = linha
    if (linha.tipo === 'titulo') {
      const idx = linhas.indexOf(linha)
      if (idx !== -1) {
        const nextClickable = linhas.slice(idx + 1).find(l => l.tipo === 'totalizador' || l.tipo === 'agrupamento')
        if (nextClickable) targetLinha = nextClickable
      }
    }

    if (targetLinha.tipo !== 'agrupamento' && targetLinha.tipo !== 'totalizador') return

    const cacheKey = `${clienteId}:${ano}:${targetLinha.agrupamento_slug || 'total-' + targetLinha.ordem}:${clickedMes ?? 'ano'}`
    if (activeDetail?.cacheKey === cacheKey) {
      setActiveDetail(null)
    } else {
      const refOrdem = sectionRefOrdem[targetLinha.ordem]
      const refLinha = refOrdem ? totalizadorMap[refOrdem] : null
      
      let parentTotalReal = 0
      let parentTotalOrc = 0
      let totalRealizado = 0
      let totalOrcado = 0

      if (clickedMes) {
        // Mês específico
        const rVal = targetLinha.realizado[clickedMes] !== undefined ? targetLinha.realizado[clickedMes] : (targetLinha.realizado[String(clickedMes)] ?? 0)
        const oVal = targetLinha.orcado[clickedMes] !== undefined ? targetLinha.orcado[clickedMes] : (targetLinha.orcado[String(clickedMes)] ?? 0)
        totalRealizado = rVal
        totalOrcado = oVal

        if (refLinha) {
          parentTotalReal = refLinha.realizado[clickedMes] !== undefined ? refLinha.realizado[clickedMes] : (refLinha.realizado[String(clickedMes)] ?? 0)
          parentTotalOrc = refLinha.orcado[clickedMes] !== undefined ? refLinha.orcado[clickedMes] : (refLinha.orcado[String(clickedMes)] ?? 0)
        }
      } else {
        // Ano todo
        totalRealizado = Object.values(targetLinha.realizado || {}).reduce((s, v) => s + (v || 0), 0)
        totalOrcado = Object.values(targetLinha.orcado || {}).reduce((s, v) => s + (v || 0), 0)

        if (refLinha) {
          parentTotalReal = Object.values(refLinha.realizado || {}).reduce((s, v) => s + (v || 0), 0)
          parentTotalOrc = Object.values(refLinha.orcado || {}).reduce((s, v) => s + (v || 0), 0)
        }
      }

      setActiveDetail({
        ordem: linha.ordem,
        cacheKey,
        agrupamentoSlug: targetLinha.agrupamento_slug || null,
        agrupamentoNome: gridLabelClean(linha.rotulo), // Usa o rótulo original clicado (ex: RECEITAS ou Entradas)
        clienteId,
        ano,
        mes: clickedMes,
        valoresRealizados: targetLinha.realizado,
        valoresOrcados: targetLinha.orcado,
        totalRealizado,
        totalOrcado,
        isOutflow: isOutflow(targetLinha.rotulo),
        parentTotalRealizado: parentTotalReal,
        parentTotalOrcado: parentTotalOrc
      })
    }
  }

  const toggleTotalizador = (ordem) => {
    setCollapsedTotais(prev => {
      const next = new Set(prev)
      if (next.has(ordem)) next.delete(ordem)
      else next.add(ordem)
      return next
    })
  }

  const gridLabelClean = (label) => {
    return label.replace(/^\(\s*[-+=/]+\s*\)\s*/, '')
  }

  const renderKpiDeviation = (val, pct, isCost = false) => {
    const isPositive = val >= 0
    const isFavorable = isCost ? !isPositive : isPositive
    const color = val === 0 ? 'var(--text-muted)' : (isFavorable ? '#15803D' : '#B91C1C')
    const sign = val > 0 ? '+' : ''
    return (
      <span style={{ fontSize: 10.5, fontWeight: 700, color }}>
        {sign}{pct.toFixed(1)}% ({sign}{fmt(val)})
      </span>
    )
  }

  const anos = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 1 + i)
  const versoes = ['Original', 'Rev.1', 'Rev.2']

  const renderRows = () => {
    const result = []
    
    // Configurações de largura e padding dos estilos
    const tdBase = { padding: '8px 10px', borderBottom: '0.5px solid var(--border)', fontSize: 11.5, verticalAlign: 'middle' }
    
    for (const l of linhas) {
      // 1. Oculta se pai estiver colapsado
      const parentOrdem = parentOf[l.ordem]
      if (parentOrdem && collapsedTotais.has(parentOrdem)) continue

      const isTotal = l.tipo === 'totalizador'
      const isDestaqueTitulo = l.tipo === 'agrupamento' && (
        SLUGS_DESTAQUE_TITULO.includes(l.agrupamento_slug) ||
        (!l.agrupamento_slug && SLUGS_DESTAQUE_TITULO.some(s => new RegExp(s, 'i').test(l.rotulo)))
      )
      const isClickable = viewMode === 'comparativo' && (l.tipo === 'agrupamento' || l.tipo === 'totalizador' || l.tipo === 'titulo')
      const isThisActive = isClickable && activeDetail?.ordem === l.ordem
      const isNeg = isOutflow(l.rotulo)

      let bgRow = 'transparent'
      if (l.tipo === 'titulo') bgRow = 'var(--surface-light, #f1f5f9)'
      else if (isTotal) bgRow = 'rgba(0,0,0,0.03)'
      else if (isThisActive) bgRow = 'var(--brand-light, rgba(83, 74, 183, 0.05))'
      else if (isDestaqueTitulo) bgRow = 'rgba(0,0,0,0.03)'

      const textWeight = isTotal ? 800 : 400
      const textColor = isTotal ? 'var(--text-1)' : 'var(--text-2)'
      // Reaproveita as regras do bloco de título (borda superior) para a linha de destaque,
      // sem alterar tdBase (compartilhado por todas as outras linhas).
      const tdBaseRow = isDestaqueTitulo ? { ...tdBase, borderTop: '1.5px solid var(--border)' } : tdBase

      // Título da Seção
      if (l.tipo === 'titulo') {
        result.push(
          <tr 
            key={l.ordem} 
            style={{ background: bgRow, cursor: isClickable ? 'pointer' : 'default' }}
            onClick={isClickable ? (e) => { e.stopPropagation(); handleCellClick(l, null); } : undefined}
          >
            <td colSpan={15} style={{ ...tdBase, padding: '10px 14px', fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {l.rotulo}
            </td>
          </tr>
        )
        continue
      }

      // Rótulo da linha com suporte a collapse
      const isCollapsed = collapsedTotais.has(l.ordem)
      const rotuloContent = isTotal ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          <span>{l.rotulo}</span>
        </div>
      ) : (
        <span style={{
          paddingLeft: 18,
          color: isDestaqueTitulo ? 'var(--text-1)' : (isClickable ? 'var(--brand-dark, #3b30ad)' : textColor),
          cursor: isClickable ? 'pointer' : 'default',
          fontWeight: isDestaqueTitulo ? 800 : (isClickable ? 700 : textWeight),
        }}>
          {l.rotulo}
        </span>
      )

      const realTotal = Object.values(l.realizado || {}).reduce((s, v) => s + (v || 0), 0)
      const orcTotal = Object.values(l.orcado || {}).reduce((s, v) => s + (v || 0), 0)
      const difTotal = realTotal - orcTotal
      const totalDevPct = orcTotal !== 0 ? (difTotal / Math.abs(orcTotal)) * 100 : null

      const realPartTotal = getParticipacao(l, true)
      const orcPartTotal = getParticipacao(l, false)

      // Layout Simplificado (Apenas Realizado ou Orçado)
      if (viewMode === 'realizado' || viewMode === 'orcado') {
        const values = viewMode === 'realizado' ? l.realizado : l.orcado;
        const total = viewMode === 'realizado' ? realTotal : orcTotal;
        const partTotal = viewMode === 'realizado' ? realPartTotal : orcPartTotal;

        result.push(
          <tr 
            key={l.ordem} 
            style={{ background: bgRow, cursor: isClickable ? 'pointer' : 'default' }}
            onClick={isClickable ? () => handleRowClick(l) : undefined}
          >
            {/* Rótulo */}
            <td
              style={{ ...tdBaseRow, position: 'sticky', left: 0, background: bgRow === 'transparent' ? 'var(--surface, #ffffff)' : bgRow, borderRight: '0.5px solid var(--border)', minWidth: 220, maxWidth: 280, whiteSpace: 'normal', cursor: isTotal ? 'pointer' : 'inherit', zIndex: 1 }}
              onClick={isTotal ? (e) => { e.stopPropagation(); toggleTotalizador(l.ordem); } : undefined}
            >
              {rotuloContent}
            </td>

            {/* Meses */}
            {MESES_N.map(m => {
              const val = values[m] ?? 0
              const monthlyPart = showPct ? getMonthlyPct(l, m, viewMode === 'realizado') : null
              const pctColor = viewMode === 'realizado' ? '#534AB7' : '#0ea5e9'
              return (
                <td key={m} style={{ ...tdBaseRow, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: isTotal ? 700 : 600, color: 'var(--text-1)' }}>
                  <CelulaValorPct
                    value={fmt(val)}
                    pct={monthlyPart}
                    showPct={monthlyPart !== null}
                    pctColor={pctColor}
                  />
                </td>
              )
            })}

            {/* Acumulado Ano */}
            <td style={{ ...tdBaseRow, textAlign: 'right', padding: '8px 12px', fontWeight: 800, borderLeft: '1.5px solid var(--border)', position: 'sticky', right: 80, background: isTotal ? 'var(--surface-light, #f4f6fa)' : bgRow, zIndex: 1 }}>
              {fmt(total)}
            </td>

            {/* Participação Coluna */}
            <td style={{ ...tdBaseRow, textAlign: 'right', padding: '8px 12px', fontWeight: 800, color: 'var(--brand)', position: 'sticky', right: 0, background: isTotal ? 'var(--surface-light, #f4f6fa)' : bgRow, zIndex: 1 }}>
              {partTotal !== null ? `${partTotal.toFixed(1)}%` : '—'}
            </td>
          </tr>
        )
      } else {
        // Layout Comparativo Completo (Realizado, Orçado, Desvio % verticalmente)
        result.push(
          <tr key={l.ordem} style={{ background: bgRow }}>
            {/* Rótulo */}
            <td
              style={{ ...tdBaseRow, position: 'sticky', left: 0, background: bgRow === 'transparent' ? 'var(--surface, #ffffff)' : bgRow, borderRight: '0.5px solid var(--border)', minWidth: 220, maxWidth: 280, whiteSpace: 'normal', cursor: isTotal ? 'pointer' : (isClickable ? 'pointer' : 'inherit'), verticalAlign: 'middle', zIndex: 1 }}
              onClick={isTotal ? (e) => { e.stopPropagation(); toggleTotalizador(l.ordem); } : (isClickable ? (e) => { e.stopPropagation(); handleCellClick(l, null); } : undefined)}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div>{rotuloContent}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: 4, paddingLeft: isTotal ? 20 : 18, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <span style={{ fontWeight: 800, color: '#334155' }}>• Realizado</span>
                  <span style={{ fontWeight: 800, color: '#475569' }}>• Planejado</span>
                  <span style={{ fontWeight: 800, color: '#64748b' }}>• Desvio %</span>
                </div>
              </div>
            </td>

            {/* 12 Meses */}
            {MESES_N.map(m => {
              const real = l.realizado[m] ?? 0
              const orc = l.orcado[m] ?? 0
              const diff = real - orc
              const devPct = orc !== 0 ? (diff / Math.abs(orc)) * 100 : null

              const realMonthlyPart = showPct ? getMonthlyPct(l, m, true) : null
              const orcMonthlyPart = showPct ? getMonthlyPct(l, m, false) : null

              let devColor = 'inherit'
              if (diff !== 0) {
                if (isNeg) {
                  devColor = diff > 0 ? 'var(--red, #ef4444)' : 'var(--green, #22c55e)'
                } else {
                  devColor = diff > 0 ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)'
                }
              }

              return (
                <td
                  key={m}
                  style={{ ...tdBaseRow, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11, cursor: isClickable ? 'pointer' : 'inherit' }}
                  onClick={isClickable ? (e) => { e.stopPropagation(); handleCellClick(l, m); } : undefined}
                >
                  {/* Realizado */}
                  <CelulaValorPct
                    value={fmt(real)}
                    color="var(--text-1, #0f172a)"
                    fontWeight={800}
                    pct={realMonthlyPart}
                    showPct={realMonthlyPart !== null}
                    pctColor="#534AB7"
                  />
                  {/* Planejado */}
                  <CelulaValorPct
                    value={fmt(orc)}
                    color="var(--text-2, #334155)"
                    fontWeight={700}
                    pct={orcMonthlyPart}
                    showPct={orcMonthlyPart !== null}
                    pctColor="#0ea5e9"
                    containerStyle={{ margin: '2px 0' }}
                  />
                  {/* Desvio */}
                  <div style={{ color: devColor, fontWeight: 800, fontSize: 10.5, whiteSpace: 'nowrap' }}>
                    {fmtPct(devPct)}
                  </div>
                </td>
              )
            })}

            {/* Acumulado Ano */}
            <td
              style={{ ...tdBaseRow, textAlign: 'right', padding: '8px 12px', borderLeft: '1.5px solid var(--border)', position: 'sticky', right: 80, background: isTotal ? 'var(--surface-light, #f4f6fa)' : (isThisActive ? 'var(--brand-light, rgba(83, 74, 183, 0.05))' : 'var(--surface)'), zIndex: 1, cursor: isClickable ? 'pointer' : 'inherit' }}
              onClick={isClickable ? (e) => { e.stopPropagation(); handleCellClick(l, null); } : undefined}
            >
              <div style={{ fontWeight: 800, color: 'var(--text-1, #0f172a)' }}>{fmt(realTotal)}</div>
              <div style={{ color: 'var(--text-2, #334155)', fontWeight: 700, margin: '2px 0' }}>{fmt(orcTotal)}</div>
              <div style={{ fontWeight: 900, fontSize: 11, color: difTotal !== 0 ? (isNeg ? (difTotal > 0 ? 'var(--red)' : 'var(--green)') : (difTotal > 0 ? 'var(--green)' : 'var(--red)')) : 'inherit' }}>
                {fmtPct(totalDevPct)}
              </div>
            </td>

            {/* Participação Coluna */}
            <td
              style={{ ...tdBaseRow, textAlign: 'right', padding: '8px 12px', position: 'sticky', right: 0, background: isTotal ? 'var(--surface-light, #f4f6fa)' : (isThisActive ? 'var(--brand-light, rgba(83, 74, 183, 0.05))' : 'var(--surface)'), zIndex: 1, cursor: isClickable ? 'pointer' : 'inherit' }}
              onClick={isClickable ? (e) => { e.stopPropagation(); handleCellClick(l, null); } : undefined}
            >
              <div style={{ fontWeight: 800, color: 'var(--text-1)' }}>
                {realPartTotal !== null ? `${realPartTotal.toFixed(1)}%` : '—'}
              </div>
              <div style={{ color: 'var(--text-2)', fontWeight: 700, margin: '2px 0' }}>
                {orcPartTotal !== null ? `${orcPartTotal.toFixed(1)}%` : '—'}
              </div>
              <div style={{ height: 13 }} />
            </td>
          </tr>
        )
      }

      // 4. Renderiza painel de detalhamento inline (4 gráficos)
      if (isThisActive && activeDetail) {
        result.push(
          <tr key={l.ordem + '-detail'}>
            <td colSpan={15} style={{ padding: 0, border: 'none', position: 'sticky', left: 0, zIndex: 5, background: '#F4F4F0' }}>
              <PainelDetalheOrcamento
                agrupamentoSlug={activeDetail.agrupamentoSlug}
                agrupamentoNome={activeDetail.agrupamentoNome}
                clienteId={activeDetail.clienteId}
                ano={activeDetail.ano}
                mes={activeDetail.mes}
                valoresRealizados={activeDetail.valoresRealizados}
                valoresOrcados={activeDetail.valoresOrcados}
                totalRealizado={activeDetail.totalRealizado}
                totalOrcado={activeDetail.totalOrcado}
                isOutflow={activeDetail.isOutflow}
                parentTotalRealizado={activeDetail.parentTotalRealizado}
                parentTotalOrcado={activeDetail.parentTotalOrcado}
              />
            </td>
          </tr>
        )
      }
    }
    
    return result
  }

  const pLabel = `Janeiro a Dezembro de ${ano}`

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Controle Orçamentário</div>
          <div className="page-sub">Acompanhamento e comparativo entre Realizado vs Planejado</div>
        </div>
      </div>

      {/* Controles Principais */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        marginBottom: 20, 
        flexWrap: 'wrap', 
        alignItems: 'center',
        background: 'var(--surface-light, rgba(255,255,255,0.02))',
        padding: '16px 20px',
        borderRadius: 12,
        border: '1px solid var(--border)'
      }}>
        {isCliente ? (
          <div className="metric-card" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>
            {clientes.find(c => String(c.id) === clienteId)?.razao_social ?? 'Rio das Pedras'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Cliente</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)}
              style={{ fontSize: 13, padding: '8px 12px', minWidth: 260, borderRadius: 6 }}>
              <option value="">Selecione o cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.razao_social}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Ano</label>
          <select value={ano} onChange={e => setAno(Number(e.target.value))}
            style={{ fontSize: 13, padding: '8px 12px', width: 90, borderRadius: 6 }}>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Versão</label>
          <select value={versao} onChange={e => setVersao(e.target.value)}
            style={{ fontSize: 13, padding: '8px 12px', width: 120, borderRadius: 6 }}>
            {versoes.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)' }}>Modo de Visualização</label>
          <SegControl
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'comparativo', label: 'Comparativo' },
              { value: 'realizado', label: 'Realizado' },
              { value: 'orcado', label: 'Orçado' }
            ]}
          />
        </div>
      </div>

      {/* Tabela de Dados */}
      {!clienteId ? (
        <div className="empty-state">Selecione um cliente para visualizar o orçamento.</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>
          Processando e carregando dados orçamentários...
        </div>
      ) : linhas.length > 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, boxShadow: 'var(--shadow-sm)' }}>
          
          {/* Top Summary Dashboard (Show/Hide) */}
          {showDashboard && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-hover)' }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Faturamento / Vendas</span>
                <span style={{ fontSize: 17, fontWeight: 800 }}>R$ {fmt(kpis.vendas.real)}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Orçado: R$ {fmt(kpis.vendas.orc)}</span>
                  {renderKpiDeviation(kpis.vendas.dev, kpis.vendas.pct)}
                </div>
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-hover)' }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lucro Bruto</span>
                <span style={{ fontSize: 17, fontWeight: 800 }}>R$ {fmt(kpis.lucro.real)}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Orçado: R$ {fmt(kpis.lucro.orc)}</span>
                  {renderKpiDeviation(kpis.lucro.dev, kpis.lucro.pct)}
                </div>
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-hover)' }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Custos Operacionais</span>
                <span style={{ fontSize: 17, fontWeight: 800 }}>R$ {fmt(kpis.custos.real)}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Orçado: R$ {fmt(kpis.custos.orc)}</span>
                  {renderKpiDeviation(kpis.custos.dev, kpis.custos.pct, true)}
                </div>
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-hover)' }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>EBITDA</span>
                <span style={{ fontSize: 17, fontWeight: 800 }}>R$ {fmt(kpis.ebitda.real)}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Orçado: R$ {fmt(kpis.ebitda.orc)}</span>
                  {renderKpiDeviation(kpis.ebitda.dev, kpis.ebitda.pct)}
                </div>
              </div>
            </div>
          )}

          {/* Área principal: Sidebar de Ações à esquerda, Tabela à direita */}
          <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
            
            {/* Sidebar Lateral de Ações (Toolbar) à esquerda */}
            <div style={{
              width: 46, flexShrink: 0, borderRight: '1.5px solid var(--border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '12px 6px', gap: 10, background: '#EAEAE6', borderRadius: '6px 0 0 6px'
            }}>
              <style>{`
                .fc-sidebar-btn {
                  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 32px;
                  height: 32px;
                  border-radius: 8px;
                  cursor: pointer;
                  border: 1px solid transparent !important;
                  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
                }
                .fc-sidebar-btn:hover {
                  transform: scale(1.1);
                  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
                }
                /* Dashboard Toggle: Amber/Orange */
                .fc-sidebar-btn-dash {
                  background: #fffbeb !important;
                  color: #d97706 !important;
                  border: 1px solid #fde68a !important;
                }
                .fc-sidebar-btn-dash.active {
                  background: #d97706 !important;
                  color: #fff !important;
                  border-color: #d97706 !important;
                }
                /* Export PDF: Red/Coral */
                .fc-sidebar-btn-pdf {
                  background: #fef2f2 !important;
                  color: #dc2626 !important;
                  border: 1px solid #fecaca !important;
                }
                /* % Participation: Sky Blue */
                .fc-sidebar-btn-pct {
                  background: #f0f9ff !important;
                  color: #0284c7 !important;
                  border: 1px solid #bae6fd !important;
                }
                .fc-sidebar-btn-pct.active {
                  background: #0284c7 !important;
                  color: #fff !important;
                  border-color: #0284c7 !important;
                }
                /* Expand: Emerald Green */
                .fc-sidebar-btn-expand {
                  background: #ecfdf5 !important;
                  color: #059669 !important;
                  border: 1px solid #a7f3d0 !important;
                }
                /* Collapse: Indigo/Purple */
                .fc-sidebar-btn-collapse {
                  background: #faf5ff !important;
                  color: #7c3aed !important;
                  border: 1px solid #e9d5ff !important;
                }
                /* Claude IA: Soft Orange/Peach */
                .fc-sidebar-btn-claude {
                  background: #fff7ed !important;
                  color: #ea580c !important;
                  border: 1px solid #ffedd5 !important;
                }
                .fc-sidebar-btn-claude.active {
                  background: #ea580c !important;
                  color: #fff !important;
                  border-color: #ea580c !important;
                }
                /* Gemini IA: Light Blue/Google Blue */
                .fc-sidebar-btn-gemini {
                  background: #f0f4ff !important;
                  color: #1a73e8 !important;
                  border: 1px solid #d2e3fc !important;
                }
                .fc-sidebar-btn-gemini.active {
                  background: #1a73e8 !important;
                  color: #fff !important;
                  border-color: #1a73e8 !important;
                }
                /* OpenRouter IA: Yellow/Gold */
                .fc-sidebar-btn-or {
                  background: #fffbeb !important;
                  color: #ca8a04 !important;
                  border: 1px solid #fef08a !important;
                }
                .fc-sidebar-btn-or.active {
                  background: #ca8a04 !important;
                  color: #fff !important;
                  border-color: #ca8a04 !important;
                }
                /* Logout: Dark Red */
                .fc-sidebar-btn-logout {
                  background: #fff5f5 !important;
                  color: #e53e3e !important;
                  border: 1px solid #feb2b2 !important;
                }
              `}</style>
              
              {/* Dashboard / Dash Toggle */}
              <button
                onClick={() => setShowDashboard(d => !d)}
                title={showDashboard ? "Ocultar Painel Resumo" : "Exibir Painel Resumo"}
                className={`fc-sidebar-btn fc-sidebar-btn-dash ${showDashboard ? 'active' : ''}`}
              >
                <LayoutDashboard size={16} />
              </button>

              {/* PDF Export */}
              <BotaoExportarPDF
                titulo="Demonstrativo Orçamentário"
                clienteNome={clientes.find(c => String(c.id) === clienteId)?.razao_social ?? 'Rio das Pedras'}
                periodo={pLabel}
                colunas={dadosExportacao.colunas}
                linhas={dadosExportacao.linhas}
                iconOnly={true}
                className="fc-sidebar-btn fc-sidebar-btn-pdf"
              />

              {/* % participação */}
              <button
                onClick={() => setShowPct(p => !p)}
                title="Mostrar % Participação Mensal"
                className={`fc-sidebar-btn fc-sidebar-btn-pct ${showPct ? 'active' : ''}`}
              >
                <Percent size={15} />
              </button>

              {/* Editar Orçamento */}
              <button
                onClick={() => navigate(`/controladoria/orcamento/editar?cliente_id=${clienteId}&ano=${ano}&versao=${versao}`)}
                title="Editar Orçamento"
                className="fc-sidebar-btn"
              >
                <Pencil size={15} />
              </button>

              {/* Expandir tudo */}
              <button
                onClick={() => setCollapsedTotais(new Set())}
                title="Expandir Todas as Seções"
                className="fc-sidebar-btn fc-sidebar-btn-expand"
              >
                <ChevronsDown size={16} />
              </button>

              {/* Colapsar tudo */}
              <button
                onClick={() => setCollapsedTotais(new Set(allTotalizadores))}
                title="Colapsar Todas as Seções"
                className="fc-sidebar-btn fc-sidebar-btn-collapse"
              >
                <ChevronsUp size={16} />
              </button>

              {/* Separador */}
              <div style={{ width: '60%', height: 1, background: 'rgba(0,0,0,0.1)', margin: '8px 0' }} />

              {/* Assistentes de IA */}
              <button
                onClick={() => podeClaude ? setAiPanel(aiPanel === 'claude' ? null : 'claude') : toast.error('Claude não está liberado para o seu usuário. Solicite a liberação.')}
                title="Assistente Claude"
                className={`fc-sidebar-btn fc-sidebar-btn-claude ${aiPanel === 'claude' ? 'active' : ''}`}
                style={{
                  opacity: podeClaude ? 1 : 0.35,
                  filter: podeClaude ? 'none' : 'grayscale(100%)',
                  cursor: podeClaude ? 'pointer' : 'not-allowed',
                }}
              >
                <LogoClaude size={16} />
              </button>

              <button
                onClick={() => podeGemini ? setAiPanel(aiPanel === 'gemini' ? null : 'gemini') : toast.error('Gemini não está liberado para o seu usuário. Solicite a liberação.')}
                title="Assistente Gemini"
                className={`fc-sidebar-btn fc-sidebar-btn-gemini ${aiPanel === 'gemini' ? 'active' : ''}`}
                style={{
                  opacity: podeGemini ? 1 : 0.35,
                  filter: podeGemini ? 'none' : 'grayscale(100%)',
                  cursor: podeGemini ? 'pointer' : 'not-allowed',
                }}
              >
                <LogoGemini size={16} />
              </button>

              <button
                onClick={() => podeOR ? setAiPanel(aiPanel === 'openrouter' ? null : 'openrouter') : toast.error('OpenRouter não está liberado para o seu usuário. Solicite a liberação.')}
                title="Assistente OpenRouter"
                className={`fc-sidebar-btn fc-sidebar-btn-or ${aiPanel === 'openrouter' ? 'active' : ''}`}
                style={{
                  opacity: podeOR ? 1 : 0.35,
                  filter: podeOR ? 'none' : 'grayscale(100%)',
                  cursor: podeOR ? 'pointer' : 'not-allowed',
                }}
              >
                <LogoOpenRouter size={12} />
              </button>

              {/* Separador */}
              <div style={{ width: '60%', height: 1, background: 'rgba(0,0,0,0.1)', margin: '8px 0' }} />

              {/* Voltar ao filtro */}
              <button
                onClick={() => setClienteId('')}
                title="Sair do Relatório (Voltar)"
                className="fc-sidebar-btn fc-sidebar-btn-logout"
              >
                <LogOut size={16} />
              </button>
            </div>

            {/* Tabela de Dados */}
            <div style={{ flex: 1, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1400 }}>
                <thead>
                  <tr style={{ background: 'var(--surface, #ffffff)', color: '#475569' }}>
                    <th style={{ 
                      textAlign: 'left', 
                      padding: '12px 14px', 
                      minWidth: 220,
                      position: 'sticky', 
                      left: 0, 
                      background: 'var(--surface, #ffffff)', 
                      zIndex: 3,
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1.5px solid var(--border)',
                      borderTop: '0.5px solid var(--border)',
                      color: '#475569'
                    }}>
                      Conta / Categoria
                    </th>
                    {MESES.map((m, i) => (
                      <th key={i} style={{ 
                        textAlign: 'right', 
                        padding: '12px 8px', 
                        minWidth: 95,
                        background: 'var(--surface, #ffffff)',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        borderBottom: '1.5px solid var(--border)',
                        borderTop: '0.5px solid var(--border)',
                        color: '#475569'
                      }}>{m}</th>
                    ))}
                    <th style={{ 
                      textAlign: 'right', 
                      padding: '12px 12px', 
                      minWidth: 110,
                      borderLeft: '1.5px solid var(--border)',
                      position: 'sticky',
                      right: 80,
                      background: 'var(--surface, #ffffff)',
                      zIndex: 2,
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1.5px solid var(--border)',
                      borderTop: '0.5px solid var(--border)',
                      color: '#475569'
                    }}>
                      Acumulado Ano
                    </th>
                    <th style={{ 
                      textAlign: 'right', 
                      padding: '12px 12px', 
                      minWidth: 80,
                      position: 'sticky',
                      right: 0,
                      background: 'var(--surface, #ffffff)',
                      zIndex: 2,
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1.5px solid var(--border)',
                      borderTop: '0.5px solid var(--border)',
                      color: '#475569'
                    }}>
                      Part. %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {renderRows()}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      ) : (
        <div className="empty-state">Nenhum dado orçamentário carregado para os filtros selecionados.</div>
      )}
    </div>
  )
}
