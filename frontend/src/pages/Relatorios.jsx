import { BarChart2 } from 'lucide-react'

export default function Relatorios() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Relatórios</div>
          <div className="page-sub">Em breve novas opções de relatórios</div>
        </div>
      </div>
      <div className="card" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'60px 20px', gap:16 }}>
        <BarChart2 size={40} color="var(--text-3)" />
        <div style={{ fontSize:15, fontWeight:600, color:'var(--text-2)' }}>Seção em construção</div>
        <div style={{ fontSize:13, color:'var(--text-3)', textAlign:'center' }}>
          Os gráficos analíticos estão disponíveis no <strong>Dashboard</strong>.
        </div>
      </div>
    </div>
  )
}
