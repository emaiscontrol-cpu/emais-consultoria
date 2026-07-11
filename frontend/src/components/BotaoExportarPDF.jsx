import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { pdfAPI } from '../services/api'
import toast from 'react-hot-toast'

function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

function extrairNomeArquivo(headers, fallback) {
  const cd = headers?.['content-disposition']
  const match = cd && /filename=([^;]+)/.exec(cd)
  return match ? match[1].trim() : fallback
}

export default function BotaoExportarPDF({ titulo, clienteNome, periodo, colunas, linhas, iconOnly, className }) {
  const [loading, setLoading] = useState(false)

  const handleExportar = async () => {
    setLoading(true)
    try {
      const { data, headers } = await pdfAPI.demonstrativo({
        titulo, cliente_nome: clienteNome, periodo, colunas, linhas,
      })
      const nome = extrairNomeArquivo(headers, `${titulo}.pdf`)
      baixarBlob(data, nome)
    } catch {
      toast.error('Erro ao gerar PDF')
    } finally {
      setLoading(false)
    }
  }

  if (iconOnly) {
    return (
      <button
        onClick={handleExportar}
        disabled={loading}
        title="Exportar PDF"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 6,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all .15s',
        }}
        className={className || 'fc-sidebar-btn'}
      >
        {loading
          ? <Loader2 size={15} className="spin" />
          : <Download size={15} />
        }
      </button>
    )
  }

  return (
    <button
      onClick={handleExportar}
      disabled={loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', fontSize: 11, borderRadius: 5,
        border: '0.5px solid var(--border)', background: 'transparent',
        color: 'var(--text-muted)', cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'all .15s',
      }}
    >
      {loading
        ? <><Loader2 size={12} className="spin" /> Gerando...</>
        : <><Download size={12} /> Exportar PDF</>
      }
    </button>
  )
}
