import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from auth import get_usuario_atual

router = APIRouter()

DB_PATH     = Path("C:/emals-service/emais_consultoria.db")
BACKUP_DIR  = Path("C:/emals-service/backup")

# ── Estado do backup automático ───────────────────────────────────────────────
_auto_backup_state = {
    "ativo":       True,
    "horario":     "03:00",   # HH:MM — executado diariamente
    "ultimo":      None,      # datetime do último backup bem-sucedido
    "ultimo_arq":  None,      # nome do arquivo gerado
    "erro":        None,
}
_auto_timer: threading.Timer | None = None


# ── Lógica de backup ─────────────────────────────────────────────────────────

def _executar_backup() -> Path:
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
    """Recalcula segundos até o próximo disparo e agenda o timer."""
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
    """Chamado no startup do backend."""
    _agendar_proximo()
    print(f"[backup] Automático agendado para {_auto_backup_state['horario']} diariamente.")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/backup")
def fazer_backup(usuario=Depends(get_usuario_atual)):
    if usuario.perfil != "admin":
        raise HTTPException(403, "Apenas administradores podem executar o backup")
    if not DB_PATH.exists():
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
        return {"backups": [], "auto": _auto_backup_state}

    arquivos = sorted(BACKUP_DIR.glob("*.db"), key=lambda f: f.stat().st_mtime, reverse=True)
    backups  = [
        {
            "nome":    f.name,
            "tamanho": f.stat().st_size,
            "data":    datetime.fromtimestamp(f.stat().st_mtime).isoformat(timespec="seconds"),
        }
        for f in arquivos[:20]
    ]
    return {"backups": backups, "auto": _auto_backup_state}


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
