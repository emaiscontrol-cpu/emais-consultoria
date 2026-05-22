# release.ps1 — Publica nova versão do E Mais Consultoria
#
# Uso:
#   .\release.ps1          (2.0.0 → 2.0.0a → 2.0.0b  — ajuste/melhoria)
#   .\release.ps1 minor    (2.0.0b → 2.1.0            — funcionalidade nova)
#   .\release.ps1 major    (2.1.0  → 3.0.0            — implementação robusta)

param([string]$tipo = "letra")

$mainPy = "$PSScriptRoot\backend\main.py"
$pkgJson = "$PSScriptRoot\electron-client\package.json"

# Ler versão atual do backend (suporta sufixo de letra: 2.0.0a)
$content = Get-Content $mainPy -Raw
if ($content -match 'app\.version\s*=\s*"(\d+)\.(\d+)\.(\d+)([a-z]*)"') {
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]
    $letra = $Matches[4]
} else {
    Write-Host "Versão não encontrada em main.py" -ForegroundColor Red
    exit 1
}

# Calcular nova versão
switch ($tipo) {
    "major" {
        $major++; $minor = 0; $patch = 0; $letra = ''
    }
    "minor" {
        $minor++; $patch = 0; $letra = ''
    }
    default {
        # Incrementa a letra: '' → 'a', 'a' → 'b', ..., 'z' → erro
        if ($letra -eq '') {
            $letra = 'a'
        } elseif ($letra -eq 'z') {
            Write-Host "Sufixo de letra esgotado (z). Use .\release.ps1 minor para avançar a versão." -ForegroundColor Red
            exit 1
        } else {
            $letra = [char]([int][char]$letra + 1)
        }
    }
}
$novaVersao = "$major.$minor.$patch$letra"

Write-Host "Publicando versão $novaVersao..." -ForegroundColor Cyan

# Atualizar backend/main.py
(Get-Content $mainPy -Raw) -replace 'app\.version\s*=\s*"[\d\.a-z]+"', "app.version = `"$novaVersao`"" |
    Set-Content $mainPy -Encoding UTF8

# Atualizar electron-client/package.json
$pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
$pkg.version = $novaVersao
$pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgJson -Encoding UTF8

# Build do frontend
Write-Host "Compilando frontend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend"
npm run build

# Commit e push (inclui o dist compilado)
git -C $PSScriptRoot add backend/main.py electron-client/package.json frontend/dist
git -C $PSScriptRoot commit -m "Release v$novaVersao"
git -C $PSScriptRoot push origin main

Write-Host "v$novaVersao publicada com sucesso!" -ForegroundColor Green
Write-Host "O servidor será atualizado automaticamente em instantes." -ForegroundColor Yellow
