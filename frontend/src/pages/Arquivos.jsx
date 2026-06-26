import { useEffect, useRef, useState } from 'react'
import { clientesAPI, arquivosAPI } from '../services/api'
import { LoadingPage } from '../components/shared'
import {
  File, FileText, FileSpreadsheet, FileImage, Upload,
  Download, Trash2, FolderOpen, Eye,
} from 'lucide-react'
import toast from 'react-hot-toast'

const CATEGORIAS = ['Contrato', 'Relatório', 'Financeiro', 'Jurídico', 'Outros']

const CATEGORIA_COR = {
  'Contrato':  { bg: '#DBEAFE', text: '#1D4ED8' },
  'Relatório': { bg: '#EDE9FE', text: '#6D28D9' },
  'Financeiro':{ bg: '#DCFCE7', text: '#15803D' },
  'Jurídico':  { bg: '#FEF3C7', text: '#B45309' },
  'Outros':    { bg: '#F3F4F6', text: '#4B5563' },
}

function BadgeCategoria({ categoria }) {
  const cor = CATEGORIA_COR[categoria] || CATEGORIA_COR['Outros']
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 600,
      background: cor.bg,
      color: cor.text,
      flexShrink: 0,
    }}>
      {categoria || 'Outros'}
    </span>
  )
}

function iconeArquivo(mime, nome) {
  const ext = nome?.split('.').pop()?.toLowerCase() || ''
  if (mime?.includes('pdf') || ext === 'pdf')
    return <FileText size={18} color="#DC2626" />
  if (mime?.includes('spreadsheet') || mime?.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext))
    return <FileSpreadsheet size={18} color="#16A34A" />
  if (mime?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
    return <FileImage size={18} color="#7C3AED" />
  if (mime?.includes('word') || ['doc', 'docx'].includes(ext))
    return <FileText size={18} color="#1D4ED8" />
  return <File size={18} color="#6B7280" />
}

function ehImagem(mime, nome) {
  const ext = nome?.split('.').pop()?.toLowerCase() || ''
  return (mime?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext))
}

function podeAbrirInline(mime, nome) {
  const ext = nome?.split('.').pop()?.toLowerCase() || ''
  return (mime?.includes('pdf') || ext === 'pdf') ||
         (mime?.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext))
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Carrega a signed URL para thumbnail de imagem quando o componente monta
function ThumbnailImagem({ arq }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    if (!arq.disponivel) return
    arquivosAPI.download(arq.id)
      .then(r => setSrc(r.data.url))
      .catch(() => {})
  }, [arq.id])

  if (!src) return (
    <div style={{
      width: 48, height: 48, borderRadius: 7, flexShrink: 0,
      background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <FileImage size={18} color="#7C3AED" />
    </div>
  )

  return (
    <img
      src={src}
      alt=""
      style={{ width: 48, height: 48, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }}
    />
  )
}

export default function Arquivos() {
  const [clientes,        setClientes]        = useState([])
  const [clienteAtivo,    setClienteAtivo]    = useState(null)
  const [arquivos,        setArquivos]        = useState([])
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [loadingClientes, setLoadingClientes] = useState(true)
  const [loadingArquivos, setLoadingArquivos] = useState(false)
  const [deletando,       setDeletando]       = useState(null)

  // Upload com seletor de categoria
  const [arquivosPendentes, setArquivosPendentes] = useState([])
  const [categoriaPendente, setCategoriaPendente] = useState('Outros')
  const [enviando,          setEnviando]          = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    clientesAPI.listar()
      .then(r => setClientes(r.data.filter(c => c.ativo)))
      .catch(() => toast.error('Erro ao carregar clientes'))
      .finally(() => setLoadingClientes(false))
  }, [])

  const carregarArquivos = async (clienteId) => {
    setLoadingArquivos(true)
    try {
      const r = await arquivosAPI.listar(clienteId)
      setArquivos(r.data)
    } catch {
      toast.error('Erro ao carregar arquivos')
    } finally {
      setLoadingArquivos(false)
    }
  }

  const selecionarCliente = (c) => {
    setClienteAtivo(c)
    setFiltroCategoria('Todos')
    carregarArquivos(c.id)
  }

  const handleSelecionarArquivos = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setArquivosPendentes(files)
    setCategoriaPendente('Outros')
    inputRef.current.value = ''
  }

  const handleConfirmarUpload = async () => {
    if (!arquivosPendentes.length) return
    setEnviando(true)
    let ok = 0
    for (const f of arquivosPendentes) {
      try {
        await arquivosAPI.upload(clienteAtivo.id, f, categoriaPendente)
        ok++
      } catch {
        toast.error(`Erro ao enviar ${f.name}`)
      }
    }
    if (ok) toast.success(`${ok} arquivo(s) enviado(s)!`)
    setArquivosPendentes([])
    setEnviando(false)
    carregarArquivos(clienteAtivo.id)
  }

  const handleAbrirOuBaixar = async (arq) => {
    const inline = podeAbrirInline(arq.tipo_mime, arq.nome_original)
    // Abre janela em branco ANTES do await para preservar o gesto do usuário
    const novaJanela = inline ? window.open('about:blank', '_blank') : null
    try {
      const r = await arquivosAPI.download(arq.id)
      if (inline) {
        if (novaJanela) novaJanela.location.href = r.data.url
        else window.open(r.data.url, '_blank')
      } else {
        const a = document.createElement('a')
        a.href = r.data.url
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch {
      if (novaJanela) novaJanela.close()
      toast.error('Erro ao abrir arquivo')
    }
  }

  const handleDeletar = async () => {
    try {
      await arquivosAPI.deletar(deletando.id)
      toast.success('Arquivo removido.')
      setDeletando(null)
      carregarArquivos(clienteAtivo.id)
    } catch {
      toast.error('Erro ao remover arquivo')
    }
  }

  const arquivosFiltrados = filtroCategoria === 'Todos'
    ? arquivos
    : arquivos.filter(a => (a.categoria || 'Outros') === filtroCategoria)

  if (loadingClientes) return <LoadingPage />

  return (
    <div className="page" style={{ padding: 0, height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/* Painel lateral de clientes */}
      <div style={{
        width: 220, flexShrink: 0, borderRight: '1px solid var(--border)',
        overflowY: 'auto', background: 'var(--sidebar-bg, #f9fafb)',
        padding: '16px 8px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 8px', marginBottom: 8 }}>
          Clientes
        </div>
        {clientes.map(c => (
          <button
            key={c.id}
            onClick={() => selecionarCliente(c)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: clienteAtivo?.id === c.id ? 'var(--brand)' : 'transparent',
              color: clienteAtivo?.id === c.id ? '#fff' : 'var(--text)',
              fontSize: 13, fontWeight: clienteAtivo?.id === c.id ? 600 : 400,
              marginBottom: 2, transition: 'background .15s',
            }}
            onMouseEnter={e => { if (clienteAtivo?.id !== c.id) e.currentTarget.style.background = 'var(--surface)' }}
            onMouseLeave={e => { if (clienteAtivo?.id !== c.id) e.currentTarget.style.background = 'transparent' }}
          >
            {c.razao_social}
          </button>
        ))}
      </div>

      {/* Área principal */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!clienteAtivo ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <FolderOpen size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: .4 }} />
            <span style={{ fontSize: 14 }}>Selecione um cliente para ver os arquivos</span>
          </div>
        ) : (
          <>
            {/* Cabeçalho */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{clienteAtivo.razao_social}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {arquivos.length} arquivo(s)
                  </div>
                </div>
                <div>
                  <input ref={inputRef} type="file" multiple style={{ display: 'none' }} onChange={handleSelecionarArquivos} />
                  <button
                    className="btn btn-primary"
                    onClick={() => inputRef.current.click()}
                    style={{ display: 'flex', alignItems: 'center', gap: 7 }}
                  >
                    <Upload size={14} />
                    Enviar arquivo
                  </button>
                </div>
              </div>

              {/* Filtro por categoria */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Todos', ...CATEGORIAS].map(cat => {
                  const ativo = filtroCategoria === cat
                  const cor = cat !== 'Todos' ? CATEGORIA_COR[cat] : null
                  return (
                    <button
                      key={cat}
                      onClick={() => setFiltroCategoria(cat)}
                      style={{
                        padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        border: ativo ? 'none' : '1px solid var(--border)',
                        cursor: 'pointer',
                        background: ativo ? (cor ? cor.bg : 'var(--brand)') : 'transparent',
                        color: ativo ? (cor ? cor.text : '#fff') : 'var(--text-muted)',
                        transition: 'all .15s',
                      }}
                    >
                      {cat}
                      {cat !== 'Todos' && (
                        <span style={{ marginLeft: 5, opacity: .65 }}>
                          {arquivos.filter(a => (a.categoria || 'Outros') === cat).length}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Lista de arquivos */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
              {loadingArquivos ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</div>
              ) : arquivosFiltrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                  <Upload size={36} strokeWidth={1} style={{ marginBottom: 10, opacity: .35, display: 'block', margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 14 }}>
                    {filtroCategoria === 'Todos' ? 'Nenhum arquivo enviado ainda.' : `Nenhum arquivo na categoria "${filtroCategoria}".`}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {arquivosFiltrados.map(arq => (
                    <div key={arq.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#fff', border: '1px solid var(--border)',
                      borderRadius: 9, padding: '10px 14px',
                      transition: 'box-shadow .15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.07)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      {/* Thumbnail para imagens, ícone para demais */}
                      <div style={{ flexShrink: 0 }}>
                        {ehImagem(arq.tipo_mime, arq.nome_original) && arq.disponivel
                          ? <ThumbnailImagem arq={arq} />
                          : iconeArquivo(arq.tipo_mime, arq.nome_original)
                        }
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {arq.nome_original}
                          </span>
                          <BadgeCategoria categoria={arq.categoria} />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                          <span>{formatBytes(arq.tamanho)}</span>
                          {arq.enviado_por && <span>por {arq.enviado_por}</span>}
                          {arq.criado_em && (
                            <span>{new Date(arq.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button
                          className="btn btn-sm btn-ghost"
                          title={!arq.disponivel ? 'Arquivo não disponível — reenvie o documento' : podeAbrirInline(arq.tipo_mime, arq.nome_original) ? 'Abrir' : 'Baixar'}
                          disabled={!arq.disponivel}
                          onClick={() => arq.disponivel && handleAbrirOuBaixar(arq)}
                          style={!arq.disponivel ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
                        >
                          {podeAbrirInline(arq.tipo_mime, arq.nome_original)
                            ? <Eye size={13} />
                            : <Download size={13} />}
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          title="Excluir"
                          style={{ color: 'var(--red)' }}
                          onClick={() => setDeletando(arq)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal: seletor de categoria antes do upload */}
      {arquivosPendentes.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Enviar arquivo(s)</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              {arquivosPendentes.length === 1
                ? arquivosPendentes[0].name
                : `${arquivosPendentes.length} arquivos selecionados`}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>
                Categoria
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIAS.map(cat => {
                  const ativo = categoriaPendente === cat
                  const cor = CATEGORIA_COR[cat]
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoriaPendente(cat)}
                      style={{
                        padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600,
                        border: ativo ? 'none' : '1px solid var(--border)',
                        cursor: 'pointer',
                        background: ativo ? cor.bg : 'transparent',
                        color: ativo ? cor.text : 'var(--text-muted)',
                        transition: 'all .15s',
                      }}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                className="btn"
                onClick={() => setArquivosPendentes([])}
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmarUpload}
                disabled={enviando}
                style={{ display: 'flex', alignItems: 'center', gap: 7 }}
              >
                <Upload size={14} />
                {enviando ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar exclusão */}
      {deletando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 24, width: 380, boxShadow: '0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Excluir arquivo</div>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
              Tem certeza que deseja excluir <strong style={{ color: 'var(--text)' }}>{deletando.nome_original}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setDeletando(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleDeletar}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
