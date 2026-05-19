# ============================================================
#  E Mais Consultoria — Script de Instalacao no Servidor
#  Executar como Administrador no Windows Server
# ============================================================

$APP     = "C:\emais-service\app"
$SERVICE = "C:\emais-service"
$DB      = "C:\emais-service\emais_consultoria.db"
$REPO    = "https://github.com/emaiscontrol-cpu/emais-consultoria.git"

Write-Host "`n=== E Mais Consultoria — Instalacao ===" -ForegroundColor Cyan

# 1. Criar estrutura de pastas
Write-Host "`n[1/8] Criando pastas..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $SERVICE | Out-Null
New-Item -ItemType Directory -Force -Path "$SERVICE\logs" | Out-Null

# 2. Clonar repositorio
Write-Host "[2/8] Clonando repositorio do GitHub..." -ForegroundColor Yellow
if (Test-Path "$APP\.git") {
    Write-Host "      Repositorio ja existe, atualizando..."
    git -C $APP pull
} else {
    git clone $REPO $APP
}

# 3. Criar ambiente virtual Python
Write-Host "[3/8] Criando ambiente virtual Python..." -ForegroundColor Yellow
python -m venv "$SERVICE\venv"

# 4. Instalar dependencias Python
Write-Host "[4/8] Instalando dependencias Python..." -ForegroundColor Yellow
& "$SERVICE\venv\Scripts\pip.exe" install -r "$APP\backend\requirements.txt"

# 5. Criar arquivo .env
Write-Host "[5/8] Configurando .env..." -ForegroundColor Yellow
$envContent = "SECRET_KEY=emais-consultoria-$(Get-Random)-producao"
Set-Content -Path "$APP\backend\.env" -Value $envContent -Encoding utf8
Write-Host "      SECRET_KEY gerado automaticamente."

# 6. Atualizar caminho do banco de dados
Write-Host "[6/8] Configurando banco de dados..." -ForegroundColor Yellow
$dbConfig = "SQLALCHEMY_DATABASE_URL = `"sqlite:///C:/emais-service/emais_consultoria.db`""
(Get-Content "$APP\backend\database.py") -replace 'SQLALCHEMY_DATABASE_URL = .*', $dbConfig |
    Set-Content "$APP\backend\database.py" -Encoding utf8

# 7. Build do frontend
Write-Host "[7/8] Compilando frontend..." -ForegroundColor Yellow
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCheck) {
    Push-Location "$APP\frontend"
    npm install --silent
    npm run build
    Pop-Location
} else {
    Write-Host "      AVISO: Node.js nao encontrado. Copie a pasta frontend\dist manualmente." -ForegroundColor Red
}

# 8. Instalar servico Windows
Write-Host "[8/8] Instalando servico Windows..." -ForegroundColor Yellow
Copy-Item "$APP\deploy\emais-backend-servidor.xml" "$SERVICE\emais-backend.xml" -Force

$winsw = "$SERVICE\emais-backend.exe"
if (-not (Test-Path $winsw)) {
    Write-Host "      Baixando WinSW..." -ForegroundColor Gray
    $url = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
    Invoke-WebRequest -Uri $url -OutFile $winsw
}

& $winsw install
& $winsw start

Write-Host "`n=== Instalacao concluida! ===" -ForegroundColor Green
Write-Host "Backend rodando em: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Proximo passo: instalar o Caddy (ver DEPLOY.md)" -ForegroundColor Cyan
