import { useEffect, useState } from 'react'
import { clientesAPI, orcamentoAPI } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const ANO_ATUAL = new Date().getFullYear()
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const fmt = v =>
  v !== 0 && v !== null && v !== undefined
    ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
    : '—'

// ── Estilos por tipo ──────────────────────────────────────────────────────────
const estiloLinha = tipo => {
  if (tipo === 'RES') return { background: 'linear-gradient(90deg,#dcfce7 0%,#f0faf4 60%,transparent 100%)', borderLeft: '3px solid #22c55e', fontWeight: 700, fontSize: 13 }
  if (tipo === 'TT')  return { background: 'linear-gradient(90deg,#e8f0ff 0%,#f4f7ff 60%,transparent 100%)', borderLeft: '3px solid var(--brand)', fontWeight: 700, fontSize: 13 }
  if (tipo === 'GRP') return { background: 'linear-gradient(90deg,#f0f0f8 0%,#f7f7fb 100%)', borderLeft: '3px solid var(--brand)', fontWeight: 800, fontSize: 11 }
  return { background: 'transparent', borderLeft: '3px solid transparent' }
}
const corTexto = tipo => {
  if (tipo === 'RES') return '#16a34a'
  if (tipo === 'TT')  return 'var(--brand)'
  if (tipo === 'GRP') return 'var(--brand)'
  return 'inherit'
}
const bgSticky = tipo => {
  if (tipo === 'RES') return '#e8f5ed'
  if (tipo === 'TT')  return '#e8f0ff'
  if (tipo === 'GRP') return '#f0f0f8'
  return 'var(--surface,#fff)'
}

export default function DRE() {
  const { usuario } = useAuth()
  const isCliente = usuario?.perfil === 'cliente'

  const [clientes,   setClientes]   = useState([])
  const [clienteId,  setClienteId]  = useState('')
  const [ano,        setAno]        = useState(ANO_ATUAL - 1)  // default: ano anterior (dados históricos)

  const [unidades,   setUnidades]   = useState([])
  const [unidade,    setUnidade]    = useState('CONSOLIDADO')

  const [dados,      setDados]      = useState(null)   // { plano, unidade, linhas }
  const [vals,       setVals]       = useState({})     // { conta: { mes: valor } }
  const [loading,    setLoading]    = useState(false)

  // ── Carregar clientes ────────────────────────────────────────────────────
  useEffect(() => {
    if (isCliente) {
      setClienteId(String(usuario.cliente_id))
    } else {
      clientesAPI.listar()
        .then(r => {
          setClientes(r.data || [])
          if ((r.data || []).length === 1) setClienteId(String(r.data[0].id))
        })
        .catch(() => {})
    }
  }, [])

  // ── Carregar unidades disponíveis ────────────────────────────────────────
  useEffect(() => {
    if (!clienteId) { setUnidades([]); return }
    orcamentoAPI.unidades(clienteId, ano)
      .then(r => {
        const lista = r.data || []
        setUnidades(lista)
        setUnidade(lista.includes('CONSOLIDADO') ? 'CONSOLIDADO' : (lista[0] || 'CONSOLIDADO'))
      })
      .catch(() => setUnidades([]))
  }, [clienteId, ano])

  // ── Carregar DRE ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clienteId) { setDados(null); setVals({}); return }
    setLoading(true)
    orcamentoAPI.obterDre(clienteId, ano, unidade)
      .then(r => {
        setDados(r.data)
        const m = {}
        for (const linha of r.data.linhas || []) {
          m[linha.conta] = linha.valores
        }
        setVals(m)
      })
      .catch(() => toast.error('Erro ao carregar DRE'))
      .finally(() => setLoading(false))
  }, [clienteId, ano, unidade])

  const total12 = conta =>
    Object.values(vals[conta] || {}).reduce((s, v) => s + (v || 0), 0)

  const anos = Array.from({ length: 5 }, (_, i) => ANO_ATUAL - 2 + i)

  const nomeUnidade = u => u === 'CONSOLIDADO' ? 'Consolidado' : u

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">DRE</div>
          <div className="page-sub">Demonstração do Resultado do Exercício — valores mensais</div>
        </div>
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {isCliente ? (
          <div className="metric-card" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600 }}>
            {clientes.find(c => String(c.id) === clienteId)?.razao_social ?? '—'}
          </div>
        ) : (
          <select value={clienteId} onChange={e => setClienteId(e.target.value)}
            style={{ fontSize: 13, padding: '8px 14px', minWidth: 280 }}>
            <option value="">Selecione o cliente...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        )}

        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          style={{ fontSize: 13, padding: '8px 14px', width: 100 }}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {/* Seletor de unidade (só aparece se existirem unidades) */}
        {unidades.length > 0 && (
          <select value={unidade} onChange={e => setUnidade(e.target.value)}
            style={{ fontSize: 13, padding: '8px 14px', minWidth: 220 }}>
            {unidades.map(u => (
              <option key={u} value={u}>
                {u === 'CONSOLIDADO' ? 'Consolidado (todas as unidades)' : u}
              </option>
            ))}
          </select>
        )}

        {dados?.plano && (
          <span className="badge" style={{ fontSize: 11, background: 'var(--brand-light)', color: 'var(--brand)' }}>
            {dados.plano.nome}
          </span>
        )}
        {unidades.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {unidades.length} unidade{unidades.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Estados vazios */}
      {!clienteId && (
        <div className="empty-state">Selecione um cliente para visualizar o DRE.</div>
      )}

      {clienteId && !loading && dados?.plano === null && (
        <div className="empty-state">
          Este cliente não possui plano DRE vinculado.
          Acesse <strong>Planos de Contas</strong> para vincular um template.
        </div>
      )}

      {clienteId && !loading && dados?.plano && dados.linhas?.length === 0 && (
        <div className="empty-state">
          Nenhum dado de DRE disponível para {ano}.
          Execute o script de importação para carregar os dados.
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)', fontSize: 13 }}>
          Carregando DRE...
        </div>
      )}

      {/* Tabela DRE */}
      {!loading && dados?.plano && dados.linhas?.length > 0 && (
        <>
          {/* Cabeçalho da demonstração */}
          <div style={{
            background: 'linear-gradient(90deg, var(--brand) 0%, #1a4fa8 100%)',
            color: '#fff', padding: '10px 16px', borderRadius: '8px 8px 0 0',
            display: 'flex', alignItems: 'center', gap: 16, fontSize: 13,
          }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              {dados.plano.nome}
            </span>
            <span style={{ opacity: .7 }}>·</span>
            <span>{ano}</span>
            {unidades.length > 0 && (
              <>
                <span style={{ opacity: .7 }}>·</span>
                <span style={{ fontWeight: 600 }}>{nomeUnidade(unidade)}</span>
              </>
            )}
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4ff' }}>
                  <th style={{
                    textAlign: 'left', padding: '8px 12px', minWidth: 280,
                    position: 'sticky', left: 0, background: '#f0f4ff', zIndex: 1,
                    fontWeight: 700, color: 'var(--brand)', fontSize: 11, letterSpacing: '.05em',
                    borderBottom: '2px solid var(--brand)',
                  }}>
                    DESCRIÇÃO
                  </th>
                  {MESES.map((m, i) => (
                    <th key={i} style={{
                      textAlign: 'right', padding: '8px 8px', minWidth: 80,
                      fontWeight: 600, color: 'var(--text-2)', fontSize: 11,
                      borderBottom: '2px solid var(--brand)',
                    }}>{m}</th>
                  ))}
                  <th style={{
                    textAlign: 'right', padding: '8px 10px', minWidth: 90,
                    borderLeft: '2px solid var(--border)', fontWeight: 700,
                    color: 'var(--brand)', fontSize: 11,
                    borderBottom: '2px solid var(--brand)',
                  }}>
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {dados.linhas.map(linha => {
                  const estilo = estiloLinha(linha.tipo)
                  const vConta = vals[linha.conta] || {}

                  if (linha.tipo === 'GRP') return (
                    <tr key={linha.item_id} style={{ ...estilo, borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                      <td colSpan={14} style={{
                        padding: '8px 14px', textTransform: 'uppercase',
                        letterSpacing: '.08em', fontSize: 11, fontWeight: 800,
                        color: corTexto('GRP'),
                      }}>
                        {linha.descricao}
                      </td>
                    </tr>
                  )

                  const ehNN = linha.tipo == null

                  return (
                    <tr key={linha.item_id} style={{ ...estilo, borderBottom: '1px solid var(--border)' }}>
                      <td style={{
                        padding: '5px 12px',
                        paddingLeft: ehNN ? 28 : 14,
                        position: 'sticky', left: 0, zIndex: 1,
                        background: bgSticky(linha.tipo),
                        color: corTexto(linha.tipo),
                        fontWeight: estilo.fontWeight || 400,
                        fontSize: estilo.fontSize || 12,
                      }}>
                        {linha.descricao}
                      </td>

                      {Array.from({ length: 12 }, (_, i) => {
                        const mes = i + 1
                        const valor = vConta[mes] ?? 0
                        return (
                          <td key={mes} style={{
                            textAlign: 'right', padding: '5px 8px',
                            fontWeight: estilo.fontWeight,
                            color: corTexto(linha.tipo),
                            fontSize: 12,
                          }}>
                            {valor !== 0 ? fmt(valor) : '—'}
                          </td>
                        )
                      })}

                      <td style={{
                        textAlign: 'right', padding: '5px 10px',
                        fontWeight: estilo.fontWeight || 600,
                        color: corTexto(linha.tipo),
                        borderLeft: '2px solid var(--border)',
                        background: bgSticky(linha.tipo),
                        fontSize: 12,
                      }}>
                        {(() => { const t = total12(linha.conta); return t !== 0 ? fmt(t) : '—' })()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
            <span>Dados importados — {ano}</span>
            <span style={{ color: 'var(--brand)' }}>■ Subtotais calculados</span>
            <span style={{ color: '#16a34a' }}>■ Resultado final</span>
          </div>
        </>
      )}
    </div>
  )
}
