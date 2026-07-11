import gzip
import os
import sqlite3
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from security import get_usuario_atual, requer_perfil

router = APIRouter()

# Ordem de inserção respeitando dependências de FK
TABELAS_BACKUP_ORDEM = [
    "agrupamentos", "clientes", "tipos_consultoria",
    "usuarios", "projetos", "fases", "tarefas",
    "modelos_projeto", "modelos_fases", "modelos_tarefas", "modelos_subtarefas",
    "subtarefas", "responsaveis_tarefa", "comentarios", "comentarios_fase",
    "log_tarefas", "log_atividades", "mensagens_chat", "anotacoes", "arquivos",
    "bandeiras", "solicitacoes_reset",
    "balancete_lancamentos", "categorias_financeiras", "lancamentos",
    "orcamento_linhas", "import_layouts", "importacao_logs",
    "importacao_pendencias",
]


def _resolver_db_path():
    from dotenv import load_dotenv
    load_dotenv()
    url = os.getenv("DATABASE_URL", "sqlite:///C:/emals-service/emais_consultoria.db")
    if not url.startswith("sqlite"):
        return None  # PostgreSQL: sem arquivo local
    path_str = url.replace("sqlite:///", "")
    p = Path(path_str)
    if not p.is_absolute():
        p = Path(os.getcwd()) / p
    return p


DB_PATH      = _resolver_db_path()
_IS_POSTGRES = DB_PATH is None
BACKUP_DIR   = Path(os.getenv("BACKUP_DIR", str(
    (DB_PATH.parent / "backup") if DB_PATH else (Path(os.getcwd()) / "backup")
)))

# ── Estado do backup automático ───────────────────────────────────────────────
_auto_backup_state = {
    "ativo":      True,
    "horario":    "03:00",
    "ultimo":     None,
    "ultimo_arq": None,
    "erro":       None,
}
_auto_timer: threading.Timer | None = None


# ── Lógica de backup ──────────────────────────────────────────────────────────

def _escapar_valor(v, col: str, bool_cols: set) -> str:
    if v is None:
        return "NULL"
    if col in bool_cols or isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def _executar_backup_postgres() -> Path:
    from database import engine
    from sqlalchemy import text, inspect

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"emais_backup_{ts}.sql.gz"

    inspector  = inspect(engine)
    tabelas_db = set(inspector.get_table_names(schema="public"))
    tabelas    = [t for t in TABELAS_BACKUP_ORDEM if t in tabelas_db]
    tabelas   += [t for t in sorted(tabelas_db) if t not in tabelas]

    with engine.connect() as conn:
        with gzip.open(dest, "wt", encoding="utf-8") as f:
            f.write("-- E Mais Consultoria -- Backup PostgreSQL\n")
            f.write(f"-- Gerado em: {datetime.now().isoformat()}\n\n")
            f.write("SET session_replication_role = 'replica';\n\n")

            for tabela in tabelas:
                col_rows = conn.execute(text("""
                    SELECT column_name, data_type
                    FROM information_schema.columns
                    WHERE table_schema='public' AND table_name=:t
                    ORDER BY ordinal_position
                """), {"t": tabela}).fetchall()
                if not col_rows:
                    continue

                col_names = [r[0] for r in col_rows]
                bool_cols = {r[0] for r in col_rows if r[1] == "boolean"}
                col_str   = ", ".join(f'"{c}"' for c in col_names)

                count = conn.execute(text(f'SELECT COUNT(*) FROM "{tabela}"')).scalar()
                if count == 0:
                    continue

                f.write(f"-- {tabela} ({count} rows)\n")
                f.write(f'TRUNCATE TABLE "{tabela}" RESTART IDENTITY CASCADE;\n')

                BATCH  = 1000
                offset = 0
                while offset < count:
                    rows = conn.execute(text(
                        f'SELECT {col_str} FROM "{tabela}" ORDER BY id LIMIT {BATCH} OFFSET {offset}'
                    )).fetchall()
                    if not rows:
                        break
                    for row in rows:
                        vals = [_escapar_valor(v, col_names[i], bool_cols) for i, v in enumerate(row)]
                        f.write(f'INSERT INTO "{tabela}" ({col_str}) VALUES ({", ".join(vals)});\n')
                    offset += len(rows)

                f.write("\n")

            f.write("SET session_replication_role = 'origin';\n")

    _auto_backup_state["ultimo"]     = datetime.now().isoformat(timespec="seconds")
    _auto_backup_state["ultimo_arq"] = dest.name
    _auto_backup_state["erro"]       = None
    return dest


def _executar_backup() -> Path:
    if _IS_POSTGRES:
        return _executar_backup_postgres()

    # SQLite
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = BACKUP_DIR / f"emais_consultoria_{ts}.db"
    src  = sqlite3.connect(str(DB_PATH))
    out  = sqlite3.connect(str(dest))
    src.backup(out)
    src.close()
    out.close()
    _auto_backup_state["ultimo"]     = datetime.now().isoformat(timespec="seconds")
    _auto_backup_state["ultimo_arq"] = dest.name
    _auto_backup_state["erro"]       = None
    return dest


def _agendar_proximo():
    global _auto_timer
    if not _auto_backup_state["ativo"]:
        return
    agora = datetime.now()
    h, m  = map(int, _auto_backup_state["horario"].split(":"))
    prox  = agora.replace(hour=h, minute=m, second=0, microsecond=0)
    if prox <= agora:
        from datetime import timedelta
        prox += timedelta(days=1)
    secs = (prox - agora).total_seconds()
    _auto_timer = threading.Timer(secs, _rodar_auto)
    _auto_timer.daemon = True
    _auto_timer.start()


def _rodar_auto():
    try:
        _executar_backup()
        print(f"[backup] Automático concluído: {_auto_backup_state['ultimo_arq']}")
    except Exception as e:
        _auto_backup_state["erro"] = str(e)
        print(f"[backup] Erro no automático: {e}")
    finally:
        _agendar_proximo()


def iniciar_backup_automatico():
    global _auto_timer
    if _auto_timer and _auto_timer.is_alive():
        _auto_timer.cancel()
    _agendar_proximo()
    tipo = "PostgreSQL/Supabase" if _IS_POSTGRES else "SQLite"
    print(f"[backup] Automático agendado para {_auto_backup_state['horario']} diariamente ({tipo}).")


# ── Restore helpers ───────────────────────────────────────────────────────────

def _restaurar_postgres_sql(sql: str):
    from database import engine
    from sqlalchemy import text
    with engine.begin() as conn:
        conn.execute(text("SET session_replication_role = 'replica'"))
        for line in sql.splitlines():
            line = line.strip()
            if not line or line.startswith("--") or line.upper().startswith("SET SESSION"):
                continue
            try:
                conn.execute(text(line))
            except Exception:
                pass
        conn.execute(text("SET session_replication_role = 'origin'"))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/backup")
def fazer_backup(usuario=Depends(get_usuario_atual)):
    if usuario.perfil != "admin":
        raise HTTPException(403, "Apenas administradores podem executar o backup")
    if not _IS_POSTGRES and not DB_PATH.exists():
        raise HTTPException(500, f"Banco não encontrado em {DB_PATH}")
    try:
        dest = _executar_backup()
        return {
            "ok":      True,
            "arquivo": dest.name,
            "tamanho": dest.stat().st_size,
            "data":    _auto_backup_state["ultimo"],
        }
    except Exception as e:
        raise HTTPException(500, f"Erro ao fazer backup: {e}")


@router.get("/backup")
def listar_backups(usuario=Depends(get_usuario_atual)):
    if usuario.perfil != "admin":
        raise HTTPException(403, "Acesso negado")
    if not BACKUP_DIR.exists():
        return {"backups": [], "auto": _auto_backup_state, "postgres": _IS_POSTGRES}

    padrao   = "*.sql.gz" if _IS_POSTGRES else "*.db"
    arquivos = sorted(BACKUP_DIR.glob(padrao), key=lambda f: f.stat().st_mtime, reverse=True)
    backups  = [
        {
            "nome":    f.name,
            "tamanho": f.stat().st_size,
            "data":    datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds"),
        }
        for f in arquivos[:20]
    ]
    return {"backups": backups, "auto": _auto_backup_state, "postgres": _IS_POSTGRES}


@router.put("/backup/auto")
def configurar_auto(body: dict, usuario=Depends(get_usuario_atual)):
    if usuario.perfil != "admin":
        raise HTTPException(403, "Acesso negado")
    global _auto_timer

    if "ativo" in body:
        _auto_backup_state["ativo"] = bool(body["ativo"])
    if "horario" in body:
        horario = str(body["horario"])
        try:
            h, m = map(int, horario.split(":"))
            assert 0 <= h <= 23 and 0 <= m <= 59
        except Exception:
            raise HTTPException(400, "Horário inválido. Use formato HH:MM")
        _auto_backup_state["horario"] = f"{h:02d}:{m:02d}"

    if _auto_timer:
        _auto_timer.cancel()
    _agendar_proximo()
    return {"ok": True, "auto": _auto_backup_state}


@router.get("/db/export")
def exportar_banco(usuario=Depends(get_usuario_atual)):
    if usuario.perfil != "admin":
        raise HTTPException(403, "Apenas administradores podem exportar o banco")
    if not _IS_POSTGRES and not DB_PATH.exists():
        raise HTTPException(500, f"Banco não encontrado em {DB_PATH}")
    dest       = _executar_backup()
    media_type = "application/gzip" if _IS_POSTGRES else "application/octet-stream"
    return FileResponse(path=str(dest), media_type=media_type, filename=dest.name)


@router.post("/backup/restaurar")
async def restaurar_backup(
    arquivo: UploadFile = File(...),
    usuario=Depends(get_usuario_atual),
):
    if usuario.perfil != "admin":
        raise HTTPException(403, "Apenas administradores podem restaurar o backup")

    if _IS_POSTGRES:
        try:
            conteudo = await arquivo.read()
            sql = gzip.decompress(conteudo).decode("utf-8") if conteudo[:2] == b'\x1f\x8b' else conteudo.decode("utf-8")
            if "E Mais Consultoria" not in sql[:120]:
                raise HTTPException(400, "Arquivo não é um backup válido deste sistema")
            _restaurar_postgres_sql(sql)
            return {"ok": True, "mensagem": "Banco restaurado com sucesso a partir do backup SQL."}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, f"Erro ao restaurar: {e}")

    # SQLite
    tmp_path = None
    try:
        conteudo = await arquivo.read()
        if len(conteudo) < 100:
            raise HTTPException(400, "Arquivo inválido ou corrompido")
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            tmp.write(conteudo)
            tmp_path = tmp.name
        try:
            conn_test = sqlite3.connect(tmp_path)
            conn_test.execute("SELECT name FROM sqlite_master LIMIT 1").fetchall()
            conn_test.close()
        except Exception:
            raise HTTPException(400, "O arquivo não é um banco SQLite válido")
        try:
            _executar_backup()
        except Exception:
            pass
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        src = sqlite3.connect(tmp_path)
        dst = sqlite3.connect(str(DB_PATH))
        src.backup(dst)
        src.close()
        dst.close()
        return {"ok": True, "mensagem": "Banco restaurado com sucesso. Reinicie o servidor para aplicar."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Erro ao restaurar: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/backup/restaurar-local")
def restaurar_backup_local(body: dict, usuario=Depends(get_usuario_atual)):
    if usuario.perfil != "admin":
        raise HTTPException(403, "Apenas administradores podem restaurar o backup")
    nome = (body.get("nome") or "").strip()
    if not nome or "/" in nome or "\\" in nome or ".." in nome:
        raise HTTPException(400, "Nome de arquivo inválido")
    backup_path = BACKUP_DIR / nome
    if not backup_path.exists():
        raise HTTPException(404, f"Backup '{nome}' não encontrado em {BACKUP_DIR}")

    if _IS_POSTGRES:
        try:
            with gzip.open(backup_path, "rt", encoding="utf-8") as f:
                sql = f.read()
            _restaurar_postgres_sql(sql)
            return {"ok": True, "mensagem": f"Banco restaurado a partir de '{nome}'."}
        except Exception as e:
            raise HTTPException(500, f"Erro ao restaurar: {e}")

    # SQLite
    try:
        _executar_backup()
    except Exception:
        pass
    src = sqlite3.connect(str(backup_path))
    dst = sqlite3.connect(str(DB_PATH))
    src.backup(dst)
    src.close()
    dst.close()
    return {"ok": True, "mensagem": f"Banco restaurado a partir de '{nome}'. Reinicie o servidor para aplicar."}


@router.get("/diagnostico")
def get_diagnostico(
    db: Session = Depends(get_db),
    _=Depends(requer_perfil("admin")),
):
    import os as _os
    import re
    from database import SQLALCHEMY_DATABASE_URL as _db_url
    import models as _m

    # Contagens de registros
    try:
        _nc = db.query(_m.Cliente).count()
        _nu = db.query(_m.Usuario).count()
        _np = db.query(_m.Projeto).count()
    except Exception:
        _nc = _nu = _np = 0

    # Mascara senha se houver
    db_url_mascarada = _db_url
    if _db_url:
        match = re.match(r"(^[a-zA-Z0-9\+]+://[^:]+:)([^@]+)(@.+)$", _db_url)
        if match:
            db_url_mascarada = f"{match.group(1)}***{match.group(3)}"

    return {
        "db_url": db_url_mascarada,
        "db_cwd": _os.getcwd(),
        "admin_db_path": str(DB_PATH),
        "admin_db_exists": DB_PATH.exists() if DB_PATH else None,
        "backup_dir": str(BACKUP_DIR),
        "clientes": _nc,
        "usuarios": _nu,
        "projetos": _np,
    }
