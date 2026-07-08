import { useState, useEffect, useRef } from 'react'
import { AlertTriangle, Lock, Unlock, RefreshCw, Check, Edit2 } from 'lucide-react'
import { refDemonstrativosAPI, refTemplatesAPI, clientesAPI, refUnidadesAPI, refLancamentosAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const fmt = (v) => {
  if (v === undefined || v === null) return '0,00'
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export default function Demonstrativo() {
  const { usuario } = useAuth()
  const isAdminConsultor = ['admin', 'consultor'].includes(usuario?.perfil)
  const isCliente = ['analista', 'ger_projeto', 'ti'].includes(usuario?.perfil)

  const [clientes, setClientes] = useState([])
  const [templates, setTemplates] = useState([])
  const [templatesOrc, setTemplatesOrc] = useState([])
  const [unidades, setUnidades] = useState([])

  const anoAtual = new Date().getFullYear()
  const mesAtual = new Date().getMonth() + 1

  const [clienteId, setClienteId] = useState(isCliente ? String(usuario?.cliente_id || '') : '')
  const [templateId, setTemplateId] = useState('')
  const [templateOrcId, setTemplateOrcId] = useState('')
  const [unidadeSel, setUnidadeSel] = useState('') // '' significa Consolidado
  const [ano, setAno] = useState(anoAtual)
  const [mes, setMes] = useState(mesAtual)
  const [modoComparativo, setModoComparativo] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [periodosF, setPeriodosF] = useState([])
  const [loading, setLoading] = useState(false)

  // Estados de edição inline
  const [celulaEditando, setCelulaEditando] = useState(null) // { rotulo: str, unidade: str }
  const [valorEditando, setValorEditando] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (!isCliente) clientesAPI.listar({ modulo_analises_gerenciais: true }).then(r => setClientes(r.data))
    refTemplatesAPI.listar('dre', null).then(r => setTemplates(r.data))
    refTemplatesAPI.listar('orcamento', null).then(r => setTemplatesOrc(r.data))
  }, [])

  useEffect(() => {
    if (clienteId) {
      refDemonstrativosAPI.periodos(clienteId).then(r => setPeriodosF(r.data)).catch(() => {})
      refUnidadesAPI.listar(clienteId).then(r => setUnidades(r.data || [])).catch(() => {})
    } else {
      setPeriodosF([])
      setUnidades([])
      setUnidadeSel('')
    }
  }, [clienteId])

  // Foco automático no input ao abrir edição
  useEffect(() => {
    if (celulaEditando && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [celulaEditando])

  const estahFechado = periodosF.some(p => p.ano === Number(ano) && p.mes === Number(mes))

  const calcular = async () => {
    if (!clienteId || !templateId) return toast.error('Selecione cliente e template')
    setLoading(true)
    try {
      if (modoComparativo && templateOrcId) {
        const r = await refDemonstrativosAPI.comparativo(clienteId, ano, mes, templateId, templateOrcId, unidadeSel)
        setResultado({ tipo: 'comparativo', dados: r.data })
      } else {
        const r = await refDemonstrativosAPI.calcular(clienteId, templateId, ano, mes, unidadeSel)
        setResultado({ tipo: 'simples', dados: r.data })
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao calcular')
    } finally { setLoading(false) }
  }

  const fechar = async () => {
    if (!confirm(`Fechar o período ${MESES[mes - 1]}/${ano}? Isso impedirá novos lançamentos.`)) return
    try {
      await refDemonstrativosAPI.fecharPeriodo(clienteId, ano, mes)
      toast.success('Período fechado')
      refDemonstrativosAPI.periodos(clienteId).then(r => setPeriodosF(r.data))
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const reabrir = async () => {
    if (!confirm('Reabrir o período? Novos lançamentos serão permitidos.')) return
    try {
      await refDemonstrativosAPI.reabrirPeriodo(clienteId, ano, mes)
      toast.success('Período reaberto')
      refDemonstrativosAPI.periodos(clienteId).then(r => setPeriodosF(r.data))
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const iniciarEdicao = (linha, unidadeCod, valorAtual) => {
    if (!isAdminConsultor) return
    if (estahFechado) return toast.error('Este período está fechado para edições.')
    
    // Totalizadores em negrito e linhas sem agrupamento (fórmulas) não são editáveis
    if (linha.negrito_totalizador) return
    
    setCelulaEditando({ rotulo: linha.rotulo, unidade: unidadeCod })
    setValorEditando(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valorAtual))
  }

  const salvarEdicao = async () => {
    if (!celulaEditando) return
    
    // Limpa pontos de milhar e troca vírgula decimal por ponto para conversão
    const stringLimpa = valorEditando.replace(/\./g, '').replace(',', '.')
    const novoValor = parseFloat(stringLimpa)
    
    if (isNaN(novoValor)) {
      setCelulaEditando(null)
      return toast.error('Valor inválido')
    }

    try {
      await refLancamentosAPI.editarCelula(clienteId, {
        template_id: Number(templateId),
        rotulo_linha: celulaEditando.rotulo,
        unidade_codigo: celulaEditando.unidade,
        ano: Number(ano),
        mes: Number(mes),
        novo_valor: novoValor
      })
      toast.success('Valor atualizado!')
      setCelulaEditando(null)
      await calcular() // Recalcula a DRE e fórmulas imediatamente na tela
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao salvar valor')
      setCelulaEditando(null)
    }
  }

  const cancelarEdicao = () => {
    setCelulaEditando(null)
  }

  const linhas = resultado?.dados?.linhas || []

  // Extrai as colunas das unidades a partir dos valores_unidades das linhas carregadas
  const colunasUnidades = []
  if (resultado?.tipo === 'simples' && linhas.length > 0 && linhas[0].valores_unidades) {
    const chaves = Object.keys(linhas[0].valores_unidades).filter(k => k !== 'Consolidado')
    chaves.forEach(cod => {
      const uObj = unidades.find(u => u.codigo === cod)
      colunasUnidades.push({
        codigo: cod,
        nome: uObj ? uObj.nome : `Loja ${cod}`
      })
    })
    colunasUnidades.sort((a, b) => a.codigo.localeCompare(b.codigo))
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Demonstrativo Gerencial</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            DRE · Fluxo de Caixa · Orçamento calculado pelo plano referencial
          </p>
        </div>
        {isAdminConsultor && clienteId && (
          <div style={{ display: 'flex', gap: 8 }}>
            {estahFechado ? (
               <button className="btn btn-sm" onClick={reabrir} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                 <Unlock size={13} /> Reabrir {MESES[mes - 1]}/{ano}
               </button>
            ) : (
               <button className="btn btn-sm" onClick={fechar} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                 <Lock size={13} /> Fechar Período
               </button>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        {!isCliente && (
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Cliente</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ minWidth: 200 }}>
              <option value="">Selecione...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
            </select>
          </div>
        )}
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Template</label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={{ minWidth: 180 }}>
            <option value="">Selecione...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        
        {clienteId && (
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Filial / Unidade</label>
            <select value={unidadeSel} onChange={e => setUnidadeSel(e.target.value)} style={{ minWidth: 150 }}>
              <option value="">Consolidado</option>
              {unidades.map(u => <option key={u.id} value={u.codigo}>{u.nome}</option>)}
            </select>
          </div>
        )}

        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Mês</label>
          <select value={mes} onChange={e => setMes(Number(e.target.value))}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12 }}>Ano</label>
          <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))} style={{ width: 80 }} />
        </div>
        {isAdminConsultor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
            <input type="checkbox" checked={modoComparativo} onChange={e => setModoComparativo(e.target.checked)} />
            <label style={{ fontSize: 12 }}>Comparativo vs Orçado</label>
          </div>
        )}
        {modoComparativo && isAdminConsultor && (
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12 }}>Template Orçado</label>
            <select value={templateOrcId} onChange={e => setTemplateOrcId(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Selecione...</option>
              {templatesOrc.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
        )}
        <button className="btn btn-primary" onClick={calcular} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} />
          {loading ? 'Calculando...' : 'Calcular'}
        </button>
      </div>

      {estahFechado && (
        <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#dc2626', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={13} /> Período {MESES[mes - 1]}/{ano} está fechado. Novos lançamentos ou edições não são permitidos.
        </div>
      )}

      {/* Tabela de Demonstrativo */}
      {resultado && (
        <div style={{ overflowX: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface-header)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 700 }}>Linha</th>
                
                {/* Renderização condicional de colunas: Tabular aberta por Unidade vs Simples consolidado vs Comparativo */}
                {resultado.tipo === 'simples' ? (
                  unidadeSel === '' && colunasUnidades.length > 0 ? (
                    <>
                      {colunasUnidades.map(col => (
                        <th key={col.codigo} style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>
                          {col.nome}
                        </th>
                      ))}
                      <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700, color: 'var(--brand)' }}>
                        Consolidado
                      </th>
                    </>
                  ) : (
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>
                      Valor (R$)
                    </th>
                  )
                ) : (
                  <>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Realizado</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Orçado</th>
                    <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 700 }}>Desvio %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const negrito = l.negrito_totalizador
                const dzero = l.tem_divisao_por_zero
                const desvio = resultado.tipo === 'comparativo' ? l.desvio_percentual : null
                
                return (
                  <tr key={i} style={{
                    borderBottom: '1px solid var(--border)',
                    background: negrito ? 'var(--surface-hover)' : 'transparent',
                    fontWeight: negrito ? 700 : 400
                  }}>
                    {/* Coluna Rótulo */}
                    <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: negrito ? 'var(--text-1)' : 'var(--text-2)' }}>{l.rotulo}</span>
                      {dzero && <AlertTriangle size={12} color="#f59e0b" title="Divisão por zero — valor zerado" />}
                    </td>
                    
                    {/* Colunas Valores */}
                    {resultado.tipo === 'simples' ? (
                      unidadeSel === '' && colunasUnidades.length > 0 ? (
                        <>
                          {colunasUnidades.map(col => {
                            const valorF = l.valores_unidades ? l.valores_unidades[col.codigo] : 0.0
                            const editando = celulaEditando?.rotulo === l.rotulo && celulaEditando?.unidade === col.codigo
                            
                            return (
                              <td key={col.codigo} 
                                onDoubleClick={() => iniciarEdicao(l, col.codigo, valorF)}
                                style={{ 
                                  textAlign: 'right', 
                                  padding: '8px 16px', 
                                  fontFamily: 'monospace',
                                  cursor: (!negrito && isAdminConsultor && !estahFechado) ? 'pointer' : 'default',
                                  transition: 'background 0.2s',
                                  position: 'relative'
                                }}
                                className={(!negrito && isAdminConsultor && !estahFechado) ? 'hover-editable-cell' : ''}
                              >
                                {editando ? (
                                  <input
                                    ref={inputRef}
                                    type="text"
                                    value={valorEditando}
                                    onChange={e => setValorEditando(e.target.value)}
                                    onBlur={salvarEdicao}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') salvarEdicao()
                                      if (e.key === 'Escape') cancelarEdicao()
                                    }}
                                    style={{
                                      width: '100px',
                                      textAlign: 'right',
                                      padding: '2px 4px',
                                      fontSize: 12,
                                      border: '1px solid var(--brand)',
                                      borderRadius: 4,
                                      background: 'var(--surface-input)'
                                    }}
                                  />
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                    {fmt(valorF)}
                                    {!negrito && isAdminConsultor && !estahFechado && (
                                      <Edit2 size={10} className="edit-icon" style={{ opacity: 0, color: 'var(--text-muted)' }} />
                                    )}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                          
                          {/* Coluna Consolidado final da linha */}
                          <td style={{ 
                            textAlign: 'right', 
                            padding: '10px 16px', 
                            fontFamily: 'monospace', 
                            fontWeight: 700, 
                            color: 'var(--brand)' 
                          }}>
                            {fmt(l.valores_unidades?.Consolidado || l.valor)}
                          </td>
                        </>
                      ) : (
                        // Exibição simples de unidade selecionada (permite editar a própria célula consolidada caso seja de uma filial)
                        <td 
                          onDoubleClick={() => {
                            if (unidadeSel !== '') {
                              iniciarEdicao(l, unidadeSel, l.valor)
                            } else {
                              toast.error('Escolha uma filial para editar os valores contábeis.')
                            }
                          }}
                          style={{ 
                            textAlign: 'right', 
                            padding: '10px 16px', 
                            fontFamily: 'monospace',
                            cursor: (!negrito && isAdminConsultor && !estahFechado && unidadeSel !== '') ? 'pointer' : 'default'
                          }}
                          className={(!negrito && isAdminConsultor && !estahFechado && unidadeSel !== '') ? 'hover-editable-cell' : ''}
                        >
                          {celulaEditando?.rotulo === l.rotulo && celulaEditando?.unidade === unidadeSel ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={valorEditando}
                              onChange={e => setValorEditando(e.target.value)}
                              onBlur={salvarEdicao}
                              onKeyDown={e => {
                                if (e.key === 'Enter') salvarEdicao()
                                if (e.key === 'Escape') cancelarEdicao()
                              }}
                              style={{
                                width: '100px',
                                textAlign: 'right',
                                padding: '2px 4px',
                                fontSize: 12,
                                border: '1px solid var(--brand)',
                                borderRadius: 4
                              }}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                              {fmt(l.valor)}
                              {!negrito && isAdminConsultor && !estahFechado && unidadeSel !== '' && (
                                <Edit2 size={10} className="edit-icon" style={{ opacity: 0, color: 'var(--text-muted)' }} />
                              )}
                            </div>
                          )}
                        </td>
                      )
                    ) : (
                      // Modo Comparativo lado a lado
                      <>
                        <td style={{ textAlign: 'right', padding: '10px 16px', fontFamily: 'monospace' }}>{fmt(l.realizado)}</td>
                        <td style={{ textAlign: 'right', padding: '10px 16px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{fmt(l.orcado)}</td>
                        <td style={{ textAlign: 'right', padding: '10px 16px', fontFamily: 'monospace',
                          color: desvio === null ? 'var(--text-muted)' : desvio >= 0 ? '#22c55e' : '#ef4444',
                          fontWeight: desvio !== null ? 600 : 400 }}>
                          {desvio === null ? '—' : `${desvio >= 0 ? '+' : ''}${desvio.toFixed(1)}%`}
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {/* Estilo CSS customizado para interatividade do Grid de Células */}
          <style>{`
            .hover-editable-cell:hover {
              background: rgba(var(--brand-rgb, 99, 102, 241), 0.05) !important;
            }
            .hover-editable-cell:hover .edit-icon {
              opacity: 1 !important;
            }
          `}</style>
        </div>
      )}

      {!resultado && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 12 }}>
          Selecione os filtros e clique em "Calcular" para visualizar o demonstrativo.
        </div>
      )}
    </div>
  )
}
