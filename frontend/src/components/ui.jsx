import { Pencil, Trash2, Plus } from 'lucide-react'

// Tamanhos fixos — únicos permitidos em ícones de ação. Ver DESIGN_SYSTEM.md § "Componentes obrigatórios".
const ICON_SIZE = { sm: 16, md: 20 }

export function IconButton({ icon: Icon, size = 'sm', danger = false, title, className = '', style = {}, ...rest }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon-${size} ${className}`}
      title={title}
      aria-label={title}
      style={{ color: danger ? 'var(--red)' : undefined, ...style }}
      {...rest}
    >
      <Icon size={ICON_SIZE[size]} />
    </button>
  )
}

export function BotaoEditar({ size = 'sm', title = 'Editar', ...rest }) {
  return <IconButton icon={Pencil} size={size} title={title} {...rest} />
}

export function BotaoExcluir({ size = 'sm', title = 'Excluir', ...rest }) {
  return <IconButton icon={Trash2} size={size} title={title} danger {...rest} />
}

export function BotaoNovo({ children = 'Novo', size = 'md', className = '', ...rest }) {
  return (
    <button type="button" className={`btn btn-primary ${size === 'sm' ? 'btn-sm' : ''} ${className}`} {...rest}>
      <Plus size={ICON_SIZE[size]} />
      {children}
    </button>
  )
}

export function Card({ children, className = '', style = {}, ...rest }) {
  return (
    <div className={`card ${className}`} style={style} {...rest}>
      {children}
    </div>
  )
}

const BADGE_VARIANTS = ['sintetica', 'analitica', 'fc', 'dre', 'orc', 'blue', 'green', 'amber', 'red', 'gray', 'purple', 'teal']

export function BadgeTag({ children, variant = 'gray', className = '' }) {
  const cls = BADGE_VARIANTS.includes(variant) ? `badge-${variant}` : 'badge-gray'
  return <span className={`badge ${cls} ${className}`}>{children}</span>
}
