import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Target, ArrowRight } from 'lucide-react'
import { controladoriaAPI } from '../../services/api'

const fmt = v => {
  if (v == null) return '—'
  const val = Number(v)
  const formatted = Math.abs(val) >= 1000 && val % 1 === 0
    ? val.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `R$ ${formatted}`
}

const MODULOS = [
  {
    icon: TrendingUp,
    cor: '#10B981',
    titulo: 'Fluxo de Caixa',
    desc: 'Entradas e saídas financeiras por período, cliente e projeto.',
    rota: '/controladoria/fluxo-de-caixa',
    fase: 2,
  },
  {
    icon: BarChart3,
    cor: '#6366F1',
    titulo: 'DRE',
    desc: 'Demonstração do resultado, receitas consolidadas e margem por período.',
    rota: '/controladoria/dre',
    fase: 3,
  },
  {
    icon: Target,
    cor: '#F59E0B',
    titulo: 'Plano Orçamentário',
    desc: 'Metas financeiras por categoria comparadas ao realizado.',
    rota: '/controladoria/orcamento',
    fase: 4,
  },
]

export default function ControladoriaIndex() {
  const navigate = useNavigate()
  const hoje = new Date()
  const [resumo, setResumo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    controladoriaAPI.resumo(hoje.getMonth() + 1, hoje.getFullYear())
      .then(r => setResumo(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Controladoria</div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:2 }}>
            Módulo financeiro — {meses[hoje.getMonth()]} {hoje.getFullYear()}
          </div>
        </div>
      </div>

      {/* KPIs do mês */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:32 }}>
        {[
          { label:'Receitas', valor: resumo?.receitas ?? 0, cor:'#10B981', icon: TrendingUp  },
          { label:'Despesas', valor: resumo?.despesas ?? 0, cor:'#EF4444', icon: TrendingDown },
          { label:'Resultado',valor: resumo?.resultado ?? 0,
            cor: (resumo?.resultado ?? 0) >= 0 ? '#10B981' : '#EF4444', icon: DollarSign },
        ].map(({ label, valor, cor, icon: Icon }) => (
          <div key={label} className="card" style={{ padding:'20px 24px', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:44, height:44, borderRadius:10, background:`${cor}18`,
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Icon size={20} color={cor} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600,
                textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{label}</div>
              {loading
                ? <div style={{ height:24, width:100, background:'#f3f4f6', borderRadius:4 }} />
                : <div style={{ fontSize:22, fontWeight:800, color: valor < 0 ? '#EF4444' : '#111827' }}>
                    {fmt(valor)}
                  </div>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Módulos */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'.6px', marginBottom:16 }}>
          Módulos disponíveis
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {MODULOS.map(({ icon: Icon, cor, titulo, desc, rota, fase }) => (
            <div key={titulo} className="card"
              style={{ padding:24, cursor:'pointer', transition:'box-shadow .15s, transform .15s',
                borderTop:`3px solid ${cor}` }}
              onClick={() => navigate(rota)}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 20px rgba(0,0,0,.10)'; e.currentTarget.style.transform='translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow=''; e.currentTarget.style.transform='' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${cor}18`,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Icon size={20} color={cor} />
                </div>
                <div style={{ fontWeight:700, fontSize:15, color:'#111827' }}>{titulo}</div>
              </div>
              <div style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.6, marginBottom:16 }}>
                {desc}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:12,
                fontWeight:600, color: cor }}>
                Acessar <ArrowRight size={13} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rodapé informativo */}
      <div style={{ background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:8,
        padding:'14px 18px', fontSize:13, color:'#0369A1', marginTop:8 }}>
        <strong>Módulo Controladoria — v2.0</strong> · Os dados financeiros são vinculados diretamente
        aos clientes e projetos cadastrados no sistema. Lançamentos registrados aqui alimentam
        automaticamente o Fluxo de Caixa, o DRE e o Plano Orçamentário.
      </div>
    </div>
  )
}
