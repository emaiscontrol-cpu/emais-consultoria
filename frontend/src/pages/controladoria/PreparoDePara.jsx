import { useState, useEffect } from 'react'
import { CheckCircle2, HelpCircle, XCircle, Plus } from 'lucide-react'
import { refDeParaAPI, refPlanoAPI, clientesAPI } from '../../services/api'
import { Modal } from '../../components/shared'
import { Card, BadgeTag } from '../../components/ui'
import toast from 'react-hot-toast'

function flatten(contas) {
  const out = []
  for (const c of contas) {
    out.push(c)
    if (c.filhos?.length) out.push(...flatten(c.filhos))
  }
  return out
}

function ModalNovaConta({ planoId, descricaoSugerida, onCriado, onFechar }) {
  const [form, setForm] = useState({ codigo: '', descricao: descricaoSugerida || '', tipo: 'analitica' })
  const [salvando, setSalvando] = useState(false)

  const salvar = async () => {
    if (!form.codigo || !form.descricao) { toast.error('Preencha código e descrição'); return }
    setSalvando(true)
    try {
      const r = await refPlanoAPI.criarConta(planoId, form)
      toast.success('Conta criada no Plano Referencial')
      onCriado(r.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao criar conta')
      setSalvando(false)
    }
  }

  return (
    <Modal title="Incluir Nova Conta no Plano Referencial" onClose={onFechar}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div className="form-group">
          <label>Código</label>
          <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="ex: 4.15" />
        </div>
        <div className="form-group">
          <label>Descrição</label>
          <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
        </div>
        <div className="form-group">
          <label>Tipo</label>
          <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
            <option value="analitica">Analítica</option>
            <option value="sintetica">Sintética</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onFechar}>Cancelar</button>
          <button className="btn btn-primary" disabled={salvando} onClick={salvar}>
            {salvando ? 'Criando...' : 'Criar e Vincular'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ModalVincularExistente({ contasRef, onEscolher, onFechar }) {
  const [busca, setBusca] = useState('')
  const buscaNorm = busca.trim().toLowerCase()
  const filtradas = contasRef.filter(c => c.tipo === 'analitica' && (
    buscaNorm === '' ||
    c.descricao.toLowerCase().includes(buscaNorm) ||
    c.codigo.toLowerCase().includes(buscaNorm)
  ))

  return (
    <Modal title="Vincular a Conta Existente" onClose={onFechar}>
      <input value={busca} onChange={e => setBusca(e.target.value)}
        placeholder="Buscar por código ou descrição..." style={{ marginBottom: 12, width: '100%' }} autoFocus />
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'grid', gap: 4 }}>
        {filtradas.slice(0, 50).map(c => (
          <button key={c.id} className="btn btn-sm" style={{ justifyContent: 'flex-start', textAlign: 'left' }}
            onClick={() => onEscolher(c)}>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', marginRight: 8 }}>{c.codigo}</span>
            {c.descricao}
          </button>
        ))}
        {filtradas.length === 0 && (
          <div style={{ color: 'var(--text-muted)', padding: 12, fontSize: 13 }}>Nenhuma conta encontrada.</div>
        )}
      </div>
    </Modal>
  )
}

export default function PreparoDePara() {
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [colar, setColar] = useState('')
  const [resultado, setResultado] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [selecionadas, setSelecionadas] = useState(new Set())
  const [planoId, setPlanoId] = useState(null)
  const [contasRef, setContasRef] = useState([])
  const [modalNovaConta, setModalNovaConta] = useState(null)
  const [modalVincularId, setModalVincularId] = useState(null)

  useEffect(() => {
    clientesAPI.listar().then(r => setClientes(r.data))
    refPlanoAPI.listar().then(r => {
      if (r.data[0]) {
        setPlanoId(r.data[0].id)
        refPlanoAPI.listarContas(r.data[0].id).then(rc => setContasRef(flatten(rc.data)))
      }
    })
  }, [])

  const hoje = new Date()
  const vigencia = { vigente_a_partir_ano: hoje.getFullYear(), vigente_a_partir_mes: hoje.getMonth() + 1 }

  const rodarPreparo = async (cid = clienteId) => {
    setCarregando(true)
    try {
      const r = await refDeParaAPI.preparar(cid)
      setResultado(r.data)
      setSelecionadas(new Set())
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao rodar o preparo')
    } finally {
      setCarregando(false)
    }
  }

  const registrarEPreparar = async () => {
    if (!clienteId) { toast.error('Selecione um cliente'); return }
    setCarregando(true)
    try {
      const linhas = colar.split('\n').map(l => l.trim()).filter(Boolean)
      const contas = linhas.map(l => {
        const [codigo, ...resto] = l.split(/[;\t]/)
        return { codigo_origem: (codigo || '').trim(), descricao_origem: (resto.join(' ') || codigo || '').trim() }
      }).filter(c => c.codigo_origem)

      if (contas.length) {
        const r = await refDeParaAPI.registrarPlanoDeContas(clienteId, contas)
        toast.success(`${r.data.criadas} conta(s) nova(s) registrada(s)`)
      }
      await rodarPreparo()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao registrar plano de contas')
    } finally {
      setCarregando(false)
    }
  }

  const confirmarVinculo = async (contaClienteId, contaReferencialId) => {
    try {
      await refDeParaAPI.confirmar({
        conta_cliente_id: contaClienteId,
        itens: [{ conta_referencial_id: contaReferencialId, percentual: 100 }],
        ...vigencia,
      })
      toast.success('Vínculo confirmado')
      await rodarPreparo()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao confirmar')
    }
  }

  const confirmarSelecionadas = async () => {
    const itens = resultado.auto_vinculadas.filter(a => selecionadas.has(a.conta_cliente_id))
    if (!itens.length) { toast.error('Selecione ao menos uma conta'); return }
    try {
      await Promise.all(itens.map(item => refDeParaAPI.confirmar({
        conta_cliente_id: item.conta_cliente_id,
        itens: [{ conta_referencial_id: item.candidatos[0].conta_referencial_id, percentual: 100 }],
        ...vigencia,
      })))
      toast.success(`${itens.length} vínculo(s) confirmado(s)`)
      await rodarPreparo()
    } catch (e) {
      toast.error('Erro ao confirmar em lote')
    }
  }

  const ignorar = async (ccId) => {
    try {
      await refDeParaAPI.ignorarContaCliente(ccId, true)
      toast.success('Conta marcada como ignorada')
      await rodarPreparo()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erro ao ignorar')
    }
  }

  const toggleSelecionada = (id) => {
    setSelecionadas(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id); else novo.add(id)
      return novo
    })
  }

  const progresso = resultado ? Math.round((resultado.resolvidas / Math.max(resultado.total, 1)) * 100) : 0

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Preparo DE-PARA</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>
          Vincula o plano de contas do cliente ao Plano Referencial antes de importar valores —
          pré-requisito da importação de valores (Fase D).
        </p>
      </div>

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Cliente</label>
          <select value={clienteId} onChange={e => { setClienteId(e.target.value); setResultado(null) }}>
            <option value="">Selecione...</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razao_social}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Colar plano de contas (uma linha por conta: código;descrição)</label>
          <textarea value={colar} onChange={e => setColar(e.target.value)}
            placeholder={'311101;Vendas à Vista\n311104;Vendas Cartão Crédito\n...'}
            style={{ width: '100%', height: 100, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
        </div>
        <button className="btn btn-primary" disabled={!clienteId || carregando} onClick={registrarEPreparar}>
          {carregando ? 'Processando...' : 'Registrar e Rodar Preparo'}
        </button>
        {resultado && (
          <button className="btn" style={{ marginLeft: 8 }} disabled={carregando} onClick={() => rodarPreparo()}>
            Rodar Preparo Novamente
          </button>
        )}
      </Card>

      {resultado && (
        <>
          <Card style={{ padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{resultado.resolvidas} de {resultado.total} contas resolvidas</div>
              <div className="progress-wrap" style={{ marginTop: 6 }}>
                <div className={`progress-fill ${progresso === 100 ? 'green' : 'amber'}`} style={{ width: `${progresso}%` }} />
              </div>
            </div>
            <BadgeTag variant={progresso === 100 ? 'green' : 'amber'}>{progresso}%</BadgeTag>
          </Card>

          {/* AUTO-VINCULADAS */}
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="var(--green)" />
                <strong>Auto-vinculadas</strong>
                <BadgeTag variant="green">{resultado.auto_vinculadas.length}</BadgeTag>
              </div>
              {resultado.auto_vinculadas.length > 0 && (
                <button className="btn btn-sm btn-primary" onClick={confirmarSelecionadas}>
                  Confirmar selecionadas ({selecionadas.size})
                </button>
              )}
            </div>
            {resultado.auto_vinculadas.map(item => (
              <div key={item.conta_cliente_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <input type="checkbox" checked={selecionadas.has(item.conta_cliente_id)} onChange={() => toggleSelecionada(item.conta_cliente_id)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13 }}>{item.codigo_origem} — {item.descricao_origem}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    → {item.candidatos[0].codigo} {item.candidatos[0].descricao}
                    {item.resolvido_por === 'grupo' && ' (desambiguado por grupo)'}
                  </div>
                </div>
                <BadgeTag variant="green">{Math.round(item.candidatos[0].confianca * 100)}%</BadgeTag>
                <button className="btn btn-sm" onClick={() => confirmarVinculo(item.conta_cliente_id, item.candidatos[0].conta_referencial_id)}>
                  Confirmar
                </button>
              </div>
            ))}
            {resultado.auto_vinculadas.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma conta nesta situação.</div>
            )}
          </Card>

          {/* AMBÍGUAS */}
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <HelpCircle size={16} color="var(--amber)" />
              <strong>Ambíguas</strong>
              <BadgeTag variant="amber">{resultado.ambiguas.length}</BadgeTag>
            </div>
            {resultado.ambiguas.map(item => (
              <div key={item.conta_cliente_id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, marginBottom: 6 }}>{item.codigo_origem} — {item.descricao_origem}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {item.candidatos.map(c => (
                    <button key={c.conta_referencial_id} className="btn btn-sm"
                      onClick={() => confirmarVinculo(item.conta_cliente_id, c.conta_referencial_id)}>
                      {c.codigo} {c.descricao} ({Math.round(c.confianca * 100)}%)
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {resultado.ambiguas.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma conta nesta situação.</div>
            )}
          </Card>

          {/* SEM MATCH / TRATATIVA */}
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <XCircle size={16} color="var(--red)" />
              <strong>Tratativa (sem correspondência)</strong>
              <BadgeTag variant="red">{resultado.sem_match.length}</BadgeTag>
            </div>
            {resultado.sem_match.map(item => (
              <div key={item.conta_cliente_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ flex: 1, fontSize: 13 }}>{item.codigo_origem} — {item.descricao_origem}</div>
                <button className="btn btn-sm btn-primary" onClick={() => setModalNovaConta(item)}>
                  <Plus size={12} /> Incluir Nova Conta
                </button>
                <button className="btn btn-sm" onClick={() => setModalVincularId(item.conta_cliente_id)}>Vincular Existente</button>
                <button className="btn btn-sm" onClick={() => ignorar(item.conta_cliente_id)}>Ignorar</button>
              </div>
            ))}
            {resultado.sem_match.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma conta nesta situação.</div>
            )}
          </Card>
        </>
      )}

      {modalNovaConta && (
        <ModalNovaConta planoId={planoId} descricaoSugerida={modalNovaConta.descricao_origem}
          onFechar={() => setModalNovaConta(null)}
          onCriado={async (novaConta) => {
            setContasRef(prev => [...prev, novaConta])
            await confirmarVinculo(modalNovaConta.conta_cliente_id, novaConta.id)
            setModalNovaConta(null)
          }} />
      )}

      {modalVincularId && (
        <ModalVincularExistente contasRef={contasRef}
          onFechar={() => setModalVincularId(null)}
          onEscolher={async (conta) => {
            await confirmarVinculo(modalVincularId, conta.id)
            setModalVincularId(null)
          }} />
      )}
    </div>
  )
}
