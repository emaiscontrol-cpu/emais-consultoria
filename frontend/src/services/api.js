import axios from 'axios'

const api = axios.create({ baseURL: '/api', headers: { 'ngrok-skip-browser-warning': '1' } })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login:        (email, senha)             => api.post('/auth/login', { email, senha }),
  me:           ()                         => api.get('/auth/me'),
  alterarSenha: (senha_atual, nova_senha)  => api.put('/auth/senha', { senha_atual, nova_senha }),
}

export const dashboardAPI = {
  resumo:         () => api.get('/dashboard/resumo'),
  projetosResumo: () => api.get('/dashboard/projetos-resumo'),
}

export const clientesAPI = {
  listar: ()        => api.get('/clientes/'),
  detalhe: id       => api.get(`/clientes/${id}`),
  criar:   data     => api.post('/clientes/', data),
  atualizar:(id,d)  => api.put(`/clientes/${id}`, d),
}

export const projetosAPI = {
  listar:   (clienteId) => api.get('/projetos/', { params: clienteId ? { cliente_id: clienteId } : {} }),
  detalhe:  id          => api.get(`/projetos/${id}`),
  criar:    data        => api.post('/projetos/', data),
  atualizar:(id,d)      => api.put(`/projetos/${id}`, d),
  deletar:  id          => api.delete(`/projetos/${id}`),
}

export const fasesAPI = {
  porProjeto:   projetoId    => api.get(`/fases/projeto/${projetoId}`),
  detalhe:      id           => api.get(`/fases/${id}`),
  criar:        data         => api.post('/fases/', data),
  atualizar:    (id,d)       => api.put(`/fases/${id}`, d),
  deletar:      id           => api.delete(`/fases/${id}`),
  comentarios:  id           => api.get(`/fases/${id}/comentarios`),
  comentar:     (id, texto)  => api.post(`/fases/${id}/comentarios`, { texto }),
}

export const tarefasAPI = {
  porFase:              faseId      => api.get(`/tarefas/fase/${faseId}`),
  detalhe:              id          => api.get(`/tarefas/${id}`),
  criar:                data        => api.post('/tarefas/', data),
  atualizar:            (id,d)      => api.put(`/tarefas/${id}`, d),
  deletar:              id          => api.delete(`/tarefas/${id}`),
  comentar:             (id,texto)  => api.post(`/tarefas/${id}/comentarios`, { tarefa_id: id, texto }),
  comentarios:          id          => api.get(`/tarefas/${id}/comentarios`),
  listarResponsaveis:   id          => api.get(`/tarefas/${id}/responsaveis`),
  adicionarResponsavel: (id, data)  => api.post(`/tarefas/${id}/responsaveis`, data),
  removerResponsavel:   (id, respId)=> api.delete(`/tarefas/${id}/responsaveis/${respId}`),
}

export const usuariosAPI = {
  listar:   ()       => api.get('/usuarios/'),
  criar:    data     => api.post('/usuarios/', data),
  atualizar:(id,d)   => api.put(`/usuarios/${id}`, d),
  desativar: id      => api.delete(`/usuarios/${id}`),
}

export const notificacoesAPI = {
  listar:        ()  => api.get('/notificacoes/'),
  relatorioExcel: () => api.get('/notificacoes/excel', { responseType: 'blob' }),
}

export const relatoriosAPI = {
  projetosExcel: () => api.get('/relatorios/projetos/excel', { responseType: 'blob' }),
  graficos:  id  => api.get(`/relatorios/graficos/${id}`),
}

export const historicoAPI = {
  listar: (projetoId) => api.get('/historico/', { params: projetoId ? { projeto_id: projetoId } : {} }),
}

export const subtarefasAPI = {
  listar:    tarefaId    => api.get(`/subtarefas/tarefa/${tarefaId}`),
  criar:     data        => api.post('/subtarefas/', data),
  atualizar: (id, data)  => api.put(`/subtarefas/${id}`, data),
  deletar:   id          => api.delete(`/subtarefas/${id}`),
}

export const controladoriaAPI = {
  resumo:              (mes, ano)  => api.get('/controladoria/resumo', { params: { mes, ano } }),
  categorias:          ()          => api.get('/controladoria/categorias'),
  criarCategoria:      data        => api.post('/controladoria/categorias', data),
  deletarCategoria:    id          => api.delete(`/controladoria/categorias/${id}`),
  lancamentos:         params      => api.get('/controladoria/lancamentos', { params }),
  criarLancamento:     data        => api.post('/controladoria/lancamentos', data),
  atualizarLancamento: (id, data)  => api.put(`/controladoria/lancamentos/${id}`, data),
  deletarLancamento:   id          => api.delete(`/controladoria/lancamentos/${id}`),
  orcamento:           params      => api.get('/controladoria/orcamento', { params }),
  criarOrcamento:      data        => api.post('/controladoria/orcamento', data),
  deletarOrcamento:    id          => api.delete(`/controladoria/orcamento/${id}`),
}

export default api
