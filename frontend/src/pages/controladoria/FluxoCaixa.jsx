import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, Percent, ChevronsDown, ChevronsUp, LayoutDashboard, Download, LogOut } from 'lucide-react'
import { demonstrativoFcAPI, clientesAPI } from '../../services/api'
import { LoadingPage } from '../../components/shared'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

import BotaoExportarPDF from '../../components/BotaoExportarPDF'
import PainelDetalheAgrupamento from '../../components/PainelDetalheAgrupamento'
import CelulaValorPct from '../../components/CelulaValorPct'
import { LogoClaude, LogoGemini, LogoOpenRouter } from '../../components/FloatingAI'

const MESES      = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const ANOS       = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i)
const MESES_N    = Array.from({ length: 12 }, (_, i) => i + 1)

// Linhas de dados que devem GANHAR APARÊNCIA de título (negrito + fundo destacado + borda
// superior), sem virar `tipo === 'titulo'` de verdade — continuam mostrando valores e %.
// Promover outra linha no futuro = só adicionar o slug aqui.
const SLUGS_DESTAQUE_TITULO = ['compras']

const getErroDesc = (erro) => {
  if (!erro) return '';
  if (erro === 'div_zero') return 'Erro: Divisão por zero na fórmula';
  if (erro === 'ciclo') return 'Erro: Referência circular / ciclo de cálculo';
  if (erro.startsWith('ref_inexistente:')) {
    const ref = erro.split(':')[1];
    return `Erro: Fórmula referencia elemento inexistente: '${ref}'`;
  }
  if (erro.startsWith('erro_calculo:')) {
    const detail = erro.substring('erro_calculo:'.length);
    return `Erro de cálculo: ${detail}`;
  }
  return `Erro de fórmula: ${erro}`;
}

const fmt = v =>
  v == null ? '—' :
  Math.abs(v) >= 1000 && v % 1 === 0
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Regra única de célula vazia/zero: sem dado (null) => "—"; valor 0 numa linha normal => "—";
// valor 0 numa linha em negrito (totalizador/destaque) => "0,00" (ver DESIGN_SYSTEM.md).
const fmtCelula = (v, boldRow) => (v == null || (v === 0 && !boldRow)) ? '—' : fmt(v)

const fmtPct = v => v == null ? '' : `${v.toFixed(1)}%`

function corValor(v) {
  if (v == null || v === 0) return 'var(--text-muted)'
  return v < 0 ? '#D25656' : 'var(--text)'
}

const cleanLabel = (text) => {
  if (!text) return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const isOutflow = (label) => {
  const l = (label || '').toLowerCase()
  return l.includes('pessoal') || l.includes('serviço') || l.includes('imposto') || l.includes('despesa') || l.includes('custo') || l.includes('pagamento') || l.includes('saída')
}

const getPerfilLinha = (rotulo) => {
  const clean = cleanLabel(rotulo)

  // Lucro das Operações (EBITDA)
  if (clean.includes('lucrodasoperacoes') || clean.includes('ebitda')) {
    return 'especial'
  }

  // Destaques
  const destaque = ['compras', 'lucrobruto', 'emprestimos']
  if (destaque.some(d => clean.includes(d))) {
    return 'destaque'
  }

  // Derivadas
  const derivada = [
    'vendasliquidasrecebidas', 'vendasliquidas',
    'margemdevenda1', 'margemdevenda2',
    'movimentofinanceiro', 'mvtofinanceiro',
    'lucroantesdoimpostoderenda', 'lucroantesdoir',
    'lucroliquido',
    'investimentosefinanciamentos',
    'ncg1', 'ncg2',
    'socios', 'coligadas'
  ]
  if (derivada.some(d => clean.includes(d))) {
    return 'derivada'
  }

  // Padrão (Entradas, Saídas, Sub Total de Fornecedores, Custos Operacionais, Vendas Totais)
  const padraoMatches = ['entradas', 'saidas', 'fornecedores', 'custosoperacionais', 'vendastotais']
  if (padraoMatches.some(p => clean.includes(p))) {
    return 'padrao'
  }

  return 'padrao'
}



// Para cada agrupamento: qual totalizador fecha sua seção (collapse e % de participação)
function buildGroupings(linhas) {
  const parentOf        = {}
  const sectionRefOrdem = {}
  // ordem do totalizador -> slug composto das contas-filhas da seção ('slug1+slug2+...').
  // Permite abrir o MESMO gráfico das analíticas ao clicar num totalizador (que
  // sozinho não tem agrupamento_slug próprio — é uma fórmula).
  const totalizadorChildSlugs = {}
  let pending = []
  let pendingSlugs = []
  for (const l of linhas) {
    if (l.tipo === 'titulo') {
      pending = []
      pendingSlugs = []
    } else if (l.tipo === 'agrupamento') {
      pending.push(l.ordem)
      if (l.agrupamento_slug) pendingSlugs.push(l.agrupamento_slug)
    } else if (l.tipo === 'totalizador') {
      for (const o of pending) {
        parentOf[o]        = l.ordem
        sectionRefOrdem[o] = l.ordem
      }
      if (pendingSlugs.length) totalizadorChildSlugs[l.ordem] = pendingSlugs.join('+')
      pending = []
      pendingSlugs = []
    }
  }
  return { parentOf, sectionRefOrdem, totalizadorChildSlugs }
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

export default function FluxoCaixa({ aiPanel, setAiPanel }) {
  const hoje = new Date()
  const { usuario } = useAuth()
  const isAdmin = usuario?.perfil === 'admin'
  const podeClaude = isAdmin || usuario?.ia_claude === true
  const podeGemini = isAdmin || usuario?.ia_gemini === true
  const podeOR     = isAdmin || usuario?.ia_openrouter === true

  const [clientes,    setClientes]    = useState([])
  const [clienteId,   setClienteId]   = useState('')
  const [ano,         setAno]         = useState(hoje.getFullYear())
  const [mes,         setMes]         = useState(hoje.getMonth() + 1)
  const [modo,        setModo]        = useState('mensal')
  const [dados,       setDados]       = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [erro,        setErro]        = useState('')

  // Melhoria 1 — expand/collapse de seções por totalizador
  const [collapsedTotais, setCollapsedTotais] = useState(new Set())

  // Melhoria 2 — % de participação (modo "todos")
  const [showPct, setShowPct] = useState(false)

  // Toggle do mini-dashboard de resumo
  const [showDashboard, setShowDashboard] = useState(false)

  // Melhoria 3 — painel de detalhe por célula de valor
  // { ordem, cacheKey, agrupamentoNome, periodo, clienteId, ano, mes, mesFim, modo, totalAgrupamento }
  const [activeDetail, setActiveDetail] = useState(null)


  useEffect(() => {
    clientesAPI.listar({ modulo_analises_gerenciais: true }).then(r => setClientes(r.data)).catch(() => {})
  }, [])

  const carregar = useCallback(() => {
    if (!clienteId) return
    setLoading(true)
    setErro('')
    setDados(null)
    setActiveDetail(null)
    setCollapsedTotais(new Set())
    const params = { cliente_id: clienteId, ano, modo }
    if (modo !== 'todos') params.mes = mes
    demonstrativoFcAPI.carregar(params)
      .then(r => setDados(r.data))
      .catch(e => setErro(e?.response?.data?.detail ?? 'Erro ao carregar demonstrativo'))
      .finally(() => setLoading(false))
  }, [clienteId, ano, mes, modo])

  useEffect(() => { carregar() }, [carregar])

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


  const { parentOf, sectionRefOrdem, totalizadorMap, allTotalizadores, totalizadorChildSlugs } = useMemo(() => {
    if (!dados) return { parentOf: {}, sectionRefOrdem: {}, totalizadorMap: {}, allTotalizadores: new Set(), totalizadorChildSlugs: {} }
    const { parentOf, sectionRefOrdem, totalizadorChildSlugs } = buildGroupings(dados.linhas)
    const totalizadorMap = Object.fromEntries(dados.linhas.map(l => [l.ordem, l]))
    const allTotalizadores = new Set(
      dados.linhas.filter(l => l.tipo === 'totalizador').map(l => l.ordem)
    )
    return { parentOf, sectionRefOrdem, totalizadorMap, allTotalizadores, totalizadorChildSlugs }
  }, [dados])

  // Dados no formato genérico aceito por POST /api/pdf/demonstrativo
  const dadosExportacao = useMemo(() => {
    if (!dados) return { colunas: [], linhas: [] }
    if (modo === 'todos') {
      const colunas = [...MESES, 'Total']
      const linhas = dados.linhas.map(l => {
        if (l.tipo === 'titulo') return { rotulo: l.rotulo, tipo: 'titulo', valores: [] }
        const valoresMeses = MESES_N.map(m => l.valores_mensais ? (l.valores_mensais[m] ?? 0) : 0)
        const total = valoresMeses.reduce((s, v) => s + (v ?? 0), 0)
        return { rotulo: l.rotulo, tipo: l.tipo, valores: [...valoresMeses, total] }
      })
      return { colunas, linhas }
    }
    const colunas = ['Realizado', '% Vendas']
    const linhas = dados.linhas.map(l => {
      if (l.tipo === 'titulo') return { rotulo: l.rotulo, tipo: 'titulo', valores: [] }
      return { rotulo: l.rotulo, tipo: l.tipo, valores: [l.realizado ?? 0, l.pct_realizado ?? null] }
    })
    return { colunas, linhas }
  }, [dados, modo])

  // Estatísticas/KPIs do demonstrativo para o painel resumo (dashboard)
  const kpis = useMemo(() => {
    if (!dados) return null
    const vendasTotais = dados.linhas.find(l => l.rotulo.toLowerCase().includes('vendas - totais'))
    const margem1 = dados.linhas.find(l => l.rotulo.toLowerCase().includes('margem de venda 1'))
    const margem2 = dados.linhas.find(l => l.rotulo.toLowerCase().includes('margem de venda 2'))

    const getVal = (linha) => {
      if (!linha) return 0
      if (modo === 'todos') {
        return Object.values(linha.valores_mensais ?? {}).reduce((s, v) => s + (v ?? 0), 0)
      }
      return linha.realizado ?? 0
    }

    return {
      receita: getVal(vendasTotais),
      margem1: getVal(margem1),
      saldo: getVal(margem2),
    }
  }, [dados, modo])


  const toggleTotalizador = (ordem) => {
    setCollapsedTotais(prev => {
      const next = new Set(prev)
      if (next.has(ordem)) next.delete(ordem)
      else next.add(ordem)
      return next
    })
  }

  const obterDadosLocaisTotalizador = (targetOrdem, modoClique, mesClique) => {
    if (!dados || !dados.linhas) return null
    const totalizador = dados.linhas.find(l => l.ordem === targetOrdem)
    if (!totalizador || totalizador.tipo !== 'totalizador') return null

    const filhas = dados.linhas.filter(l => l.tipo === 'agrupamento' && parentOf[l.ordem] === targetOrdem)

    let mesRef = null
    let mesFimRef = null

    if (modoClique === 'todos') {
      if (mesClique && mesClique !== 'all') {
        mesRef = Number(mesClique)
      } else {
        mesRef = null
      }
    } else if (modoClique === 'mensal') {
      mesRef = dados.mes
    } else if (modoClique === 'acumulado') {
      mesRef = dados.mes
      mesFimRef = dados.mes_fim
    }

    const isDeducao = (l) => {
      const rot = l.rotulo || ''
      return rot.includes('( - )') || isOutflow(rot)
    }

    const atual = []
    const anterior = []

    filhas.forEach(l => {
      let valAtual = 0
      let valAnterior = 0

      const multiplicador = isDeducao(l) ? -1 : 1

      if (modoClique === 'todos') {
        if (mesRef !== null) {
          valAtual = (l.valores_mensais ? (l.valores_mensais[mesRef] ?? 0) : 0) * multiplicador
          if (mesRef > 1) {
            valAnterior = (l.valores_mensais ? (l.valores_mensais[mesRef - 1] ?? 0) : 0) * multiplicador
          }
        } else {
          const totalAno = l.valores_mensais
            ? Object.values(l.valores_mensais).reduce((s, v) => s + (v ?? 0), 0)
            : (l.realizado ?? 0)
          valAtual = totalAno * multiplicador
          valAnterior = 0
        }
      } else if (modoClique === 'mensal') {
        valAtual = (l.realizado ?? 0) * multiplicador
        if (mesRef > 1) {
          valAnterior = (l.valores_mensais ? (l.valores_mensais[mesRef - 1] ?? 0) : 0) * multiplicador
        }
      } else if (modoClique === 'acumulado') {
        valAtual = (l.realizado ?? 0) * multiplicador
        const ultimoMes = mesFimRef ?? mesRef
        if (ultimoMes > 1) {
          valAnterior = (l.valores_mensais ? (l.valores_mensais[ultimoMes - 1] ?? 0) : 0) * multiplicador
        }
      }

      atual.push({
        conta_origem: l.rotulo,
        descricao: '',
        valor: valAtual
      })

      anterior.push({
        conta_origem: l.rotulo,
        descricao: '',
        valor: valAnterior
      })
    })

    const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const trend = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      const val = totalizador.valores_mensais ? (totalizador.valores_mensais[m] ?? 0) : 0
      return { mes: MESES_ABR[i], valor: val }
    })

    const obterRotuloPeriodo = (mIni, mFim, a) => {
      if (mIni === null) return `Ano ${a}`
      if (mFim === null || mIni === mFim) return `${MESES_ABR[mIni - 1]}/${a}`
      return `${MESES_ABR[mIni - 1]} a ${MESES_ABR[mFim - 1]}/${a}`
    }

    let pAtual = obterRotuloPeriodo(mesRef, mesFimRef, ano)
    let pAnterior = '—'
    if (modoClique === 'acumulado') {
      const ultimoMes = mesFimRef ?? mesRef
      if (ultimoMes > 1) {
        pAnterior = obterRotuloPeriodo(ultimoMes - 1, null, ano)
      }
    } else if (mesRef && mesRef > 1) {
      pAnterior = obterRotuloPeriodo(mesRef - 1, null, ano)
    }

    return {
      atual,
      anterior,
      periodo_atual: pAtual,
      periodo_anterior: pAnterior,
      trend
    }
  }

  // Abre/fecha painel de detalhe ao clicar numa célula de valor
  const handleCellClick = (ordem, cacheKey, detail) => {
    let targetDetail = { ...detail }
    let targetOrdem = ordem
    const clickedLinha = dados?.linhas?.find(l => l.ordem === ordem)
    
    if (clickedLinha && clickedLinha.tipo === 'titulo') {
      const idx = dados.linhas.indexOf(clickedLinha)
      if (idx !== -1) {
        const nextClickable = dados.linhas.slice(idx + 1).find(l => l.tipo === 'totalizador' || l.tipo === 'agrupamento')
        if (nextClickable) {
          targetOrdem = nextClickable.ordem
          targetDetail.agrupamentoSlug = nextClickable.agrupamento_slug
            || (nextClickable.tipo === 'totalizador' ? totalizadorChildSlugs[nextClickable.ordem] : null)
            || null
          targetDetail.totalAgrupamento = nextClickable.realizado ?? 0
        }
      }
    }

    const resolvedLinha = dados?.linhas?.find(l => l.ordem === targetOrdem)
    if (resolvedLinha) {
      const isTotalizador = resolvedLinha.tipo === 'totalizador'
      const isDestaqueTitulo = resolvedLinha.tipo === 'agrupamento' && (
        SLUGS_DESTAQUE_TITULO.includes(resolvedLinha.agrupamento_slug) ||
        (!resolvedLinha.agrupamento_slug && SLUGS_DESTAQUE_TITULO.some(s => new RegExp(s, 'i').test(resolvedLinha.rotulo)))
      )
      const bold = resolvedLinha.negrito_totalizador || isTotalizador || isDestaqueTitulo
      const perfil = getPerfilLinha(resolvedLinha.rotulo)

      let mesClique = null
      let modoClique = modo
      
      const parts = cacheKey.split(':')
      if (parts.length >= 4) {
        const t = parts[2]
        const m = parts[3]
        if (t === 'm' && m !== 'all') {
          mesClique = m
        }
        if (m === 'all') {
          modoClique = 'todos'
          mesClique = 'all'
        }
      }

      // Receita do período correspondente (usado pelo perfil especial)
      let receitaVal = 0
      const linhaReceita = dados?.linhas?.find(l => {
        const c = cleanLabel(l.rotulo)
        return c.includes('vendastotais')
      })
      if (linhaReceita) {
        if (modoClique === 'todos') {
          if (mesClique && mesClique !== 'all') {
            receitaVal = linhaReceita.valores_mensais ? (linhaReceita.valores_mensais[Number(mesClique)] ?? 0) : 0
          } else {
            receitaVal = linhaReceita.valores_mensais
              ? Object.values(linhaReceita.valores_mensais).reduce((s, v) => s + (v ?? 0), 0)
              : (linhaReceita.realizado ?? 0)
          }
        } else {
          receitaVal = linhaReceita.realizado ?? 0
        }
      }

      targetDetail.valoresMensaisLinha = resolvedLinha.valores_mensais || null
      targetDetail.realizadoLinha = resolvedLinha.realizado ?? null
      targetDetail.rotuloLinha = resolvedLinha.rotulo || ''
      targetDetail.isBold = bold
      targetDetail.perfilLinha = perfil
      targetDetail.receitaPeriodo = receitaVal

      if (isTotalizador && perfil === 'padrao') {
        targetDetail.isTotalizador = true
        targetDetail.dadosLocais = obterDadosLocaisTotalizador(targetOrdem, modoClique, mesClique)
      } else {
        targetDetail.isTotalizador = false
        targetDetail.dadosLocais = null
      }
    }

    // Mesma célula → fecha
    if (activeDetail?.cacheKey === cacheKey && activeDetail?.ordem === ordem) {
      setActiveDetail(null)
      return
    }
    // Nova célula → reabre
    setActiveDetail({ ordem, cacheKey, ...targetDetail })
  }

  // Helpers de participação baseada em Vendas Totais (até ordem 15) e Vendas Líquidas Recebidas (acima)
  const getBaseRow = (linha) => {
    if (!dados || !dados.linhas || !linha) return null
    if (linha.ordem <= 15) {
      return dados.linhas.find(l => l.ordem === 12 || l.rotulo.toLowerCase().includes('vendas - totais') || l.rotulo.toLowerCase().includes('vendas totais'))
    }
    return dados.linhas.find(l => {
      const clean = l.rotulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '')
      return clean.includes('vendasliquidasrecebidas') || clean.includes('vendasliquidas')
    })
  }

  const getPct = (linha, mes_i) => {
    if (linha.tipo === 'titulo') return null
    const baseRow = getBaseRow(linha)
    if (!baseRow) return null
    
    let refVal, lineVal
    if (modo === 'todos') {
      if (mes_i !== null) {
        refVal  = baseRow.valores_mensais?.[mes_i] ?? 0
        lineVal = linha.valores_mensais?.[mes_i] ?? 0
      } else {
        refVal  = Object.values(baseRow.valores_mensais ?? {}).reduce((s, v) => s + (v ?? 0), 0)
        lineVal = Object.values(linha.valores_mensais  ?? {}).reduce((s, v) => s + (v ?? 0), 0)
      }
    } else {
      refVal  = baseRow.realizado ?? 0
      lineVal = linha.realizado    ?? 0
    }
    if (!refVal) return null
    return (lineVal / refVal) * 100
  }

  const modoOpts = [
    { value: 'mensal',    label: 'Mensal' },
    { value: 'acumulado', label: 'Acumulado' },
    { value: 'todos',     label: 'Todos os meses' },
  ]

  const periodoLabel = dados
    ? (modo === 'todos'
        ? `Ano ${dados.ano} — todos os meses`
        : modo === 'acumulado'
          ? `Jan–${MESES[(dados.mes ?? 1) - 1]}/${dados.ano}`
          : `${MESES[(dados.mes ?? 1) - 1]}/${dados.ano}`)
    : ''

  const thBase = {
    background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 700,
    padding: '12px 14px', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 2,
    borderBottom: '1.5px solid var(--border)',
    borderTop: '0.5px solid var(--border)',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  }

  const colSpanAll = modo === 'todos' ? 14 : 3

  const renderRows = () => {
    if (!dados) return null
    const result = []

    for (const linha of dados.linhas) {
      const {
        ordem, tipo, rotulo, negrito_totalizador,
        realizado, pct_realizado, valores_mensais,
        conta_count, agrupamento_slug, erro, erros_mensais,
      } = linha

      // Agrupamentos sob totalizador colapsado ficam ocultos
      if (tipo === 'agrupamento') {
        const parent = parentOf[ordem]
        if (parent !== undefined && collapsedTotais.has(parent)) continue
      }

      const isTotalizador     = tipo === 'totalizador'
      const isDestaqueTitulo  = tipo === 'agrupamento' && (
        SLUGS_DESTAQUE_TITULO.includes(agrupamento_slug) ||
        (!agrupamento_slug && SLUGS_DESTAQUE_TITULO.some(s => new RegExp(s, 'i').test(rotulo)))
      )
      const bold          = negrito_totalizador || isTotalizador || isDestaqueTitulo
      const perfil        = getPerfilLinha(rotulo)
      const bgRow         = (negrito_totalizador || isDestaqueTitulo) ? 'rgba(83, 74, 183, 0.03)' : 'transparent'
      const isExpanded    = !collapsedTotais.has(ordem)

      // Células clicáveis em qualquer tipo de linha (títulos, totalizadores ou agrupamentos)
      const isClickable = tipo === 'agrupamento' || tipo === 'totalizador' || tipo === 'titulo'

      // Slug usado pelo painel de detalhe (gráfico). Agrupamento usa o próprio;
      // totalizador (sem slug próprio) usa o composto das contas-filhas da seção,
      // para renderizar o MESMO gráfico das analíticas em vez de dar erro.
      const detailSlug = agrupamento_slug || (isTotalizador ? totalizadorChildSlugs[ordem] : null) || null

      const tdBase = {
        padding: '10px 14px', fontSize: 12, fontWeight: bold ? 700 : 400,
        borderBottom: '0.5px solid var(--border)', background: bgRow,
        transition: 'all 0.15s ease',
        ...(isDestaqueTitulo ? { borderTop: '1.5px solid var(--border)' } : {}),
      }


      if (tipo === 'titulo') {
        const cacheKey = `${clienteId}:${ano}:titulo-${ordem}:ano`
        const detail = {
          agrupamentoSlug: null,
          agrupamentoNome: rotulo,
          periodo: periodoLabel,
          clienteId,
          ano,
          mes: dados.mes,
          mesFim: dados.mes_fim,
          modo,
          totalAgrupamento: 0,
          isOutflow: isOutflow(rotulo)
        }
        result.push(
          <tr 
            key={ordem} 
            style={{ background: 'var(--surface)', cursor: 'pointer' }}
            onClick={() => handleCellClick(ordem, cacheKey, detail)}
          >
            <td colSpan={colSpanAll} style={{
              padding: '8px 12px', fontSize: 11, fontWeight: 800,
              color: 'var(--text-muted)', letterSpacing: '.7px',
              textTransform: 'uppercase', borderTop: '2px solid var(--border)',
            }}>
              {rotulo}
            </td>
          </tr>
        )
        continue
      }

      // Rótulo: totalizadores têm chevron, filhos têm conector visual tracejado
      const rotuloContent = (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: isTotalizador ? 0 : 8 }}>
          {isTotalizador ? (
            isExpanded ? (
              <ChevronDown size={13} style={{ flexShrink: 0, color: 'var(--brand)', transition: 'transform 0.2s' }} />
            ) : (
              <ChevronRight size={13} style={{ flexShrink: 0, color: 'var(--text-muted)', transition: 'transform 0.2s' }} />
            )
          ) : (
            <span style={{
              width: 12,
              height: 12,
              borderLeft: '1.5px dashed var(--border)',
              borderBottom: '1.5px dashed var(--border)',
              marginRight: 4,
              marginTop: -6,
              flexShrink: 0
            }} />
          )}
          <span style={{
            color: bold ? 'var(--text)' : 'var(--text-2)',
            fontSize: bold ? '12.5px' : '12px',
            fontWeight: isDestaqueTitulo ? 800 : undefined,
          }}>
            {rotulo}
          </span>
        </span>
      )


      // Helper: monta uma célula de valor clicável.
      // pctEnabled controla se o slot de % é reservado (independe do valor de `pct`, que
      // pode ser null quando a linha não tem % a exibir — ver CelulaValorPct).
      const makeValueCell = (key, v, extraStyle, cacheKey, detail, pct, pctEnabled, erroCell) => {
        const isThisActive = isClickable && activeDetail?.cacheKey === cacheKey && activeDetail?.ordem === ordem
        return (
          <td key={key}
            className="fc-cell-val"
            style={{
              ...tdBase, ...extraStyle,
              fontVariantNumeric: 'tabular-nums',
              cursor: isClickable && !erroCell ? 'pointer' : 'default',
            }}
            onClick={isClickable && !erroCell ? () => handleCellClick(ordem, cacheKey, detail) : undefined}
            title={getErroDesc(erroCell)}
          >
            <CelulaValorPct
              value={erroCell ? "—" : fmtCelula(v, bold)}
              color={erroCell ? "var(--danger)" : corValor(v)}
              fontWeight={isThisActive ? 700 : (bold ? 700 : 400)}
              underline={false}
              pct={erroCell ? null : pct}
              showPct={erroCell ? false : !!pctEnabled}
            />
          </td>
        )
      }


      if (modo === 'todos') {
        const totalRow = valores_mensais
          ? Object.values(valores_mensais).reduce((s, v) => s + (v ?? 0), 0)
          : (realizado ?? 0)
        const pctTotal = showPct && (tipo === 'agrupamento' || isTotalizador) ? getPct(linha, null) : null

        result.push(
          <tr key={ordem} className="fc-row" style={{ background: bgRow }}>
            {/* Coluna rótulo — sticky */}
            <td
              style={{ ...tdBase, position: 'sticky', left: 0, background: bgRow === 'transparent' ? 'var(--surface, #ffffff)' : '#F5F4FB',
                borderRight: '0.5px solid var(--border)', minWidth: 200, maxWidth: 260,
                whiteSpace: 'normal', cursor: isClickable ? 'pointer' : 'default', zIndex: 1 }}
              onClick={isTotalizador && perfil === 'padrao' ? (e) => { e.stopPropagation(); toggleTotalizador(ordem); } : (isClickable ? (e) => { e.stopPropagation(); handleCellClick(ordem, `${clienteId}:${ano}:m:all:${agrupamento_slug || 'total-' + ordem}`, { agrupamentoSlug: detailSlug, agrupamentoNome: rotulo, periodo: periodoLabel, clienteId, ano, mes: dados.mes, mesFim: dados.mes_fim, modo, totalAgrupamento: totalRow, isOutflow: isOutflow(rotulo) }); } : undefined)}
            >
              {rotuloContent}
            </td>

            {/* 12 colunas de mês */}
            {MESES_N.map(m => {
              const v   = valores_mensais ? (valores_mensais[m] ?? 0) : 0
              const erroM = erros_mensais ? erros_mensais[m] : null
              const pct = showPct && (tipo === 'agrupamento' || isTotalizador) ? getPct(linha, m) : null
              const ck = isClickable && !erroM
                ? `${clienteId}:${ano}:m:${m}:${agrupamento_slug || 'total-' + ordem}`
                : null
              const detail = isClickable && !erroM
                ? {
                    agrupamentoSlug: detailSlug, agrupamentoNome: rotulo,
                    periodo: `${MESES_FULL[m - 1]}/${ano}`, clienteId, ano, mes: m, mesFim: null,
                    modo: 'todos', totalAgrupamento: v, isOutflow: isOutflow(rotulo)
                  }
                : null
              return makeValueCell(m, v, { textAlign: 'right', whiteSpace: 'nowrap' }, ck, detail, pct, showPct, erroM)
            })}

            {/* Coluna Total — congelada à direita (sticky), fundo opaco para não deixar
                o conteúdo rolado vazar por trás (padrão do módulo Orçamento). */}
            <td
              style={{ ...tdBase, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                position: 'sticky', right: 0, zIndex: 1,
                background: bgRow === 'transparent' ? 'var(--surface, #ffffff)' : '#F5F4FB',
                borderLeft: '1.5px solid var(--border)', whiteSpace: 'nowrap', cursor: isClickable && !erro ? 'pointer' : 'inherit' }}
              onClick={isClickable && !erro ? (e) => { e.stopPropagation(); handleCellClick(ordem, `${clienteId}:${ano}:m:all:${agrupamento_slug || 'total-' + ordem}`, { agrupamentoSlug: detailSlug, agrupamentoNome: rotulo, periodo: periodoLabel, clienteId, ano, mes: dados.mes, mesFim: dados.mes_fim, modo, totalAgrupamento: totalRow, isOutflow: isOutflow(rotulo) }); } : undefined}
              title={getErroDesc(erro)}
            >
              <CelulaValorPct
                value={erro ? "—" : fmtCelula(totalRow, bold)}
                color={erro ? "var(--danger)" : corValor(totalRow)}
                pct={erro ? null : pctTotal}
                showPct={erro ? false : showPct}
              />
            </td>
          </tr>
        )
      } else {
        // Modo mensal / acumulado
        const val = realizado ?? 0
        const ck = isClickable && !erro
          ? `${clienteId}:${ano}:${modo === 'mensal' ? 'm' : 'a'}:${mes}:${agrupamento_slug || 'total-' + ordem}`
          : null
        const detail = isClickable && !erro
          ? modo === 'mensal'
            ? {
                agrupamentoSlug: detailSlug, agrupamentoNome: rotulo,
                periodo: MESES_FULL[mes - 1], clienteId, ano, mes, mesFim: null,
                modo: 'mensal', totalAgrupamento: val, isOutflow: isOutflow(rotulo)
              }
            : {
                agrupamentoSlug: detailSlug, agrupamentoNome: rotulo,
                periodo: `Acumulado Jan a ${MESES[mes - 1]}`, clienteId, ano, mes: 1, mesFim: mes,
                modo: 'acumulado', totalAgrupamento: val, isOutflow: isOutflow(rotulo)
              }
          : null

        result.push(
          <tr key={ordem} className="fc-row" style={{ background: bgRow }}>
            <td
              style={{ ...tdBase, minWidth: 220, cursor: isClickable && !erro ? 'pointer' : 'default' }}
              onClick={isTotalizador && perfil === 'padrao' ? (e) => { e.stopPropagation(); toggleTotalizador(ordem); } : (isClickable && !erro ? (e) => { e.stopPropagation(); handleCellClick(ordem, ck, detail); } : undefined)}
            >
              {rotuloContent}
            </td>

            {makeValueCell('val', val, { textAlign: 'right', whiteSpace: 'nowrap' }, ck, detail, null, false, erro)}

            <td style={{ ...tdBase, textAlign: 'right', color: '#1e293b', fontWeight: 700, fontSize: 11.5 }}>
              {erro ? '' : fmtPct(pct_realizado)}
            </td>
          </tr>
        )
      }

      // Painel de detalhe — aparece logo abaixo da linha quando esta linha tem o activeDetail.
      // key=cacheKey força remount (e reanimação) sempre que uma célula diferente é aberta.
      if (activeDetail?.ordem === ordem) {
        result.push(
          <tr key={`detail-${ordem}`}>
            <td colSpan={colSpanAll} style={{ padding: 0, position: 'sticky', left: 0, zIndex: 5, background: '#F4F4F0' }}>
              <PainelDetalheAgrupamento
                key={activeDetail.cacheKey}
                agrupamentoSlug={activeDetail.agrupamentoSlug}
                agrupamentoNome={activeDetail.agrupamentoNome}
                periodo={activeDetail.periodo}
                clienteId={activeDetail.clienteId}
                ano={activeDetail.ano}
                mes={activeDetail.mes}
                mesFim={activeDetail.mesFim}
                modo={activeDetail.modo}
                totalAgrupamento={activeDetail.totalAgrupamento}
                isOutflow={activeDetail.isOutflow}
                isTotalizador={activeDetail.isTotalizador || false}
                dadosLocais={activeDetail.dadosLocais || null}
                valoresMensaisLinha={activeDetail.valoresMensaisLinha || null}
                realizadoLinha={activeDetail.realizadoLinha ?? null}
                rotuloLinha={activeDetail.rotuloLinha || ''}
                isBold={activeDetail.isBold || false}
                perfilLinha={activeDetail.perfilLinha || 'padrao'}
                receitaPeriodo={activeDetail.receitaPeriodo ?? null}
              />
            </td>
          </tr>
        )
      }
    }

    return result
  }

  return (
    <div className="page">
      <style>{`
        .fc-row {
          transition: background-color 0.12s ease;
        }
        /* Hover OPACO: fundo translúcido deixava o conteúdo rolado vazar por trás
           das colunas congeladas (sticky) exatamente na linha sob o mouse. */
        .fc-row:hover td {
          background-color: #F4F3FB !important;
        }
        .app-shell.hide-sidebar .sidebar {
          display: none !important;
        }
        .app-shell.hide-sidebar .main-area {
          margin-left: 0 !important;
          padding-left: 0 !important;
          width: 100vw !important;
          max-width: 100vw !important;
        }
      `}</style>
      <div className="page-header">
        <div>
          <div className="page-title">Fluxo de Caixa Executivo</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
            Demonstrativo gerado a partir dos lançamentos importados
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="card" style={{ padding: 16, marginBottom: 20,
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
          <label>Cliente</label>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label>Ano</label>
          <select value={ano} onChange={e => setAno(+e.target.value)}>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {modo !== 'todos' && (
          <div className="form-group" style={{ margin: 0 }}>
            <label>Mês</label>
            <select value={mes} onChange={e => setMes(+e.target.value)}>
              {MESES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom: 1 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Modo</div>
          <SegControl value={modo} onChange={setModo} options={modoOpts} />
        </div>
      </div>

      {!clienteId && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Selecione um cliente para visualizar o demonstrativo.
        </div>
      )}

      {clienteId && loading && <LoadingPage />}

      {clienteId && !loading && erro && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--red, #EF4444)' }}>
          {erro}
        </div>
      )}

      {!loading && dados && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Cabeçalho do demonstrativo */}
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)',
            display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg)' }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{dados.cliente_nome}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', background: 'var(--surface)', padding: '3px 10px', borderRadius: 12 }}>
              {periodoLabel}
            </span>
          </div>

          {/* Painel de KPI Dashboard */}
          {showDashboard && kpis && (
            <div style={{
              display: 'flex', gap: 16, padding: '16px 20px',
              borderBottom: '0.5px solid var(--border)', background: 'rgba(83, 74, 183, 0.015)',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: 200, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Entradas de Vendas</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)' }}>R$ {fmt(kpis.receita)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 200, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 8 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Margem de Venda 1</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>R$ {fmt(kpis.margem1)}</span>
              </div>
              <div style={{ flex: 1, minWidth: 200, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, background: kpis.saldo >= 0 ? 'rgba(34, 197, 94, 0.04)' : 'rgba(239, 68, 68, 0.04)', border: kpis.saldo >= 0 ? '0.5px solid rgba(34, 197, 94, 0.2)' : '0.5px solid rgba(239, 68, 68, 0.2)', borderRadius: 8 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: kpis.saldo >= 0 ? '#166534' : '#991B1B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fluxo de Caixa Líquido</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: kpis.saldo >= 0 ? '#15803D' : '#B91C1C' }}>R$ {fmt(kpis.saldo)}</span>
              </div>
            </div>
          )}

          {/* Área principal: Sidebar de Ações à esquerda, Tabela à direita */}
          <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
            {/* Sidebar Lateral de Ações (Toolbar) à esquerda */}
            <div style={{
              width: 46, flexShrink: 0, borderRight: '1.5px solid var(--border)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '12px 6px', gap: 10, background: '#EAEAE6'
            }}>
              {/* Estilo CSS injetado localmente para hover e efeitos modernos da sidebar */}
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
                titulo="Fluxo de Caixa Executivo"
                clienteNome={dados.cliente_nome}
                periodo={periodoLabel}
                colunas={dadosExportacao.colunas}
                linhas={dadosExportacao.linhas}
                iconOnly={true}
                className="fc-sidebar-btn fc-sidebar-btn-pdf"
              />

              {/* % participação (se modo todos) */}
              {modo === 'todos' && (
                <button
                  onClick={() => setShowPct(p => !p)}
                  title="% de Participação"
                  className={`fc-sidebar-btn fc-sidebar-btn-pct ${showPct ? 'active' : ''}`}
                >
                  <Percent size={15} />
                </button>
              )}

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

              {/* Sair do Relatório (Voltar) */}
              <button
                onClick={() => setClienteId('')}
                title="Sair do Relatório (Voltar)"
                className="fc-sidebar-btn fc-sidebar-btn-logout"
              >
                <LogOut size={16} />
              </button>
            </div>

            {/* Tabela */}
            <div style={{ flex: 1, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse',
                minWidth: modo === 'todos' ? 1400 : 520 }}>
                <thead>
                  {modo === 'todos' ? (
                    <tr>
                      <th style={{ ...thBase, textAlign: 'left', position: 'sticky', left: 0, zIndex: 3,
                        minWidth: 200, maxWidth: 260 }}>Conta</th>
                      {MESES.map(m => <th key={m} style={{ ...thBase, textAlign: 'right' }}>{m}</th>)}
                      <th style={{ ...thBase, textAlign: 'right',
                        borderLeft: '0.5px solid var(--border)' }}>Total</th>
                    </tr>
                  ) : (
                    <tr>
                      <th style={{ ...thBase, textAlign: 'left', minWidth: 220 }}>Conta</th>
                      <th style={{ ...thBase, textAlign: 'right', minWidth: 120 }}>Realizado</th>
                      <th style={{ ...thBase, textAlign: 'right', minWidth: 80 }}>% Vendas</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {renderRows()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
