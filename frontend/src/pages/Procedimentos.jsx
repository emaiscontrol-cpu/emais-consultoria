import { useState, useEffect, useRef } from 'react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'
import { DatabaseBackup, Clock, CheckCircle, XCircle, RefreshCw, Upload } from 'lucide-react'

function fmt(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fmtData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function Procedimentos() {
  const [backups,      setBackups]      = useState([])
  const [auto,         setAuto]         = useState(null)
  const [postgres,     setPostgres]     = useState(false)
  const [carregando,   setCarregando]   = useState(false)
  const [fazendo,      setFazendo]      = useState(false)
  const [novoHorario,  setNovoHorario]  = useState('')
  const [salvandoAuto, setSalvandoAuto] = useState(false)
  const [restaurando,  setRestaurando]  = useState(false)
  const [arquivoRest,  setArquivoRest]  = useState(null)
  const inputRef = useRef()

  const carregar = async () => {
    setCarregando(true)
    try {
      const r = await adminAPI.listarBackups()
      setBackups(r.data.backups)
      setAuto(r.data.auto)
      setPostgres(r.data.postgres ?? false)
      setNovoHorario(r.data.auto?.horario ?? '03:00')
    } catch {
      toast.error('Erro ao carregar backups')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const fazerBackup = async () => {
    setFazendo(true)
    try {
      const r = await adminAPI.fazerBackup()
      toast.success(`Backup concluído: ${r.data.arquivo}`)
      carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao fazer backup')
    } finally {
      setFazendo(false)
    }
  }

  const salvarAuto = async () => {
    setSalvandoAuto(true)
    try {
      await adminAPI.configurarAuto({ horario: novoHorario })
      toast.success('Configuração salva')
      carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar')
    } finally {
      setSalvandoAuto(false)
    }
  }

  const toggleAuto = async () => {
    try {
      await adminAPI.configurarAuto({ ativo: !auto?.ativo })
      carregar()
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  const restaurar = async () => {
    if (!arquivoRest) return
    if (!window.confirm(
      `Restaurar o banco com o arquivo "${arquivoRest.name}"?\n\n` +
      `⚠ Os dados atuais serão substituídos pelos dados do backup.\n` +
      `Um backup de segurança será gerado automaticamente antes.`
    )) return

    setRestaurando(true)
    try {
      const r = await adminAPI.restaurarBackup(arquivoRest)
      toast.success(r.data.mensagem || 'Banco restaurado com sucesso')
      setArquivoRest(null)
      if (inputRef.current) inputRef.current.value = ''
      carregar()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao restaurar backup')
    } finally {
      setRestaurando(false)
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 820 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <DatabaseBackup size={22} color="var(--brand)" />
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Procedimentos</h1>
      </div>

      {/* ── Fazer Backup Agora ─────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Backup Manual</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          {postgres
            ? <>Exporta todos os dados do <strong>Supabase (PostgreSQL)</strong> e salva um arquivo <code>.sql.gz</code> no servidor local como cópia de segurança adicional.</>
            : <>Gera imediatamente uma cópia do banco de dados local em <code>.db</code>.</>
          }
        </div>
        <button className="btn btn-primary" onClick={fazerBackup} disabled={fazendo}
          style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <DatabaseBackup size={14} />
          {fazendo ? 'Fazendo backup...' : 'Fazer Backup Agora'}
        </button>
      </div>

      {/* ── Restaurar Backup ──────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Restaurar Banco de Dados</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Selecione um arquivo <code>{postgres ? '.sql.gz' : '.db'}</code> de backup para restaurar. Um backup de segurança é gerado automaticamente antes da restauração.
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px',
            background: '#f0f4ff', border: '1px solid var(--brand)', borderRadius: 6,
            cursor: 'pointer', fontSize: 13, color: 'var(--brand)', fontWeight: 600,
          }}>
            <Upload size={14} />
            Selecionar arquivo {postgres ? '.sql.gz' : '.db'}
            <input ref={inputRef} type="file" accept={postgres ? '.sql.gz,.gz' : '.db'} style={{ display: 'none' }}
              onChange={e => setArquivoRest(e.target.files?.[0] || null)} />
          </label>

          {arquivoRest && (
            <>
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                {arquivoRest.name}
                <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({fmt(arquivoRest.size)})</span>
              </span>
              <button className="btn btn-sm" onClick={restaurar} disabled={restaurando}
                style={{ background: '#dc2626', color: '#fff', border: 'none', fontWeight: 600 }}>
                {restaurando ? 'Restaurando...' : 'Confirmar Restauração'}
              </button>
              <button className="btn btn-sm" onClick={() => { setArquivoRest(null); if (inputRef.current) inputRef.current.value = '' }}>
                Cancelar
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 12, padding: '8px 12px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
          ⚠ Use este recurso para importar o banco do servidor para um ambiente local de testes. Após restaurar, reinicie o servidor backend para garantir a consistência.
        </div>
      </div>

      {/* ── Backup Automático ─────────────────────────────────────── */}
      {auto && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Backup Automático Diário</div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Status: </span>
              {auto.ativo
                ? <span style={{ color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={13}/> Ativo</span>
                : <span style={{ color: '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={13}/> Inativo</span>
              }
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Horário agendado: </span>
              <strong>{auto.horario}</strong>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>Último backup: </span>
              <strong>{fmtData(auto.ultimo)}</strong>
              {auto.ultimo_arq && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({auto.ultimo_arq})</span>}
            </div>
          </div>

          {auto.erro && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#dc2626', marginBottom: 12 }}>
              Último erro: {auto.erro}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Horário (HH:MM)
              </label>
              <input type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)}
                style={{ fontSize: 13, padding: '5px 10px', borderRadius: 5, border: '1px solid var(--border)' }} />
            </div>
            <button className="btn btn-primary btn-sm" onClick={salvarAuto} disabled={salvandoAuto}>
              {salvandoAuto ? 'Salvando...' : 'Salvar horário'}
            </button>
            <button className={`btn btn-sm ${auto.ativo ? '' : 'btn-primary'}`}
              style={auto.ativo ? { border: '1px solid #dc2626', color: '#dc2626' } : {}}
              onClick={toggleAuto}>
              {auto.ativo ? 'Desativar automático' : 'Ativar automático'}
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de backups ─────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Backups Recentes</div>
          <button className="btn btn-sm" onClick={carregar} disabled={carregando}
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <RefreshCw size={12} style={{ animation: carregando ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        </div>

        {backups.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
            Nenhum backup encontrado
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12 }}>Arquivo</th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12 }}>Data</th>
                <th style={{ textAlign: 'right', padding: '6px 10px', fontWeight: 600, color: 'var(--text-muted)', fontSize: 12 }}>Tamanho</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b, i) => (
                <tr key={b.nome} style={{ borderBottom: i < backups.length - 1 ? '1px solid var(--border-light, #f0f0f0)' : 'none' }}>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: 12 }}>{b.nome}</td>
                  <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{fmtData(b.data)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(b.tamanho)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
