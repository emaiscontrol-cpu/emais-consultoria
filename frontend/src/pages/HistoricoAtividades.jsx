import { useEffect, useState } from 'react'
import { historicoAPI, projetosAPI } from '../services/api'
import { LoadingPage } from '../components/shared'
import toast from 'react-hot-toast'

export default function HistoricoAtividades() {
  const [historico, setHistorico] = useState([])
  const [projetos,  setProjetos]  = useState([])
  const [filtro,    setFiltro]    = useState('')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([historicoAPI.listar(), projetosAPI.listar()])
      .then(([h, p]) => { setHistorico(h.data); setProjetos(p.data) })
      .catch(() => toast.error('Erro ao carregar histórico'))
      .finally(() => setLoading(false))
  }, [])

  const lista = filtro
    ? historico.filter(lg => String(lg.projeto_nome) === filtro)
    : historico

  if (loading) return <LoadingPage />

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Histórico de Atividades</div>
        <select value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ fontSize:13, padding:'5px 10px', minWidth:220 }}>
          <option value="">Todos os projetos</option>
          {projetos.map(p => (
            <option key={p.id} value={p.nome}>{p.nome}</option>
          ))}
        </select>
      </div>

      {lista.length === 0 ? (
        <div className="empty-state">Nenhuma atividade registrada.</div>
      ) : (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, color:'var(--text-3)', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap' }}>Data</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, color:'var(--text-3)', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em' }}>Projeto</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, color:'var(--text-3)', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em' }}>Usuário</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, color:'var(--text-3)', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em' }}>Ação</th>
                <th style={{ padding:'10px 16px', textAlign:'left', fontWeight:600, color:'var(--text-3)', fontSize:11, textTransform:'uppercase', letterSpacing:'.05em' }}>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((lg, i) => (
                <tr key={lg.id} style={{ borderBottom: i < lista.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding:'10px 16px', color:'var(--text-3)', whiteSpace:'nowrap' }}>
                    {new Date(lg.criado_em).toLocaleDateString('pt-BR')}{' '}
                    <span style={{ fontSize:11 }}>
                      {new Date(lg.criado_em).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                    </span>
                  </td>
                  <td style={{ padding:'10px 16px', fontWeight:500 }}>{lg.projeto_nome || '—'}</td>
                  <td style={{ padding:'10px 16px', color:'var(--text-2)' }}>{lg.usuario_nome || '—'}</td>
                  <td style={{ padding:'10px 16px', color:'var(--brand)', fontWeight:500 }}>{lg.acao}</td>
                  <td style={{ padding:'10px 16px', color:'var(--text-2)' }}>{lg.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
