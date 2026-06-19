import { useParams, useNavigate } from 'react-router-dom'
import { FolderKanban, TrendingUp, BarChart2, Lock, ArrowLeft, Phone } from 'lucide-react'

const MODULOS = {
  projetos: {
    icon: FolderKanban,
    cor: 'var(--brand)',
    nome: 'Módulo Projetos',
    descricao: 'Gerencie projetos, acompanhe fases, tarefas e atividades em tempo real. Tenha visibilidade completa do andamento de cada entrega e mantenha sua equipe alinhada.',
    funcionalidades: [
      'Painel geral de projetos',
      'Dashboards por Fase, Tarefa e Atividade',
      'Notificações e alertas em tempo real',
      'Histórico de atividades por projeto',
    ],
  },
  inteligencia_mercado: {
    icon: TrendingUp,
    cor: '#7c3aed',
    nome: 'Módulo Inteligência de Mercado',
    descricao: 'Acesse análises de mercado, benchmarks setoriais e indicadores competitivos para embasar decisões estratégicas com dados atualizados.',
    funcionalidades: [
      'Painel de mercado consolidado',
      'Benchmarks setoriais',
      'Indicadores de posicionamento competitivo',
    ],
  },
  analises_gerenciais: {
    icon: BarChart2,
    cor: '#059669',
    nome: 'Módulo Análises Gerenciais',
    descricao: 'Tenha controle total da saúde financeira da sua empresa com DRE gerencial, fluxo de caixa executivo, balancete e controle orçamentário integrados.',
    funcionalidades: [
      'DRE Gerencial',
      'Fluxo de Caixa Executivo',
      'Balancete',
      'Controle Orçamentário',
    ],
  },
}

export default function SaibaMais() {
  const { modulo } = useParams()
  const navigate = useNavigate()
  const info = MODULOS[modulo]

  if (!info) return (
    <div className="page">
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        Módulo não encontrado.
      </div>
    </div>
  )

  const { icon: Icon, cor, nome, descricao, funcionalidades } = info

  return (
    <div className="page">
      <button
        onClick={() => navigate(-1)}
        className="btn btn-ghost btn-sm"
        style={{ marginBottom: 20, display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <ArrowLeft size={14} /> Voltar
      </button>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 20,
            background: cor + '15',
            border: `2px solid ${cor}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <Icon size={36} color={cor} />
            <div style={{
              position: 'absolute', bottom: -8, right: -8,
              width: 26, height: 26, borderRadius: '50%',
              background: '#f3f4f6', border: '2px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Lock size={13} color="#6b7280" />
            </div>
          </div>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          {nome}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          {descricao}
        </p>

        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '.07em',
            textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12,
          }}>
            O que está incluído
          </div>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {funcionalidades.map(f => (
              <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="card" style={{ textAlign: 'center', background: cor + '08', border: `1px solid ${cor}25` }}>
          <Phone size={20} color={cor} style={{ display: 'block', margin: '0 auto 10px' }} />
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Quer contratar este módulo?</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Entre em contato com o responsável da E Mais Consultoria para habilitar o acesso.
          </div>
        </div>
      </div>
    </div>
  )
}
