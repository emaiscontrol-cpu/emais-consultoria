import { useState, useEffect } from 'react'
import { modelosAPI } from '../services/api'
import { Modal } from '../components/shared'
import { BotaoEditar, BotaoExcluir, BotaoNovo } from '../components/ui'
import { Copy, Plus, ChevronDown, ChevronRight, Clock, CheckSquare, Square, ListTodo } from 'lucide-react'
import toast from 'react-hot-toast'

const FORM_MODELO = { nome: '', descricao: '' }
const FORM_FASE   = { nome: '', ordem: 1, perc_desbloqueio: 80, duracao_dias: '' }
const FORM_TAR    = { nome: '', descricao: '', ordem: 0, requer_validacao: false, duracao_dias: '' }
const FORM_SUB    = { nome: '', ordem: 0, duracao_dias: '' }

export default function Modelos() {
  const [modelos,     setModelos]     = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [salvando,    setSalvando]    = useState(false)

  // abertura de painéis
  const [fasesAbertas,     setFasesAbertas]     = useState({})
  const [tarefasAbertas,   setTarefasAbertas]   = useState({})

  // modais
  const [modalModelo, setModalModelo] = useState(false)
  const [editModelo,  setEditModelo]  = useState(null)
  const [fModelo,     setFModelo]     = useState(FORM_MODELO)

  const [modalFase,   setModalFase]   = useState(false)
  const [editFase,    setEditFase]    = useState(null)
  const [fFase,       setFFase]       = useState(FORM_FASE)

  const [modalTar,    setModalTar]    = useState(false)
  const [editTar,     setEditTar]     = useState(null)
  const [faseIdTar,   setFaseIdTar]   = useState(null)
  const [fTar,        setFTar]        = useState(FORM_TAR)

  const [modalSub,    setModalSub]    = useState(false)
  const [editSub,     setEditSub]     = useState(null)
  const [faseIdSub,   setFaseIdSub]   = useState(null)
  const [tarIdSub,    setTarIdSub]    = useState(null)
  const [fSub,        setFSub]        = useState(FORM_SUB)

  // ── Carregar ────────────────────────────────────────────────────────────────

  const carregar = async () => {
    setLoading(true)
    try { const { data } = await modelosAPI.listar(); setModelos(data) }
    catch { toast.error('Erro ao carregar modelos') }
    finally { setLoading(false) }
  }

  const carregarDetalhe = async (id) => {
    try {
      const { data } = await modelosAPI.detalhe(id)
      setSelecionado(data)
      const fa = {}, ta = {}
      data.fases.forEach(f => {
        fa[f.id] = true
        f.tarefas.forEach(t => { ta[t.id] = false })
      })
      setFasesAbertas(fa)
      setTarefasAbertas(ta)
    } catch { toast.error('Erro ao carregar modelo') }
  }

  const atualizar = (data) => {
    setSelecionado(data)
    carregar()
  }

  useEffect(() => { carregar() }, [])

  // ── Modelo ──────────────────────────────────────────────────────────────────

  const salvarModelo = async () => {
    if (!fModelo.nome.trim()) return toast.error('Informe o nome')
    setSalvando(true)
    try {
      if (editModelo) {
        await modelosAPI.atualizar(editModelo.id, fModelo)
        toast.success('Template atualizado!')
        await carregarDetalhe(editModelo.id)
      } else {
        const { data } = await modelosAPI.criar(fModelo)
        toast.success('Template criado!')
        await carregarDetalhe(data.id)
      }
      setModalModelo(false); carregar()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao salvar') }
    finally { setSalvando(false) }
  }

  const excluirModelo = async (m) => {
    if (!confirm(`Excluir o template "${m.nome}"?`)) return
    try {
      await modelosAPI.deletar(m.id)
      toast.success('Template excluído')
      if (selecionado?.id === m.id) setSelecionado(null)
      carregar()
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro') }
  }

  // ── Fase ────────────────────────────────────────────────────────────────────

  const salvarFase = async () => {
    if (!fFase.nome.trim()) return toast.error('Informe o nome da fase')
    setSalvando(true)
    try {
      const payload = { nome: fFase.nome, ordem: +fFase.ordem, perc_desbloqueio: +fFase.perc_desbloqueio, duracao_dias: fFase.duracao_dias ? +fFase.duracao_dias : null }
      const { data } = editFase
        ? await modelosAPI.atualizarFase(selecionado.id, editFase.id, payload)
        : await modelosAPI.criarFase(selecionado.id, payload)
      toast.success(editFase ? 'Fase atualizada!' : 'Fase adicionada!')
      atualizar(data); setModalFase(false)
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao salvar fase') }
    finally { setSalvando(false) }
  }

  const excluirFase = async (f) => {
    if (!confirm(`Excluir a fase "${f.nome}" e todo o seu conteúdo do template?`)) return
    try { const { data } = await modelosAPI.deletarFase(selecionado.id, f.id); atualizar(data) }
    catch (err) { toast.error(err.response?.data?.detail || 'Erro') }
  }

  // ── Tarefa ──────────────────────────────────────────────────────────────────

  const salvarTarefa = async () => {
    if (!fTar.nome.trim()) return toast.error('Informe o nome da tarefa')
    setSalvando(true)
    try {
      const payload = { nome: fTar.nome, descricao: fTar.descricao || null, ordem: +fTar.ordem, requer_validacao: fTar.requer_validacao, duracao_dias: fTar.duracao_dias ? +fTar.duracao_dias : null }
      const { data } = editTar
        ? await modelosAPI.atualizarTarefa(selecionado.id, faseIdTar, editTar.id, payload)
        : await modelosAPI.criarTarefa(selecionado.id, faseIdTar, payload)
      toast.success(editTar ? 'Tarefa atualizada!' : 'Tarefa adicionada!')
      atualizar(data); setModalTar(false)
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao salvar tarefa') }
    finally { setSalvando(false) }
  }

  const excluirTarefa = async (t, faseId) => {
    if (!confirm(`Excluir a tarefa "${t.nome}" e suas atividades do template?`)) return
    try { const { data } = await modelosAPI.deletarTarefa(selecionado.id, faseId, t.id); atualizar(data) }
    catch (err) { toast.error(err.response?.data?.detail || 'Erro') }
  }

  // ── Subtarefa ───────────────────────────────────────────────────────────────

  const salvarSub = async () => {
    if (!fSub.nome.trim()) return toast.error('Informe o nome da atividade')
    setSalvando(true)
    try {
      const payload = { nome: fSub.nome, ordem: +fSub.ordem, duracao_dias: fSub.duracao_dias ? +fSub.duracao_dias : null }
      const { data } = editSub
        ? await modelosAPI.atualizarSubtarefa(selecionado.id, faseIdSub, tarIdSub, editSub.id, payload)
        : await modelosAPI.criarSubtarefa(selecionado.id, faseIdSub, tarIdSub, payload)
      toast.success(editSub ? 'Atividade atualizada!' : 'Atividade adicionada!')
      atualizar(data); setModalSub(false)
    } catch (err) { toast.error(err.response?.data?.detail || 'Erro ao salvar atividade') }
    finally { setSalvando(false) }
  }

  const excluirSub = async (s, faseId, tarId) => {
    if (!confirm(`Excluir a atividade "${s.nome}"?`)) return
    try { const { data } = await modelosAPI.deletarSubtarefa(selecionado.id, faseId, tarId, s.id); atualizar(data) }
    catch (err) { toast.error(err.response?.data?.detail || 'Erro') }
  }

  // ── Abrir modais ────────────────────────────────────────────────────────────

  const abrirModelo  = (m)        => { setEditModelo(m); setFModelo(m ? { nome: m.nome, descricao: m.descricao || '' } : FORM_MODELO); setModalModelo(true) }
  const abrirFase    = (f)        => { setEditFase(f); setFFase(f ? { nome: f.nome, ordem: f.ordem, perc_desbloqueio: f.perc_desbloqueio, duracao_dias: f.duracao_dias ?? '' } : { ...FORM_FASE, ordem: (selecionado?.fases.length ?? 0) + 1 }); setModalFase(true) }
  const abrirTar     = (t, fId)   => { setEditTar(t); setFaseIdTar(fId); setFTar(t ? { nome: t.nome, descricao: t.descricao || '', ordem: t.ordem, requer_validacao: t.requer_validacao, duracao_dias: t.duracao_dias ?? '' } : { ...FORM_TAR, ordem: (selecionado?.fases.find(f => f.id === fId)?.tarefas.length ?? 0) + 1 }); setModalTar(true) }
  const abrirSub     = (s, fId, tId) => { setEditSub(s); setFaseIdSub(fId); setTarIdSub(tId); setFSub(s ? { nome: s.nome, ordem: s.ordem, duracao_dias: s.duracao_dias ?? '' } : { ...FORM_SUB, ordem: (selecionado?.fases.find(f => f.id === fId)?.tarefas.find(t => t.id === tId)?.subtarefas.length ?? 0) + 1 }); setModalSub(true) }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Painel esquerdo */}
      <div style={{ width: 270, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Copy size={18} color="var(--brand)" />
              <span style={{ fontWeight: 700, fontSize: 15 }}>Templates</span>
            </div>
            <BotaoNovo size="sm" onClick={() => abrirModelo(null)}>Novo</BotaoNovo>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{modelos.length} template(s)</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
          ) : modelos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              <Copy size={28} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.3 }} />
              Nenhum template.<br />Clique em "Novo" para criar.
            </div>
          ) : modelos.map(m => (
            <div key={m.id} onClick={() => carregarDetalhe(m.id)}
              style={{ padding: '10px 16px', cursor: 'pointer', borderLeft: '3px solid', borderLeftColor: selecionado?.id === m.id ? 'var(--brand)' : 'transparent', background: selecionado?.id === m.id ? '#f0f5ff' : 'transparent' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{m.nome}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.total_fases} fase(s) · {m.total_tarefas} tarefa(s)</div>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {!selecionado ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-muted)' }}>
            <Copy size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>Selecione um template para visualizar e editar</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{selecionado.nome}</h1>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {selecionado.descricao || 'Sem descrição'} · {selecionado.total_fases} fase(s) · {selecionado.total_tarefas} tarefa(s)
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <BotaoEditar onClick={() => abrirModelo(selecionado)}>Editar</BotaoEditar>
                <BotaoExcluir onClick={() => excluirModelo(selecionado)}>Excluir</BotaoExcluir>
              </div>
            </div>

            {/* Cabeçalho fases */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Estrutura do Template</span>
              <button className="btn btn-primary btn-sm" onClick={() => abrirFase(null)} style={{ gap: 5 }}><Plus size={12} /> Adicionar Fase</button>
            </div>

            {selecionado.fases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, background: '#f8f9fa', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                Nenhuma fase ainda. Clique em "Adicionar Fase" para começar.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selecionado.fases.map((fase, fi) => (
                  <div key={fase.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>

                    {/* Header da fase */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#f0f4ff', cursor: 'pointer' }}
                      onClick={() => setFasesAbertas(p => ({ ...p, [fase.id]: !p[fase.id] }))}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{fi + 1}</div>
                      {fasesAbertas[fase.id] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                      <span style={{ fontWeight: 700, fontSize: 13, flex: 1, color: 'var(--brand)' }}>{fase.nome}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {fase.tarefas.length} tarefa(s){fase.duracao_dias ? ` · ${fase.duracao_dias}d` : ''}{' · '}desbloqueio {fase.perc_desbloqueio}%
                      </span>
                      <BotaoEditar onClick={e => { e.stopPropagation(); abrirFase(fase) }} />
                      <BotaoExcluir onClick={e => { e.stopPropagation(); excluirFase(fase) }} />
                    </div>

                    {/* Tarefas da fase */}
                    {fasesAbertas[fase.id] && (
                      <div style={{ padding: '8px 14px 12px' }}>
                        {fase.tarefas.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0 8px', textAlign: 'center' }}>Nenhuma tarefa nesta fase</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                            {fase.tarefas.map((tar, ti) => (
                              <div key={tar.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>

                                {/* Header da tarefa */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: '#fafafa', cursor: 'pointer' }}
                                  onClick={() => setTarefasAbertas(p => ({ ...p, [tar.id]: !p[tar.id] }))}>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, textAlign: 'center', flexShrink: 0 }}>{fi + 1}.{ti + 1}</span>
                                  <ListTodo size={12} color="var(--text-muted)" style={{ flexShrink: 0 }}/>
                                  {tarefasAbertas[tar.id] ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{tar.nome}</span>
                                  {tar.duracao_dias && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10}/>{tar.duracao_dias}d</span>}
                                  {tar.requer_validacao && <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Validação</span>}
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{tar.subtarefas.length} ativ.</span>
                                  <BotaoEditar onClick={e => { e.stopPropagation(); abrirTar(tar, fase.id) }} />
                                  <BotaoExcluir onClick={e => { e.stopPropagation(); excluirTarefa(tar, fase.id) }} />
                                </div>

                                {/* Subtarefas / Atividades */}
                                {tarefasAbertas[tar.id] && (
                                  <div style={{ padding: '6px 10px 8px 32px', background: '#fff' }}>
                                    {tar.subtarefas.length === 0 ? (
                                      <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0 6px' }}>Nenhuma atividade nesta tarefa</div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                                        {tar.subtarefas.map((sub, si) => (
                                          <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', background: '#f9fafb', borderRadius: 5, border: '1px solid #f0f0f0' }}>
                                            <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 30, flexShrink: 0 }}>{fi+1}.{ti+1}.{si+1}</span>
                                            <span style={{ flex: 1, fontSize: 12 }}>{sub.nome}</span>
                                            {sub.duracao_dias && <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 2 }}><Clock size={9}/>{sub.duracao_dias}d</span>}
                                            <BotaoEditar onClick={() => abrirSub(sub, fase.id, tar.id)} />
                                            <BotaoExcluir onClick={() => excluirSub(sub, fase.id, tar.id)} />
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <button className="btn btn-ghost btn-sm" onClick={() => abrirSub(null, fase.id, tar.id)}
                                      style={{ fontSize: 11, gap: 4, color: 'var(--brand)', padding: '3px 6px' }}>
                                      <Plus size={10}/> Adicionar atividade
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirTar(null, fase.id)}
                          style={{ fontSize: 12, gap: 5, color: 'var(--brand)' }}>
                          <Plus size={11}/> Adicionar tarefa
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24, padding: '12px 16px', background: '#f0f5ff', borderRadius: 8, fontSize: 12, color: '#1e40af', border: '1px solid #bfdbfe' }}>
              <strong>Como usar:</strong> Ao criar um novo projeto, selecione este template.
              O sistema criará automaticamente todas as fases, tarefas e atividades.
              {' '}Informe a data de início do projeto para calcular os prazos automaticamente.
            </div>
          </>
        )}
      </div>

      {/* Modal Modelo */}
      {modalModelo && (
        <Modal title={editModelo ? 'Editar template' : 'Novo template'} onClose={() => setModalModelo(false)}
          footer={<><button className="btn" onClick={() => setModalModelo(false)}>Cancelar</button><button className="btn btn-primary" onClick={salvarModelo} disabled={salvando}>{salvando ? 'Salvando...' : editModelo ? 'Salvar' : 'Criar'}</button></>}>
          <div className="form-group">
            <label>Nome *</label>
            <input value={fModelo.nome} autoFocus onChange={e => setFModelo(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Diagnóstico Financeiro" />
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <textarea value={fModelo.descricao} onChange={e => setFModelo(f => ({ ...f, descricao: e.target.value }))} rows={2} placeholder="Quando usar este template..." />
          </div>
        </Modal>
      )}

      {/* Modal Fase */}
      {modalFase && (
        <Modal title={editFase ? 'Editar fase' : 'Adicionar fase'} onClose={() => setModalFase(false)}
          footer={<><button className="btn" onClick={() => setModalFase(false)}>Cancelar</button><button className="btn btn-primary" onClick={salvarFase} disabled={salvando}>{salvando ? 'Salvando...' : editFase ? 'Salvar' : 'Adicionar'}</button></>}>
          <div className="form-group">
            <label>Nome da fase *</label>
            <input value={fFase.nome} autoFocus onChange={e => setFFase(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Levantamento, Análise, Implementação..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ordem</label>
              <input type="number" min={1} value={fFase.ordem} onChange={e => setFFase(f => ({ ...f, ordem: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Duração estimada (dias)</label>
              <input type="number" min={1} value={fFase.duracao_dias} onChange={e => setFFase(f => ({ ...f, duracao_dias: e.target.value }))} placeholder="Ex: 15" />
            </div>
          </div>
          <div className="form-group">
            <label>% para desbloquear próxima fase</label>
            <input type="number" min={1} max={100} value={fFase.perc_desbloqueio} onChange={e => setFFase(f => ({ ...f, perc_desbloqueio: e.target.value }))} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>Padrão 80% — a próxima fase desbloqueia quando esta atingir este %.</span>
          </div>
        </Modal>
      )}

      {/* Modal Tarefa */}
      {modalTar && (
        <Modal title={editTar ? 'Editar tarefa' : 'Adicionar tarefa'} onClose={() => setModalTar(false)}
          footer={<><button className="btn" onClick={() => setModalTar(false)}>Cancelar</button><button className="btn btn-primary" onClick={salvarTarefa} disabled={salvando}>{salvando ? 'Salvando...' : editTar ? 'Salvar' : 'Adicionar'}</button></>}>
          <div className="form-group">
            <label>Nome da tarefa *</label>
            <input value={fTar.nome} autoFocus onChange={e => setFTar(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Reunião de kick-off..." />
          </div>
          <div className="form-group">
            <label>Descrição</label>
            <input value={fTar.descricao} onChange={e => setFTar(f => ({ ...f, descricao: e.target.value }))} placeholder="Opcional..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ordem</label>
              <input type="number" min={1} value={fTar.ordem} onChange={e => setFTar(f => ({ ...f, ordem: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Duração estimada (dias)</label>
              <input type="number" min={1} value={fTar.duracao_dias} onChange={e => setFTar(f => ({ ...f, duracao_dias: e.target.value }))} placeholder="Ex: 3" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}
            onClick={() => setFTar(f => ({ ...f, requer_validacao: !f.requer_validacao }))}>
            {fTar.requer_validacao ? <CheckSquare size={16} color="var(--brand)"/> : <Square size={16} color="var(--text-muted)"/>}
            <span style={{ fontSize: 13 }}>Requer validação do consultor após confirmação do cliente</span>
          </div>
        </Modal>
      )}

      {/* Modal Subtarefa / Atividade */}
      {modalSub && (
        <Modal title={editSub ? 'Editar atividade' : 'Adicionar atividade'} onClose={() => setModalSub(false)}
          footer={<><button className="btn" onClick={() => setModalSub(false)}>Cancelar</button><button className="btn btn-primary" onClick={salvarSub} disabled={salvando}>{salvando ? 'Salvando...' : editSub ? 'Salvar' : 'Adicionar'}</button></>}>
          <div className="form-group">
            <label>Nome da atividade *</label>
            <input value={fSub.nome} autoFocus onChange={e => setFSub(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Preparar pauta, Enviar convite..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ordem</label>
              <input type="number" min={1} value={fSub.ordem} onChange={e => setFSub(f => ({ ...f, ordem: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Duração estimada (dias)</label>
              <input type="number" min={1} value={fSub.duracao_dias} onChange={e => setFSub(f => ({ ...f, duracao_dias: e.target.value }))} placeholder="Ex: 1" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
