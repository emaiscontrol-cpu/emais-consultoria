import { useState, useEffect, useRef } from 'react'
import { Upload, Trash2, Eye } from 'lucide-react'
import { clientesAPI, balanceteAPI } from '../../services/api'
import toast from 'react-hot-toast'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

function fmtBRL(v) {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Balancetes() {
  const [clientes,    setClientes]    = useState([])
  const [clienteId,   setClienteId]   = useState('')
  const [periodos,    setPeriodos]    = useState([])
  const [loading,     setLoading]     = useState(false)

  // Modal de detalhes
  const [detalhe,     setDetalhe]     = useState(null) // { ano, mes }
  const [valoresDetalhe, setValoresDetalhe] = useState({})
  const [loadingDet,  setLoadingDet]  = useState(false)

  // Import
  const [importPeriodo, setImportPeriodo] = useState({ ano: ANO_ATUAL, mes: new Date().getMonth() + 1 })
  const fileRef = useRef()

  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!clienteId) { setPeriodos([]); return }
    carregarPeriodos()
  }, [clienteId])

  const carregarPeriodos = () => {
    setLoading(true)
    balanceteAPI.periodos(clienteId)
      .then(r => setPeriodos(r.data))
      .catch(() => setPeriodos([]))
      .finally(() => setLoading(false))
  }

  const handleImportar = async e => {
    const file = e.target.files[0]; if (!file) return
    try {
      const r = await balanceteAPI.importar(clienteId, importPeriodo.ano, importPeriodo.mes, file)
      toast.success(`${r.data.importados} contas importadas`)
      carregarPeriodos()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro na importação')
    }
    e.target.value = ''
  }

  const handleDeletar = async (ano, mes) => {
    if (!confirm(`Remover balancete ${MESES[mes-1]}/${ano}? Esta ação não pode ser desfeita.`)) return
    try {
      await balanceteAPI.deletarPeriodo(clienteId, ano, mes)
      toast.success('Período removido')
      carregarPeriodos()
    } catch { toast.error('Erro ao remover') }
  }

  const abrirDetalhe = async (ano, mes) => {
    setDetalhe({ ano, mes })
    setLoadingDet(true)
    try {
      const r = await balanceteAPI.obter(clienteId, ano, mes)
      setValoresDetalhe(r.data || {})
    } catch { setValoresDetalhe({}) }
    setLoadingDet(false)
  }

  const clienteSelecionado = clientes.find(c => String(c.id) === String(clienteId))

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Balancetes</div>
      </div>

      {/* Seletor cliente */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center',
                                     gap: 12, padding: '12px 16px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
          Cliente:
        </label>
        <select value={clienteId} onChange={e => setClienteId(e.target.value)}
          style={{ flex: 1, maxWidth: 360, padding: '6px 10px', borderRadius: 6,
                   border: '1px solid var(--border-md)', fontSize: 13, background: '#fff' }}>
          <option value="">— Selecione —</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
        </select>
      </div>

      {clienteId && (
        <>
          {/* Bloco de importação */}
          <div className="card" style={{ marginBottom: 16, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--brand-dark)' }}>
              Importar novo período
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Mês:</label>
              <select value={importPeriodo.mes}
                onChange={e => setImportPeriodo(p => ({ ...p, mes: Number(e.target.value) }))}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-md)',
                         fontSize: 13, background: '#fff' }}>
                {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>

              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Ano:</label>
              <select value={importPeriodo.ano}
                onChange={e => setImportPeriodo(p => ({ ...p, ano: Number(e.target.value) }))}
                style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-md)',
                         fontSize: 13, background: '#fff' }}>
                {[ANO_ATUAL-2, ANO_ATUAL-1, ANO_ATUAL, ANO_ATUAL+1].map(a =>
                  <option key={a} value={a}>{a}</option>)}
              </select>

              <button className="btn btn-primary btn-sm" onClick={() => fileRef.current.click()}>
                <Upload size={12}/> Importar Balancete (.xlsx / .csv)
              </button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt"
                style={{ display: 'none' }} onChange={handleImportar}/>

              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Colunas esperadas: <strong>Conta</strong> e <strong>Valor</strong> (ou Saldo/Débito/Crédito)
              </span>
            </div>
          </div>

          {/* Grid de períodos */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--brand-dark)',
                          display: 'flex', alignItems: 'center', gap: 8 }}>
              Períodos importados
              {clienteSelecionado && (
                <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-3)' }}>
                  · {clienteSelecionado.razao_social}
                </span>
              )}
            </div>

            {loading && <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Carregando...</div>}

            {!loading && periodos.length === 0 && (
              <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '16px 0' }}>
                Nenhum balancete importado para este cliente.
              </div>
            )}

            {!loading && periodos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {periodos.map(p => (
                  <div key={`${p.ano}-${p.mes}`} style={{
                    border: '1px solid var(--border-md)', borderRadius: 8, padding: '14px 16px',
                    background: '#fafbff',
                    display: 'flex', flexDirection: 'column', gap: 6,
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--brand)' }}>
                      {MESES[p.mes - 1]}/{p.ano}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {p.qtd_contas} contas
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      Total: R$ {fmtBRL(p.soma_valores)}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                      <button className="btn btn-sm" style={{ flex: 1 }}
                        onClick={() => abrirDetalhe(p.ano, p.mes)}>
                        <Eye size={12}/> Ver
                      </button>
                      <button className="btn btn-sm" style={{ color: 'var(--red)' }}
                        onClick={() => handleDeletar(p.ano, p.mes)}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de detalhe */}
      {detalhe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 10, width: '100%', maxWidth: 640,
                        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-md)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--brand-dark)' }}>
                Balancete — {MESES[detalhe.mes - 1]}/{detalhe.ano}
                {clienteSelecionado && (
                  <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-3)', marginLeft: 8 }}>
                    {clienteSelecionado.razao_social}
                  </span>
                )}
              </div>
              <button className="btn btn-sm" onClick={() => setDetalhe(null)}>✕ Fechar</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
              {loadingDet ? (
                <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Carregando...</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-md)',
                                   fontSize: 11, fontWeight: 600, color: 'var(--text-2)', fontFamily: 'monospace' }}>
                        Conta
                      </th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--border-md)',
                                   fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>
                        Valor (R$)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(valoresDetalhe).length === 0 ? (
                      <tr>
                        <td colSpan={2} style={{ padding: '16px 12px', color: 'var(--text-3)', fontSize: 13 }}>
                          Nenhum valor encontrado.
                        </td>
                      </tr>
                    ) : (
                      Object.entries(valoresDetalhe)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([conta, valor]) => (
                          <tr key={conta} style={{ borderBottom: '1px solid var(--border-lt)' }}>
                            <td style={{ padding: '6px 12px', fontFamily: 'monospace', fontSize: 12 }}>
                              {conta}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: 13 }}>
                              {fmtBRL(valor)}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
