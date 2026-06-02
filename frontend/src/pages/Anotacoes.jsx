import { useState, useEffect } from 'react'
import { clientesAPI, anotacoesAPI } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Modal } from '../components/shared'
import { Pencil, Trash2, Plus, FileText, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import logoUrl from '../assets/logo.jpeg'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function gerarRelatorio(cliente, anotacoes) {
  const now = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
  const logoAbsoluto = `${window.location.origin}${logoUrl}`

  const linhas = anotacoes.map(a => {
    const [ano, mes, dia] = a.data.split('-')
    const dataFmt = `${dia}/${mes}/${ano}`
    return `
      <tr>
        <td style="white-space:nowrap;padding:10px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top">${dataFmt}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;vertical-align:top;color:#6366f1;font-weight:600">${a.usuario}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;white-space:pre-wrap">${a.texto}</td>
      </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Relatório de Atendimento — ${cliente.razao_social}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; color: #1f2937; padding: 40px; }
    header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #6366f1; padding-bottom: 16px; }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .logo { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; }
    h1 { font-size: 20px; color: #6366f1; }
    h2 { font-size: 14px; color: #374151; margin-top: 4px; }
    .meta { font-size: 12px; color: #6b7280; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead tr { background: #f3f4f6; }
    th { text-align: left; padding: 10px 14px; font-size: 13px; color: #374151; border-bottom: 2px solid #e5e7eb; }
    td { font-size: 13px; }
    footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 20px; }
      @page {
        margin: 14mm 12mm 14mm 12mm;
        @top-left {
          content: "Página " counter(page) " de " counter(pages);
          font-family: Arial, sans-serif;
          font-size: 10px;
          color: #9ca3af;
        }
      }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <img src="${logoAbsoluto}" class="logo" alt="E Mais"/>
      <div>
        <h1>E Mais Consultoria</h1>
        <h2>Relatório de Atendimento — ${cliente.razao_social}</h2>
      </div>
    </div>
    <div class="meta">
      Gerado em ${now}<br/>
      ${anotacoes.length} anotação(ões)
    </div>
  </header>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Consultor</th>
        <th>Anotação</th>
      </tr>
    </thead>
    <tbody>${linhas}</tbody>
  </table>
  <footer>E Mais Consultoria — Documento gerado automaticamente pelo sistema</footer>
  <script>window.onload = () => window.print()</script>
</body>
</html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
}

const FORM_VAZIO = { texto: '', data: new Date().toISOString().slice(0, 10) }

export default function Anotacoes() {
  const { usuario } = useAuth()

  const clienteVinculado = usuario?.cliente_id || null
  const isRestrito = clienteVinculado && ['cliente','ger_projeto','ti'].includes(usuario?.perfil)

  const [clientes, setClientes]       = useState([])
  const [clienteId, setClienteId]     = useState(isRestrito ? String(clienteVinculado) : '')
  const [anotacoes, setAnotacoes]     = useState([])
  const [loading, setLoading]         = useState(false)
  const [salvando, setSalvando]       = useState(false)

  const [showNova, setShowNova]       = useState(false)
  const [editando, setEditando]       = useState(null)
  const [deletando, setDeletando]     = useState(null)
  const [form, setForm]               = useState(FORM_VAZIO)

  useEffect(() => {
    if (!isRestrito) {
      clientesAPI.listar().then(r => setClientes(r.data.filter(c => c.ativo)))
    } else {
      clientesAPI.detalhe(clienteVinculado).then(r => setClientes([r.data]))
    }
  }, [])

  useEffect(() => {
    if (!clienteId) { setAnotacoes([]); return }
    setLoading(true)
    anotacoesAPI.listar(clienteId)
      .then(r => setAnotacoes(r.data))
      .catch(() => toast.error('Erro ao carregar anotações'))
      .finally(() => setLoading(false))
  }, [clienteId])

  function abrirNova() {
    setForm(FORM_VAZIO)
    setEditando(null)
    setShowNova(true)
  }

  function abrirEditar(a) {
    setForm({ texto: a.texto, data: a.data })
    setEditando(a)
    setShowNova(true)
  }

  async function handleSalvar(e) {
    e.preventDefault()
    if (!form.texto.trim()) return
    setSalvando(true)
    try {
      if (editando) {
        const r = await anotacoesAPI.atualizar(editando.id, { texto: form.texto.trim(), data: form.data })
        setAnotacoes(prev => prev.map(a => a.id === editando.id ? r.data : a))
        toast.success('Anotação atualizada!')
      } else {
        const r = await anotacoesAPI.criar(clienteId, { texto: form.texto.trim(), data: form.data })
        setAnotacoes(prev => [r.data, ...prev])
        toast.success('Anotação adicionada!')
      }
      setShowNova(false)
    } catch {
      toast.error('Erro ao salvar anotação.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleDeletar() {
    try {
      await anotacoesAPI.deletar(deletando.id)
      setAnotacoes(prev => prev.filter(a => a.id !== deletando.id))
      toast.success('Anotação excluída.')
    } catch {
      toast.error('Erro ao excluir anotação.')
    } finally {
      setDeletando(null)
    }
  }

  const clienteSelecionado = clientes.find(c => c.id === Number(clienteId))

  const porData = anotacoes.reduce((acc, a) => {
    if (!acc[a.data]) acc[a.data] = []
    acc[a.data].push(a)
    return acc
  }, {})

  function formatarData(iso) {
    const [ano, mes, dia] = iso.split('-')
    return `${dia}/${MESES[Number(mes) - 1]}/${ano}`
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Anotações por Cliente</div>
          <div className="page-sub">Registros de consultoria por cliente</div>
        </div>
        {clienteId && (
          <div style={{ display:'flex', gap:8 }}>
            {anotacoes.length > 0 && (
              <button className="btn" onClick={() => gerarRelatorio(clienteSelecionado, anotacoes)}>
                <FileText size={15}/> Gerar Relatório
              </button>
            )}
            <button className="btn btn-primary" onClick={abrirNova}>
              <Plus size={15}/> Nova Anotação
            </button>
          </div>
        )}
      </div>

      {/* Seletor de cliente — oculto para perfis restritos */}
      {!isRestrito && (
        <div className="card" style={{ marginBottom:20, padding:'16px 20px' }}>
          <div className="form-group" style={{ margin:0 }}>
            <label>Cliente</label>
            <div style={{ position:'relative', maxWidth:360 }}>
              <select
                value={clienteId}
                onChange={e => setClienteId(e.target.value)}
                style={{ width:'100%', paddingRight:32, appearance:'none' }}
              >
                <option value=''>Selecione um cliente...</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.razao_social}</option>
                ))}
              </select>
              <ChevronDown size={15} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:'#9ca3af', pointerEvents:'none' }}/>
            </div>
          </div>
        </div>
      )}

      {/* Lista de anotações */}
      {clienteId && (
        <div className="card">
          {loading ? (
            <div className="empty-state">Carregando...</div>
          ) : anotacoes.length === 0 ? (
            <div className="empty-state">Nenhuma anotação registrada para este cliente.</div>
          ) : (
            Object.entries(porData).map(([dataIso, items]) => (
              <div key={dataIso} style={{ marginBottom:20 }}>
                <div style={{
                  fontSize:11, fontWeight:700, color:'var(--brand)',
                  textTransform:'uppercase', letterSpacing:'0.06em',
                  marginBottom:8, paddingBottom:6,
                  borderBottom:'1px solid var(--border)'
                }}>
                  {formatarData(dataIso)}
                </div>
                {items.map(a => (
                  <div key={a.id} style={{
                    display:'flex', gap:12, alignItems:'flex-start',
                    padding:'12px 0',
                    borderBottom:'1px solid var(--border)'
                  }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--brand)', marginBottom:4 }}>
                        {a.usuario}
                      </div>
                      <p style={{ fontSize:14, color:'var(--text)', whiteSpace:'pre-wrap', lineHeight:1.6 }}>
                        {a.texto}
                      </p>
                    </div>
                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => abrirEditar(a)} title="Editar">
                        <Pencil size={13}/>
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setDeletando(a)} title="Excluir"
                        style={{ color:'var(--red)' }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal nova / editar */}
      {showNova && (
        <Modal
          title={editando ? 'Editar anotação' : 'Nova anotação'}
          onClose={() => setShowNova(false)}
          footer={<>
            <button className="btn" onClick={() => setShowNova(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleSalvar} disabled={salvando || !form.texto.trim()}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </>}
        >
          <form onSubmit={handleSalvar}>
            <div className="form-row">
              <div className="form-group">
                <label>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(f => ({...f, data: e.target.value}))} required />
              </div>
              <div className="form-group">
                <label>Consultor</label>
                <input readOnly value={usuario?.nome || ''} style={{ background:'var(--bg)', color:'var(--text-muted)' }}/>
              </div>
            </div>
            <div className="form-group">
              <label>Anotação</label>
              <textarea
                rows={5}
                value={form.texto}
                onChange={e => setForm(f => ({...f, texto: e.target.value}))}
                placeholder="Digite a anotação..."
                required
                style={{ resize:'vertical' }}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Modal confirmar exclusão */}
      {deletando && (
        <Modal
          title="Excluir anotação"
          onClose={() => setDeletando(null)}
          footer={<>
            <button className="btn" onClick={() => setDeletando(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={handleDeletar}>Excluir</button>
          </>}
        >
          <p style={{ fontSize:14, color:'var(--text)' }}>
            Tem certeza que deseja excluir esta anotação de <strong>{deletando.usuario}</strong>?<br/>
            Esta ação não pode ser desfeita.
          </p>
        </Modal>
      )}
    </div>
  )
}
