import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Wand2, Sparkles, AlertCircle, Sparkle, Lock, Unlock } from 'lucide-react'
import { orcamentoAPI, clientesAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const ANOS = [2024, 2025, 2026, 2027, 2028]
const VERSOES = ['Original', 'Rev.1', 'Rev.2']
const MESES_NOME = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Helper para rodar fórmulas Excel-like de totalizadores
const evalJsFormula = (formula, rowState) => {
  if (!formula) return 0.0
  let f = formula.trim().toUpperCase().replace(/^=/, '')
  
  // Expand SUM(D10:D20) -> (D10+D11+...+D20)
  f = f.replace(/SUM\(D(\d+):D(\d+)\)/g, (match, d1, d2) => {
    const start = parseInt(d1), end = parseInt(d2)
    const parts = []
    for (let i = start; i <= end; i++) {
      parts.push(`D${i}`)
    }
    return `(${parts.join('+')})`
  })

  // Expand SUM(D10,D12) -> (D10+D12)
  f = f.replace(/SUM\(([^)]+)\)/g, (match, content) => {
    return `(${content.replace(/,/g, '+')})`
  })

  // Strip IFERROR(expr, fallback) -> expr
  if (f.startsWith('IFERROR(')) {
    const firstP = f.indexOf('(')
    const lastP = f.lastIndexOf(')')
    const inner = f.substring(firstP + 1, lastP)
    const commaIdx = inner.lastIndexOf(',')
    if (commaIdx !== -1) {
      f = inner.substring(0, commaIdx)
    } else {
      f = inner
    }
  }

  // Handle IF(cond, true_val, false_val) -> evaluate the false_val (the computation branch)
  if (f.startsWith('IF(')) {
    let depth = 0
    let commas = []
    for (let i = 0; i < f.length; i++) {
      if (f[i] === '(') depth++
      else if (f[i] === ')') depth--
      else if (f[i] === ',' && depth === 1) {
        commas.push(i)
      }
    }
    if (commas.length >= 2) {
      const inner = f.substring(commas[1] + 1)
      const lastP = inner.lastIndexOf(')')
      f = lastP >= 0 ? inner.substring(0, lastP) : inner
    }
  }

  // Replace D{n} with the actual value of row state
  f = f.replace(/\bD(\d+)\b/g, (match, d) => {
    const val = rowState[d]
    return val != null ? String(val) : '0'
  })

  try {
    const clean = f.replace(/[^0-9.+-/*()]/g, '')
    const res = Function(`"use strict"; return (${clean || '0'})`)()
    return isNaN(res) || !isFinite(res) ? 0.0 : res
  } catch (e) {
    return 0.0
  }
}

// Parser robusto para tratar formatação BRL de input
const parseBRL = (val) => {
  if (typeof val === 'number') return val
  if (!val) return 0.0
  let s = String(val).trim()
  
  if (s.includes(',')) {
    s = s.replace(/\./g, '') // remove pontos de milhar
    s = s.replace(',', '.')  // substitui vírgula decimal por ponto
  } else {
    const parts = s.split('.')
    if (parts.length > 2) {
      s = s.replace(/\./g, '')
    } else if (parts.length === 2) {
      const decimals = parts[1]
      if (decimals.length === 3) {
        s = s.replace(/\./g, '')
      }
    }
  }
  
  const parsed = parseFloat(s)
  return isNaN(parsed) ? 0.0 : parsed
}

export default function EditarOrcamento() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const isCliente = usuario?.perfil === 'analista'
  const [searchParams, setSearchParams] = useSearchParams()

  // State de filtros
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState(searchParams.get('cliente_id') || '')
  const [ano, setAno] = useState(Number(searchParams.get('ano')) || 2026)
  const [versao, setVersao] = useState(searchParams.get('versao') || 'Original')
  const [base, setBase] = useState(searchParams.get('base') || 'fluxo_caixa')

  // State dos dados da tabela
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false)
  const [focusedCell, setFocusedCell] = useState(null)

  // Estado para cancelar edição com Esc
  const [initialCellValue, setInitialCellValue] = useState(null)
  const isEscapingRef = useRef(false)

  // State de controle do período da cascata
  const [macroPeriodo, setMacroPeriodo] = useState('anual') // 'anual' | '1'..'12'

  // State das METAS da Cascata Macro
  const [lockedCMV, setLockedCMV] = useState(false)
  const [lockedCO, setLockedCO] = useState(false)
  const [lockedEbitda, setLockedEbitda] = useState(false)
  const [macroFat, setMacroFat] = useState(0)
  const [macroCMV, setMacroCMV] = useState(0)
  const [macroCO, setMacroCO] = useState(0)
  const [macroEbitda, setMacroEbitda] = useState(0)

  // Buffers de edição locais para os inputs dos cards para evitar oscilações e piscadas (Bug 4)
  const [fatBuffer, setFatBuffer] = useState('')
  const [fatFocado, setFatFocado] = useState(false)

  const [cmvBuffer, setCmvBuffer] = useState('')
  const [cmvFocado, setCmvFocado] = useState(false)

  const [coBuffer, setCoBuffer] = useState('')
  const [coFocado, setCoFocado] = useState(false)

  const [ebitdaBuffer, setEbitdaBuffer] = useState('')
  const [ebitdaFocado, setEbitdaFocado] = useState(false)

  // Sincroniza buffers apenas quando NÃO focado
  useEffect(() => {
    if (!fatFocado) setFatBuffer(String(macroFat))
  }, [macroFat, fatFocado])

  useEffect(() => {
    if (!cmvFocado) setCmvBuffer(String(macroCMV))
  }, [macroCMV, cmvFocado])

  useEffect(() => {
    if (!coFocado) setCoBuffer(String(macroCO))
  }, [macroCO, coFocado])

  useEffect(() => {
    if (!ebitdaFocado) setEbitdaBuffer(String(macroEbitda))
  }, [macroEbitda, ebitdaFocado])

  // State do modal de projeção
  const [modalConta, setModalConta] = useState(null)
  const [modalAbaPrincipal, setModalAbaPrincipal] = useState('metodos')
  const [projTipo, setProjTipo] = useState('inflacao')
  const [projInflacaoTaxa, setProjInflacaoTaxa] = useState(4.5)
  const [projTotalAnual, setProjTotalAnual] = useState(120000)
  const [projReceitaPct, setProjReceitaPct] = useState(5.0)
  const [projFixoValor, setProjFixoValor] = useState(5000)
  const [projFixoReajuste, setProjFixoReajuste] = useState(0.0)
  const [projDriverUnitario, setProjDriverUnitario] = useState(100.0)
  const [projDriverQtds, setProjDriverQtds] = useState({
    '1': 10, '2': 10, '3': 10, '4': 10, '5': 10, '6': 10,
    '7': 10, '8': 10, '9': 10, '10': 10, '11': 10, '12': 10
  })
  
  const [ajustePcts, setAjustePcts] = useState({
    '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0,
    '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0
  })

  const roundVal = (v) => Math.round((v + Number.EPSILON) * 100) / 100

  // Seleciona todo o conteúdo do input ao focar (Bug 2)
  const handleFocus = (e) => {
    const el = e.target
    requestAnimationFrame(() => el.select())
  }

  // 10-pass formulas resolver no frontend (React)
  const recalcularTotalizadores = useCallback((listaContas) => {
    if (!listaContas || listaContas.length === 0) return []
    
    const novaLista = listaContas.map(c => ({
      ...c,
      valores: { ...c.valores },
      realizado_ano_anterior: { ...c.realizado_ano_anterior }
    }))

    const rowValsOrc = {}
    const rowValsReal = {}
    const formulaMap = {}

    novaLista.forEach(c => {
      rowValsOrc[c.ordem] = {}
      rowValsReal[c.ordem] = {}
      for (let m = 1; m <= 12; m++) {
        rowValsOrc[c.ordem][m] = parseFloat(c.valores[String(m)]) || 0.0
        rowValsReal[c.ordem][m] = parseFloat(c.realizado_ano_anterior[String(m)]) || 0.0
      }
      if (c.tipo === 'totalizador') {
        formulaMap[c.ordem] = c.formula_texto
      }
    })

    for (let pass = 0; pass < 10; pass++) {
      let changed = false
      novaLista.forEach(c => {
        if (c.tipo !== 'totalizador') return
        const formula = formulaMap[c.ordem]
        if (!formula) return

        const newOrc = {}
        const newReal = {}
        
        for (let m = 1; m <= 12; m++) {
          const stateOrc = {}
          const stateReal = {}
          Object.keys(rowValsOrc).forEach(ord => {
            stateOrc[ord] = rowValsOrc[ord][m]
            stateReal[ord] = rowValsReal[ord][m]
          })

          newOrc[m] = evalJsFormula(formula, stateOrc)
          newReal[m] = evalJsFormula(formula, stateReal)
        }

        let rowChanged = false
        for (let m = 1; m <= 12; m++) {
          if (Math.abs(rowValsOrc[c.ordem][m] - newOrc[m]) > 0.01) {
            rowValsOrc[c.ordem][m] = newOrc[m]
            c.valores[String(m)] = roundVal(newOrc[m])
            rowChanged = true
          }
          if (Math.abs(rowValsReal[c.ordem][m] - newReal[m]) > 0.01) {
            rowValsReal[c.ordem][m] = newReal[m]
            c.realizado_ano_anterior[String(m)] = roundVal(newReal[m])
            rowChanged = true
          }
        }
        if (rowChanged) {
          changed = true
        }
      })
      if (!changed) break
    }

    return novaLista
  }, [])

  // Função para calcular os valores reais calculados na grade com base na DRE estruturada
  const getActuals = useCallback(() => {
    let totalFat = 0
    let totalCmv = 0
    let totalCO = 0
    
    const meses = macroPeriodo === 'anual' 
      ? Array.from({ length: 12 }, (_, i) => String(i + 1)) 
      : [macroPeriodo]
      
    // 1. Faturamento Base is the value of row Ordem 16 (Vendas Líquidas Recebidas)
    const rowFat = contas.find(c => c.ordem === 16)
    if (rowFat) {
      meses.forEach(m => {
        totalFat += parseFloat(rowFat.valores[m]) || 0.0
      })
    }
    
    // 2. CMV is the value of row Ordem 17 (( - ) Compras)
    const rowCmv = contas.find(c => c.ordem === 17)
    if (rowCmv) {
      meses.forEach(m => {
        totalCmv += parseFloat(rowCmv.valores[m]) || 0.0
      })
    }
    
    // 3. Custo Operacional is the value of row Ordem 58 (( = )Total de custos operacionais)
    const rowCO = contas.find(c => c.ordem === 58)
    if (rowCO) {
      meses.forEach(m => {
        totalCO += parseFloat(rowCO.valores[m]) || 0.0
      })
    }
    
    const cmvPct = totalFat > 0 ? (totalCmv / totalFat) * 100 : 0.0
    const coPct = totalFat > 0 ? (totalCO / totalFat) * 100 : 0.0
    const ebitdaPct = 100 - cmvPct - coPct
    
    return {
      fat: totalFat,
      cmv: roundVal(cmvPct),
      margem: roundVal(100 - cmvPct),
      co: roundVal(coPct),
      ebitda: roundVal(ebitdaPct)
    }
  }, [contas, macroPeriodo])

  const actuals = getActuals()

  // Sincroniza Metas com os Valores Reais apenas quando muda de período ou ao carregar os dados iniciais
  // Isso evita que alterações na grade ou cliques em balanceamento sobreponham as simulações digitadas no card
  useEffect(() => {
    if (contas.length > 0) {
      const act = getActuals()
      setMacroFat(roundVal(act.fat))
      setMacroCMV(roundVal(act.cmv))
      setMacroCO(roundVal(act.co))
      setMacroEbitda(roundVal(act.ebitda))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macroPeriodo, hasLoadedInitial])

  // Carrega clientes
  useEffect(() => {
    clientesAPI.listar({ modulo_analises_gerenciais: true })
      .then(r => {
        setClientes(r.data || [])
        if (r.data.length > 0 && !clienteId) {
          const rdp = r.data.find(c => c.id === 10)
          setClienteId(rdp ? '10' : String(r.data[0].id))
        }
      })
      .catch(() => {})
  }, [clienteId])

  // Sincroniza query params
  useEffect(() => {
    if (clienteId) {
      setSearchParams({ cliente_id: clienteId, ano: String(ano), versao, base })
    }
  }, [clienteId, ano, versao, base, setSearchParams])

  // Retorna uma Promise ao carregar a grade do servidor para permitir chaining (Bug 1 - Opção 2)
  const carregarGradePromise = () => {
    if (!clienteId) return Promise.resolve()
    return orcamentoAPI.obterEditavel(clienteId, ano, versao, base)
      .then(r => {
        const calculados = recalcularTotalizadores(r.data || [])
        setContas(calculados)
        setHasLoadedInitial(true)
      })
  }

  // Carrega grade editável
  const carregarGrade = useCallback(() => {
    setLoading(true)
    carregarGradePromise()
      .catch(() => {
        toast.error('Erro ao carregar grade de orçamento.')
        setContas([])
      })
      .finally(() => setLoading(false))
  }, [clienteId, ano, versao, base, recalcularTotalizadores])

  useEffect(() => {
    carregarGrade()
  }, [carregarGrade])

  // Calcula valores cascading macros mantendo as travas (locks)
  const getCascadingValues = (field, num) => {
    let nextCmv = macroCMV
    let nextCo = macroCO
    let nextEbitda = macroEbitda

    if (field === 'cmv') {
      nextCmv = num
      if (lockedEbitda) {
        nextCo = roundVal(100 - num - macroEbitda)
      } else if (lockedCO) {
        nextEbitda = roundVal(100 - num - macroCO)
      } else {
        nextEbitda = roundVal(100 - num - macroCO)
      }
    } else if (field === 'co') {
      nextCo = num
      if (lockedEbitda) {
        nextCmv = roundVal(100 - num - macroEbitda)
      } else if (lockedCMV) {
        nextEbitda = roundVal(100 - macroCMV - num)
      } else {
        nextEbitda = roundVal(100 - macroCMV - num)
      }
    } else if (field === 'ebitda') {
      nextEbitda = num
      if (lockedCO) {
        nextCmv = roundVal(100 - macroCO - num)
      } else if (lockedCMV) {
        nextCo = roundVal(100 - macroCMV - num)
      } else {
        nextCo = roundVal(100 - macroCMV - num)
      }
    }

    return { cmv: nextCmv, co: nextCo, ebitda: nextEbitda }
  }

  // Lógica de dependências dinâmicas da Cascata Macro
  const handleEditMacro = (field, num) => {
    if (field === 'fat') {
      setMacroFat(num)
      return
    }
    const nexts = getCascadingValues(field, num)
    setMacroCMV(nexts.cmv)
    setMacroCO(nexts.co)
    setMacroEbitda(nexts.ebitda)
  }

  const toggleLock = (field) => {
    if (field === 'cmv') {
      if (!lockedCMV && lockedCO && lockedEbitda) {
        setLockedCO(false)
      }
      setLockedCMV(!lockedCMV)
    } else if (field === 'co') {
      if (!lockedCO && lockedCMV && lockedEbitda) {
        setLockedEbitda(false)
      }
      setLockedCO(!lockedCO)
    } else if (field === 'ebitda') {
      if (!lockedEbitda && lockedCMV && lockedCO) {
        setLockedCO(false)
      }
      setLockedEbitda(!lockedEbitda)
    }
  }

  // Balancear completo Top-Down (Faturamento Base -> CMV/Compras -> Custos Operacionais)
  const handleBalancearMetas = async (optFat, optCmv, optCo) => {
    if (contas.length === 0) return
    setLoading(true)
    
    const meses = macroPeriodo === 'anual' 
      ? Array.from({ length: 12 }, (_, i) => String(i + 1)) 
      : [macroPeriodo]

    const targetFatBrl = optFat !== undefined ? optFat : (parseFloat(macroFat) || 0.0)
    const targetCmvPct = optCmv !== undefined ? optCmv : (parseFloat(macroCMV) || 0.0)
    const targetCoPct = optCo !== undefined ? optCo : (parseFloat(macroCO) || 0.0)
    
    const updatedCells = [] // Array acumulador de { slug, mes, valor }

    // 1. FATURAMENTO CASCADE: Distribuir meta de faturamento base para as contas de vendas (Ordem 6-13 e deduções)
    const salesContas = contas.filter(c => c.tipo === 'agrupamento' && (
      (c.ordem >= 6 && c.ordem <= 13) || 
      c.ordem === 15 || 
      c.ordem === 15.5 || 
      c.ordem === 15.7
    ))
    
    let actualFatBrl = 0
    const rowFat = contas.find(c => c.ordem === 16)
    if (rowFat) {
      meses.forEach(m => {
        actualFatBrl += parseFloat(rowFat.valores[m]) || 0.0
      })
    }

    if (actualFatBrl > 0) {
      const fatorFat = targetFatBrl / actualFatBrl
      salesContas.forEach(c => {
        meses.forEach(m => {
          const valAtual = parseFloat(c.valores[m]) || 0.0
          updatedCells.push({
            slug: c.agrupamento_slug,
            mes: Number(m),
            valor: roundVal(valAtual * fatorFat)
          })
        })
      })
    } else {
      const positiveSales = salesContas.filter(c => c.ordem >= 6 && c.ordem <= 13)
      const valorPorCelula = positiveSales.length > 0 
        ? targetFatBrl / (positiveSales.length * meses.length) 
        : 0.0
      salesContas.forEach(c => {
        meses.forEach(m => {
          const isSalesPos = c.ordem >= 6 && c.ordem <= 13
          updatedCells.push({
            slug: c.agrupamento_slug,
            mes: Number(m),
            valor: isSalesPos ? roundVal(valorPorCelula) : 0.0
          })
        })
      })
    }

    // 2. CMV (COMPRAS) CASCADE: Distribuir meta de CMV no Compras (Ordem 17)
    const targetCmvBrl = targetFatBrl * (targetCmvPct / 100)
    const rowCmv = contas.find(c => c.ordem === 17)
    if (rowCmv) {
      meses.forEach(m => {
        let fatDoMes = 0
        if (rowFat) {
          fatDoMes = parseFloat(rowFat.valores[m]) || 0.0
        }
        const proporcaoMes = (macroPeriodo === 'anual' && targetFatBrl > 0)
          ? (fatDoMes / targetFatBrl)
          : (1 / meses.length)
          
        updatedCells.push({
          slug: rowCmv.agrupamento_slug,
          mes: Number(m),
          valor: roundVal(targetCmvBrl * proporcaoMes)
        })
      })
    }

    // 3. CUSTO OPERACIONAL CASCADE: Distribuir meta de Custo Operacional nas categorias (Ordem 29-57)
    const targetCoBrl = targetFatBrl * (targetCoPct / 100)
    const contasCO = contas.filter(c => c.tipo === 'agrupamento' && c.ordem >= 29 && c.ordem <= 57)
    
    let somaCOAtual = 0
    contasCO.forEach(c => {
      meses.forEach(m => {
        somaCOAtual += parseFloat(c.valores[m]) || 0.0
      })
    })

    if (somaCOAtual > 0) {
      const fatorCO = targetCoBrl / somaCOAtual
      contasCO.forEach(c => {
        meses.forEach(m => {
          const valAtual = parseFloat(c.valores[m]) || 0.0
          updatedCells.push({
            slug: c.agrupamento_slug,
            mes: Number(m),
            valor: roundVal(valAtual * fatorCO)
          })
        })
      })
    } else {
      const valorPorCO = contasCO.length > 0
        ? targetCoBrl / (contasCO.length * meses.length)
        : 0.0
      contasCO.forEach(c => {
        meses.forEach(m => {
          updatedCells.push({
            slug: c.agrupamento_slug,
            mes: Number(m),
            valor: roundVal(valorPorCO)
          })
        })
      })
    }

    // Grava todas as alterações no banco de dados e recalcula o orçamento
    try {
      await Promise.all(
        updatedCells.map(cell => 
          orcamentoAPI.salvarCelula(clienteId, ano, cell.mes, cell.slug, cell.valor, versao)
        )
      )
      
      // Bug 1 - Opção 2: Recarregar a grade do servidor para atualizar perfeitamente os totalizadores complexos
      await carregarGradePromise()
      
      toast.success('Simulação de metas (CMV, Custos e EBITDA) aplicada a todo o orçamento!')
    } catch (e) {
      toast.error('Erro ao processar simulação cascata.')
      carregarGrade()
    } finally {
      setLoading(false)
    }
  }

  // Atualiza um input localmente (sem rodar recalculo de totalizadores na hora para evitar lag/flicker ao digitar)
  const handleInputChange = (slug, mes, val) => {
    setContas(prev => {
      return prev.map(c => {
        if (c.agrupamento_slug === slug) {
          return {
            ...c,
            valores: {
              ...c.valores,
              [mes]: val
            }
          }
        }
        return c
      })
    })
  }

  // Envia a célula ao backend
  const salvarCelula = async (slug, mes, valor) => {
    if (!clienteId) return
    const floatVal = parseBRL(valor)
    try {
      await orcamentoAPI.salvarCelula(clienteId, ano, mes, slug, floatVal, versao)
    } catch (e) {
      toast.error(`Erro ao salvar: ${e?.response?.data?.detail || 'Erro na API'}`)
      carregarGrade()
      throw e
    }
  }

  // Executa o blur (salva e recalcula as formulas uma unica vez ao desfocar)
  const handleBlur = (slug, mes, val) => {
    setFocusedCell(null)
    if (isEscapingRef.current) {
      isEscapingRef.current = false
      return // Cancelado com Esc, não salva no banco de dados nem avalia fórmulas
    }
    const parsedVal = parseBRL(val)
    
    // Atualiza localmente imediato
    setContas(prev => {
      return prev.map(c => {
        if (c.agrupamento_slug === slug) {
          return {
            ...c,
            valores: {
              ...c.valores,
              [mes]: parsedVal
            }
          }
        }
        return c
      })
    })

    // PUT e recarrega do servidor para recalcular totalizadores com exatidão (Bug 1 - Opção 2)
    salvarCelula(slug, mes, parsedVal)
      .then(() => {
        carregarGradePromise()
      })
      .catch(() => {})
  }

  // Implementação de Navegação e Teclado Completa (Tab/Shift+Tab, ArrowUp/Down/Left/Right, Esc para Cancelar, Enter confirma)
  const handleKeyDown = (e, slug, mes) => {
    const editableAccounts = contas.filter(c => c.tipo === 'agrupamento')
    const currentAccIdx = editableAccounts.findIndex(c => c.agrupamento_slug === slug)
    const mNum = Number(mes)

    if (e.key === 'Escape') {
      e.preventDefault()
      isEscapingRef.current = true
      
      // Restaura o valor original do estado
      setContas(prev => {
        return prev.map(item => {
          if (item.agrupamento_slug === slug) {
            return {
              ...item,
              valores: {
                ...item.valores,
                [mes]: initialCellValue
              }
            }
          }
          return item
        })
      })
      
      e.target.blur()
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      e.target.blur() // Bug 3: Enter confirma e desfoca (disparando o commit/onBlur)
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) {
        // Shift + Tab -> Voltar
        if (mNum > 1) {
          const prevInput = document.getElementById(`input-${slug}-${mNum - 1}`)
          if (prevInput) prevInput.focus()
        } else if (currentAccIdx > 0) {
          const prevSlug = editableAccounts[currentAccIdx - 1].agrupamento_slug
          setTimeout(() => {
            const prevInput = document.getElementById(`input-${prevSlug}-12`)
            if (prevInput) prevInput.focus()
          }, 20)
        }
      } else {
        // Tab -> Avançar
        if (mNum < 12) {
          const nextInput = document.getElementById(`input-${slug}-${mNum + 1}`)
          if (nextInput) nextInput.focus()
        } else if (currentAccIdx < editableAccounts.length - 1) {
          const nextSlug = editableAccounts[currentAccIdx + 1].agrupamento_slug
          setTimeout(() => {
            const nextInput = document.getElementById(`input-${nextSlug}-1`)
            if (nextInput) nextInput.focus()
          }, 20)
        }
      }
      return
    }

    if (e.key === 'ArrowLeft') {
      if (mNum > 1) {
        e.preventDefault()
        const prevInput = document.getElementById(`input-${slug}-${mNum - 1}`)
        if (prevInput) prevInput.focus()
      } else if (currentAccIdx > 0) {
        e.preventDefault()
        const prevSlug = editableAccounts[currentAccIdx - 1].agrupamento_slug
        setTimeout(() => {
          const prevInput = document.getElementById(`input-${prevSlug}-12`)
          if (prevInput) prevInput.focus()
        }, 20)
      }
      return
    }

    if (e.key === 'ArrowRight') {
      if (mNum < 12) {
        e.preventDefault()
        const nextInput = document.getElementById(`input-${slug}-${mNum + 1}`)
        if (nextInput) nextInput.focus()
      } else if (currentAccIdx < editableAccounts.length - 1) {
        e.preventDefault()
        const nextSlug = editableAccounts[currentAccIdx + 1].agrupamento_slug
        setTimeout(() => {
          const nextInput = document.getElementById(`input-${nextSlug}-1`)
          if (nextInput) nextInput.focus()
        }, 20)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      if (currentAccIdx > 0) {
        e.preventDefault()
        const prevSlug = editableAccounts[currentAccIdx - 1].agrupamento_slug
        const prevInput = document.getElementById(`input-${prevSlug}-${mes}`)
        if (prevInput) prevInput.focus()
      }
      return
    }

    if (e.key === 'ArrowDown') {
      if (currentAccIdx < editableAccounts.length - 1) {
        e.preventDefault()
        const nextSlug = editableAccounts[currentAccIdx + 1].agrupamento_slug
        const nextInput = document.getElementById(`input-${nextSlug}-${mes}`)
        if (nextInput) nextInput.focus()
      }
      return
    }
  }

  // Executa projeções locais e salva todas as 12 células
  const aplicarProjecao = async (conta, valoresProjetados) => {
    setModalConta(null)
    
    setContas(prev => {
      const updated = prev.map(c => {
        if (c.agrupamento_slug === conta.agrupamento_slug) {
          return {
            ...c,
            valores: {
              ...valoresProjetados
            }
          }
        }
        return c
      })
      return recalcularTotalizadores(updated)
    })

    toast.promise(
      Promise.all(
        Object.entries(valoresProjetados).map(([mes, valor]) =>
          orcamentoAPI.salvarCelula(clienteId, ano, Number(mes), conta.agrupamento_slug, valor, versao)
        )
      ),
      {
        loading: 'Salvando projeções...',
        success: 'Orçamento da conta updated com sucesso!',
        error: 'Erro ao salvar algumas projeções. Recarregando...'
      }
    ).then(() => {
      carregarGradePromise()
    }).catch(() => {
      carregarGrade()
    })
  }

  // Processa as lógicas de BI locais para gerar os 12 meses
  const handleProjetarLocal = (conta) => {
    const valoresProjetados = {}

    if (projTipo === 'inflacao') {
      const taxa = 1 + (projInflacaoTaxa / 100)
      for (let m = 1; m <= 12; m++) {
        const valAnterior = conta.realizado_ano_anterior[String(m)] ?? 0
        valoresProjetados[String(m)] = roundVal(valAnterior * taxa)
      }
      aplicarProjecao(conta, valoresProjetados)

    } else if (projTipo === 'receita') {
      const pct = projReceitaPct / 100
      for (let m = 1; m <= 12; m++) {
        let receitaMes = 0
        contas.forEach(c => {
          const slug = (c.agrupamento_slug || '').toLowerCase()
          if (c.tipo === 'agrupamento' && slug.startsWith('vda_')) {
            receitaMes += parseFloat(c.valores[String(m)]) || 0.0
          }
        })
        if (receitaMes === 0) receitaMes = 100000
        valoresProjetados[String(m)] = roundVal(receitaMes * pct)
      }
      aplicarProjecao(conta, valoresProjetados)

    } else if (projTipo === 'fixo') {
      const valFixo = parseFloat(projFixoValor) || 0.0
      const reajuste = 1 + (projFixoReajuste / 100)
      let valCorrente = valFixo
      for (let m = 1; m <= 12; m++) {
        valoresProjetados[String(m)] = roundVal(valCorrente)
        valCorrente *= reajuste
      }
      aplicarProjecao(conta, valoresProjetados)

    } else if (projTipo === 'driver') {
      const valUnit = parseFloat(projDriverUnitario) || 0.0
      for (let m = 1; m <= 12; m++) {
        const qtd = parseFloat(projDriverQtds[String(m)]) || 0.0
        valoresProjetados[String(m)] = roundVal(qtd * valUnit)
      }
      aplicarProjecao(conta, valoresProjetados)

    } else if (projTipo === 'sazonal') {
      let totalRealizadoAnterior = 0
      for (let m = 1; m <= 12; m++) {
        totalRealizadoAnterior += conta.realizado_ano_anterior[String(m)] ?? 0
      }

      if (totalRealizadoAnterior === 0) {
        const valorMensal = roundVal(projTotalAnual / 12)
        for (let m = 1; m <= 12; m++) valoresProjetados[String(m)] = valorMensal
      } else {
        let somaProjetada = 0
        for (let m = 1; m <= 12; m++) {
          const valAnterior = conta.realizado_ano_anterior[String(m)] ?? 0
          const factor = valAnterior / totalRealizadoAnterior
          const valorMes = roundVal(projTotalAnual * factor)
          valoresProjetados[String(m)] = valorMes
          somaProjetada += valorMes
        }
        const diff = roundVal(projTotalAnual - somaProjetada)
        if (diff !== 0) {
          valoresProjetados['12'] = roundVal(valoresProjetados['12'] + diff)
        }
      }
      aplicarProjecao(conta, valoresProjetados)

    } else if (projTipo === 'zero') {
      for (let m = 1; m <= 12; m++) valoresProjetados[String(m)] = 0.0
      aplicarProjecao(conta, valoresProjetados)

    } else if (projTipo === 'benchmark') {
      const slug = (conta.agrupamento_slug || '').toLowerCase()
      const pct = slug.startsWith('cmv_') ? 0.75 : 0.18
      for (let m = 1; m <= 12; m++) {
        let receitaMes = 0
        contas.forEach(c => {
          const s = (c.agrupamento_slug || '').toLowerCase()
          if (c.tipo === 'agrupamento' && s.startsWith('vda_')) {
            receitaMes += parseFloat(c.valores[String(m)]) || 0.0
          }
        })
        if (receitaMes === 0) receitaMes = 100000
        valoresProjetados[String(m)] = roundVal(receitaMes * pct)
      }
      aplicarProjecao(conta, valoresProjetados)
    }
  }

  // Aplica o reajuste percentual mês a mês (Aba 2 do modal)
  const handleAplicarAjustePcts = (conta) => {
    const valoresProjetados = {}
    for (let m = 1; m <= 12; m++) {
      const valAtual = parseFloat(conta.valores[String(m)]) || 0.0
      const pct = parseFloat(ajustePcts[String(m)]) || 0.0
      valoresProjetados[String(m)] = roundVal(valAtual * (1 + pct / 100))
    }
    aplicarProjecao(conta, valoresProjetados)
    setAjustePcts({
      '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0,
      '7': 0, '8': 0, '9': 0, '10': 0, '11': 0, '12': 0
    })
  }

  const handleAjustePctChange = (mes, val) => {
    setAjustePcts(prev => ({
      ...prev,
      [mes]: val
    }))
  }

  const formatCurrency = (val) => {
    if (val === 0 || val == null) return 'R$ 0'
    const formatted = Math.abs(val) >= 1000 && val % 1 === 0
      ? val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `R$ ${formatted}`
  }

  const formatValueForInput = (val, isFocused) => {
    if (val === '' || val == null || Number(val) === 0) {
      return isFocused ? '' : '—'
    }
    if (isFocused) {
      return val
    }
    const num = Number(val)
    if (isNaN(num)) return val
    return Math.abs(num) >= 1000 && num % 1 === 0
      ? num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      : num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="page" style={{ background: 'var(--bg)', padding: '24px 32px' }}>
      
      {/* Cabeçalho Premium consolidado */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button 
            type="button"
            onClick={() => navigate(`/controladoria/orcamento?cliente_id=${clienteId}&ano=${ano}&versao=${versao}`)}
            className="btn-back"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              width: 36, height: 36, border: '1px solid var(--border)', 
              borderRadius: 10, background: 'var(--surface)', cursor: 'pointer', 
              color: 'var(--text)', boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
              transition: 'transform 0.2s, background 0.2s' 
            }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseOut={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.transform = 'scale(1)' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-dark)', letterSpacing: '-0.5px', margin: 0 }}>
              Editar Orçamento (Planejado)
            </h1>
            
            <p className="page-sub" style={{ fontSize: 13, color: 'var(--text-2)', margin: '6px 0 0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: 'var(--brand)', fontSize: 14 }}>
                {clientes.find(c => String(c.id) === clienteId)?.razao_social || 'Carregando cliente...'}
              </span>
              <span style={{ color: 'var(--text-3)' }}>•</span>
              <span>Ano: <strong>{ano}</strong></span>
              <span style={{ color: 'var(--text-3)' }}>•</span>
              <span>Versão: <strong>{versao}</strong></span>
              <span style={{ color: 'var(--text-3)' }}>•</span>
              <span>Regime: <strong>{base === 'fluxo_caixa' ? 'Caixa (FC)' : 'Econômico (DRE)'}</strong></span>
            </p>
          </div>
        </div>
      </div>

      {/* Painel Glassmorphic de Cascata Macro */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.9) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 28,
        boxShadow: '0 12px 35px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} style={{ color: 'var(--brand)' }} />
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--brand-dark)', letterSpacing: '0.5px' }}>
              CASCATA INTELIGENTE DE METAS
            </h4>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-2)' }}>Período da Cascata:</label>
              <select 
                value={macroPeriodo} 
                onChange={e => setMacroPeriodo(e.target.value)}
                style={{ fontSize: 12.5, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontWeight: 600, color: 'var(--text)' }}
              >
                <option value="anual">Acumulado Anual</option>
                {MESES_NOME.map((m, idx) => (
                  <option key={idx} value={String(idx + 1)}>{m}</option>
                ))}
              </select>
            </div>
            
            <button 
              type="button"
              onClick={() => handleBalancearMetas()}
              disabled={loading}
              className="btn-primary" 
              style={{ 
                fontSize: 11.5, padding: '8px 20px', borderRadius: 8, 
                fontWeight: 800, background: 'var(--brand)', border: 'none', 
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', 
                boxShadow: '0 4px 12px rgba(0, 150, 207, 0.2)', opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Processando simulação...' : 'Balancear automaticamente para bater a meta'}
            </button>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          
          {/* Card Faturamento */}
          <div style={{ background: 'var(--surface)', borderLeft: '4px solid var(--brand)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--brand)', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: '0.3px' }}>Faturamento Base</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)' }}>R$</span>
              <input 
                type="text" 
                value={fatFocado ? fatBuffer : formatValueForInput(macroFat, false)}
                onFocus={e => {
                  setFatFocado(true)
                  handleFocus(e)
                }}
                onBlur={() => {
                  setFatFocado(false)
                  const valParsed = parseBRL(fatBuffer)
                  setMacroFat(valParsed)
                }}
                onChange={e => {
                  const cleanVal = e.target.value.replace(/[^0-9.,-]/g, '')
                  setFatBuffer(cleanVal)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    const parsed = parseBRL(fatBuffer)
                    setFatFocado(false)
                    setMacroFat(parsed)
                    e.target.blur() // Bug 3: Enter confirma
                    handleBalancearMetas(parsed, macroCMV, macroCO)
                  }
                }}
                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 15, fontWeight: 800, color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <span style={{ fontSize: 9.5, color: 'var(--text-3)', display: 'block', marginTop: 6, fontWeight: 500 }}>
              Atual: {formatCurrency(actuals.fat)}
            </span>
          </div>

          {/* Card CMV */}
          <div style={{ background: 'var(--surface)', borderLeft: '4px solid var(--red)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>CMV</span>
              <button 
                type="button"
                onClick={() => toggleLock('cmv')} 
                style={{ 
                  background: 'none', 
                  border: 'none', cursor: 'pointer', 
                  color: lockedCMV ? '#ef4444' : '#eab308',
                  width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.2s'
                }}
              >
                {lockedCMV ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <input 
                type="text" 
                value={cmvFocado ? cmvBuffer : macroCMV} 
                readOnly={lockedCMV}
                onFocus={e => {
                  if (!lockedCMV) {
                    setCmvFocado(true)
                    handleFocus(e)
                  }
                }}
                onBlur={() => {
                  setCmvFocado(false)
                  const parsed = parseFloat(cmvBuffer) || 0.0
                  handleEditMacro('cmv', parsed)
                }}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  setCmvBuffer(val)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    const parsed = parseFloat(cmvBuffer) || 0.0
                    const nexts = getCascadingValues('cmv', parsed)
                    setCmvFocado(false)
                    setMacroCMV(nexts.cmv)
                    setMacroCO(nexts.co)
                    setMacroEbitda(nexts.ebitda)
                    e.target.blur() // Bug 3: Enter confirma
                    handleBalancearMetas(macroFat, nexts.cmv, nexts.co)
                  }
                }}
                style={{ 
                  width: '65px', border: 'none', background: 'transparent', 
                  fontSize: '16px', fontWeight: 800, color: 'var(--text)', 
                  outline: 'none', textAlign: 'right', cursor: lockedCMV ? 'not-allowed' : 'text',
                  padding: 0
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>%</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-2)', display: 'block', marginTop: 6, fontWeight: 600 }}>
              Meta: {formatCurrency(macroFat * (macroCMV / 100))}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--text-3)', display: 'block', marginTop: 2 }}>
              Atual: {actuals.cmv}%
            </span>
          </div>

          {/* Card Margem Bruta */}
          <div style={{ background: 'var(--surface)', borderLeft: '4px solid var(--green)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: '0.3px' }}>Margem Bruta</span>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span>{roundVal(100 - macroCMV)}</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>%</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-2)', display: 'block', marginTop: 6, fontWeight: 600 }}>
              Meta: {formatCurrency(macroFat * ((100 - macroCMV) / 100))}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--text-3)', display: 'block', marginTop: 2 }}>
              Atual: {actuals.margem}%
            </span>
          </div>

          {/* Card Custo Operacional */}
          <div style={{ background: 'var(--surface)', borderLeft: '4px solid var(--module-analises)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--module-analises)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Custo Operacional</span>
              <button 
                type="button"
                onClick={() => toggleLock('co')} 
                style={{ 
                  background: 'none', 
                  border: 'none', cursor: 'pointer', 
                  color: lockedCO ? '#ef4444' : '#eab308',
                  width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.2s'
                }}
              >
                {lockedCO ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <input 
                type="text" 
                value={coFocado ? coBuffer : macroCO} 
                readOnly={lockedCO}
                onFocus={e => {
                  if (!lockedCO) {
                    setCoFocado(true)
                    handleFocus(e)
                  }
                }}
                onBlur={() => {
                  setCoFocado(false)
                  const parsed = parseFloat(coBuffer) || 0.0
                  handleEditMacro('co', parsed)
                }}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  setCoBuffer(val)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    const parsed = parseFloat(coBuffer) || 0.0
                    const nexts = getCascadingValues('co', parsed)
                    setCoFocado(false)
                    setMacroCMV(nexts.cmv)
                    setMacroCO(nexts.co)
                    setMacroEbitda(nexts.ebitda)
                    e.target.blur() // Bug 3: Enter confirma
                    handleBalancearMetas(macroFat, nexts.cmv, nexts.co)
                  }
                }}
                style={{ 
                  width: '65px', border: 'none', background: 'transparent', 
                  fontSize: '16px', fontWeight: 800, color: 'var(--text)', 
                  outline: 'none', textAlign: 'right', cursor: lockedCO ? 'not-allowed' : 'text',
                  padding: 0
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>%</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-2)', display: 'block', marginTop: 6, fontWeight: 600 }}>
              Meta: {formatCurrency(macroFat * (macroCO / 100))}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--text-3)', display: 'block', marginTop: 2 }}>
              Atual: {actuals.co}%
            </span>
          </div>

          {/* Card EBITDA */}
          <div style={{ background: 'var(--surface)', borderLeft: '4px solid var(--purple)', borderTop: '1px solid var(--border)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', borderRadius: 12, padding: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--purple)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>EBITDA</span>
              <button 
                type="button"
                onClick={() => toggleLock('ebitda')} 
                style={{ 
                  background: 'none', 
                  border: 'none', cursor: 'pointer', 
                  color: lockedEbitda ? '#ef4444' : '#eab308',
                  width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.2s'
                }}
              >
                {lockedEbitda ? <Lock size={12} /> : <Unlock size={12} />}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <input 
                type="text" 
                value={ebitdaFocado ? ebitdaBuffer : macroEbitda} 
                readOnly={lockedEbitda}
                onFocus={e => {
                  if (!lockedEbitda) {
                    setEbitdaFocado(true)
                    handleFocus(e)
                  }
                }}
                onBlur={() => {
                  setEbitdaFocado(false)
                  const parsed = parseFloat(ebitdaBuffer) || 0.0
                  handleEditMacro('ebitda', parsed)
                }}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  setEbitdaBuffer(val)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    const parsed = parseFloat(ebitdaBuffer) || 0.0
                    const nexts = getCascadingValues('ebitda', parsed)
                    setEbitdaFocado(false)
                    setMacroCMV(nexts.cmv)
                    setMacroCO(nexts.co)
                    setMacroEbitda(nexts.ebitda)
                    e.target.blur() // Bug 3: Enter confirma
                    handleBalancearMetas(macroFat, nexts.cmv, nexts.co)
                  }
                }}
                style={{ 
                  width: '65px', border: 'none', background: 'transparent', 
                  fontSize: '16px', fontWeight: 800, color: 'var(--text)', 
                  outline: 'none', textAlign: 'right', cursor: lockedEbitda ? 'not-allowed' : 'text',
                  padding: 0
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)' }}>%</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-2)', display: 'block', marginTop: 6, fontWeight: 600 }}>
              Meta: {formatCurrency(macroFat * (macroEbitda / 100))}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--text-3)', display: 'block', marginTop: 2 }}>
              Atual: {actuals.ebitda}%
            </span>
          </div>

        </div>
      </div>

      {/* Grade de Edição */}
      {!clienteId ? (
        <div className="empty-state">Selecione um cliente para carregar a grade de edição.</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>
          Carregando contas e referências históricas...
        </div>
      ) : contas.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Baseline Indicator Box */}
          {focusedCell && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd',
              borderRadius: 8, padding: '8px 14px', fontSize: 12.5, fontWeight: 500
            }}>
              <AlertCircle size={15} />
              <span>
                <strong>Referência Histórica:</strong> O valor realizado de{' '}
                <strong>{MESES_NOME[focusedCell.mes - 1]} / {ano - 1}</strong> para{' '}
                <em>"{contas.find(c => c.agrupamento_slug === focusedCell.slug)?.rotulo}"</em> foi{' '}
                <strong>
                  {formatCurrency(contas.find(c => c.agrupamento_slug === focusedCell.slug)?.realizado_ano_anterior[String(focusedCell.mes)] ?? 0)}
                </strong>.
              </span>
            </div>
          )}

          {/* Tabela de Lançamento */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--surface-hover)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 700, color: 'var(--text-2)', minWidth: 240, position: 'sticky', left: 0, background: 'var(--surface-hover, #f3f4f6)', zIndex: 2, boxShadow: '2px 0 5px rgba(0,0,0,0.03)' }}>Conta / Categoria</th>
                  {MESES_NOME.map(m => (
                    <th key={m} style={{ padding: '14px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-2)', width: 110 }}>{m.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contas.map(c => {
                  if (c.tipo === 'titulo') {
                    return (
                      <tr key={`titulo-${c.ordem}`} style={{ background: 'linear-gradient(90deg, rgba(0,150,207,0.05) 0%, rgba(255,255,255,0) 100%)', borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={13} style={{ padding: '12px 18px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--brand-dark)', fontSize: 11, letterSpacing: '0.8px', position: 'sticky', left: 0, zIndex: 1, background: '#F4F4F0' }}>
                          {c.rotulo}
                        </td>
                      </tr>
                    )
                  }

                  if (c.tipo === 'totalizador') {
                    return (
                      <tr key={`total-${c.ordem}`} style={{ background: 'rgba(0,150,207,0.015)', borderBottom: '1.5px solid rgba(0,150,207,0.1)', fontWeight: 700 }}>
                        <td style={{ padding: '12px 18px', color: 'var(--brand-dark)', position: 'sticky', left: 0, background: '#f7f7f5', borderRight: '1px solid var(--border)', zIndex: 1, boxShadow: '2px 0 5px rgba(0,0,0,0.02)', minWidth: 240 }}>
                          {c.rotulo}
                        </td>
                        {Array.from({ length: 12 }, (_, idx) => {
                          const mStr = String(idx + 1)
                          const val = c.valores[mStr] ?? 0.0
                          return (
                            <td key={idx} style={{ padding: '10px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text)', fontSize: 12.5 }}>
                              {formatValueForInput(val, false)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  }

                  // Linha Editável
                  return (
                    <tr key={c.agrupamento_slug} style={{ borderBottom: '0.5px solid var(--border)', transition: 'background 0.15s' }}>
                      <td style={{ 
                        padding: '8px 18px', fontWeight: 600, color: 'var(--text)', 
                        position: 'sticky', left: 0, background: 'var(--surface, #ffffff)', 
                        borderRight: '1px solid var(--border)', zIndex: 1,
                        boxShadow: '2px 0 5px rgba(0,0,0,0.02)',
                        minWidth: 240
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{c.rotulo}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setModalConta(c)
                              setModalAbaPrincipal('metodos')
                            }}
                            title="Projeção Inteligente"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 22, height: 22, border: '1px solid var(--border)',
                              borderRadius: 6, background: 'var(--brand-light)', cursor: 'pointer', color: 'var(--brand)',
                              transition: 'transform 0.15s, background 0.15s'
                            }}
                            onMouseOver={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = '#bae6fd' }}
                            onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'var(--brand-light)' }}
                          >
                            <Wand2 size={12} />
                          </button>
                        </div>
                      </td>

                      {Array.from({ length: 12 }, (_, idx) => {
                        const mStr = String(idx + 1)
                        const val = c.valores[mStr] ?? ''
                        const isFocused = focusedCell?.slug === c.agrupamento_slug && focusedCell?.mes === idx + 1
                        return (
                          <td key={idx} style={{ padding: '4px 3px' }}>
                            <input
                              id={`input-${c.agrupamento_slug}-${mStr}`}
                              type="text"
                              value={formatValueForInput(val, isFocused)}
                              onChange={(e) => {
                                const cleanVal = e.target.value.replace(/[^0-9.,-]/g, '')
                                handleInputChange(c.agrupamento_slug, mStr, cleanVal)
                              }}
                              onBlur={(e) => handleBlur(c.agrupamento_slug, mStr, e.target.value)}
                              onFocus={(e) => {
                                setFocusedCell({ slug: c.agrupamento_slug, mes: idx + 1 })
                                setInitialCellValue(val)
                                handleFocus(e) // Bug 2: Seleção ao focar
                              }}
                              onKeyDown={(e) => handleKeyDown(e, c.agrupamento_slug, mStr)}
                              placeholder="—"
                              style={{
                                width: '100%',
                                padding: '8px 10px',
                                fontSize: 12.5,
                                textAlign: 'right',
                                borderRadius: 6,
                                border: '1px solid transparent',
                                background: isFocused ? '#fff' : 'transparent',
                                color: 'var(--text)',
                                fontFamily: 'monospace',
                                outline: 'none',
                                transition: 'all 0.15s',
                                boxShadow: isFocused ? '0 0 0 2px rgba(0, 150, 207, 0.25)' : 'none'
                              }}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state">Nenhum agrupamento encontrado no template ativo.</div>
      )}

      {/* Modal de Projeção Glassmorphic */}
      {modalConta && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(9, 19, 48, 0.35)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'var(--surface, #ffffff)', border: '1px solid rgba(255,255,255,0.7)',
            borderRadius: 16, width: '90%', maxWidth: 660, padding: 28,
            boxShadow: '0 24px 38px rgba(0,0,0,0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--brand-dark)' }}>
                🪄 Projeção & Reajuste: <strong>{modalConta.rotulo}</strong>
              </h3>
              <button 
                type="button"
                onClick={() => setModalConta(null)} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)' }}
              >
                &times;
              </button>
            </div>

            {/* Abas Principais */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 14 }}>
              <button 
                type="button"
                onClick={() => setModalAbaPrincipal('metodos')}
                style={{ padding: '8px 4px', border: 'none', background: 'none', fontSize: 13, fontWeight: modalAbaPrincipal === 'metodos' ? 700 : 400, color: modalAbaPrincipal === 'metodos' ? 'var(--brand)' : 'var(--text-muted)', borderBottom: modalAbaPrincipal === 'metodos' ? '2.5px solid var(--brand)' : 'none', cursor: 'pointer' }}
              >
                1. Métodos de Projeção
              </button>
              <button 
                type="button"
                onClick={() => setModalAbaPrincipal('ajuste_pct')}
                style={{ padding: '8px 4px', border: 'none', background: 'none', fontSize: 13, fontWeight: modalAbaPrincipal === 'ajuste_pct' ? 700 : 400, color: modalAbaPrincipal === 'ajuste_pct' ? 'var(--brand)' : 'var(--text-muted)', borderBottom: modalAbaPrincipal === 'ajuste_pct' ? '2.5px solid var(--brand)' : 'none', cursor: 'pointer' }}
              >
                2. Ajuste percentual mês a mês
              </button>
            </div>

            {/* ABA PRINCIPAL 1: MÉTODOS DE PROJEÇÃO */}
            {modalAbaPrincipal === 'metodos' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
                  <button type="button" onClick={() => setProjTipo('inflacao')} style={{ padding: '8px 10px', fontSize: 11, fontWeight: projTipo === 'inflacao' ? 700 : 400, background: projTipo === 'inflacao' ? 'var(--brand-light)' : '#fff', color: projTipo === 'inflacao' ? 'var(--brand)' : 'var(--text-2)', border: projTipo === 'inflacao' ? '1.5px solid var(--brand)' : '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    📈 Ano ant. + %
                  </button>
                  <button type="button" onClick={() => setProjTipo('receita')} style={{ padding: '8px 10px', fontSize: 11, fontWeight: projTipo === 'receita' ? 700 : 400, background: projTipo === 'receita' ? 'var(--brand-light)' : '#fff', color: projTipo === 'receita' ? 'var(--brand)' : 'var(--text-2)', border: projTipo === 'receita' ? '1.5px solid var(--brand)' : '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    % % da receita
                  </button>
                  <button type="button" onClick={() => setProjTipo('fixo')} style={{ padding: '8px 10px', fontSize: 11, fontWeight: projTipo === 'fixo' ? 700 : 400, background: projTipo === 'fixo' ? 'var(--brand-light)' : '#fff', color: projTipo === 'fixo' ? 'var(--brand)' : 'var(--text-2)', border: projTipo === 'fixo' ? '1.5px solid var(--brand)' : '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    📄 Fixo / contrato
                  </button>
                  <button type="button" onClick={() => setProjTipo('driver')} style={{ padding: '8px 10px', fontSize: 11, fontWeight: projTipo === 'driver' ? 700 : 400, background: projTipo === 'driver' ? 'var(--brand-light)' : '#fff', color: projTipo === 'driver' ? 'var(--brand)' : 'var(--text-2)', border: projTipo === 'driver' ? '1.5px solid var(--brand)' : '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    ⚙️ Driver operac.
                  </button>
                  <button type="button" onClick={() => setProjTipo('sazonal')} style={{ padding: '8px 10px', fontSize: 11, fontWeight: projTipo === 'sazonal' ? 700 : 400, background: projTipo === 'sazonal' ? 'var(--brand-light)' : '#fff', color: projTipo === 'sazonal' ? 'var(--brand)' : 'var(--text-2)', border: projTipo === 'sazonal' ? '1.5px solid var(--brand)' : '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    📈 Sazonal
                  </button>
                  <button type="button" onClick={() => setProjTipo('zero')} style={{ padding: '8px 10px', fontSize: 11, fontWeight: projTipo === 'zero' ? 700 : 400, background: projTipo === 'zero' ? 'var(--brand-light)' : '#fff', color: projTipo === 'zero' ? 'var(--brand)' : 'var(--text-2)', border: projTipo === 'zero' ? '1.5px solid var(--brand)' : '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    🧹 Base zero
                  </button>
                  <button type="button" onClick={() => setProjTipo('benchmark')} style={{ padding: '8px 10px', fontSize: 11, fontWeight: projTipo === 'benchmark' ? 700 : 400, background: projTipo === 'benchmark' ? 'var(--brand-light)' : '#fff', color: projTipo === 'benchmark' ? 'var(--brand)' : 'var(--text-2)', border: projTipo === 'benchmark' ? '1.5px solid var(--brand)' : '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                    🏪 Benchmark
                  </button>
                </div>

                <div style={{ marginBottom: 24, minHeight: 120 }}>
                  {projTipo === 'inflacao' && (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                        Aplica uma taxa de crescimento percentual sobre o histórico **Realizado do Ano Anterior ({ano - 1})**.
                      </p>
                      <div className="form-group" style={{ maxWidth: 200 }}>
                        <label style={{ fontSize: 11 }}>Taxa de Crescimento (%)</label>
                        <input type="number" step="0.01" value={projInflacaoTaxa} onChange={e => setProjInflacaoTaxa(parseFloat(e.target.value) || 0.0)} />
                      </div>
                    </div>
                  )}

                  {projTipo === 'receita' && (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                        Calcula o valor mensal baseado em um percentual alvo sobre o **Faturamento Base Mensal** (soma das contas de vendas daquele mês).
                      </p>
                      <div className="form-group" style={{ maxWidth: 200 }}>
                        <label style={{ fontSize: 11 }}>Percentual Alvo (%)</label>
                        <input type="number" step="0.01" value={projReceitaPct} onChange={e => setProjReceitaPct(parseFloat(e.target.value) || 0.0)} />
                      </div>
                    </div>
                  )}

                  {projTipo === 'fixo' && (
                    <div style={{ display: 'flex', gap: 16 }}>
                      <div className="form-group" style={{ maxWidth: 200 }}>
                        <label style={{ fontSize: 11 }}>Valor Fixo Mensal (R$)</label>
                        <input type="number" value={projFixoValor} onChange={e => setProjFixoValor(parseFloat(e.target.value) || 0.0)} />
                      </div>
                      <div className="form-group" style={{ maxWidth: 200 }}>
                        <label style={{ fontSize: 11 }}>Reajuste Mensal Acumulado (%)</label>
                        <input type="number" step="0.01" value={projFixoReajuste} onChange={e => setProjFixoReajuste(parseFloat(e.target.value) || 0.0)} />
                      </div>
                    </div>
                  )}

                  {projTipo === 'driver' && (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                        Calcula o valor multiplicando as quantidades estimadas de um driver operacional pelo valor unitário da categoria.
                      </p>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                        <div className="form-group" style={{ maxWidth: 200 }}>
                          <label style={{ fontSize: 11 }}>Valor Unitário (R$)</label>
                          <input type="number" value={projDriverUnitario} onChange={e => setProjDriverUnitario(parseFloat(e.target.value) || 0.0)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                        {MESES_NOME.map((m, idx) => (
                          <div key={idx} className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: 10 }}>{m}</label>
                            <input 
                              type="number" 
                              value={projDriverQtds[String(idx + 1)]} 
                              onChange={e => setProjDriverQtds(prev => ({ ...prev, [String(idx + 1)]: parseFloat(e.target.value) || 0.0 }))}
                              style={{ padding: '4px 6px', fontSize: 11.5 }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {projTipo === 'sazonal' && (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12 }}>
                        Informa uma meta anual e distribui proporcionalmente à sazonalidade do realizado de {ano - 1}.
                      </p>
                      <div className="form-group" style={{ maxWidth: 220 }}>
                        <label style={{ fontSize: 11 }}>Meta Anual Total (R$)</label>
                        <input type="number" value={projTotalAnual} onChange={e => setProjTotalAnual(parseFloat(e.target.value) || 0.0)} />
                      </div>
                    </div>
                  )}

                  {projTipo === 'zero' && (
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Deseja zerar os valores de orçamento para todos os 12 meses desta conta?
                    </p>
                  )}

                  {projTipo === 'benchmark' && (
                    <p style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Aplica o percentual de benchmark médio sugerido para esta categoria (ex: 75% da receita para CMV, 18% para Custos) de forma automática.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button type="button" onClick={() => setModalConta(null)} style={{ padding: '8px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={() => handleProjetarLocal(modalConta)} style={{ padding: '8px 22px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                    Aplicar Projeção
                  </button>
                </div>
              </div>
            )}

            {/* ABA PRINCIPAL 2: AJUSTE PERCENTUAL MÊS A MÊS */}
            {modalAbaPrincipal === 'ajuste_pct' && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
                  Informe um percentual de reajuste (ex: 10% ou -5%) que será aplicado **diretamente sobre o valor já lançado** de cada mês.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
                  {MESES_NOME.map((m, idx) => {
                    const mStr = String(idx + 1)
                    const valAtual = parseFloat(modalConta.valores[mStr]) || 0.0
                    return (
                      <div key={idx} className="form-group" style={{ margin: 0, background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                        <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)' }}>{m.toUpperCase()}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          <input 
                            type="number" 
                            value={ajustePcts[mStr]} 
                            onChange={e => handleAjustePctChange(mStr, e.target.value)} 
                            style={{ padding: '4px 6px', fontSize: 12, width: '100%' }}
                          />
                          <span style={{ fontSize: 12, fontWeight: 700 }}>%</span>
                        </div>
                        <span style={{ fontSize: 9.5, color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
                          Atual: {formatValueForInput(valAtual, false)}
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button type="button" onClick={() => setModalConta(null)} style={{ padding: '8px 18px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                    Cancelar
                  </button>
                  <button type="button" onClick={() => handleAplicarAjustePcts(modalConta)} style={{ padding: '8px 22px', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                    Aplicar ajuste aos 12 meses
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
