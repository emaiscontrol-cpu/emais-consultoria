import { X, Loader } from 'lucide-react'

export function Badge({ status }) {
  const map = {
    planejamento: ['badge-gray',   'Planejamento'],
    em_andamento: ['badge-blue',   'Em andamento'],
    concluido:    ['badge-green',  'Concluído'],
    atrasado:     ['badge-red',    'Atrasado'],
    pausado:      ['badge-amber',  'Pausado'],
    bloqueada:    ['badge-gray',   'Bloqueada'],
    pendente:     ['badge-gray',   'Pendente'],
    concluida:    ['badge-green',  'Concluída'],
    aguard_validacao: ['badge-purple','Aguard. validação'],
    aguard_valid: ['badge-purple', 'Aguard. validação'],
  }
  const [cls, label] = map[status] || ['badge-gray', status]
  return <span className={`badge ${cls}`}>{label}</span>
}

export function Progress({ value, color }) {
  const cls = value >= 100 ? 'green' : value === 0 ? '' : color || ''
  return (
    <div className="progress-wrap" style={{ minWidth: 80 }}>
      <div className={`progress-fill ${cls}`} style={{ width: `${Math.min(value,100)}%` }} />
    </div>
  )
}

export function Avatar({ nome, color = 'blue' }) {
  const initials = nome?.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'
  return <div className={`avatar avatar-${color}`}>{initials}</div>
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16}/></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function Spinner() {
  return <Loader size={18} className="spin" style={{ color: 'var(--brand)' }} />
}

export function LoadingPage() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', padding:60 }}>
      <Spinner />
    </div>
  )
}
