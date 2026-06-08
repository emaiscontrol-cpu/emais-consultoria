import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { projetosAPI, fasesAPI, tarefasAPI, usuariosAPI, subtarefasAPI } from '../services/api'
import { Badge, Progress, Avatar, Modal, LoadingPage } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import { ChevronDown, ChevronRight, Plus, MessageSquare, Check, Lock, ArrowLeft, ListTodo, Trash2, Pencil, X, EyeOff, Eye, UserPlus, Settings, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'

const SUB_STATUS = {
  a_fazer:  { label:'A fazer',   cor:'var(--gray)',  bg:'var(--gray-light)',  next:'pendente'  },
  pendente: { label:'Pendente',  cor:'var(--amber)', bg:'var(--amber-light)', next:'concluida' },
  concluida:{ label:'Concluído', cor:'var(--green)', bg:'var(--green-light)', next:'a_fazer'   },
}

const fmtData = iso => iso ? new Date(iso).toLocaleDateString('pt-BR') : null

function SubtarefaItem({ sub, onUpdate, onDelete, readonly, usuarios }) {
  const cfg = SUB_STATUS[sub.status] || SUB_STATUS.a_fazer
  const [editando, setEditando] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form, setForm] = useState({
    nome:          sub.nome,
    responsavel_id: sub.responsavel_id ? String(sub.responsavel_id) : '',
    data_inicio:   sub.data_inicio ? sub.data_inicio.slice(0,10) : '',
    data_fim:      sub.data_fim    ? sub.data_fim.slice(0,10)    : '',
  })

  const toggle = async () => {
    if (readonly) return
    try {
      await subtarefasAPI.atualizar(sub.id, { status: cfg.next })
      onUpdate()
    } catch { toast.error('Erro ao atualizar') }
  }

  const salvar = async () => {
    if (!form.nome.trim()) return
    setSaving(true)
    try {
      await subtarefasAPI.atualizar(sub.id, {
        nome:          form.nome.trim(),
        responsavel_id: form.responsavel_id ? parseInt(form.responsavel_id) : null,
        data_inicio:   form.data_inicio || null,
        data_fim:      form.data_fim    || null,
      })
      setEditando(false)
      onUpdate()
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ padding:'6px 0', borderBottom:'0.5px solid var(--border)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <button onClick={toggle} title={`Status: ${cfg.label} — clique para avançar`}
          style={{ flexShrink:0, width:20, height:20, borderRadius:4, border:`1.5px solid ${cfg.cor}`,
            background: sub.status === 'concluida' ? cfg.cor : cfg.bg,
            display:'flex', alignItems:'center', justifyContent:'center', cursor: readonly ? 'default' : 'pointer' }}>
          {sub.status === 'concluida' && <Check size={11} color="#fff" />}
        </button>
        <span style={{ flex:1, fontSize:12, textDecoration: sub.status === 'concluida' ? 'line-through' : 'none',
          color: sub.status === 'concluida' ? 'var(--text-3)' : 'var(--text)' }}>
          {sub.nome}
        </span>
        <span style={{ fontSize:10, fontWeight:600, color:cfg.cor, background:cfg.bg,
          padding:'1px 7px', borderRadius:99, whiteSpace:'nowrap' }}>
          {cfg.label}
        </span>
        {!readonly && (
          <>
            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 4px', color:'var(--text-3)' }}
              onClick={() => setEditando(v => !v)} title="Editar">
              <Pencil size={11} />
            </button>
            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 4px', color:'var(--text-3)' }}
              onClick={() => onDelete(sub.id)} title="Excluir">
              <Trash2 size={11} />
            </button>
          </>
        )}
      </div>

      {(sub.responsavel || sub.data_inicio || sub.data_fim || sub.data_prazo) && !editando && (
        <div style={{ display:'flex', gap:12, marginTop:3, marginLeft:28, fontSize:10, color:'var(--text-3)', flexWrap:'wrap' }}>
          {sub.responsavel && <span>👤 {sub.responsavel.nome}</span>}
          {sub.data_inicio && <span>▶ {fmtData(sub.data_inicio)}</span>}
          {sub.data_fim    && <span>◼ {fmtData(sub.data_fim)}</span>}
          {sub.data_prazo  && <span>⏰ prazo {fmtData(sub.data_prazo)}</span>}
        </div>
      )}

      {editando && (
        <div style={{ marginTop:6, marginLeft:28 }}>
          <div style={{ display:'flex', gap:6, marginBottom:5 }}>
            <input value={form.nome} autoFocus
              onChange={e=>setForm(f=>({...f,nome:e.target.value}))}
              style={{ flex:1, fontSize:12, padding:'4px 8px' }}
              onKeyDown={e=>e.key==='Enter'&&salvar()} />
          </div>
          <div style={{ display:'flex', gap:6, marginBottom:5 }}>
            <select value={form.responsavel_id}
              onChange={e=>setForm(f=>({...f,responsavel_id:e.target.value}))}
              style={{ flex:1, fontSize:12, padding:'4px 8px' }}>
              <option value="">Responsável (opcional)</option>
              {(usuarios||[]).map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
            <input type="date" value={form.data_inicio}
              onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))}
              style={{ width:130, fontSize:12, padding:'4px 8px' }} title="Data início" />
            <input type="date" value={form.data_fim}
              onChange={e=>setForm(f=>({...f,data_fim:e.target.value}))}
              style={{ width:130, fontSize:12, padding:'4px 8px' }} title="Data fim" />
          </div>
          <div style={{ display:'flex', gap:5, justifyContent:'flex-end' }}>
            <button className="btn btn-sm" onClick={()=>setEditando(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={salvar} disabled={saving||!form.nome.trim()}>
              {saving?'...':'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TarefaRow({ tarefa, usuarios, onUpdate, perfil }) {
  const [showComent,   setShowComent]   = useState(false)
  const [showSubs,     setShowSubs]     = useState(false)
  const [showEdit,     setShowEdit]     = useState(false)
  const [comentarios,  setComentarios]  = useState([])
  const [subtarefas,   setSubtarefas]   = useState(tarefa.subtarefas || [])
  const [novoComent,   setNovoComent]   = useState('')
  const [novaSubForm,  setNovaSubForm]  = useState({ nome:'', responsavel_id:'', data_inicio:'', data_fim:'' })
  const [loadingComent, setLoadingComent] = useState(false)
  const [savingSub,    setSavingSub]    = useState(false)
  const [formEdit, setFormEdit] = useState({
    nome: tarefa.nome,
    responsavel_id: tarefa.responsavel_id ? String(tarefa.responsavel_id) : '',
    data_prazo: tarefa.data_prazo ? new Date(tarefa.data_prazo).toISOString().slice(0,10) : '',
    requer_validacao: tarefa.requer_validacao,
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [responsaveis,     setResponsaveis]     = useState(tarefa.responsaveis || [])
  const [showFormResp,     setShowFormResp]     = useState(false)
  const [savingResp,       setSavingResp]       = useState(false)
  const [formResp, setFormResp] = useState({ nome:'', funcao:'', email:'', telefone:'' })

  const isCliente   = perfil === 'cliente'
  const isConsultor = ['admin','consultor','ger_projeto'].includes(perfil)
  const responsavel = usuarios.find(u => u.id === tarefa.responsavel_id)

  const ativa                = tarefa.ativo !== false
  const concluida            = tarefa.status === 'concluida'
  const bloqueadaParaCliente = isCliente && (tarefa.confirmado_cliente || concluida)

  const totalSubs     = subtarefas.length
  const concluidasSubs = subtarefas.filter(s => s.status === 'concluida').length

  const handleToggleStatus = async () => {
    if (isCliente) {
      try {
        await tarefasAPI.atualizar(tarefa.id, { confirmado_cliente: true })
        toast.success(tarefa.requer_validacao ? 'Enviado para validação do consultor' : 'Tarefa confirmada!')
        onUpdate()
      } catch { toast.error('Erro ao confirmar tarefa') }
    } else {
      // Concluída → reverte para Em andamento
      if (tarefa.status === 'concluida') {
        if (!confirm('Desmarcar esta tarefa como concluída e voltar para "Em andamento"?')) return
        try {
          await tarefasAPI.atualizar(tarefa.id, { status: 'em_andamento', percentual: 0 })
          toast.success('Tarefa reaberta.')
          onUpdate()
        } catch { toast.error('Erro ao reabrir tarefa') }
        return
      }
      const next = tarefa.status === 'pendente' ? 'em_andamento'
                 : tarefa.status === 'em_andamento' ? 'concluida'
                 : tarefa.status === 'aguard_validacao' ? 'concluida'
                 : tarefa.status === 'aguard_valid' ? 'concluida'
                 : null
      if (!next) return
      try {
        await tarefasAPI.atualizar(tarefa.id, { status: next, percentual: next === 'concluida' ? 100 : tarefa.percentual })
        onUpdate()
      } catch { toast.error('Erro ao atualizar tarefa') }
    }
  }

  const handleSalvarEdicao = async () => {
    setSavingEdit(true)
    try {
      await tarefasAPI.atualizar(tarefa.id, {
        nome: formEdit.nome,
        responsavel_id: formEdit.responsavel_id ? parseInt(formEdit.responsavel_id) : null,
        data_prazo: formEdit.data_prazo || null,
        requer_validacao: formEdit.requer_validacao,
      })
      toast.success('Tarefa atualizada!')
      setShowEdit(false)
      onUpdate()
    } catch { toast.error('Erro ao atualizar tarefa') }
    finally { setSavingEdit(false) }
  }

  const handleExcluir = async () => {
    if (!confirm(`Excluir a tarefa "${tarefa.nome}"?`)) return
    try {
      await tarefasAPI.deletar(tarefa.id)
      toast.success('Tarefa excluída!')
      onUpdate()
    } catch { toast.error('Erro ao excluir tarefa') }
  }

  const handleToggleAtivo = async () => {
    const novoAtivo = tarefa.ativo === false ? true : false
    try {
      await tarefasAPI.atualizar(tarefa.id, { ativo: novoAtivo })
      toast.success(novoAtivo ? 'Tarefa reativada!' : 'Tarefa desativada!')
      onUpdate()
    } catch { toast.error('Erro ao alterar tarefa') }
  }

  const recarregarSubs = async () => {
    const { data } = await subtarefasAPI.listar(tarefa.id)
    setSubtarefas(data)
  }

  const adicionarResponsavel = async () => {
    if (!formResp.nome.trim()) return
    setSavingResp(true)
    try {
      await tarefasAPI.adicionarResponsavel(tarefa.id, {
        nome: formResp.nome.trim(),
        funcao: formResp.funcao.trim() || null,
        email: formResp.email.trim() || null,
        telefone: formResp.telefone.trim() || null,
      })
      const { data } = await tarefasAPI.listarResponsaveis(tarefa.id)
      setResponsaveis(data)
      setFormResp({ nome:'', funcao:'', email:'', telefone:'' })
      setShowFormResp(false)
    } catch { toast.error('Erro ao adicionar responsável') }
    finally { setSavingResp(false) }
  }

  const removerResponsavel = async (respId) => {
    try {
      await tarefasAPI.removerResponsavel(tarefa.id, respId)
      setResponsaveis(prev => prev.filter(r => r.id !== respId))
    } catch { toast.error('Erro ao remover responsável') }
  }

  const adicionarSub = async () => {
    if (!novaSubForm.nome.trim()) return
    setSavingSub(true)
    try {
      await subtarefasAPI.criar({
        tarefa_id: tarefa.id,
        nome: novaSubForm.nome.trim(),
        responsavel_id: novaSubForm.responsavel_id ? parseInt(novaSubForm.responsavel_id) : null,
        data_inicio: novaSubForm.data_inicio || null,
        data_fim: novaSubForm.data_fim || null,
        ordem: subtarefas.length,
      })
      setNovaSubForm({ nome:'', responsavel_id:'', data_inicio:'', data_fim:'' })
      await recarregarSubs()
    } catch { toast.error('Erro ao adicionar subtarefa') }
    finally { setSavingSub(false) }
  }

  const deletarSub = async (id) => {
    try {
      await subtarefasAPI.deletar(id)
      await recarregarSubs()
    } catch { toast.error('Erro ao remover subtarefa') }
  }

  const carregarComentarios = async () => {
    if (!showComent) {
      const { data } = await tarefasAPI.comentarios(tarefa.id)
      setComentarios(data)
    }
    setShowComent(v => !v)
  }

  const enviarComentario = async () => {
    if (!novoComent.trim()) return
    setLoadingComent(true)
    try {
      await tarefasAPI.comentar(tarefa.id, novoComent)
      const { data } = await tarefasAPI.comentarios(tarefa.id)
      setComentarios(data)
      setNovoComent('')
    } catch { toast.error('Erro ao comentar') }
    finally { setLoadingComent(false) }
  }

  return (
    <div style={{ borderBottom:'0.5px solid var(--border)', opacity: ativa ? 1 : 0.45 }}>
      <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 100px 80px 100px 185px', alignItems:'center', gap:10, padding:'9px 4px' }}>
        {/* Checkbox */}
        <div onClick={!bloqueadaParaCliente ? handleToggleStatus : undefined}
          style={{ width:20, height:20, borderRadius:4,
            border: concluida ? 'none' : '1.5px solid var(--border-md)',
            background: concluida ? 'var(--green)' : tarefa.status === 'aguard_valid' || tarefa.status === 'aguard_validacao' ? 'var(--purple-light)' : 'transparent',
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor: bloqueadaParaCliente ? 'default' : 'pointer', flexShrink:0 }}>
          {concluida && <Check size={12} color="#fff" />}
        </div>

        {/* Nome + badge subtarefas */}
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontWeight:500, textDecoration: (!ativa || concluida) ? 'line-through' : 'none',
              color: (!ativa || concluida) ? 'var(--text-3)' : 'var(--text)', fontSize:13 }}>
              {tarefa.nome}
            </span>
            {totalSubs > 0 && (
              <span style={{ fontSize:10, fontWeight:600, color: concluidasSubs === totalSubs ? 'var(--green)' : 'var(--amber)',
                background: concluidasSubs === totalSubs ? 'var(--green-light)' : 'var(--amber-light)',
                padding:'1px 6px', borderRadius:99 }}>
                {concluidasSubs}/{totalSubs}
              </span>
            )}
          </div>
          {tarefa.requer_validacao && (
            <span className="badge badge-purple" style={{ fontSize:10, marginTop:2 }}>Requer validação</span>
          )}
        </div>

        {/* Responsável */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {responsavel
            ? <><Avatar nome={responsavel.nome} color="blue" /><span style={{ fontSize:11, color:'var(--text-2)' }}>{responsavel.nome.split(' ')[0]}</span></>
            : <span style={{ color:'var(--text-3)', fontSize:11 }}>—</span>}
        </div>

        {/* Prazo */}
        <div style={{ fontSize:11, color: tarefa.status === 'atrasada' ? 'var(--red)' : 'var(--text-2)' }}>
          {tarefa.data_prazo ? new Date(tarefa.data_prazo).toLocaleDateString('pt-BR') : '—'}
        </div>

        {/* % */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <Progress value={tarefa.percentual} />
          <span style={{ fontSize:11, color:'var(--text-2)' }}>{tarefa.percentual}%</span>
        </div>

        {/* Status + botões */}
        <div style={{ display:'flex', alignItems:'center', gap:3, flexWrap:'nowrap' }}>
          <Badge status={tarefa.status} />
          <button className="btn btn-ghost btn-sm" style={{ padding:'3px 5px' }} title="Subtarefas"
            onClick={() => { setShowSubs(v => !v); setShowEdit(false) }}>
            <ListTodo size={13} color={showSubs ? 'var(--brand)' : undefined} />
          </button>
          <button className="btn btn-ghost btn-sm" style={{ padding:'3px 5px' }} onClick={carregarComentarios}>
            <MessageSquare size={13} />
          </button>
          {isConsultor && (<>
            <button className="btn btn-ghost btn-sm" style={{ padding:'3px 5px' }}
              title={ativa ? 'Desativar tarefa' : 'Reativar tarefa'}
              onClick={handleToggleAtivo}>
              {ativa ? <EyeOff size={12} color="var(--text-3)" /> : <Eye size={12} color="var(--brand)" />}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ padding:'3px 5px' }} title="Editar tarefa"
              onClick={() => { setShowEdit(v => !v); setShowSubs(false); setShowComent(false) }}>
              <Pencil size={12} color={showEdit ? 'var(--brand)' : undefined} />
            </button>
            <button className="btn btn-ghost btn-sm" style={{ padding:'3px 5px', color:'var(--red)' }} title="Excluir tarefa"
              onClick={handleExcluir}>
              <Trash2 size={12} />
            </button>
          </>)}
        </div>
      </div>

      {/* Painel de subtarefas */}
      {showSubs && (
        <div style={{ padding:'8px 12px 12px 36px', background:'var(--bg)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em' }}>
              Subtarefas
            </span>
            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 5px' }} title="Fechar"
              onClick={() => setShowSubs(false)}>
              <X size={12} />
            </button>
          </div>
          {subtarefas.length === 0 && (
            <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:8 }}>Nenhuma subtarefa ainda.</div>
          )}
          {subtarefas.map(s => (
            <SubtarefaItem key={s.id} sub={s} onUpdate={recarregarSubs} onDelete={deletarSub} readonly={false} usuarios={usuarios} />
          ))}
          {isConsultor && (
            <div style={{ marginTop:10 }}>
              <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                <input value={novaSubForm.nome}
                  onChange={e=>setNovaSubForm(f=>({...f,nome:e.target.value}))}
                  placeholder="Nova subtarefa..." style={{ flex:1, fontSize:12, padding:'5px 9px' }}
                  onKeyDown={e=>e.key==='Enter'&&adicionarSub()} />
                <button className="btn btn-primary btn-sm" onClick={adicionarSub} disabled={savingSub || !novaSubForm.nome.trim()}>
                  {savingSub ? '...' : <Plus size={13}/>}
                </button>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <select value={novaSubForm.responsavel_id}
                  onChange={e=>setNovaSubForm(f=>({...f,responsavel_id:e.target.value}))}
                  style={{ flex:1, fontSize:12, padding:'5px 9px' }}>
                  <option value="">Responsável (opcional)</option>
                  {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <input type="date" value={novaSubForm.data_inicio}
                  onChange={e=>setNovaSubForm(f=>({...f,data_inicio:e.target.value}))}
                  style={{ width:130, fontSize:12, padding:'5px 9px' }} title="Data início" />
                <input type="date" value={novaSubForm.data_fim}
                  onChange={e=>setNovaSubForm(f=>({...f,data_fim:e.target.value}))}
                  style={{ width:130, fontSize:12, padding:'5px 9px' }} title="Data fim" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Painel de edição */}
      {showEdit && isConsultor && (
        <div style={{ padding:'12px 16px', background:'var(--brand-light)', borderTop:'1px solid var(--brand)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--brand)' }}>Editar tarefa</span>
            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 5px' }} onClick={() => setShowEdit(false)}>
              <X size={13} />
            </button>
          </div>
          <div className="form-row" style={{ marginBottom:8 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Nome *</label>
              <input value={formEdit.nome} onChange={e=>setFormEdit(f=>({...f,nome:e.target.value}))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Responsável</label>
              <select value={formEdit.responsavel_id} onChange={e=>setFormEdit(f=>({...f,responsavel_id:e.target.value}))}>
                <option value="">Sem responsável</option>
                {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row" style={{ marginBottom:10 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Prazo</label>
              <input type="date" value={formEdit.data_prazo} onChange={e=>setFormEdit(f=>({...f,data_prazo:e.target.value}))} />
            </div>
            <div className="form-group" style={{ marginBottom:0, justifyContent:'flex-end' }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, marginTop:20, cursor:'pointer' }}>
                <input type="checkbox" style={{ width:'auto' }} checked={formEdit.requer_validacao}
                  onChange={e=>setFormEdit(f=>({...f,requer_validacao:e.target.checked}))} />
                Requer validação do consultor
              </label>
            </div>
          </div>
          {/* Responsáveis externos */}
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em' }}>Responsáveis</span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:11, gap:4 }} onClick={() => setShowFormResp(v=>!v)}>
                <UserPlus size={12}/> Adicionar
              </button>
            </div>
            {responsaveis.map(r => (
              <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px', background:'var(--bg)', borderRadius:6, marginBottom:4, border:'1px solid var(--border)' }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontWeight:600, fontSize:12 }}>{r.nome}</span>
                  {r.funcao && <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:6 }}>{r.funcao}</span>}
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>
                    {r.email && <span style={{ marginRight:8 }}>{r.email}</span>}
                    {r.telefone && <span>{r.telefone}</span>}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ padding:'2px 4px', color:'var(--red)' }} onClick={() => removerResponsavel(r.id)}>
                  <Trash2 size={11}/>
                </button>
              </div>
            ))}
            {responsaveis.length === 0 && !showFormResp && (
              <div style={{ fontSize:11, color:'var(--text-3)' }}>Nenhum responsável cadastrado.</div>
            )}
            {showFormResp && (
              <div style={{ background:'var(--bg)', border:'1px dashed var(--brand)', borderRadius:6, padding:'10px 12px', marginTop:4 }}>
                <div className="form-row" style={{ marginBottom:6 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>Nome *</label>
                    <input value={formResp.nome} onChange={e=>setFormResp(f=>({...f,nome:e.target.value}))} placeholder="Nome completo" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>Função</label>
                    <input value={formResp.funcao} onChange={e=>setFormResp(f=>({...f,funcao:e.target.value}))} placeholder="Ex: Gerente, Analista..." />
                  </div>
                </div>
                <div className="form-row" style={{ marginBottom:8 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>E-mail</label>
                    <input type="email" value={formResp.email} onChange={e=>setFormResp(f=>({...f,email:e.target.value}))} placeholder="email@exemplo.com" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label>Telefone</label>
                    <input value={formResp.telefone} onChange={e=>setFormResp(f=>({...f,telefone:e.target.value}))} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className="btn btn-primary btn-sm" onClick={adicionarResponsavel} disabled={savingResp || !formResp.nome.trim()}>
                    {savingResp ? '...' : 'Salvar'}
                  </button>
                  <button className="btn btn-sm" onClick={() => { setShowFormResp(false); setFormResp({ nome:'', funcao:'', email:'', telefone:'' }) }}>Cancelar</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSalvarEdicao} disabled={savingEdit || !formEdit.nome}>
              {savingEdit ? 'Salvando...' : 'Salvar alterações'}
            </button>
            <button className="btn btn-sm" onClick={() => setShowEdit(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Painel de comentários */}
      {showComent && (
        <div style={{ padding:'8px 12px 12px 36px', background:'var(--bg)' }}>
          {comentarios.length === 0 && <div className="text-sm text-muted">Nenhum comentário ainda.</div>}
          {comentarios.map(c => (
            <div key={c.id} style={{ marginBottom:8 }}>
              <span style={{ fontWeight:600, fontSize:12 }}>{c.autor.nome}</span>
              <span className="text-sm text-muted" style={{ marginLeft:8 }}>{new Date(c.criado_em).toLocaleString('pt-BR')}</span>
              <div className="text-sm" style={{ marginTop:2 }}>{c.texto}</div>
            </div>
          ))}
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <input value={novoComent} onChange={e=>setNovoComent(e.target.value)}
              placeholder="Adicionar comentário..." style={{ flex:1, fontSize:12, padding:'6px 9px' }}
              onKeyDown={e=>e.key==='Enter'&&enviarComentario()} />
            <button className="btn btn-primary btn-sm" onClick={enviarComentario} disabled={loadingComent}>
              Enviar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function FaseCard({ fase, usuarios, perfil, onRefresh }) {
  const [open, setOpen] = useState(false)
  const [painel,        setPainel]        = useState(null) // 'editar' | 'comentarios' | 'parametros' | null
  const [showAddTarefa, setShowAddTarefa] = useState(false)
  const [formTarefa,    setFormTarefa]    = useState({ nome:'', responsavel_id:'', requer_validacao:false, data_prazo:'' })
  const [saving,        setSaving]        = useState(false)
  const [showFormRespNova, setShowFormRespNova] = useState(false)
  const [formRespNova,  setFormRespNova]  = useState({ nome:'', funcao:'', email:'', telefone:'' })

  // Edição de fase
  const [formFase, setFormFase] = useState({
    nome: fase.nome,
    descricao: fase.descricao || '',
    data_inicio: fase.data_inicio ? new Date(fase.data_inicio).toISOString().slice(0,10) : '',
    data_fim_prev: fase.data_fim_prev ? new Date(fase.data_fim_prev).toISOString().slice(0,10) : '',
  })
  const [savingFase, setSavingFase] = useState(false)

  // Parâmetros de dependência
  const [formParam, setFormParam] = useState({
    bloqueado_por_anterior: fase.bloqueado_por_anterior ?? true,
    perc_desbloqueio: fase.perc_desbloqueio ?? 80,
  })
  const [savingParam, setSavingParam] = useState(false)

  // Comentários de fase
  const [comentarios,   setComentarios]  = useState(fase.comentarios_fase || [])
  const [novoComent,    setNovoComent]   = useState('')
  const [loadingComent, setLoadingComent]= useState(false)

  const isConsultor = ['admin','consultor','ger_projeto'].includes(perfil)
  const isAdmin     = perfil === 'admin'
  const bloqueada   = fase.status === 'bloqueada'

  const togglePainel = (p) => {
    setPainel(v => v === p ? null : p)
    if (p === 'comentarios' && painel !== 'comentarios') {
      fasesAPI.comentarios(fase.id).then(r => setComentarios(r.data)).catch(() => {})
    }
  }

  const handleSalvarEdicao = async () => {
    setSavingFase(true)
    try {
      await fasesAPI.atualizar(fase.id, {
        nome: formFase.nome,
        descricao: formFase.descricao || null,
        data_inicio: formFase.data_inicio || null,
        data_fim_prev: formFase.data_fim_prev || null,
      })
      toast.success('Fase atualizada!')
      setPainel(null)
      onRefresh()
    } catch { toast.error('Erro ao atualizar fase') }
    finally { setSavingFase(false) }
  }

  const handleSalvarParam = async () => {
    setSavingParam(true)
    try {
      await fasesAPI.atualizar(fase.id, {
        bloqueado_por_anterior: formParam.bloqueado_por_anterior,
        perc_desbloqueio: parseFloat(formParam.perc_desbloqueio),
      })
      toast.success('Parâmetros salvos!')
      setPainel(null)
      onRefresh()
    } catch { toast.error('Erro ao salvar parâmetros') }
    finally { setSavingParam(false) }
  }

  const handleExcluirFase = async () => {
    if (!confirm(`Excluir a fase "${fase.nome}" e todas as suas tarefas?`)) return
    try {
      await fasesAPI.deletar(fase.id)
      toast.success('Fase excluída!')
      onRefresh()
    } catch { toast.error('Erro ao excluir fase') }
  }

  const enviarComentario = async () => {
    if (!novoComent.trim()) return
    setLoadingComent(true)
    try {
      await fasesAPI.comentar(fase.id, novoComent.trim())
      const { data } = await fasesAPI.comentarios(fase.id)
      setComentarios(data)
      setNovoComent('')
    } catch { toast.error('Erro ao comentar') }
    finally { setLoadingComent(false) }
  }

  const handleAddTarefa = async e => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: nova } = await tarefasAPI.criar({
        fase_id: fase.id,
        nome: formTarefa.nome,
        responsavel_id: formTarefa.responsavel_id ? parseInt(formTarefa.responsavel_id) : null,
        requer_validacao: formTarefa.requer_validacao,
        data_prazo: formTarefa.data_prazo || null,
        ordem: (fase.tarefas?.length || 0) + 1
      })
      if (formRespNova.nome.trim()) {
        await tarefasAPI.adicionarResponsavel(nova.id, {
          nome: formRespNova.nome.trim(),
          funcao: formRespNova.funcao.trim() || null,
          email: formRespNova.email.trim() || null,
          telefone: formRespNova.telefone.trim() || null,
        })
      }
      toast.success('Tarefa adicionada!')
      setShowAddTarefa(false)
      setFormTarefa({ nome:'', responsavel_id:'', requer_validacao:false, data_prazo:'' })
      setFormRespNova({ nome:'', funcao:'', email:'', telefone:'' })
      setShowFormRespNova(false)
      onRefresh()
    } catch { toast.error('Erro ao adicionar tarefa') }
    finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ marginBottom:10, opacity: bloqueada ? .75 : 1 }}>
      {/* Cabeçalho da fase */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, cursor: 'pointer', userSelect:'none' }}
          onClick={() => setOpen(v=>!v)}>
          {bloqueada && !isConsultor
            ? <Lock size={14} color="var(--text-3)" />
            : open ? <ChevronDown size={14}/> : <ChevronRight size={14}/>
          }
          <div style={{ fontWeight:600, fontSize:14, flex:1 }}>
            <span style={{ marginRight:8, color:'var(--text-3)', fontSize:12 }}>Fase {fase.ordem}</span>
            {fase.nome}
            {!fase.bloqueado_por_anterior && (
              <span style={{ marginLeft:8, fontSize:10, fontWeight:600, color:'var(--green)', background:'var(--green-light)', padding:'1px 7px', borderRadius:99 }}>Livre</span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ minWidth:100 }}>
              <Progress value={fase.progresso} color={fase.status === 'concluida' ? 'green' : ''} />
            </div>
            <span className="text-sm text-muted">{fase.progresso}%</span>
            <Badge status={fase.status} />
          </div>
        </div>

        {/* Botões de ação da fase */}
        {isConsultor && (
          <div style={{ display:'flex', gap:2, flexShrink:0 }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm" style={{ padding:'4px 6px' }} title="Editar fase"
              onClick={() => togglePainel('editar')}>
              <Pencil size={12} color={painel === 'editar' ? 'var(--brand)' : undefined} />
            </button>
            <button className="btn btn-ghost btn-sm" style={{ padding:'4px 6px' }} title="Comentários da fase"
              onClick={() => togglePainel('comentarios')}>
              <MessageSquare size={12} color={painel === 'comentarios' ? 'var(--brand)' : undefined} />
              {comentarios.length > 0 && (
                <span style={{ fontSize:10, fontWeight:700, color:'var(--brand)', marginLeft:2 }}>{comentarios.length}</span>
              )}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ padding:'4px 6px' }} title="Parâmetros de dependência"
              onClick={() => togglePainel('parametros')}>
              <SlidersHorizontal size={12} color={painel === 'parametros' ? 'var(--brand)' : undefined} />
            </button>
          </div>
        )}
      </div>

      {/* Painel: Editar fase */}
      {painel === 'editar' && isConsultor && (
        <div style={{ marginTop:12, padding:'12px 16px', background:'var(--brand-light)', borderRadius:6, border:'1px solid var(--brand)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--brand)' }}>Editar fase</span>
            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 5px' }} onClick={() => setPainel(null)}><X size={13}/></button>
          </div>
          <div className="form-row" style={{ marginBottom:8 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Nome *</label>
              <input value={formFase.nome} onChange={e=>setFormFase(f=>({...f,nome:e.target.value}))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Descrição</label>
              <input value={formFase.descricao} onChange={e=>setFormFase(f=>({...f,descricao:e.target.value}))} placeholder="Objetivo desta fase..." />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom:10 }}>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Data início</label>
              <input type="date" value={formFase.data_inicio} onChange={e=>setFormFase(f=>({...f,data_inicio:e.target.value}))} />
            </div>
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>Data fim prevista</label>
              <input type="date" value={formFase.data_fim_prev} onChange={e=>setFormFase(f=>({...f,data_fim_prev:e.target.value}))} />
            </div>
          </div>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSalvarEdicao} disabled={savingFase || !formFase.nome}>
              {savingFase ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn btn-sm" onClick={() => setPainel(null)}>Cancelar</button>
            {isAdmin && (
              <button className="btn btn-sm" style={{ marginLeft:'auto', color:'var(--red)', borderColor:'var(--red)' }}
                onClick={handleExcluirFase}>
                <Trash2 size={12}/> Excluir fase
              </button>
            )}
          </div>
        </div>
      )}

      {/* Painel: Parâmetros de dependência */}
      {painel === 'parametros' && isConsultor && (
        <div style={{ marginTop:12, padding:'12px 16px', background:'var(--bg)', borderRadius:6, border:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text-2)' }}>Parâmetros de dependência</span>
            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 5px' }} onClick={() => setPainel(null)}><X size={13}/></button>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:6 }}>
              Dependência da fase anterior
            </label>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                <input type="radio" name={`dep-${fase.id}`} checked={!formParam.bloqueado_por_anterior}
                  onChange={() => setFormParam(f=>({...f, bloqueado_por_anterior:false}))} />
                <span>
                  <strong>Livre</strong>
                  <span style={{ color:'var(--text-3)', fontSize:11, marginLeft:6 }}>— fase sempre acessível, sem bloqueio automático</span>
                </span>
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                <input type="radio" name={`dep-${fase.id}`} checked={formParam.bloqueado_por_anterior}
                  onChange={() => setFormParam(f=>({...f, bloqueado_por_anterior:true}))} />
                <span>
                  <strong>Bloqueada</strong>
                  <span style={{ color:'var(--text-3)', fontSize:11, marginLeft:6 }}>— só libera após a fase anterior atingir o percentual abaixo</span>
                </span>
              </label>
            </div>
          </div>

          {formParam.bloqueado_por_anterior && (
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'var(--text-2)', display:'block', marginBottom:6 }}>
                % mínima da fase anterior para desbloqueio
              </label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[50, 60, 70, 80, 90, 100].map(p => (
                  <button key={p} onClick={() => setFormParam(f=>({...f, perc_desbloqueio:p}))}
                    className={`btn btn-sm ${formParam.perc_desbloqueio === p ? 'btn-primary' : ''}`}
                    style={{ minWidth:52 }}>
                    {p}%
                  </button>
                ))}
              </div>
              <div style={{ marginTop:6, fontSize:11, color:'var(--text-3)' }}>
                Selecionado: <strong>{formParam.perc_desbloqueio}%</strong>
              </div>
            </div>
          )}

          <div style={{ display:'flex', gap:6 }}>
            <button className="btn btn-primary btn-sm" onClick={handleSalvarParam} disabled={savingParam}>
              {savingParam ? 'Salvando...' : 'Aplicar parâmetros'}
            </button>
            <button className="btn btn-sm" onClick={() => setPainel(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Painel: Comentários da fase */}
      {painel === 'comentarios' && (
        <div style={{ marginTop:12, padding:'12px 16px', background:'var(--bg)', borderRadius:6, border:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text-2)' }}>Comentários da fase</span>
            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 5px' }} onClick={() => setPainel(null)}><X size={13}/></button>
          </div>
          {comentarios.length === 0 && <div className="text-sm text-muted" style={{ marginBottom:10 }}>Nenhum comentário ainda.</div>}
          {comentarios.map(c => (
            <div key={c.id} style={{ marginBottom:10, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontWeight:600, fontSize:12 }}>{c.autor.nome}</span>
              <span className="text-sm text-muted" style={{ marginLeft:8 }}>
                {new Date(c.criado_em).toLocaleString('pt-BR')}
              </span>
              <div style={{ fontSize:13, marginTop:4 }}>{c.texto}</div>
            </div>
          ))}
          <div style={{ display:'flex', gap:6, marginTop:4 }}>
            <input value={novoComent} onChange={e=>setNovoComent(e.target.value)}
              placeholder="Adicionar comentário na fase..." style={{ flex:1, fontSize:12, padding:'6px 9px' }}
              onKeyDown={e=>e.key==='Enter'&&enviarComentario()} />
            <button className="btn btn-primary btn-sm" onClick={enviarComentario} disabled={loadingComent || !novoComent.trim()}>
              Enviar
            </button>
          </div>
        </div>
      )}

      {/* Lista de tarefas */}
      {open && (!bloqueada || isConsultor) && (
        <div style={{ marginTop:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'32px 1fr 100px 80px 100px 185px', gap:10, padding:'0 4px 6px', borderBottom:'0.5px solid var(--border)' }}>
            <div/><div className="section-title" style={{ margin:0 }}>Tarefa</div>
            <div className="section-title" style={{ margin:0 }}>Responsável</div>
            <div className="section-title" style={{ margin:0 }}>Prazo</div>
            <div className="section-title" style={{ margin:0 }}>Progresso</div>
            <div className="section-title" style={{ margin:0 }}>Status</div>
          </div>

          {fase.tarefas?.length === 0 && (
            <div className="text-sm text-muted" style={{ padding:'12px 4px' }}>Nenhuma tarefa nesta fase.</div>
          )}

          {fase.tarefas?.map(t => (
            <TarefaRow key={t.id} tarefa={t} usuarios={usuarios} onUpdate={onRefresh} perfil={perfil} />
          ))}

          {isConsultor && (
            showAddTarefa ? (
              <div style={{ padding:'10px 4px', borderTop:'0.5px solid var(--border)', marginTop:4 }}>
                <form onSubmit={handleAddTarefa}>
                  <div className="form-row" style={{ marginBottom:8 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label>Nome da tarefa *</label>
                      <input value={formTarefa.nome} onChange={e=>setFormTarefa(f=>({...f,nome:e.target.value}))} required placeholder="Nome da tarefa..." />
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label>Responsável</label>
                      <select value={formTarefa.responsavel_id} onChange={e=>setFormTarefa(f=>({...f,responsavel_id:e.target.value}))}>
                        <option value="">Sem responsável</option>
                        {usuarios.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row" style={{ marginBottom:8 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label>Prazo</label>
                      <input type="date" value={formTarefa.data_prazo} onChange={e=>setFormTarefa(f=>({...f,data_prazo:e.target.value}))} />
                    </div>
                    <div className="form-group" style={{ marginBottom:0, justifyContent:'flex-end' }}>
                      <label style={{ display:'flex', alignItems:'center', gap:6, marginTop:20, cursor:'pointer' }}>
                        <input type="checkbox" style={{ width:'auto' }} checked={formTarefa.requer_validacao}
                          onChange={e=>setFormTarefa(f=>({...f,requer_validacao:e.target.checked}))} />
                        Requer validação do consultor
                      </label>
                    </div>
                  </div>
                  {/* Responsável externo */}
                  <div style={{ marginBottom:8 }}>
                    <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize:11, gap:4, borderStyle:'dashed' }}
                      onClick={() => setShowFormRespNova(v=>!v)}>
                      <UserPlus size={12}/> {showFormRespNova ? 'Remover responsável' : '+ Responsável (Nome, Função, E-mail, Telefone)'}
                    </button>
                    {showFormRespNova && (
                      <div style={{ marginTop:8, padding:'10px 12px', background:'var(--brand-light)', border:'1px dashed var(--brand)', borderRadius:6 }}>
                        <div className="form-row" style={{ marginBottom:6 }}>
                          <div className="form-group" style={{ marginBottom:0 }}>
                            <label>Nome *</label>
                            <input value={formRespNova.nome} onChange={e=>setFormRespNova(f=>({...f,nome:e.target.value}))} placeholder="Nome completo" />
                          </div>
                          <div className="form-group" style={{ marginBottom:0 }}>
                            <label>Função</label>
                            <input value={formRespNova.funcao} onChange={e=>setFormRespNova(f=>({...f,funcao:e.target.value}))} placeholder="Ex: Gerente, Analista..." />
                          </div>
                        </div>
                        <div className="form-row">
                          <div className="form-group" style={{ marginBottom:0 }}>
                            <label>E-mail</label>
                            <input type="email" value={formRespNova.email} onChange={e=>setFormRespNova(f=>({...f,email:e.target.value}))} placeholder="email@exemplo.com" />
                          </div>
                          <div className="form-group" style={{ marginBottom:0 }}>
                            <label>Telefone</label>
                            <input value={formRespNova.telefone} onChange={e=>setFormRespNova(f=>({...f,telefone:e.target.value}))} placeholder="(00) 00000-0000" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display:'flex', gap:6 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                      {saving ? 'Salvando...' : 'Salvar tarefa'}
                    </button>
                    <button type="button" className="btn btn-sm" onClick={()=>setShowAddTarefa(false)}>Cancelar</button>
                  </div>
                </form>
              </div>
            ) : (
              <button className="btn btn-ghost btn-sm" style={{ marginTop:8, borderStyle:'dashed', width:'100%', justifyContent:'center' }}
                onClick={()=>setShowAddTarefa(true)}>
                <Plus size={13}/> Adicionar tarefa
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default function ProjetoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const [projeto,  setProjeto]  = useState(null)
  const [usuarios, setUsuarios] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [erro,     setErro]     = useState(false)
  const [showAddFase, setShowAddFase] = useState(false)
  const [formFase, setFormFase] = useState({ nome:'', descricao:'', perc_desbloqueio:80, bloqueado_por_anterior:true, data_inicio:'', data_fim_prev:'' })
  const [savingFase, setSavingFase] = useState(false)

  const isConsultor = ['admin','consultor','ger_projeto'].includes(usuario?.perfil)

  const carregar = async () => {
    setLoading(true)
    setErro(false)
    try {
      const [p, u] = await Promise.all([
        projetosAPI.detalhe(id),
        isConsultor ? usuariosAPI.listar() : Promise.resolve({ data: [] }),
      ])
      setProjeto(p.data)
      setUsuarios(u.data)
    } catch {
      setErro(true)
      toast.error('Erro ao carregar projeto. Verifique a conexão.')
    }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [id])

  const handleAddFase = async e => {
    e.preventDefault()
    setSavingFase(true)
    try {
      const novaOrdem = (projeto.fases?.length || 0) + 1
      await fasesAPI.criar({
        projeto_id: parseInt(id),
        nome: formFase.nome,
        descricao: formFase.descricao || null,
        ordem: novaOrdem,
        perc_desbloqueio: parseFloat(formFase.perc_desbloqueio),
        bloqueado_por_anterior: formFase.bloqueado_por_anterior,
        data_inicio: formFase.data_inicio || null,
        data_fim_prev: formFase.data_fim_prev || null,
      })
      toast.success('Fase adicionada!')
      setShowAddFase(false)
      setFormFase({ nome:'', descricao:'', perc_desbloqueio:80, bloqueado_por_anterior:true, data_inicio:'', data_fim_prev:'' })
      carregar()
    } catch { toast.error('Erro ao adicionar fase') }
    finally { setSavingFase(false) }
  }

  if (loading) return <LoadingPage />

  if (erro || !projeto) return (
    <div className="page">
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', gap:16 }}>
        <div style={{ fontSize:14, color:'var(--text-2)', fontWeight:600 }}>Não foi possível carregar o projeto.</div>
        <div style={{ fontSize:12, color:'var(--text-3)' }}>Verifique a conexão e tente novamente.</div>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <button className="btn btn-primary btn-sm" onClick={carregar}>Tentar novamente</button>
          <button className="btn btn-sm" onClick={() => navigate('/projetos')}>
            <ArrowLeft size={13}/> Voltar aos projetos
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate('/projetos')}>
            <ArrowLeft size={14}/> Voltar
          </button>
          <div>
            <div className="page-title">{projeto.nome}</div>
            <div className="page-sub">{projeto.cliente?.razao_social}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <Badge status={projeto.status} />
          <span className="text-sm text-muted">{projeto.progresso}% concluído</span>
        </div>
      </div>

      {/* Barra de progresso geral */}
      <div className="card" style={{ marginBottom:16, padding:'12px 18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span className="section-title" style={{ margin:0, whiteSpace:'nowrap' }}>Progresso geral</span>
          <div style={{ flex:1 }}><Progress value={projeto.progresso} /></div>
          <span style={{ fontSize:13, fontWeight:600, minWidth:36 }}>{projeto.progresso}%</span>
          <span className="text-sm text-muted">{projeto.fases?.length} fase(s)</span>
          {projeto.data_inicio && (
            <span className="text-sm text-muted">
              {new Date(projeto.data_inicio).toLocaleDateString('pt-BR')} →{' '}
              {projeto.data_fim_prev ? new Date(projeto.data_fim_prev).toLocaleDateString('pt-BR') : '?'}
            </span>
          )}
        </div>
      </div>

      {/* Fases */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <div className="section-title" style={{ margin:0 }}>Fases do projeto</div>
        {isConsultor && (
          <button className="btn btn-sm" onClick={()=>setShowAddFase(v=>!v)}>
            <Plus size={13}/> Adicionar fase
          </button>
        )}
      </div>

      {showAddFase && (
        <div className="card" style={{ marginBottom:10, border:'1px dashed var(--brand)' }}>
          <form onSubmit={handleAddFase}>
            <div className="form-row">
              <div className="form-group">
                <label>Nome da fase *</label>
                <input value={formFase.nome} onChange={e=>setFormFase(f=>({...f,nome:e.target.value}))} required placeholder="Ex: Fase 5 — Treinamentos" />
              </div>
              <div className="form-group">
                <label>Descrição</label>
                <input value={formFase.descricao} onChange={e=>setFormFase(f=>({...f,descricao:e.target.value}))} placeholder="Objetivo desta fase (opcional)" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Data início</label>
                <input type="date" value={formFase.data_inicio} onChange={e=>setFormFase(f=>({...f,data_inicio:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>Data fim prevista</label>
                <input type="date" value={formFase.data_fim_prev} onChange={e=>setFormFase(f=>({...f,data_fim_prev:e.target.value}))} />
              </div>
            </div>
            {/* Parâmetros de dependência */}
            <div style={{ padding:'10px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                Dependência da fase anterior
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom: formFase.bloqueado_por_anterior ? 8 : 0 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="nova-dep" checked={!formFase.bloqueado_por_anterior}
                    onChange={() => setFormFase(f=>({...f, bloqueado_por_anterior:false}))} />
                  <strong>Livre</strong>
                  <span style={{ color:'var(--text-3)', fontSize:11 }}>— sempre acessível</span>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="nova-dep" checked={formFase.bloqueado_por_anterior}
                    onChange={() => setFormFase(f=>({...f, bloqueado_por_anterior:true}))} />
                  <strong>Bloqueada</strong>
                  <span style={{ color:'var(--text-3)', fontSize:11 }}>— aguarda % da fase anterior</span>
                </label>
              </div>
              {formFase.bloqueado_por_anterior && (
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:12, color:'var(--text-2)' }}>Liberar após</span>
                  <select value={formFase.perc_desbloqueio} onChange={e=>setFormFase(f=>({...f,perc_desbloqueio:e.target.value}))}
                    style={{ fontSize:12, padding:'3px 8px' }}>
                    <option value={50}>50%</option>
                    <option value={60}>60%</option>
                    <option value={70}>70%</option>
                    <option value={80}>80%</option>
                    <option value={90}>90%</option>
                    <option value={100}>100%</option>
                  </select>
                  <span style={{ fontSize:12, color:'var(--text-2)' }}>da fase anterior</span>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingFase}>
                {savingFase ? 'Salvando...' : 'Salvar fase'}
              </button>
              <button type="button" className="btn btn-sm" onClick={()=>setShowAddFase(false)}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {projeto.fases?.map(fase => (
        <FaseCard key={fase.id} fase={fase} usuarios={usuarios} perfil={usuario?.perfil} onRefresh={carregar} />
      ))}

      {projeto.fases?.length === 0 && (
        <div className="empty-state">Nenhuma fase cadastrada. Adicione a primeira fase acima.</div>
      )}

    </div>
  )
}
