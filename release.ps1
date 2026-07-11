# release.ps1 — Publica nova versão do E Mais Consultoria
#
# Uso:
#   .\release.ps1          (2.0.0 → 2.0.0a → 2.0.0b  — ajuste/melhoria, notifica usuários)
#   .\release.ps1 beta     (2.0.0a → 2.0.0a-beta      — deploy silencioso para validação)
#   .\release.ps1 minor    (2.0.0b → 2.1.0            — funcionalidade nova)
#   .\release.ps1 major    (2.1.0  → 3.0.0            — implementação robusta)

param([string]$tipo = "letra")

$mainPy = "$PSScriptRoot\backend\main.py"
$pkgJson = "$PSScriptRoot\electron-client\package.json"

# Ler versão atual do backend (suporta 2.0.0, 2.0.0a, 2.0.0a-beta)
$content = Get-Content $mainPy -Raw
if ($content -match 'APP_VERSION\s*=\s*"(\d+)\.(\d+)\.(\d+)([a-z]*)(-beta)?"') {
    $major  = [int]$Matches[1]
    $minor  = [int]$Matches[2]
    $patch  = [int]$Matches[3]
    $letra  = $Matches[4]
    $isBeta = $Matches[5] -eq '-beta'
} else {
    Write-Host "Versão não encontrada em main.py" -ForegroundColor Red
    exit 1
}

# Calcular nova versão
# [Linhas 27 a 57 continuam inalteradas]
switch ($tipo) {
    "beta" {
        # Se já é beta, mantém base; senão incrementa letra e adiciona -beta
        if (-not $isBeta) {
            if ($letra -eq '') { $letra = 'a' }
            elseif ($letra -eq 'z') { Write-Host "Sufixo esgotado. Use .\release.ps1 minor." -ForegroundColor Red; exit 1 }
            else { $letra = [char]([int][char]$letra + 1) }
        }
        $novaVersao = "$major.$minor.$patch$letra-beta"
    }
    "major" {
        $major++; $minor = 0; $patch = 0; $letra = ''
        $novaVersao = "$major.$minor.$patch"
    }
    "minor" {
        $minor++; $patch = 0; $letra = ''
        $novaVersao = "$major.$minor.$patch"
    }
    default {
        # Release oficial — remove -beta se existia, ou incrementa letra
        if ($isBeta) {
            $novaVersao = "$major.$minor.$patch$letra"  # promove beta para oficial
        } else {
            if ($letra -eq '') { $letra = 'a' }
            elseif ($letra -eq 'z') { Write-Host "Sufixo esgotado. Use .\release.ps1 minor." -ForegroundColor Red; exit 1 }
            else { $letra = [char]([int][char]$letra + 1) }
            $novaVersao = "$major.$minor.$patch$letra"
        }
    }
}

Write-Host "Publicando versão $novaVersao..." -ForegroundColor Cyan

# Atualizar backend/main.py
(Get-Content $mainPy -Raw) -replace 'APP_VERSION\s*=\s*"[\d\.a-z-]+"', "APP_VERSION = `"$novaVersao`"" |
    Set-Content $mainPy -Encoding UTF8

# Atualizar electron-client/package.json (sem BOM — electron-builder falha com BOM)
$pkg = Get-Content $pkgJson -Raw | ConvertFrom-Json
$pkg.version = $novaVersao
$json = $pkg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($pkgJson, $json, [System.Text.UTF8Encoding]::new($false))

# Build do frontend
Write-Host "Compilando frontend..." -ForegroundColor Cyan
Set-Location "$PSScriptRoot\frontend"
npm run build

# Commit, PR e merge (contorna branch protection via --admin; CI já rodou no feature branch)
$relBranch = "release/v$novaVersao"
git -C $PSScriptRoot checkout -b $relBranch
git -C $PSScriptRoot add backend/ electron-client/package.json frontend/dist ORCAMENTO/
git -C $PSScriptRoot commit -m "Release v$novaVersao"
git -C $PSScriptRoot push origin $relBranch
gh pr create --base main --head $relBranch --title "Release v$novaVersao" --body "Build automático gerado por release.ps1" --repo emaiscontrol-cpu/emais-consultoria
Write-Host "Aguardando CI registrar checks (30s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30
Write-Host "Monitorando CI..." -ForegroundColor Yellow
gh pr checks $relBranch --watch --repo emaiscontrol-cpu/emais-consultoria
$mergeOk = gh pr merge $relBranch --merge --delete-branch --repo emaiscontrol-cpu/emais-consultoria
git -C $PSScriptRoot checkout main
git -C $PSScriptRoot pull origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "v$novaVersao publicada com sucesso!" -ForegroundColor Green
    Write-Host "O servidor será atualizado automaticamente em instantes." -ForegroundColor Yellow
} else {
    Write-Host "PR criado mas merge falhou. Verifique o PR no GitHub e faça o merge manualmente." -ForegroundColor Red
}
