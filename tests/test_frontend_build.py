"""
Verifica que frontend/dist/ existe, tem a estrutura esperada e está
atualizado em relação ao código fonte de frontend/src/.

frontend/dist/ é servido como estático pelo próprio backend FastAPI
(ver backend/main.py) e é commitado no git — se ele não existir, estiver
incompleto ou ficar mais antigo que o código fonte, o app quebra em
produção sem nenhum erro do backend.

No CI, o workflow roda `npm run build` antes destes testes (ver
.github/workflows/ci.yml), então o dist sempre estará fresco ali. A
checagem de "desatualizado" (test_dist_nao_esta_desatualizado) só é
aplicada em execução local, fora do CI, como aviso para o desenvolvedor.
"""
import os
import re
from pathlib import Path

import pytest

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"
SRC_DIR = FRONTEND_DIR / "src"

EM_CI = os.environ.get("CI", "").lower() in ("1", "true")


def _arquivos_fonte():
    return [p for p in SRC_DIR.rglob("*") if p.is_file()]


def _arquivos_dist():
    return [p for p in DIST_DIR.rglob("*") if p.is_file()]


class TestDistExiste:
    def test_dist_dir_existe(self):
        assert DIST_DIR.exists(), (
            "frontend/dist/ não existe. Rode `npm run build` dentro de frontend/ "
            "antes de fazer deploy ou rodar a suíte completa."
        )

    def test_index_html_existe(self):
        assert (DIST_DIR / "index.html").exists(), "frontend/dist/index.html não encontrado."

    def test_assets_dir_tem_js(self):
        assets_dir = DIST_DIR / "assets"
        assert assets_dir.exists(), "frontend/dist/assets/ não encontrado."
        js_files = list(assets_dir.glob("*.js"))
        assert js_files, "Nenhum arquivo .js encontrado em frontend/dist/assets/."


class TestDistConsistente:
    def test_index_html_referencia_assets_existentes(self):
        """O HTML gerado pelo Vite deve apontar só para arquivos que de fato existem em dist/assets."""
        index_html = (DIST_DIR / "index.html").read_text(encoding="utf-8")
        referencias = re.findall(r'(?:src|href)="(/assets/[^"]+)"', index_html)
        assert referencias, "index.html não referencia nenhum asset — build pode estar corrompido."
        for ref in referencias:
            caminho = DIST_DIR / ref.lstrip("/")
            assert caminho.exists(), f"index.html referencia '{ref}', mas o arquivo não existe em dist/."

    def test_dist_nao_esta_vazio(self):
        assert len(_arquivos_dist()) > 0


@pytest.mark.skipif(EM_CI, reason="No CI o dist é gerado fresco pelo workflow antes deste teste.")
class TestDistAtualizado:
    def test_dist_nao_esta_desatualizado(self):
        """Aviso para desenvolvimento local: se algum arquivo em src/ for mais novo
        que o build mais recente em dist/, o build provavelmente está desatualizado.
        """
        fontes = _arquivos_fonte()
        builds = _arquivos_dist()
        if not fontes or not builds:
            pytest.skip("Sem arquivos para comparar.")

        mtime_fonte_mais_novo = max(p.stat().st_mtime for p in fontes)
        mtime_build_mais_novo = max(p.stat().st_mtime for p in builds)

        assert mtime_fonte_mais_novo <= mtime_build_mais_novo, (
            "frontend/dist/ parece desatualizado em relação a frontend/src/. "
            "Rode `npm run build` dentro de frontend/ antes de comitar/fazer deploy."
        )
