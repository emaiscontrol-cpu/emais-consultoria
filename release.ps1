# release.ps1 — Publica nova versão do E Mais Consultoria
# Uso: .\release.ps1 patch   (1.0.0 -> 1.0.1)
#      .\release.ps1 minor   (1.0.0 -> 1.1.0)
#      .\release.ps1 major   (1.0.0 -> 2.0.0)

param([string]$tipo = "patch")

$mainPy = "$PSScriptRoot\backend\main.py"
$pkgJson = "$PSScriptRoot\electron-client\package.json"

# Ler versão atual do backend
$content = Get-Content $mainPy -Raw
if ($content -match 'app\.version\s*=\s*"(\d+)\.(\d+)\.(\d+)"') {
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]
} else {
    Write-Host "Versão não encontrada em main.py" -ForegroundColor Red
    exit 1
}

# Calcular nova versão
switch ($tipo) {
    "major" { $major++; $minor = 0; $patch = 0 }
    "minor" { $minor++; $patch = 0 }
    default { $patch++ }
}
$novaVersao = "$major.$minor.$patch"

Write-Host "Publicando versão $novaVersao..." -ForegroundColor Cyan

# Atualizar backend/main.py
(Get-Content $mainPy -Raw) -replace 'app\.version\s*=\s*"[\d\.]+"', "app.version = `"$novaVersao`"" |
    Set-Content $mainPy -Encoding UTF8

# Atualizar electron-client/package.json
$pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
$pkg.version = $novaVersao
$pkg | ConvertTo-Json -Depth 10 | Set-Content $pkgJson -Encoding UTF8

# Commit e push
git -C $PSScriptRoot add backend/main.py electron-client/package.json
git -C $PSScriptRoot commit -m "Release v$novaVersao"
git -C $PSScriptRoot push origin main

Write-Host "v$novaVersao publicada com sucesso!" -ForegroundColor Green
Write-Host "O servidor será atualizado automaticamente em instantes." -ForegroundColor Yellow
