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
    const isLoginRequest = err.config?.url?.includes('/auth/login')
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authAPI = {
  login:          (payload)                 => api.post('/auth/login', payload),
  me:             ()                        => api.get('/auth/me'),
  alterarSenha:   (senha_atual, nova_senha) => api.put('/auth/senha', { senha_atual, nova_senha }),
  atualizarFoto:  (foto)                    => api.put('/auth/foto', { foto }),
  esqueciSenha:   (email)                   => api.post('/auth/esqueci-senha', { email }),
  refresh:        ()                        => api.post('/auth/refresh'),
  empresasPublico:()                        => api.get('/auth/empresas-publico'),
}

export const dashboardAPI = {
  resumo:         () => api.get('/dashboard/resumo'),
  projetosResumo: () => api.get('/dashboard/projetos-resumo'),
  cliente:        id => api.get(`/dashboard/cliente/${id}`),
  executivo:      () => api.get('/dashboard/executivo'),
}

export const clientesAPI = {
  listar:  (params) => api.get('/clientes/', { params }),
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
  porProjeto:   projetoId           => api.get(`/fases/projeto/${projetoId}`),
  detalhe:      id                  => api.get(`/fases/${id}`),
  criar:        data                => api.post('/fases/', data),
  atualizar:    (id,d)              => api.put(`/fases/${id}`, d),
  deletar:      id                  => api.delete(`/fases/${id}`),
  comentarios:  id                  => api.get(`/fases/${id}/comentarios`),
  comentar:     (id, texto)         => api.post(`/fases/${id}/comentarios`, { texto }),
  reordenar:    (id, direcao)       => api.patch(`/fases/${id}/ordem`, { direcao }),
}

export const tarefasAPI = {
  porFase:              faseId           => api.get(`/tarefas/fase/${faseId}`),
  detalhe:              id               => api.get(`/tarefas/${id}`),
  criar:                data             => api.post('/tarefas/', data),
  atualizar:            (id,d)           => api.put(`/tarefas/${id}`, d),
  deletar:              id               => api.delete(`/tarefas/${id}`),
  comentar:             (id,texto)       => api.post(`/tarefas/${id}/comentarios`, { tarefa_id: id, texto }),
  comentarios:          id               => api.get(`/tarefas/${id}/comentarios`),
  listarResponsaveis:   id               => api.get(`/tarefas/${id}/responsaveis`),
  adicionarResponsavel: (id, data)       => api.post(`/tarefas/${id}/responsaveis`, data),
  removerResponsavel:   (id, respId)     => api.delete(`/tarefas/${id}/responsaveis/${respId}`),
  reordenar:            (id, direcao)    => api.patch(`/tarefas/${id}/ordem`, { direcao }),
}

export const usuariosAPI = {
  listar:              ()       => api.get('/usuarios/'),
  criar:               data     => api.post('/usuarios/', data),
  atualizar:           (id, d)  => api.put(`/usuarios/${id}`, d),
  excluir:             id       => api.delete(`/usuarios/${id}`),
  listarResetRequests: ()       => api.get('/usuarios/reset-requests'),
  dispensarReset:      id       => api.delete(`/usuarios/reset-requests/${id}`),
}

export const notificacoesAPI = {
  listar:        ()  => api.get('/notificacoes/'),
  relatorioExcel: () => api.get('/notificacoes/excel', { responseType: 'blob' }),
}

export const relatoriosAPI = {
  projetosExcel: () => api.get('/relatorios/projetos/excel', { responseType: 'blob' }),
  graficos:  id  => api.get(`/relatorios/graficos/${id}`),
}

export const pdfAPI = {
  demonstrativo: payload => api.post('/pdf/demonstrativo', payload, { responseType: 'blob' }),
}

export const historicoAPI = {
  listar:    (projetoId) => api.get('/historico/', { params: projetoId ? { projeto_id: projetoId } : {} }),
  porTarefa: (tarefaId)  => api.get(`/historico/tarefa/${tarefaId}`),
}

export const buscaAPI = {
  buscar: (q) => api.get('/busca/', { params: { q } }),
}

export const chatAPI = {
  listar:   (projetoId)        => api.get(`/chat/projeto/${projetoId}`),
  enviar:   (projetoId, texto) => api.post(`/chat/projeto/${projetoId}`, { texto }),
  naoLidas: (projetoId, desde) => api.get(`/chat/projeto/${projetoId}/nao-lidas`, { params: { desde } }),
}

export const subtarefasAPI = {
  listar:    tarefaId    => api.get(`/subtarefas/tarefa/${tarefaId}`),
  criar:     data        => api.post('/subtarefas/', data),
  atualizar: (id, data)  => api.put(`/subtarefas/${id}`, data),
  deletar:   id          => api.delete(`/subtarefas/${id}`),
}

export const fluxoCaixaAPI = {
  agrupadores:      ()          => api.get('/fluxo/agrupadores'),
  criarAgrupador:   data        => api.post('/fluxo/agrupadores', data),
  deletarAgrupador: id          => api.delete(`/fluxo/agrupadores/${id}`),
}

export const demonstrativoFcAPI = {
  carregar: (params) => api.get('/demonstrativos/fluxo-caixa', { params }),
  detalhe:  (params) => api.get('/demonstrativos/fluxo-caixa/detalhe', { params }),
  detalheComparativo: (params) => api.get('/demonstrativos/fluxo-caixa/detalhe-comparativo', { params }),
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


export const balanceteAPI = {
  obter:          (cid, ano, mes)             => api.get(`/balancete/cliente/${cid}/ano/${ano}/mes/${mes}`),
  upsert:         (cid, ano, mes, conta, valor) =>
    api.put(`/balancete/cliente/${cid}/ano/${ano}/mes/${mes}/conta/${conta}`, { valor }),
  importar:       (cid, ano, mes, arquivo)    => {
    const fd = new FormData()
    fd.append('arquivo', arquivo)
    return api.post(`/balancete/importar?cliente_id=${cid}&ano=${ano}&mes=${mes}`, fd)
  },
  periodos:       cid                         => api.get(`/balancete/cliente/${cid}/periodos`),
  deletarPeriodo: (cid, ano, mes)             => api.delete(`/balancete/cliente/${cid}/ano/${ano}/mes/${mes}`),
}

export const orcamentoAPI = {
  clientesComPlano: ()                        => api.get('/orcamento/clientes'),
  obter:            (clienteId, ano)          => api.get(`/orcamento/cliente/${clienteId}/ano/${ano}`),
  salvar:           (clienteId, ano, itemId, mes, valor) =>
    api.put(`/orcamento/cliente/${clienteId}/ano/${ano}/item/${itemId}/mes/${mes}`, { valor }),
  unidades:         (clienteId, ano)          => api.get(`/orcamento/cliente/${clienteId}/ano/${ano}/unidades`),
  obterDre:         (clienteId, ano, unidade) => api.get(`/orcamento/cliente/${clienteId}/ano/${ano}/dre`, { params: { unidade } }),
  salvarDre:        (clienteId, ano, itemId, mes, valor, unidade) =>
    api.put(`/orcamento/dre/cliente/${clienteId}/ano/${ano}/item/${itemId}/mes/${mes}`, { valor, unidade }),
  obterComparativo: (clienteId, ano, versao = 'Original') => 
    api.get(`/orcamento/cliente/${clienteId}/comparativo`, { params: { ano, versao } }),
  importar: (clienteId, ano, file, versao = 'Original') => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post(`/orcamento/cliente/${clienteId}/ano/${ano}/importar?versao=${versao}`, fd)
  },
  obterEditavel: (clienteId, ano, versao = 'Original', base = 'fluxo_caixa') => 
    api.get(`/orcamento/cliente/${clienteId}/ano/${ano}/editavel`, { params: { versao, base } }),
  salvarCelula: (clienteId, ano, mes, slug, valor, versao = 'Original') =>
    api.put(`/orcamento/cliente/${clienteId}/ano/${ano}/mes/${mes}/conta/${slug}`, { valor, versao }),
  sugerirIa: (clienteId, ano, agrupamento_slug, rotulo, cenario_usuario, valores_referencia) =>
    api.post(`/orcamento/cliente/${clienteId}/ano/${ano}/sugerir-ia`, { agrupamento_slug, rotulo, cenario_usuario, valores_referencia }),
}

export const anotacoesAPI = {
  listar:    clienteId         => api.get(`/anotacoes/cliente/${clienteId}`),
  criar:     (clienteId, data) => api.post(`/anotacoes/cliente/${clienteId}`, data),
  atualizar: (id, data)        => api.put(`/anotacoes/${id}`, data),
  deletar:   id                => api.delete(`/anotacoes/${id}`),
}

export const arquivosAPI = {
  listar:  (clienteId) => api.get(`/arquivos/cliente/${clienteId}`),
  upload:  (clienteId, arquivo, categoria = 'Outros') => {
    const fd = new FormData()
    fd.append('arquivo', arquivo)
    fd.append('categoria', categoria)
    return api.post(`/arquivos/cliente/${clienteId}`, fd)
  },
  download: (id) => api.get(`/arquivos/${id}/download`),
  deletar:  (id) => api.delete(`/arquivos/${id}`),
}

export const adminAPI = {
  fazerBackup:     ()        => api.post('/admin/backup'),
  listarBackups:   ()        => api.get('/admin/backup'),
  configurarAuto:  (config)  => api.put('/admin/backup/auto', config),
  restaurarBackup: (arquivo) => {
    const fd = new FormData(); fd.append('arquivo', arquivo)
    return api.post('/admin/backup/restaurar', fd)
  },
}

export const bandeiraAPI = {
  listar:   clienteId       => api.get(`/bandeiras/cliente/${clienteId}`),
  criar:    (clienteId, d)  => api.post(`/bandeiras/cliente/${clienteId}`, d),
  atualizar:(id, d)         => api.put(`/bandeiras/${id}`, d),
  deletar:  id              => api.delete(`/bandeiras/${id}`),
}

export const modelosAPI = {
  listar:              ()                        => api.get('/modelos/'),
  criar:               data                      => api.post('/modelos/', data),
  detalhe:             id                        => api.get(`/modelos/${id}`),
  atualizar:           (id, data)                => api.put(`/modelos/${id}`, data),
  deletar:             id                        => api.delete(`/modelos/${id}`),
  criarFase:           (mid, data)               => api.post(`/modelos/${mid}/fases`, data),
  atualizarFase:       (mid, fid, data)          => api.put(`/modelos/${mid}/fases/${fid}`, data),
  deletarFase:         (mid, fid)                => api.delete(`/modelos/${mid}/fases/${fid}`),
  criarTarefa:         (mid, fid, data)          => api.post(`/modelos/${mid}/fases/${fid}/tarefas`, data),
  atualizarTarefa:     (mid, fid, tid, data)     => api.put(`/modelos/${mid}/fases/${fid}/tarefas/${tid}`, data),
  deletarTarefa:       (mid, fid, tid)           => api.delete(`/modelos/${mid}/fases/${fid}/tarefas/${tid}`),
  criarSubtarefa:      (mid, fid, tid, data)     => api.post(`/modelos/${mid}/fases/${fid}/tarefas/${tid}/subtarefas`, data),
  atualizarSubtarefa:  (mid, fid, tid, sid, d)   => api.put(`/modelos/${mid}/fases/${fid}/tarefas/${tid}/subtarefas/${sid}`, d),
  deletarSubtarefa:    (mid, fid, tid, sid)      => api.delete(`/modelos/${mid}/fases/${fid}/tarefas/${tid}/subtarefas/${sid}`),
  aplicar:             (modeloId, projetoId)     => api.post(`/modelos/aplicar/${modeloId}/projeto/${projetoId}`),
}

export const iaAPI = {
  analisar: (titulo, contexto, pergunta = '') =>
    api.post('/ia/analisar', { titulo, contexto, pergunta }),
}

export const geminiAPI = {
  analisar: (titulo, contexto, pergunta = '') =>
    api.post('/gemini/analisar', { titulo, contexto, pergunta }),
}

export const openrouterAPI = {
  analisar: (titulo, contexto, pergunta = '', modelo = 'openai/gpt-4o') =>
    api.post('/openrouter/analisar', { titulo, contexto, pergunta, modelo }),
}

export const dreMotorAPI = {
  // Fórmulas
  gerarFormulas:   (planoId, sobrescrever = false) =>
    api.post(`/dre/formulas/gerar/${planoId}?sobrescrever=${sobrescrever}`),
  listarFormulas:  planoId  => api.get(`/dre/formulas/${planoId}`),
  atualizarFormula:(id, d)      => api.put(`/dre/formulas/${id}`, d),
  upsertFormula:   (itemId, d)  => api.put(`/dre/formulas/item/${itemId}`, d),
  // Recálculo
  recalcular: (clienteId, ano, unidade, mes = null, persistir = true) => {
    const p = new URLSearchParams({ cliente_id: clienteId, ano, unidade, persistir })
    if (mes) p.set('mes', mes)
    return api.post(`/dre/recalcular?${p}`)
  },
  // Layouts
  listarLayouts:  clienteId => api.get(`/dre/layouts?cliente_id=${clienteId}`),
  criarLayout:    data      => api.post('/dre/layouts', data),
  atualizarLayout:(id, d)   => api.put(`/dre/layouts/${id}`, d),
  excluirLayout:  id        => api.delete(`/dre/layouts/${id}`),
  previewArquivo: arquivo   => {
    const fd = new FormData(); fd.append('arquivo', arquivo)
    return api.post('/dre/layouts/preview', fd)
  },
  // DE-PARA
  listarDePara:   (clienteId, layoutId = null) => {
    const p = new URLSearchParams({ cliente_id: clienteId })
    if (layoutId) p.set('layout_id', layoutId)
    return api.get(`/dre/de-para?${p}`)
  },
  criarDePara:    data      => api.post('/dre/de-para', data),
  criarDeParaBulk:data      => api.post('/dre/de-para/bulk', data),
  atualizarDePara:(id, d)   => api.put(`/dre/de-para/${id}`, d),
  excluirDePara:  id        => api.delete(`/dre/de-para/${id}`),
  // Importação
  importar: (arquivo, params) => {
    const fd = new FormData(); fd.append('arquivo', arquivo)
    const p = new URLSearchParams(params)
    return api.post(`/dre/importar?${p}`, fd)
  },
  sugerirAgrupamentos: planoId => api.post(`/dre/sugerir-agrupamentos/${planoId}`),
  listarLogs:      clienteId => api.get(`/dre/importar/logs?cliente_id=${clienteId}`),
  pendenciasDoLog: logId     => api.get(`/dre/importar/logs/${logId}/pendencias`),
  resolverPendencia: data    => api.post('/dre/importar/pendencias/resolver', data),
}

// ── PLANO REFERENCIAL ─────────────────────────────────────────────────────────

export const refSegmentosAPI = {
  listar:   ()         => api.get('/ref/segmentos/'),
  criar:    data       => api.post('/ref/segmentos/', data),
  atualizar:(id, data) => api.put(`/ref/segmentos/${id}`, data),
  deletar:  id         => api.delete(`/ref/segmentos/${id}`),
}

export const refPlanoAPI = {
  listar:           ()              => api.get('/ref/plano/'),
  criar:            data            => api.post('/ref/plano/', data),
  listarContas:     planoId         => api.get(`/ref/plano/${planoId}/contas`),
  criarConta:       (planoId, data) => api.post(`/ref/plano/${planoId}/contas`, data),
  criarSubconta:    (id, data)      => api.post(`/ref/plano/contas/${id}/subcontas`, data),
  atualizarConta:   (id, data)      => api.put(`/ref/plano/contas/${id}`, data),
  deletarConta:     id              => api.delete(`/ref/plano/contas/${id}`),
  listarAgrupamentos: planoId       => api.get(`/ref/plano/agrupamentos/${planoId}`),
  // Vínculos de agrupamento
  listarVinculos:         id              => api.get(`/ref/plano/contas/${id}/agrupamentos`),
  vincularAgrupamento:    (id, data)      => api.post(`/ref/plano/contas/${id}/agrupamentos`, data),
  removerVinculo:         (id, vinculoId) => api.delete(`/ref/plano/contas/${id}/agrupamentos/${vinculoId}`),
  propagarAgrupamento:    id              => api.post(`/ref/plano/contas/${id}/propagar-agrupamento`),
  sugerirAgrupamento:     id              => api.get(`/ref/plano/contas/${id}/sugerir-agrupamento`),
  autoSugerirAgrupamentos: planoId        => api.post(`/ref/plano/auto-sugerir-agrupamentos`, null, { params: { plano_id: planoId } }),
}

export const refLancamentosAPI = {
  importar:           data                    => api.post('/ref/lancamentos/importar', data),
  importarArquivo:    (cid, data, params)     => api.post(`/ref/lancamentos/importar-arquivo`, data, { params }),
  listar:             (cid, ano, mes)         => api.get(`/ref/lancamentos/cliente/${cid}`, { params: { ano, mes } }),
  deletarCompetencia: (cid, ano, mes)         => api.delete(`/ref/lancamentos/cliente/${cid}/competencia/${ano}/${mes}`),
  editarCelula:       (cid, data)             => api.put(`/ref/lancamentos/cliente/${cid}/editar-celula`, data),
}

export const refUnidadesAPI = {
  listar:    cid => api.get(`/ref/unidades/cliente/${cid}`),
  criar:     (cid, data) => api.post(`/ref/unidades/cliente/${cid}`, data),
  atualizar: (id, data) => api.put(`/ref/unidades/${id}`, data),
  deletar:   id => api.delete(`/ref/unidades/${id}`),
}

export const refDeParaAPI = {
  pendencias:       clienteId  => api.get('/ref/depara/pendencias', { params: clienteId ? { cliente_id: clienteId } : {} }),
  sugestoes:        ccId       => api.get(`/ref/depara/sugestoes/${ccId}`),
  confirmar:        data       => api.post('/ref/depara/confirmar', data),
  porCliente:       clienteId  => api.get(`/ref/depara/cliente/${clienteId}`),
  contasCliente:    clienteId  => api.get(`/ref/depara/contas-cliente/${clienteId}`),
}

export const refTemplatesAPI = {
  listar:         (tipo, segId)     => api.get('/ref/templates/', { params: { tipo, segmento_id: segId } }),
  criar:          data              => api.post('/ref/templates/', data),
  detalhe:        id                => api.get(`/ref/templates/${id}`),
  atualizar:      (id, data)        => api.put(`/ref/templates/${id}`, data),
  deletar:        id                => api.delete(`/ref/templates/${id}`),
  criarLinha:     (id, data)        => api.post(`/ref/templates/${id}/linhas`, data),
  atualizarLinha: (id, lid, data)   => api.put(`/ref/templates/${id}/linhas/${lid}`, data),
  deletarLinha:   (id, lid)         => api.delete(`/ref/templates/${id}/linhas/${lid}`),
  duplicar:       (id, data)        => api.post(`/ref/templates/${id}/duplicar`, data),
}

export const refDemonstrativosAPI = {
  calcular:       (cid, tid, ano, mes, unidade_codigo = null) => {
    const params = { ano, mes }
    if (unidade_codigo) params.unidade_codigo = unidade_codigo
    return api.get(`/ref/demonstrativos/cliente/${cid}/template/${tid}`, { params })
  },
  comparativo:    (cid, ano, mes, tReal, tOrc, unidade_codigo = null)  => {
    const params = { ano, mes, template_realizado_id: tReal, template_orcado_id: tOrc }
    if (unidade_codigo) params.unidade_codigo = unidade_codigo
    return api.get(`/ref/demonstrativos/cliente/${cid}/comparativo`, { params })
  },
  fecharPeriodo:  (cid, ano, mes)               => api.post(`/ref/demonstrativos/cliente/${cid}/periodo/${ano}/${mes}/fechar`),
  reabrirPeriodo: (cid, ano, mes)               => api.delete(`/ref/demonstrativos/cliente/${cid}/periodo/${ano}/${mes}/reabrir`),
  periodos:       cid                           => api.get(`/ref/demonstrativos/cliente/${cid}/periodos`),
}

export const refBenchmarkAPI = {
  calcular: (segId, ano, mes, templateId) =>
    api.get(`/ref/benchmark/segmento/${segId}`, { params: { ano, mes, template_id: templateId } }),
}

export default api
