import { useState, useEffect } from 'react'
import { Thermometer, Gauge, CalendarDays, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react'
import { GraficoBarras, GraficoArea, fmtNumeroBR } from './Graficos'

const fmt = fmtNumeroBR

// Tooltip trimestral com desvio % — específico deste painel (o padrão de
// chartTheme.js não deriva percentuais, só formata valores).
const TooltipQuarters = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null
  const real = payload[0].value
  const plan = payload[1]?.value ?? 0
  const diff = real - plan
  const pct = plan !== 0 ? (diff / Math.abs(plan)) * 100 : 0
  return (
    <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', padding: '8px 12px', borderRadius: 6, boxShadow: 'var(--shadow)' }}>
      <p style={{ margin: '0 0 4px 0', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{payload[0].payload.name}</p>
      <div style={{ fontSize: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ color: '#534AB7', fontWeight: 600 }}>Realizado:</span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>R$ {fmt(real)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 2 }}>
          <span style={{ color: '#0ea5e9', fontWeight: 600 }}>Planejado:</span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>R$ {fmt(plan)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 4, paddingTop: 4, borderTop: '0.5px solid var(--border)' }}>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>Desvio %:</span>
          <span style={{ fontWeight: 700, color: diff >= 0 ? '#1E8449' : '#C0392B' }}>
            {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  )
}

export default function PainelDetalheOrcamento({
  agrupamentoSlug,
  agrupamentoNome,
  clienteId,
  ano,
  mes, // O mês clicado (1-12) ou null para o ano acumulado
  valoresRealizados,
  valoresOrcados,
  totalRealizado,
  totalOrcado,
  isOutflow,
  parentTotalRealizado,
  parentTotalOrcado
}) {
  const [animar, setAnimar] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimar(true))
    })
    return () => cancelAnimationFrame(raf)
  }, [agrupamentoSlug, mes])

  // Prepara dados para evolução mensal (Evolução Mensal)
  const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const trendData = MESES_ABR.map((mName, idx) => {
    const m = idx + 1
    const realVal = valoresRealizados[m] !== undefined ? valoresRealizados[m] : (valoresRealizados[String(m)] !== undefined ? valoresRealizados[String(m)] : 0)
    const orcVal = valoresOrcados[m] !== undefined ? valoresOrcados[m] : (valoresOrcados[String(m)] !== undefined ? valoresOrcados[String(m)] : 0)
    return {
      mes: mName,
      Realizado: realVal,
      Planejado: orcVal
    }
  })

  // Prepara dados para análise trimestral (Análise Comparativa)
  const quartersData = [
    { name: '1º Trim', Realizado: 0, Planejado: 0 },
    { name: '2º Trim', Realizado: 0, Planejado: 0 },
    { name: '3º Trim', Realizado: 0, Planejado: 0 },
    { name: '4º Trim', Realizado: 0, Planejado: 0 },
  ]
  MESES_ABR.forEach((_, idx) => {
    const m = idx + 1
    const qIdx = Math.floor((m - 1) / 3)
    const realVal = valoresRealizados[m] !== undefined ? valoresRealizados[m] : (valoresRealizados[String(m)] !== undefined ? valoresRealizados[String(m)] : 0)
    const orcVal = valoresOrcados[m] !== undefined ? valoresOrcados[m] : (valoresOrcados[String(m)] !== undefined ? valoresOrcados[String(m)] : 0)
    quartersData[qIdx].Realizado += realVal
    quartersData[qIdx].Planejado += orcVal
  })

  // Cálculos de desvio e Meta
  const pctReal = totalOrcado !== 0 ? (totalRealizado / Math.abs(totalOrcado)) * 100 : (totalRealizado !== 0 ? 100 : 0)
  const diffVal = totalRealizado - totalOrcado
  const pctDev = totalOrcado !== 0 ? (diffVal / Math.abs(totalOrcado)) * 100 : 0
  
  const isFavorable = isOutflow ? (totalRealizado <= totalOrcado) : (totalRealizado >= totalOrcado)
  const devColor = isFavorable ? '#22c55e' : '#ef4444'

  // Velocímetro SVG - Ângulo da agulha com ponta de seta
  const cappedPct = Math.min(120, Math.max(0, pctReal))
  const angleDeg = 180 + cappedPct * 1.8 // Mapeamento correto: 0% -> 180° (esquerda), 100% -> 360° (direita)

  const labelPeriodo = mes ? `${MESES_ABR[mes - 1]} / ${ano}` : `Ano ${ano} (Acumulado)`

  return (
    <div style={{
      background: '#EAEBE5',
      borderTop: '3px solid #534AB7',
      borderBottom: '1.5px solid #c7c7c2',
      margin: 0,
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.05), inset 0 -4px 10px rgba(0,0,0,0.05)'
    }}>
      <style>{`
        .chart-header-title {
          font-size: 10px;
          font-weight: 800;
          color: #1e293b;
          text-transform: uppercase;
          letter-spacing: .05em;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
      `}</style>

      {/* Cabeçalho */}
      <div style={{
        background: '#F2F2EE', padding: '8px 20px',
        display: 'flex', alignItems: 'center', gap: 24,
        borderBottom: '0.5px solid var(--border)',
      }}>
        <span style={{
          fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em',
          fontWeight: 800, color: '#334155',
        }}>
          Detalhamento · {agrupamentoNome} · {labelPeriodo}
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
          Realizado: <span style={{ color: '#534AB7', fontWeight: 800 }}>R$ {fmt(totalRealizado)}</span> · Planejado: <span style={{ color: '#0ea5e9', fontWeight: 800 }}>R$ {fmt(totalOrcado)}</span>
        </span>
      </div>

      {/* Grid de 4 Colunas */}
      <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', padding: '10px 0' }}>
        
        {/* Coluna 1 — Termômetro de Meta (Mais estreita e elegante) */}
        <div style={{
          flex: 0.6, minWidth: 170, borderRight: '1.5px solid rgba(0,0,0,0.06)',
          padding: '14px 16px', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', gap: 10
        }}>
          <div className="chart-header-title">
            <Thermometer size={13} color="#EF4444" /> Metas
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Meta (Planejado) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#1e293b' }}>
                <span>Planejado</span>
                <span>R$ {fmt(totalOrcado)}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: '#0ea5e9',
                  width: animar ? '100%' : '0%',
                  transition: 'width 1s ease-out'
                }} />
              </div>
            </div>

            {/* Realizado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#1e293b' }}>
                <span>Realizado</span>
                <span>R$ {fmt(totalRealizado)}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: '#534AB7',
                  width: animar ? `${Math.min(100, pctReal)}%` : '0%',
                  transition: 'width 1s ease-out'
                }} />
              </div>
            </div>

            {/* Desvio */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, color: '#1e293b' }}>
                <span>Desvio</span>
                <span style={{ color: devColor, fontWeight: 800 }}>
                  {pctDev > 0 ? '+' : ''}{pctDev.toFixed(1)}%
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: devColor,
                  width: animar ? `${Math.min(100, Math.abs(pctDev))}%` : '0%',
                  transition: 'width 1s ease-out'
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 2 — Velocímetro (Gradiente, Ponteiro com Seta, Percentual acima) */}
        <div style={{
          width: 200, flexShrink: 0, borderRight: '1.5px solid rgba(0,0,0,0.06)',
          padding: '14px 12px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="chart-header-title" style={{ width: '100%', marginBottom: 4 }}>
            <Gauge size={13} color="#eab308" /> Aderência
          </div>

          {/* Indicador de Percentual posicionado em cima */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#1e293b' }}>{pctReal.toFixed(1)}%</span>
            <span style={{ fontSize: 8.5, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>Atingido</span>
          </div>
          
          <div style={{ position: 'relative', width: 140, height: 95 }}>
            <svg width="140" height="95" viewBox="0 0 140 95">
              <defs>
                {/* Gradiente do arco que vai do azul claro ao roxo do comparativo */}
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#bae6fd" />
                  <stop offset="50%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#534AB7" />
                </linearGradient>
              </defs>
              
              {/* Trilho de Fundo */}
              <path
                d="M 15,85 A 55,55 0 0,1 125,85"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Trilho Ativo com Gradiente */}
              <path
                d="M 15,85 A 55,55 0 0,1 125,85"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={172.7}
                strokeDashoffset={172.7 - (172.7 * Math.min(100, pctReal)) / 100}
                style={{
                  transition: 'stroke-dashoffset 1s ease-out',
                  opacity: animar ? 1 : 0
                }}
              />
              
              {/* Ponteiro em formato de Seta */}
              <g 
                transform={animar ? `rotate(${angleDeg}, 70, 85)` : `rotate(180, 70, 85)`} 
                style={{ transition: 'transform 1s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}
              >
                {/* Corpo do ponteiro */}
                <line x1="70" y1="85" x2="110" y2="85" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                {/* Seta da ponta */}
                <polygon points="106,81 118,85 106,89" fill="#1e293b" />
                {/* Eixo central */}
                <circle cx="70" cy="85" r="5" fill="#1e293b" />
              </g>
            </svg>
          </div>
        </div>

        {/* Coluna 3 — Trimestres comparativo */}
        <div style={{ width: 280, flexShrink: 0, padding: '10px 14px', display: 'flex', flexDirection: 'column', borderRight: '1.5px solid rgba(0,0,0,0.06)' }}>
          <div className="chart-header-title">
            <CalendarDays size={13} color="#0ea5e9" /> Análise Comparativa
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <GraficoBarras
              dados={quartersData}
              chaveX="name"
              altura={140}
              margin={{ top: 5, right: 5, left: -22, bottom: 5 }}
              tooltipContent={<TooltipQuarters />}
              barras={[
                { chave: 'Realizado', cor: '#534AB7', barSize: 12 },
                { chave: 'Planejado', cor: '#0ea5e9', barSize: 12 },
              ]}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: '#1e293b', fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#534AB7' }} />
                Realizado
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: '#1e293b', fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#0ea5e9' }} />
                Planejado
              </span>
            </div>
          </div>
        </div>

        {/* Coluna 4 — Evolução Mensal (Espaço ampliado) */}
        <div style={{ flex: 2.1, minWidth: 480, padding: '10px 20px', display: 'flex', flexDirection: 'column' }}>
          <div className="chart-header-title">
            <TrendingUp size={13} color="#534AB7" /> Evolução Mensal
          </div>
          
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 5 }}>
            <GraficoArea
              dados={trendData}
              chaveX="mes"
              altura={150}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              areas={[
                { chave: 'Realizado', cor: '#534AB7', opacidade: 0.25 },
                { chave: 'Planejado', cor: '#0ea5e9', opacidade: 0.15, tracejado: true, strokeWidth: 1.5 },
              ]}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
