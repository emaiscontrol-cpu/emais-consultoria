import { useState, useEffect } from 'react'
import { demonstrativoFcAPI } from '../services/api'
import { GraficoArea, GraficoBarras, GraficoRosca } from './Graficos'

const CustomTooltipBars = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const formatValue = v => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const p0 = payload[0].payload;
    const val0 = p0.origAtual !== undefined ? p0.origAtual : payload[0].value;
    const val1 = p0.origAnterior !== undefined ? p0.origAnterior : (payload[1]?.value ?? 0);
    return (
      <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', padding: '8px 12px', borderRadius: 4, boxShadow: 'var(--shadow)', maxWidth: 220 }}>
        <p style={{ margin: '0 0 4px 0', fontSize: 10, fontWeight: 700, color: 'var(--text)', whiteSpace: 'normal', wordBreak: 'break-all' }}>
          {payload[0].payload.conta}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10.5 }}>
          <span style={{ color: '#534AB7', fontWeight: 600 }}>Atual:</span>
          <span style={{ fontWeight: 700 }}>R$ {formatValue(val0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 10.5, marginTop: 2 }}>
          <span style={{ color: '#9B9A94', fontWeight: 600 }}>Anterior:</span>
          <span style={{ fontWeight: 700 }}>R$ {formatValue(val1)}</span>
        </div>
        {val0 != null && val1 != null && val1 !== 0 ? (
          <div style={{
            marginTop: 4, paddingTop: 4, borderTop: '0.5px solid var(--border)',
            fontSize: 10, fontWeight: 700,
            color: val0 > val1 ? '#C0392B' : '#1E8449',
            textAlign: 'right'
          }}>
            Variação: {val0 > val1 ? '+' : ''}{((val0 - val1) / Math.abs(val1) * 100).toFixed(0)}%
          </div>
        ) : null}
      </div>
    )
  }
  return null
}

const fmt = v => v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const R = 44
const CIRC = 2 * Math.PI * R

const CORES_ABC = {
  A: ['#534AB7'], // Roxo sólido
  B: ['#8F85F0'], // Lilás/Periwinkle sólido
  C: ['#C5C2EC'], // Lavanda claro sólido
}

const corPorClasse = (classe, posClasse) => {
  const arr = CORES_ABC[classe]
  return arr[Math.min(posClasse - 1, arr.length - 1)]
}

const LEGENDA_ABC = [
  { classe: 'A', bg: '#534AB7', cor: '#534AB7', desc: 'Até 70% do total' },
  { classe: 'B', bg: '#8F85F0', cor: '#8F85F0', desc: '70% a 90%' },
  { classe: 'C', bg: '#C5C2EC', cor: '#C5C2EC', desc: '90% a 100%' },
]


const nomeConta = it => `${it.conta_origem}${it.descricao ? ` · ${it.descricao}` : ''}`
const nomeCurto = it => {
  const base = it.descricao || it.conta_origem || ''
  return base.length > 18 ? `${base.slice(0, 17)}…` : base
}

// Classifica por curva ABC (70/90/100) e aplica gradiente de cor por posição dentro da classe.
function classificarABC(itens, total) {
  const ordenados = itens
    .slice()
    .sort((a, b) => Math.abs(b.valor ?? 0) - Math.abs(a.valor ?? 0))

  let acumulado = 0
  const posPorClasse = { A: 0, B: 0, C: 0 }
  return ordenados.map(it => {
    const pct = total ? (Math.abs(it.valor) / Math.abs(total)) * 100 : 0
    // Classifica pelo acumulado ANTES de somar esta conta: a conta que cruza o
    // limiar ainda pertence à classe que está sendo alcançada (ex.: uma única
    // conta com 85% do total é A, não B — o acumulado prévio era 0%, < 70%).
    const classe = acumulado < 70 ? 'A' : acumulado < 90 ? 'B' : 'C'
    acumulado += Math.abs(pct)
    posPorClasse[classe] += 1
    return { ...it, pct, classe, posClasse: posPorClasse[classe], cor: corPorClasse(classe, posPorClasse[classe]) }
  })
}

// Painel de detalhamento sofisticado por agrupamento — lista ABC + rosca + comparativo.
// Reutilizável por qualquer demonstrativo que exponha um endpoint /detalhe-comparativo no
// mesmo formato: { atual: [{conta_origem, descricao, valor}], anterior: [...], periodo_atual, periodo_anterior }.
export default function PainelDetalheAgrupamento({
  agrupamentoSlug, agrupamentoNome, periodo,
  clienteId, ano, mes, mesFim, modo = 'mensal',
  totalAgrupamento,
  isTotalizador = false,
  dadosLocais = null,
  valoresMensaisLinha = null,
  realizadoLinha = null,
  rotuloLinha = '',
  isBold = false,
  perfilLinha = 'padrao',
  receitaPeriodo = null,
}) {
  const [dados, setDados] = useState(null)
  const [erro, setErro]   = useState('')
  const [animar, setAnimar] = useState(false)

  useEffect(() => {
    if (dadosLocais) {
      setDados(dadosLocais)
      setErro('')
      setAnimar(false)
      return
    }

    const fallbackLocal = () => {
      const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      let mesRef = null
      let mesFimRef = null

      if (modo === 'todos') {
        if (mes != null) {
          mesRef = Number(mes)
        } else {
          mesRef = null
        }
      } else if (modo === 'mensal') {
        mesRef = mes
      } else if (modo === 'acumulado') {
        mesRef = mes
        mesFimRef = mesFim
      }

      let valAtual = 0
      let valAnterior = 0

      if (modo === 'todos') {
        if (mesRef !== null) {
          valAtual = valoresMensaisLinha ? (valoresMensaisLinha[mesRef] ?? 0) : 0
          if (mesRef > 1) {
            valAnterior = valoresMensaisLinha ? (valoresMensaisLinha[mesRef - 1] ?? 0) : 0
          }
        } else {
          valAtual = totalAgrupamento ?? realizadoLinha ?? 0
          valAnterior = 0
        }
      } else if (modo === 'mensal') {
        valAtual = totalAgrupamento ?? realizadoLinha ?? 0
        if (mesRef > 1) {
          valAnterior = valoresMensaisLinha ? (valoresMensaisLinha[mesRef - 1] ?? 0) : 0
        }
      } else if (modo === 'acumulado') {
        valAtual = totalAgrupamento ?? realizadoLinha ?? 0
        const ultimoMes = mesFimRef ?? mesRef
        if (ultimoMes > 1) {
          valAnterior = valoresMensaisLinha ? (valoresMensaisLinha[ultimoMes - 1] ?? 0) : 0
        }
      }

      const atual = [{
        conta_origem: rotuloLinha || agrupamentoNome || '—',
        descricao: '',
        valor: valAtual
      }]

      const anterior = [{
        conta_origem: rotuloLinha || agrupamentoNome || '—',
        descricao: '',
        valor: valAnterior
      }]

      const trend = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        const val = valoresMensaisLinha ? (valoresMensaisLinha[m] ?? 0) : 0
        return { mes: MESES_ABR[i], valor: val }
      })

      const obterRotuloPeriodo = (mIni, mFim, a) => {
        if (mIni === null) return `Ano ${a}`
        if (mFim === null || mIni === mFim) return `${MESES_ABR[mIni - 1]}/${a}`
        return `${MESES_ABR[mIni - 1]} a ${MESES_ABR[mFim - 1]}/${a}`
      }

      let pAtual = obterRotuloPeriodo(mesRef, mesFimRef, ano)
      let pAnterior = '—'
      if (modo === 'acumulado') {
        const ultimoMes = mesFimRef ?? mesRef
        if (ultimoMes > 1) {
          pAnterior = obterRotuloPeriodo(ultimoMes - 1, null, ano)
        }
      } else if (mesRef && mesRef > 1) {
        pAnterior = obterRotuloPeriodo(mesRef - 1, null, ano)
      }

      setDados({
        atual,
        anterior,
        periodo_atual: pAtual,
        periodo_anterior: pAnterior,
        trend
      })
    }

    if (perfilLinha !== 'padrao') {
      fallbackLocal()
      setErro('')
      setAnimar(false)
      return
    }

    let cancelado = false
    setDados(null)
    setErro('')
    setAnimar(false)

    const params = { cliente_id: clienteId, ano, agrupamento_slug: agrupamentoSlug, modo }
    if (mes != null) params.mes = mes
    if (mesFim != null) params.mes_fim = mesFim

    demonstrativoFcAPI.detalheComparativo(params)
      .then(r => {
        if (!cancelado) {
          if (r.data && r.data.atual && r.data.atual.length > 0) {
            setDados(r.data)
          } else if (isBold) {
            fallbackLocal()
          } else {
            setDados({ atual: [], anterior: [] })
          }
        }
      })
      .catch(() => {
        if (!cancelado) {
          if (isBold) {
            fallbackLocal()
          } else {
            setErro('Erro ao carregar lançamentos.')
          }
        }
      })

    return () => { cancelado = true }
  }, [clienteId, ano, agrupamentoSlug, modo, mes, mesFim, dadosLocais, isBold, valoresMensaisLinha, realizadoLinha, rotuloLinha, agrupamentoNome, totalAgrupamento, perfilLinha])

  // Dispara a animação só depois que o painel já está pintado com barras/arcos em 0
  useEffect(() => {
    if (!dados || (dados.atual ?? []).length === 0) return
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimar(true))
    })
    return () => cancelAnimationFrame(raf1)
  }, [dados])

  if (erro) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--red, #EF4444)' }}>{erro}</div>
    )
  }
  if (dados === null) {
    return (
      <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)' }}>Carregando...</div>
    )
  }

  const itensAtual = dados.atual ?? []
  if (itensAtual.length === 0) return null
  const itensAnterior = dados.anterior ?? []

  const total = totalAgrupamento != null && totalAgrupamento !== 0
    ? totalAgrupamento
    : itensAtual.reduce((s, i) => s + (i.valor ?? 0), 0)

  const linhas = classificarABC(itensAtual, total)

  const pctPorClasse = { A: 0, B: 0, C: 0 }
  linhas.forEach(it => { pctPorClasse[it.classe] += Math.abs(it.pct) })

  const maior = linhas[0]
  const top6 = linhas.slice(0, 6)
  const anteriorMap = new Map(itensAnterior.map(a => [a.conta_origem, a.valor]))
  const semAnterior = itensAnterior.length === 0
  const maxComp = Math.max(
    1,
    ...top6.flatMap(it => [Math.abs(it.valor ?? 0), Math.abs(anteriorMap.get(it.conta_origem) ?? 0)])
  )

  return (
    <div style={{
      background: '#EAEBE5',
      borderTop: perfilLinha === 'destaque' ? '3px solid #E24B4A' : '3px solid #534AB7',
      borderBottom: '1.5px solid #c7c7c2',
      borderLeft: 'none',
      borderRight: 'none',
      margin: '0',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.05), inset 0 -4px 10px rgba(0,0,0,0.05)',
    }}>
      {/* Estilo CSS injetado localmente para hover e efeitos modernos */}
      <style>{`
        .detail-row-item {
          transition: all 0.15s ease;
        }
        .detail-row-item:hover {
          background-color: rgba(0, 0, 0, 0.02) !important;
        }
      `}</style>
      <div style={{
        background: perfilLinha === 'destaque' ? 'rgba(226, 75, 74, 0.08)' : 'rgba(0, 0, 0, 0.03)', padding: '8px 20px',
        display: 'flex', alignItems: 'center', gap: 24,
        borderBottom: '1.5px solid #c7c7c2',
      }}>
        <span style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
          fontWeight: 700, color: perfilLinha === 'destaque' ? '#E24B4A' : 'var(--brand)',
        }}>
          Detalhamento · {agrupamentoNome} · {periodo}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
          Total: <span style={{ color: total < 0 ? '#A32D2D' : 'var(--brand-dark)', fontWeight: 800 }}>R$ {fmt(total)}</span> · <span style={{ color: 'var(--text-muted)' }}>{linhas.length} {linhas.length === 1 ? 'conta' : 'contas'}</span>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
        {/* Coluna 1 — lista de contas (só no perfil padrão, que decompõe em contas reais).
            Derivada/Destaque/Especial não mostram esta lista — apenas os gráficos. */}
        {perfilLinha === 'padrao' && (
        <div style={{
          flex: 1.2, minWidth: 320, borderRight: '1px solid rgba(0,0,0,0.06)',
          alignSelf: 'stretch', display: 'flex', flexDirection: 'column',
          justifyContent: linhas.length < 5 ? 'space-evenly' : 'flex-start',
          maxHeight: 250,
          overflowY: 'auto',
        }}>
          {linhas.map((it, i) => (
            <div key={i} className="detail-row-item" style={{
              padding: '10px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              borderBottom: i === linhas.length - 1 ? 'none' : '0.5px solid rgba(0,0,0,0.03)',
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <BadgeABC classe={it.classe} cor={it.cor} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nomeConta(it)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                  R$ {fmt(it.valor)}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: it.cor }}>
                  {it.pct.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.05)', overflow: 'hidden', marginTop: 2 }}>
                <div style={{
                  height: '100%',
                  borderRadius: 3,
                  background: it.cor,
                  width: animar ? `${Math.min(Math.abs(it.pct), 100)}%` : '0%',
                  transition: 'width 1.2s cubic-bezier(.4,0,.2,1)',
                  transitionDelay: `${i * 30}ms`,
                }} />
              </div>
            </div>
          ))}
        </div>
        )}

        {/* Coluna 2 — rosca analítica ou indicador Margem % ou omissão dependendo do perfil */}
        {perfilLinha === 'padrao' && (
          <div style={{
            width: 200, flexShrink: 0, borderRight: '1px solid rgba(0,0,0,0.06)',
            padding: '14px 12px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--text)',
              textTransform: 'uppercase', letterSpacing: '.03em',
              width: '100%', marginBottom: 5
            }}>
              Distribuição ABC
            </div>
            <div style={{ position: 'relative', width: 140, height: 140 }}>
              <GraficoRosca
                dados={[
                  { name: 'Classe A', value: pctPorClasse.A, color: '#534AB7' },
                  { name: 'Classe B', value: pctPorClasse.B, color: '#8F85F0' },
                  { name: 'Classe C', value: pctPorClasse.C, color: '#C5C2EC' },
                ]}
                innerRadius={36}
                outerRadius={55}
                altura="100%"
              />
              <div style={{
                position: 'absolute',
                top: '47%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
                  {maior ? `${Math.abs(maior.pct).toFixed(0)}%` : '—'}
                </span>
                <span style={{ fontSize: 9.5, color: 'var(--brand)', fontWeight: 700, letterSpacing: '0.02em', marginTop: 3 }}>
                  {maior ? maior.conta_origem : ''}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', justifyContent: 'center', marginTop: 8, width: '100%' }}>
              {LEGENDA_ABC.map(l => (
                <div key={l.classe} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: l.bg, flexShrink: 0 }} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: l.cor }}>{l.classe}</span>
                  <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>
                    {Math.round(pctPorClasse[l.classe] ?? 0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {perfilLinha === 'especial' && (
          <div style={{
            width: 200, flexShrink: 0, borderRight: '1px solid rgba(0,0,0,0.06)',
            padding: '14px 12px', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--text)',
              textTransform: 'uppercase', letterSpacing: '.03em',
              width: '100%', marginBottom: 15
            }}>
              Margem Operacional
            </div>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flex: 1
            }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#534AB7', lineHeight: 1 }}>
                {receitaPeriodo && receitaPeriodo !== 0
                  ? `${((totalAgrupamento / receitaPeriodo) * 100).toFixed(1)}%`
                  : '0.0%'}
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--text-muted)', fontWeight: 700, marginTop: 10, textAlign: 'center' }}>
                EBITDA / Vendas Totais
              </span>
            </div>
          </div>
        )}

        {/* Coluna 3 — comparativo com período anterior */}
        <div style={{ width: 260, flexShrink: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--text)',
              textTransform: 'uppercase', letterSpacing: '.03em',
            }}>
              Análise Comparativa
            </div>
          </div>

          {semAnterior ? (
            <div style={{
              textAlign: 'center', padding: '30px 10px',
              fontSize: 10, fontStyle: 'italic', color: 'var(--text-muted)',
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              Sem dados anteriores
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <GraficoBarras
                dados={top6.map(it => ({
                  name: nomeCurto(it),
                  Atual: Math.abs(it.valor ?? 0),
                  Anterior: Math.abs(anteriorMap.get(it.conta_origem) ?? 0),
                  origAtual: it.valor,
                  origAnterior: anteriorMap.get(it.conta_origem) ?? 0,
                  conta: nomeConta(it),
                }))}
                chaveX="name"
                altura={140}
                margin={{ top: 5, right: 5, left: -22, bottom: 5 }}
                tooltipContent={<CustomTooltipBars />}
                barras={[
                  {
                    chave: 'Atual', radius: [2, 2, 0, 0], barSize: 8,
                    cellProps: entry => ({ fill: (entry.origAtual < 0 || entry.origAnterior < 0 || entry.conta?.includes('( - )')) ? '#E24B4A' : '#534AB7' }),
                  },
                  {
                    chave: 'Anterior', radius: [2, 2, 0, 0], barSize: 8,
                    cellProps: entry => ({ fill: (entry.origAtual < 0 || entry.origAnterior < 0 || entry.conta?.includes('( - )')) ? '#ECA4A4' : '#C5C2EC' }),
                  },
                ]}
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#534AB7' }} />
                  Atual ({dados.periodo_atual ?? periodo})
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text-3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#C5C2EC' }} />
                  Anterior ({dados.periodo_anterior ?? '—'})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Coluna 4 — evolução/tendência anual */}
        <div style={{ flex: 1.5, minWidth: 350, padding: '10px 20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'var(--text)',
              textTransform: 'uppercase', letterSpacing: '.03em',
            }}>
              Evolução Mensal (Ano Corrente)
            </div>
          </div>
          {dados.trend && dados.trend.length > 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5 }}>
              <GraficoArea
                dados={dados.trend}
                chaveX="mes"
                altura={150}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                areas={[{ chave: 'valor', cor: '#534AB7', opacidade: 0.25 }]}
              />
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '30px 10px',
              fontSize: 10, fontStyle: 'italic', color: 'var(--text-muted)',
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              Sem dados de evolução
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BadgeABC({ classe, cor, size = 14 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: 3, background: cor,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 800, color: '#fff', flexShrink: 0,
    }}>
      {classe}
    </span>
  )
}

function LinhaComparativa({ it, anteriorVal, maxComp, animar, delay }) {
  const variacao = anteriorVal ? ((it.valor - anteriorVal) / Math.abs(anteriorVal)) * 100 : null
  const widthAtual    = animar ? `${Math.min(Math.abs(it.valor ?? 0) / maxComp * 100, 100)}%` : '0%'
  const widthAnterior = animar ? `${Math.min(Math.abs(anteriorVal ?? 0) / maxComp * 100, 100)}%` : '0%'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <BadgeABC classe={it.classe} cor={it.cor} size={13} />
        <span style={{
          flex: 1, minWidth: 0, fontSize: 10.5, fontWeight: 500, color: 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {nomeCurto(it)}
        </span>
        {variacao != null && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, flexShrink: 0,
            background: variacao > 0 ? '#FDE7E7' : variacao < 0 ? '#E3F5EA' : '#EEEDEA',
            color: variacao > 0 ? '#C0392B' : variacao < 0 ? '#1E8449' : '#6B6A65',
          }}>
            {variacao > 0 ? '▲' : variacao < 0 ? '▼' : '—'}{Math.abs(variacao).toFixed(0)}%
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <div style={{ flex: 1, height: 9, borderRadius: 2, background: '#EDEDEA', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#534AB7', width: widthAtual,
            transition: 'width 1s cubic-bezier(.4,0,.2,1)', transitionDelay: `${delay}ms`,
          }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#534AB7', minWidth: 50, textAlign: 'right', flexShrink: 0 }}>
          {fmt(it.valor)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ flex: 1, height: 9, borderRadius: 2, background: '#EDEDEA', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2, background: '#C5C2EC', width: widthAnterior,
            transition: 'width 1s cubic-bezier(.4,0,.2,1)', transitionDelay: `${delay}ms`,
          }} />
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 50, textAlign: 'right', flexShrink: 0 }}>
          {anteriorVal != null ? fmt(anteriorVal) : '—'}
        </span>
      </div>
    </div>
  )
}

function Rosca({ linhas, animar, maior }) {
  let acumulado = 0
  const arcos = linhas.map(it => {
    const start = acumulado
    const fatia = Math.min(Math.abs(it.pct), 100) / 100 * CIRC
    acumulado += fatia
    return { cor: it.cor, start, fatia }
  })

  return (
    <div style={{ position: 'relative', width: 120, height: 120 }}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={R} fill="none" stroke="#E0DED8" strokeWidth={14} />
        <g transform="rotate(-90 60 60)">
          {arcos.map((a, i) => (
            <circle
              key={i}
              cx={60} cy={60} r={R} fill="none"
              stroke={a.cor} strokeWidth={14}
              strokeDasharray={animar ? `${a.fatia} ${CIRC - a.fatia}` : `0 ${CIRC}`}
              strokeDashoffset={-a.start}
              style={{
                transition: 'stroke-dasharray 1.1s cubic-bezier(.4,0,.2,1)',
                transitionDelay: `${i * 100}ms`,
              }}
            />
          ))}
        </g>
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 2,
      }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: '#1A1A18' }}>
          {maior ? `${Math.abs(maior.pct).toFixed(0)}%` : '—'}
        </span>
        <span style={{
          fontSize: 8, color: '#5F5E5A', maxWidth: 62, textAlign: 'center',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {maior ? nomeCurto(maior) : ''}
        </span>
      </div>
    </div>
  )
}
