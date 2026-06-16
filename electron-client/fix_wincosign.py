"""
Baixa e extrai o winCodeSign-2.6.0 no cache do electron-builder,
ignorando os links simbólicos do macOS que exigem privilégios elevados no Windows.
"""
import os
import py7zr
import urllib.request
import tempfile

URL = "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
CACHE_DIR = os.path.join(os.environ["LOCALAPPDATA"], "electron-builder", "Cache", "winCodeSign", "winCodeSign-2.6.0")

print(f"Destino: {CACHE_DIR}")

if os.path.isdir(CACHE_DIR) and os.listdir(CACHE_DIR):
    print("Já extraído, ignorando.")
else:
    os.makedirs(CACHE_DIR, exist_ok=True)

    tmp = tempfile.NamedTemporaryFile(suffix=".7z", delete=False)
    tmp.close()
    print(f"Baixando {URL} ...")
    urllib.request.urlretrieve(URL, tmp.name)
    print("Extraindo (ignorando links simbólicos do macOS) ...")

    with py7zr.SevenZipFile(tmp.name, mode="r") as z:
        entries = z.list()
        # Filtra entradas de link simbólico (os links darwin/*.dylib)
        targets = [e.filename for e in entries if not e.is_symlink]
        z.reset()
        z.extract(path=CACHE_DIR, targets=targets)

    os.unlink(tmp.name)
    print("Concluído.")

print("Cache pronto. Execute: npm run build")
