import { useState, useEffect, useRef } from 'react'
import { Upload } from 'lucide-react'
import { clientesAPI, planosAPI, balanceteAPI } from '../../services/api'
import toast from 'react-hot-toast'

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const ANO_ATUAL = new Date().getFullYear()

const MOV_COLOR = {
  Entrada: { bg:'var(--green-light)', color:'var(--green)' },
  Receita: { bg:'var(--green-light)', color:'var(--green)' },
  Saída:   { bg:'var(--red-light)',   color:'var(--red)'   },
  Despesa: { bg:'var(--red-light)',   color:'var(--red)'   },
}

function fmtBRL(v) {
  if (v === null || v === undefined || v === '') return ''
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })
}

function parseBRL(s) {
  const n = parseFloat(String(s).replace(/\./g,'').replace(',','.'))
  return isNaN(n) ? 0 : n
}

export default function ModuloBase({ modulo, titulo, descricao, children }) {
  const [clientes,     setClientes]     = useState([])
  const [clienteId,    setClienteId]    = useState('')
  const [dadosPlano,   setDadosPlano]   = useState(null)
  const [loadingPlano, setLoadingPlano] = useState(false)

  const [ano,   setAno]   = useState(ANO_ATUAL)
  const [mes,   setMes]   = useState(new Date().getMonth() + 1)

  const [valores,      setValores]      = useState({})   // { conta: valor }
  const [editando,     setEditando]     = useState(null) // conta sendo editada
  const [editVal,      setEditVal]      = useState('')
  const [salvando,     setSalvando]     = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!clienteId) { setDadosPlano(null); return }
    setLoadingPlano(true)
    planosAPI.planoPorClienteModulo(clienteId, modulo)
      .then(r => setDadosPlano(r.data))
      .catch(() => setDadosPlano(null))
      .finally(() => setLoadingPlano(false))
  }, [clienteId, modulo])

  useEffect(() => {
    if (!clienteId) { setValores({}); return }
    balanceteAPI.obter(clienteId, ano, mes)
      .then(r => setValores(r.data || {}))
      .catch(() => setValores({}))
  }, [clienteId, ano, mes])

  const clienteSelecionado = clientes.find(c => String(c.id) === String(clienteId))

  // Calcula o valor de uma linha TT = soma das subordinadas
  const calcValorLinha = (item, itens) => {
    if (item.tipo?.toUpperCase() !== 'TT') {
      return item.conta ? (valores[item.conta] ?? null) : null
    }
    const idx = itens.findIndex(i => i.id === item.id)
    let soma = 0
    for (let i = idx + 1; i < itens.length; i++) {
      if (itens[i].tipo?.toUpperCase() === 'TT') break
      const v = itens[i].conta ? (valores[itens[i].conta] ?? 0) : 0
      soma += v
    }
    return soma
  }

  const iniciarEdicao = (conta, valorAtual) => {
    setEditando(conta)
    setEditVal(valorAtual !== null && valorAtual !== undefined ? fmtBRL(valorAtual) : '')
  }

  const salvarEdicao = async (conta) => {
    setSalvando(conta)
    try {
      const val = parseBRL(editVal)
      await balanceteAPI.upsert(clienteId, ano, mes, conta, val)
      setValores(prev => ({ ...prev, [conta]: val }))
      toast.success('Valor salvo')
    } catch { toast.error('Erro ao salvar') }
    setSalvando(null)
    setEditando(null)
  }

  const handleImportar = async e => {
    const file = e.target.files[0]; if (!file) return
    try {
      const r = await balanceteAPI.importar(clienteId, ano, mes, file)
      toast.success(`${r.data.importados} contas importadas`)
      const r2 = await balanceteAPI.obter(clienteId, ano, mes)
      setValores(r2.data || {})
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro na importação') }
    e.target.value = ''
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{titulo}</div>
          {descricao && <div className="page-sub">{descricao}</div>}
        </div>
      </div>

      {/* Seletor cliente + mês/ano */}
      <div className="card" style={{ marginBottom:16, display:'flex', alignItems:'center',
                                     gap:12, padding:'12px 16px', flexWrap:'wrap' }}>
        <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', whiteSpace:'nowrap' }}>
          Cliente:
        </label>
        <select value={clienteId} onChange={e => setClienteId(e.target.value)}
          style={{ flex:1, maxWidth:320, padding:'6px 10px', borderRadius:6,
                   border:'1px solid var(--border-md)', fontSize:13, background:'#fff' }}>
          <option value="">— Selecione —</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
        </select>

        <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)' }}>Mês:</label>
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          style={{ padding:'6px 10px', borderRadius:6, border:'1px solid var(--border-md)',
                   fontSize:13, background:'#fff' }}>
          {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>

        <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)' }}>Ano:</label>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          style={{ padding:'6px 10px', borderRadius:6, border:'1px solid var(--border-md)',
                   fontSize:13, background:'#fff' }}>
          {[ANO_ATUAL-2, ANO_ATUAL-1, ANO_ATUAL, ANO_ATUAL+1].map(a =>
            <option key={a} value={a}>{a}</option>)}
        </select>

        {clienteId && (
          <>
            <button className="btn btn-sm" style={{ marginLeft:'auto' }}
              onClick={() => fileRef.current.click()}>
              <Upload size={12}/> Importar Balancete
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt"
              style={{ display:'none' }} onChange={handleImportar}/>
          </>
        )}
      </div>

      {/* Plano de contas + valores */}
      {clienteId && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:12, color:'var(--brand-dark)',
                        display:'flex', alignItems:'center', gap:8 }}>
            {titulo} — {MESES[mes-1]}/{ano}
            {clienteSelecionado && (
              <span style={{ fontWeight:400, fontSize:12, color:'var(--text-3)' }}>
                · {clienteSelecionado.razao_social}
              </span>
            )}
            {dadosPlano?.plano && (
              <span style={{ fontWeight:400, fontSize:11, color:'var(--teal)', marginLeft:4 }}>
                Plano: {dadosPlano.plano.nome}
              </span>
            )}
          </div>

          {loadingPlano && <div style={{ color:'var(--text-3)', fontSize:13 }}>Carregando...</div>}

          {!loadingPlano && !dadosPlano?.plano && (
            <div style={{ color:'var(--text-3)', fontSize:13, padding:'16px 0' }}>
              Nenhum plano vinculado.{' '}
              <a href="/controladoria/planos" style={{ color:'var(--brand)' }}>Configurar em Planos de Contas</a>.
            </div>
          )}

          {!loadingPlano && dadosPlano?.itens?.length === 0 && dadosPlano?.plano && (
            <div style={{ color:'var(--text-3)', fontSize:13 }}>
              Plano sem contas para o módulo selecionado.
            </div>
          )}

          {!loadingPlano && dadosPlano?.itens?.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width:36, textAlign:'center' }}>#</th>
                    <th style={{ width:90 }}>Conta</th>
                    <th>Descrição</th>
                    <th style={{ width:60 }}>Tipo</th>
                    <th style={{ width:100 }}>Movimento</th>
                    <th style={{ width:150, textAlign:'right' }}>
                      Valor — {MESES[mes-1]}/{ano}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dadosPlano.itens.map((item, idx) => {
                    const isGrupo = item.tipo?.toUpperCase() === 'TT'
                    const movStyle = item.movimento ? MOV_COLOR[item.movimento] : null
                    const valorLinha = calcValorLinha(item, dadosPlano.itens)
                    const estaEditando = editando === item.conta && !isGrupo

                    return (
                      <tr key={item.id} style={{
                        background: isGrupo
                          ? 'linear-gradient(90deg,#e8f0ff 0%,#f4f7ff 60%,transparent 100%)'
                          : '',
                        borderLeft: isGrupo ? '3px solid var(--brand)' : '3px solid transparent',
                      }}>
                        <td style={{ textAlign:'center', fontSize:11, color:'var(--text-3)' }}>{idx+1}</td>
                        <td style={{ fontFamily:'monospace', fontSize:11 }}>{item.conta || '—'}</td>
                        <td>
                          <span style={{ fontSize:13, fontWeight: isGrupo ? 700 : 400,
                            color: isGrupo ? 'var(--brand)' : 'inherit', letterSpacing: isGrupo ? '0.02em' : 'normal' }}>
                            {item.descricao}
                          </span>
                        </td>
                        <td style={{ fontSize:11, fontFamily:'monospace' }}>{item.tipo || '—'}</td>
                        <td>
                          {movStyle
                            ? <span style={{ fontSize:11, padding:'2px 7px', borderRadius:99, ...movStyle }}>
                                {item.movimento}
                              </span>
                            : <span style={{ color:'var(--text-3)', fontSize:11 }}>—</span>}
                        </td>
                        <td style={{ textAlign:'right' }}>
                          {isGrupo ? (
                            <span style={{ fontSize:13, fontWeight:700, color:'var(--brand)' }}>
                              {valorLinha !== null ? fmtBRL(valorLinha) : '—'}
                            </span>
                          ) : item.conta ? (
                            estaEditando ? (
                              <div style={{ display:'flex', gap:4, justifyContent:'flex-end' }}>
                                <input
                                  autoFocus
                                  value={editVal}
                                  onChange={e => setEditVal(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') salvarEdicao(item.conta)
                                    if (e.key === 'Escape') setEditando(null)
                                  }}
                                  style={{ width:110, textAlign:'right', padding:'2px 6px',
                                           fontSize:12, borderRadius:4,
                                           border:'1px solid var(--brand)', outline:'none' }}
                                />
                                <button className="btn btn-sm btn-primary"
                                  style={{ padding:'2px 8px', fontSize:11 }}
                                  disabled={salvando === item.conta}
                                  onClick={() => salvarEdicao(item.conta)}>
                                  {salvando === item.conta ? '...' : 'OK'}
                                </button>
                                <button className="btn btn-sm" style={{ padding:'2px 6px', fontSize:11 }}
                                  onClick={() => setEditando(null)}>✕</button>
                              </div>
                            ) : (
                              <span
                                title="Clique para editar"
                                onClick={() => iniciarEdicao(item.conta, valorLinha)}
                                style={{ cursor:'pointer', fontSize:13,
                                         color: valorLinha !== null && valorLinha !== 0
                                           ? 'inherit' : 'var(--text-3)',
                                         borderBottom:'1px dashed var(--border-md)',
                                         paddingBottom:1 }}>
                                {valorLinha !== null ? fmtBRL(valorLinha) : '+ valor'}
                              </span>
                            )
                          ) : (
                            <span style={{ color:'var(--text-3)', fontSize:11 }}>sem conta</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {children && clienteId && dadosPlano?.plano && children({ clienteId, dadosPlano })}
    </div>
  )
}
