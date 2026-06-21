import { useState, useEffect, useRef } from 'react'
import { Check, RefreshCw, List, Columns, Percent, AlertCircle, Plus } from 'lucide-react'
import { refDeParaAPI, clientesAPI, refPlanoAPI } from '../../services/api'
import { Modal } from '../../components/shared'
import toast from 'react-hot-toast'

const CONF_COR = (c) => c >= 0.8 ? '#22c55e' : c >= 0.5 ? '#f59e0b' : '#ef4444'
const CONF_LABEL = (c) => `${Math.round(c * 100)}%`

// ── Modo Lista ────────────────────────────────────────────────────────────────
function ModoLista({ pendencias, clientes, onAtualizar }) {
  const [trocando, setTrocando] = useState(null)
  const [sugestoes, setSugestoes] = useState([])
  const [rateandoId, setRateandoId] = useState(null)
  const [itensRateio, setItensRateio] = useState([])
  const [vigAno, setVigAno] = useState(new Date().getFullYear())
  const [vigMes, setVigMes] = useState(new Date().getMonth() + 1)
  const [contas, setContas] = useState([])

  useEffect(() => {
    refPlanoAPI.listar().then(r => {
      if (r.data[0]) refPlanoAPI.listarContas(r.data[0].id).then(rc => {
        const lista = []
        const flatten = (arr) => arr.forEach(c => { lista.push(c); if (c.filhos) flatten(c.filhos) })
        flatten(rc.data)
        setContas(lista.filter(c => c.tipo === 'analitica'))
      })
    })
  }, [])

  const aceitar = async (p) => {
    try {
      await refDeParaAPI.confirmar({
        conta_cliente_id: p.conta_cliente_id,
        itens: [{ conta_referencial_id: p.conta_referencial_id, percentual: p.percentual }],
        vigente_a_partir_ano: vigAno,
        vigente_a_partir_mes: vigMes,
      })
      toast.success('De-Para confirmado')
      onAtualizar()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const abrirTroca = async (p) => {
    const r = await refDeParaAPI.sugestoes(p.conta_cliente_id)
    setSugestoes(r.data)
    setTrocando(p)
  }

  const trocar = async (contaRefId) => {
    try {
      await refDeParaAPI.confirmar({
        conta_cliente_id: trocando.conta_cliente_id,
        itens: [{ conta_referencial_id: contaRefId, percentual: 100 }],
        vigente_a_partir_ano: vigAno,
        vigente_a_partir_mes: vigMes,
      })
      toast.success('De-Para atualizado')
      setTrocando(null)
      onAtualizar()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  const abrirRateio = (p) => {
    setItensRateio([
      { conta_referencial_id: p.conta_referencial_id || '', percentual: 100 },
    ])
    setRateandoId(p.conta_cliente_id)
  }

  const salvarRateio = async () => {
    try {
      await refDeParaAPI.confirmar({
        conta_cliente_id: rateandoId,
        itens: itensRateio.map(i => ({ ...i, conta_referencial_id: Number(i.conta_referencial_id) })),
        vigente_a_partir_ano: vigAno,
        vigente_a_partir_mes: vigMes,
      })
      toast.success('Rateio salvo')
      setRateandoId(null)
      onAtualizar()
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Vigência padrão:</span>
        <input type="number" value={vigMes} min={1} max={12}
          onChange={e => setVigMes(Number(e.target.value))}
          style={{ width: 60, textAlign: 'center' }} placeholder="Mês" />
        <input type="number" value={vigAno}
          onChange={e => setVigAno(Number(e.target.value))}
          style={{ width: 80, textAlign: 'center' }} placeholder="Ano" />
      </div>

      {pendencias.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Nenhuma pendência de revisão.
        </div>
      ) : pendencias.map(p => (
        <div key={p.id} style={{
          border: '1px solid var(--border)', borderRadius: 8,
          padding: '12px 16px', marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{p.codigo_origem}</div>
            <div style={{ fontWeight: 600 }}>{p.descricao_origem}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{p.conta_referencial_codigo}</div>
            <div>{p.conta_referencial_descricao}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              background: CONF_COR(p.confianca) + '22', color: CONF_COR(p.confianca),
              borderRadius: 99, padding: '2px 10px', fontWeight: 700, fontSize: 12
            }}>{CONF_LABEL(p.confianca)}</span>
            {p.origem_vinculo === 'aprendido_de_outro_cliente' &&
              <span title="Aprendido de outro cliente" style={{ color: '#8b5cf6' }}>★</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" style={{ background: '#22c55e', color: '#fff', border: 'none' }}
              onClick={() => aceitar(p)} title="Aceitar sugestão">
              <Check size={13} />
            </button>
            <button className="btn btn-sm" onClick={() => abrirTroca(p)} title="Trocar conta">
              <RefreshCw size={13} />
            </button>
            <button className="btn btn-sm" onClick={() => abrirRateio(p)} title="Ratear entre contas">
              <Percent size={13} />
            </button>
          </div>
        </div>
      ))}

      {/* Modal Trocar */}
      {trocando && (
        <Modal titulo={`Trocar mapeamento: ${trocando.descricao_origem}`} onClose={() => setTrocando(null)}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Escolha a conta referencial correta:
          </div>
          {sugestoes.map(s => (
            <button key={s.conta_referencial_id} onClick={() => trocar(s.conta_referencial_id)}
              style={{
                display: 'flex', width: '100%', alignItems: 'center', gap: 12,
                padding: '10px 14px', border: '1px solid var(--border)',
                borderRadius: 8, marginBottom: 8, cursor: 'pointer',
                background: 'var(--surface)', textAlign: 'left',
              }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', minWidth: 80 }}>{s.codigo}</span>
              <span style={{ flex: 1 }}>{s.descricao}</span>
              <span style={{ background: CONF_COR(s.confianca) + '22', color: CONF_COR(s.confianca), borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                {CONF_LABEL(s.confianca)}
              </span>
            </button>
          ))}
          {sugestoes.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
              Sem sugestões. Adicione contas referenciais primeiro.
            </div>
          )}
        </Modal>
      )}

      {/* Modal Rateio */}
      {rateandoId && (
        <Modal titulo="Ratear entre contas" onClose={() => setRateandoId(null)}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Distribua os {100}% entre múltiplas contas referenciais.
          </div>
          {itensRateio.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <select value={item.conta_referencial_id}
                onChange={e => setItensRateio(prev => prev.map((it, i) => i === idx ? { ...it, conta_referencial_id: e.target.value } : it))}
                style={{ flex: 1 }}>
                <option value="">Selecione a conta...</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.descricao}</option>)}
              </select>
              <input type="number" value={item.percentual} min={1} max={100}
                onChange={e => setItensRateio(prev => prev.map((it, i) => i === idx ? { ...it, percentual: Number(e.target.value) } : it))}
                style={{ width: 70, textAlign: 'center' }} />
              <span style={{ fontSize: 12 }}>%</span>
              {idx > 0 && (
                <button onClick={() => setItensRateio(prev => prev.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer' }}>×</button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button className="btn btn-sm" onClick={() => setItensRateio(prev => [...prev, { conta_referencial_id: '', percentual: 0 }])}>
              <Plus size={12} /> Adicionar conta
            </button>
            <span style={{ fontSize: 12, color: itensRateio.reduce((s, i) => s + i.percentual, 0) > 100 ? 'var(--red)' : 'var(--text-muted)' }}>
              Total: {itensRateio.reduce((s, i) => s + Number(i.percentual || 0), 0)}%
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn" onClick={() => setRateandoId(null)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvarRateio}>Salvar Rateio</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Modo Lado a Lado ──────────────────────────────────────────────────────────
function ModoLadoALado({ clienteId, onAtualizar }) {
  const [contasCliente, setContasCliente] = useState([])
  const [contasRef, setContasRef] = useState([])
  const [dragOrigemId, setDragOrigemId] = useState(null)
  const [pendentes, setPendentes] = useState({})  // cc_id → lista de dps pendentes
  const [vigAno] = useState(new Date().getFullYear())
  const [vigMes] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    if (!clienteId) return
    refDeParaAPI.contasCliente(clienteId).then(r => setContasCliente(r.data))
    refPlanoAPI.listar().then(r => {
      if (r.data[0]) refPlanoAPI.listarContas(r.data[0].id).then(rc => {
        const lista = []
        const flatten = (arr) => arr.forEach(c => { lista.push(c); if (c.filhos) flatten(c.filhos) })
        flatten(rc.data)
        setContasRef(lista.filter(c => c.tipo === 'analitica'))
      })
    })
    refDeParaAPI.porCliente(clienteId).then(r => {
      const mapa = {}
      r.data.forEach(dp => { mapa[dp.conta_cliente_id] = dp })
      setPendentes(mapa)
    })
  }, [clienteId])

  const vincular = async (ccId, crId) => {
    try {
      await refDeParaAPI.confirmar({
        conta_cliente_id: ccId,
        itens: [{ conta_referencial_id: crId, percentual: 100 }],
        vigente_a_partir_ano: vigAno,
        vigente_a_partir_mes: vigMes,
      })
      toast.success('Conta vinculada')
      onAtualizar()
      refDeParaAPI.porCliente(clienteId).then(r => {
        const mapa = {}
        r.data.forEach(dp => { mapa[dp.conta_cliente_id] = dp })
        setPendentes(mapa)
      })
    } catch (e) { toast.error(e.response?.data?.detail || 'Erro') }
  }

  if (!clienteId) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
      Selecione um cliente no filtro acima.
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Contas do Cliente (origem)</div>
        {contasCliente.map(cc => {
          const dp = pendentes[cc.id]
          return (
            <div key={cc.id}
              draggable
              onDragStart={() => setDragOrigemId(cc.id)}
              style={{
                padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6,
                marginBottom: 6, cursor: 'grab', fontSize: 12,
                background: dp ? 'rgba(34,197,94,.06)' : 'var(--surface)',
                borderColor: dp ? 'rgba(34,197,94,.3)' : 'var(--border)',
              }}>
              <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 11 }}>{cc.codigo_origem}</div>
              <div>{cc.descricao_origem}</div>
              {dp && <div style={{ fontSize: 10, color: '#22c55e', marginTop: 2 }}>→ {dp.conta_referencial_descricao}</div>}
            </div>
          )
        })}
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>Plano Referencial (destino)</div>
        {contasRef.map(cr => (
          <div key={cr.id}
            onDragOver={e => e.preventDefault()}
            onDrop={() => { if (dragOrigemId) vincular(dragOrigemId, cr.id); setDragOrigemId(null) }}
            style={{
              padding: '8px 12px', border: '1px dashed var(--border)', borderRadius: 6,
              marginBottom: 6, fontSize: 12,
              background: dragOrigemId ? 'rgba(79,70,229,.05)' : 'transparent',
            }}>
            <div style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: 11 }}>{cr.codigo}</div>
            <div>{cr.descricao}</div>
            {cr.agrupamento && <div style={{ fontSize: 10, color: 'var(--brand)', marginTop: 2 }}>@{cr.agrupamento}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function RevisaoDepara() {
  const [aba, setAba] = useState('lista')
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [pendencias, setPendencias] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data))
  }, [])

  const carregar = async () => {
    setLoading(true)
    try {
      const r = await refDeParaAPI.pendencias(clienteId || null)
      setPendencias(r.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [clienteId])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Revisão De-Para</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {pendencias.length} pendência{pendencias.length !== 1 ? 's' : ''} de revisão
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={clienteId} onChange={e => setClienteId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">Todos os clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
          <button className="btn" onClick={carregar}><RefreshCw size={13} /></button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '2px solid var(--border)' }}>
        {[
          { id: 'lista', label: 'Lista de Pendências', icon: List },
          { id: 'lado', label: 'Modo Lado a Lado', icon: Columns },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setAba(id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', border: 'none', cursor: 'pointer',
            background: 'transparent', borderBottom: aba === id ? '2px solid var(--brand)' : '2px solid transparent',
            color: aba === id ? 'var(--brand)' : 'var(--text-muted)',
            fontWeight: aba === id ? 700 : 400, fontSize: 13, marginBottom: -2,
          }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Carregando...</div>
      ) : aba === 'lista' ? (
        <ModoLista pendencias={pendencias} clientes={clientes} onAtualizar={carregar} />
      ) : (
        <ModoLadoALado clienteId={clienteId ? Number(clienteId) : null} onAtualizar={carregar} />
      )}
    </div>
  )
}
