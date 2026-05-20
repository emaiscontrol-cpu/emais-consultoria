import { useState } from 'react'

const SECOES = [
  {
    id: 'acesso', titulo: '1. Acessando o Sistema',
    conteudo: [
      { tipo: 'subtitulo', texto: 'Como entrar' },
      { tipo: 'lista', itens: [
        'Abra o navegador (recomendado: Google Chrome)',
        'Digite o endereço do sistema na barra de navegação',
        'Preencha o campo Email com seu endereço cadastrado',
        'Preencha o campo Senha',
        'Clique em Entrar',
      ]},
      { tipo: 'aviso', texto: 'Se aparecer "Email ou senha inválidos", verifique se o email está completo (ex: nome@emaiscontrol.com.br) e tente novamente.' },
      { tipo: 'subtitulo', texto: 'Como sair' },
      { tipo: 'texto', texto: 'No menu lateral esquerdo, role até o final e clique em Sair.' },
    ],
  },
  {
    id: 'perfis', titulo: '2. Perfis de Usuário',
    conteudo: [
      { tipo: 'texto', texto: 'O sistema possui 4 perfis com permissões diferentes:' },
      { tipo: 'tabela', colunas: ['Perfil', 'O que pode fazer'], linhas: [
        ['Administrador', 'Acesso total: projetos, clientes, usuários, relatórios, histórico'],
        ['Consultor', 'Projetos, clientes, relatórios, histórico — não gerencia usuários'],
        ['Ger. Projeto', 'Igual ao Consultor'],
        ['Cliente', 'Visualiza apenas os projetos da sua empresa'],
      ]},
    ],
  },
  {
    id: 'dashboard', titulo: '3. Dashboard — Tela Principal',
    conteudo: [
      { tipo: 'texto', texto: 'Ao fazer login, você é direcionado ao Dashboard — a visão geral do sistema.' },
      { tipo: 'subtitulo', texto: 'Cartões de métricas (topo da tela)' },
      { tipo: 'lista', itens: [
        'Total de Projetos — quantidade de projetos cadastrados',
        'Em Andamento — projetos ativos no momento',
        'Tarefas Pendentes — tarefas que aguardam execução',
        'Atrasados — projetos ou tarefas fora do prazo',
      ]},
      { tipo: 'subtitulo', texto: 'Lista de projetos' },
      { tipo: 'texto', texto: 'Abaixo dos cartões, cada projeto aparece como um card com nome, cliente, barra de progresso, status e datas. Clique sobre o card para acessar o projeto.' },
    ],
  },
  {
    id: 'projetos', titulo: '4. Projetos',
    conteudo: [
      { tipo: 'subtitulo', texto: 'Visualizar projetos' },
      { tipo: 'texto', texto: 'Clique em Projetos no menu lateral. A lista exibe todos os projetos com nome, cliente, status e progresso.' },
      { tipo: 'subtitulo', texto: 'Criar um novo projeto' },
      { tipo: 'lista', itens: [
        'Clique em + Novo Projeto (canto superior direito)',
        'Nome do projeto (obrigatório)',
        'Cliente (obrigatório) — selecione da lista de clientes cadastrados',
        'Status: Planejamento / Em andamento / Pausado / Concluído',
        'Data de início e Previsão de término',
        'Progresso (%) — percentual manual de conclusão',
        'Descrição — informações adicionais',
        'Clique em Salvar',
      ]},
      { tipo: 'subtitulo', texto: 'Editar um projeto' },
      { tipo: 'texto', texto: 'Abra o projeto e clique no ícone de lápis no cabeçalho. Altere os campos e clique em Salvar.' },
      { tipo: 'subtitulo', texto: 'Excluir um projeto' },
      { tipo: 'aviso', texto: 'A exclusão remove também todas as fases, tarefas e subtarefas do projeto. Esta ação não pode ser desfeita.' },
    ],
  },
  {
    id: 'fases', titulo: '5. Fases',
    conteudo: [
      { tipo: 'texto', texto: 'As fases representam as grandes etapas de um projeto (ex: Levantamento, Desenvolvimento, Testes, Entrega).' },
      { tipo: 'subtitulo', texto: 'Criar uma fase' },
      { tipo: 'lista', itens: [
        'Na tela do projeto, clique em + Nova Fase',
        'Nome da fase (obrigatório)',
        'Descrição — objetivo da fase',
        'Data de início e Previsão de término',
        'Dependência: Livre (inicia quando quiser) ou Bloqueada pela anterior',
        'Se Bloqueada: defina o percentual de desbloqueio (50% a 100%)',
        'Clique em Salvar',
      ]},
      { tipo: 'subtitulo', texto: 'Painel de ações da fase (3 botões no cabeçalho)' },
      { tipo: 'lista', itens: [
        '✏️ Lápis → Editar nome, descrição e datas da fase',
        '💬 Balão → Comentários: ver e adicionar observações sobre a fase',
        '⚙️ Controles → Parâmetros de dependência: configurar bloqueio entre fases',
      ]},
      { tipo: 'subtitulo', texto: 'Status das fases' },
      { tipo: 'tabela', colunas: ['Badge', 'Significado'], linhas: [
        ['Planejamento', 'Fase ainda não iniciada'],
        ['Em andamento', 'Fase em execução'],
        ['Atrasada', 'Prazo ultrapassado'],
        ['Concluída', 'Todas as tarefas concluídas'],
        ['Bloqueada', 'Aguardando fase anterior'],
        ['Livre', 'Fase independente, sem bloqueio'],
      ]},
    ],
  },
  {
    id: 'tarefas', titulo: '6. Tarefas',
    conteudo: [
      { tipo: 'texto', texto: 'As tarefas são as atividades específicas dentro de cada fase.' },
      { tipo: 'subtitulo', texto: 'Criar uma tarefa' },
      { tipo: 'lista', itens: [
        'Dentro de uma fase, clique em + Nova Tarefa',
        'Nome da tarefa (obrigatório)',
        'Responsável — usuário responsável pela execução',
        'Data prazo — prazo para conclusão',
        'Requer validação — marque se precisa de aprovação',
        'Clique em Adicionar',
      ]},
      { tipo: 'subtitulo', texto: 'Status das tarefas' },
      { tipo: 'tabela', colunas: ['Status', 'Descrição'], linhas: [
        ['Pendente', 'Criada, aguardando início'],
        ['Em andamento', 'Em execução'],
        ['Aguard. validação', 'Concluída, aguarda aprovação'],
        ['Concluída', 'Finalizada e aprovada'],
        ['Bloqueada', 'Fase bloqueada impede avanço'],
        ['Atrasada', 'Prazo vencido sem conclusão'],
      ]},
      { tipo: 'subtitulo', texto: 'Outras ações nas tarefas' },
      { tipo: 'lista', itens: [
        'Editar: clique no lápis para alterar nome, responsável, prazo e % concluído',
        'Comentários: registre decisões e atualizações com data e autoria',
        'Responsáveis extras: adicione pessoas externas com nome, função, email e telefone',
        'Excluir: clique na lixeira e confirme',
      ]},
    ],
  },
  {
    id: 'subtarefas', titulo: '7. Subtarefas',
    conteudo: [
      { tipo: 'texto', texto: 'Subtarefas são itens de checklist dentro de uma tarefa — pequenas ações necessárias para concluí-la.' },
      { tipo: 'subtitulo', texto: 'Criar uma subtarefa' },
      { tipo: 'lista', itens: [
        'Expanda a tarefa e clique na aba Subtarefas (ícone de lista)',
        'Digite o nome da subtarefa',
        'Defina uma data prazo (opcional)',
        'Clique em Adicionar',
      ]},
      { tipo: 'subtitulo', texto: 'Avançar o status' },
      { tipo: 'texto', texto: 'Clique no botão quadrado à esquerda da subtarefa para avançar: A fazer (cinza) → Pendente (amarelo) → Concluído (verde) → volta para A fazer.' },
    ],
  },
  {
    id: 'clientes', titulo: '8. Clientes',
    conteudo: [
      { tipo: 'texto', texto: 'O cadastro de clientes permite vincular projetos às empresas atendidas.' },
      { tipo: 'subtitulo', texto: 'Cadastrar um novo cliente' },
      { tipo: 'lista', itens: [
        'Clique em Clientes no menu lateral',
        'Clique em + Novo Cliente',
        'Razão Social (obrigatório)',
        'CNPJ, Email, Telefone e Contato (nome do responsável)',
        'Clique em Salvar',
      ]},
      { tipo: 'texto', texto: 'Para editar, clique no ícone de lápis ao lado do cliente na lista.' },
    ],
  },
  {
    id: 'usuarios', titulo: '9. Usuários',
    conteudo: [
      { tipo: 'aviso', texto: 'Disponível apenas para Administradores.' },
      { tipo: 'subtitulo', texto: 'Criar um novo usuário' },
      { tipo: 'lista', itens: [
        'Clique em Usuários no menu lateral (seção Administração)',
        'Clique em + Novo Usuário',
        'Nome completo (obrigatório)',
        'Email (obrigatório) — usado para login',
        'Senha (mínimo 6 caracteres)',
        'Perfil: Administrador / Consultor / Ger. Projeto / Cliente',
        'Clique em Salvar — o usuário já pode fazer login imediatamente',
      ]},
      { tipo: 'subtitulo', texto: 'Desativar um usuário' },
      { tipo: 'texto', texto: 'Clique na lixeira ao lado do usuário e confirme. O histórico de atividades é preservado.' },
    ],
  },
  {
    id: 'notificacoes', titulo: '10. Notificações',
    conteudo: [
      { tipo: 'texto', texto: 'O sistema monitora automaticamente os projetos e gera alertas para situações que precisam de atenção. O número em vermelho no ícone de sino indica alertas não lidos.' },
      { tipo: 'subtitulo', texto: 'Tipos de alertas' },
      { tipo: 'tabela', colunas: ['Alerta', 'Descrição'], linhas: [
        ['Tarefa atrasada', 'Prazo vencido e tarefa não concluída'],
        ['Prazo próximo', 'Tarefa com prazo nos próximos dias'],
        ['Aguardando validação', 'Tarefa concluída aguardando aprovação'],
        ['Projeto atrasado', 'Data prevista do projeto ultrapassada'],
      ]},
      { tipo: 'texto', texto: 'Clique em Exportar Excel para baixar a lista de alertas em planilha.' },
    ],
  },
  {
    id: 'relatorios', titulo: '11. Relatórios',
    conteudo: [
      { tipo: 'texto', texto: 'Visualizações gráficas do andamento dos projetos. Clique em Relatórios no menu lateral e selecione o projeto desejado.' },
      { tipo: 'subtitulo', texto: 'Gráficos disponíveis' },
      { tipo: 'lista', itens: [
        'Status Geral (rosca): distribuição de tarefas em Feito / Em andamento / Parado',
        'Burndown: linha azul (ideal) vs linha vermelha (real) — linha vermelha acima da azul indica atraso',
        'Gantt: linha do tempo de fases e tarefas com progresso visual',
        'Por fase: gráfico individual de cada fase do projeto',
      ]},
      { tipo: 'subtitulo', texto: 'Exportar Excel' },
      { tipo: 'texto', texto: 'Clique em Exportar Excel para baixar planilha com 3 abas: Projetos, Tarefas e Histórico.' },
    ],
  },
  {
    id: 'historico', titulo: '12. Histórico de Atividades',
    conteudo: [
      { tipo: 'texto', texto: 'Registra todas as ações realizadas no sistema com data, hora, usuário e descrição.' },
      { tipo: 'texto', texto: 'Clique em Histórico no menu lateral. Use o filtro de Projeto para ver atividades de um projeto específico.' },
    ],
  },
  {
    id: 'senha', titulo: '13. Alterar Senha',
    conteudo: [
      { tipo: 'lista', itens: [
        'No rodapé do menu lateral, clique em Alterar senha',
        'Preencha a Senha atual',
        'Digite e confirme a Nova senha (mínimo 6 caracteres)',
        'Clique em Salvar',
      ]},
    ],
  },
  {
    id: 'dicas', titulo: '14. Dicas Gerais',
    conteudo: [
      { tipo: 'lista', itens: [
        'Mantenha os percentuais de conclusão das tarefas atualizados — eles alimentam os gráficos',
        'Use os comentários para registrar decisões importantes — ficam no histórico',
        'Defina sempre datas de prazo nas tarefas — o sistema usa para gerar alertas de atraso',
        'Quando uma tarefa for concluída, marque o status como Concluída para atualizar o progresso da fase',
        'O badge vermelho no sino indica notificações pendentes que precisam de atenção',
      ]},
    ],
  },
]

export default function Manual() {
  const [secaoAtiva, setSecaoAtiva] = useState(null)

  return (
    <div className="page" style={{ display:'flex', gap:0, padding:0, height:'100%' }}>

      {/* Índice lateral */}
      <div style={{
        width:260, flexShrink:0, borderRight:'0.5px solid var(--border)',
        overflowY:'auto', padding:'16px 0', background:'var(--surface)',
      }}>
        <div style={{ padding:'0 16px 12px', fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.06em' }}>
          Índice
        </div>
        {SECOES.map(s => (
          <a key={s.id} href={`#${s.id}`}
            onClick={() => setSecaoAtiva(s.id)}
            style={{
              display:'block', padding:'7px 16px', fontSize:12,
              color: secaoAtiva === s.id ? 'var(--brand)' : 'var(--text-2)',
              background: secaoAtiva === s.id ? 'var(--brand-light)' : 'transparent',
              borderLeft: secaoAtiva === s.id ? '3px solid var(--brand)' : '3px solid transparent',
              textDecoration:'none', transition:'all .12s', lineHeight:1.4,
            }}>
            {s.titulo}
          </a>
        ))}
      </div>

      {/* Conteúdo */}
      <div style={{ flex:1, overflowY:'auto', padding:'28px 36px' }}>
        <div style={{ maxWidth:780 }}>
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:20, fontWeight:800, color:'var(--brand-dark)', marginBottom:4 }}>
              Manual Operacional
            </div>
            <div style={{ fontSize:13, color:'var(--text-3)' }}>
              E Mais Consultoria — Sistema de Gestão de Projetos &nbsp;·&nbsp; Versão 1.0
            </div>
          </div>

          {SECOES.map(s => (
            <div key={s.id} id={s.id} style={{ marginBottom:36, scrollMarginTop:20 }}>
              <div style={{
                fontSize:16, fontWeight:700, color:'var(--brand-dark)',
                borderBottom:'2px solid var(--brand-light)', paddingBottom:8, marginBottom:16,
              }}>
                {s.titulo}
              </div>

              {s.conteudo.map((bloco, i) => {
                if (bloco.tipo === 'texto') return (
                  <p key={i} style={{ fontSize:13, color:'var(--text)', lineHeight:1.7, marginBottom:12 }}>
                    {bloco.texto}
                  </p>
                )
                if (bloco.tipo === 'subtitulo') return (
                  <div key={i} style={{ fontSize:13, fontWeight:700, color:'var(--text)', marginTop:16, marginBottom:8 }}>
                    {bloco.texto}
                  </div>
                )
                if (bloco.tipo === 'aviso') return (
                  <div key={i} style={{
                    background:'var(--amber-light)', border:'0.5px solid var(--amber)',
                    borderRadius:8, padding:'10px 14px', fontSize:12, color:'var(--amber)',
                    marginBottom:12, lineHeight:1.6,
                  }}>
                    ⚠️ {bloco.texto}
                  </div>
                )
                if (bloco.tipo === 'lista') return (
                  <ul key={i} style={{ paddingLeft:20, marginBottom:12 }}>
                    {bloco.itens.map((item, j) => (
                      <li key={j} style={{ fontSize:13, color:'var(--text)', lineHeight:1.8, marginBottom:2 }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                )
                if (bloco.tipo === 'tabela') return (
                  <div key={i} className="table-wrap" style={{ marginBottom:12 }}>
                    <table>
                      <thead>
                        <tr>{bloco.colunas.map((c,j) => <th key={j}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {bloco.linhas.map((linha, j) => (
                          <tr key={j}>
                            {linha.map((cel, k) => (
                              <td key={k} style={{ fontSize:13 }}>
                                {k === 0 ? <strong>{cel}</strong> : cel}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
                return null
              })}
            </div>
          ))}

          <div style={{ borderTop:'0.5px solid var(--border)', paddingTop:16, fontSize:11, color:'var(--text-3)', textAlign:'center' }}>
            Manual Operacional v1.0 — E Mais Consultoria · Maio/2026
          </div>
        </div>
      </div>
    </div>
  )
}
