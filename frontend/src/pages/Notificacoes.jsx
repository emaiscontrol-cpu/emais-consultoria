import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { notificacoesAPI } from '../services/api'
import { LoadingPage } from '../components/shared'
import { AlertTriangle, Clock, FileDown } from 'lucide-react'
import toast from 'react-hot-toast'

const TIPO_COR   = { tarefa_atrasada: 'var(--red)',   prazo_proximo: 'var(--amber)' }
const TIPO_LABEL = { tarefa_atrasada: 'Atrasada',     prazo_proximo: 'Prazo próximo' }
const TIPO_ICONE = { tarefa_atrasada: AlertTriangle,  prazo_proximo: Clock }

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

export default function Notificacoes() {
  const [alertas,  setAlertas]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [exportando, setExportando] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    notificacoesAPI.listar()
      .then(r => setAlertas(r.data))
      .catch(() => toast.error('Erro ao carregar notificações'))
      .finally(() => setLoading(false))
  }, [])

  const handleExportar = async () => {
    setExportando(true)
    try {
      const { data } = await notificacoesAPI.relatorioExcel()
      baixarBlob(data, `notificacoes_${new Date().toISOString().slice(0,10)}.xlsx`)
      toast.success('Relatório gerado!')
    } catch { toast.error('Erro ao gerar relatório') }
    finally { setExportando(false) }
  }

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Notificações</div>
          <div className="page-sub">{alertas.length} alerta(s) ativo(s)</div>
        </div>
        <button className="btn btn-primary" onClick={handleExportar} disabled={exportando}>
          <FileDown size={14} /> {exportando ? 'Gerando...' : 'Exportar Excel'}
        </button>
      </div>

      {alertas.length === 0 ? (
        <div className="card" style={{ textAlign:'center', padding:48, color:'var(--text-3)' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
          <div>Nenhum alerta no momento. Tudo em dia!</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {alertas.map((a, i) => {
            const Icone = TIPO_ICONE[a.tipo] || AlertTriangle
            const cor   = TIPO_COR[a.tipo]   || 'var(--text-2)'
            return (
              <div key={i} className="card" style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 18px', borderLeft:`4px solid ${cor}`, cursor:'pointer' }}
                onClick={() => a.projeto_id && navigate(`/projetos/${a.projeto_id}`)}>
                <Icone size={20} color={cor} style={{ flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--text)' }}>{a.titulo}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{a.mensagem}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:cor, background: cor + '18', padding:'2px 8px', borderRadius:99 }}>
                  {TIPO_LABEL[a.tipo]}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
