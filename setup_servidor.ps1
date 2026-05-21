# ============================================================
# E Mais Consultoria — Script de Implantação no Servidor
# Execute como Administrador no Windows Server
# ============================================================
# Uso:
#   cd C:\
#   Set-ExecutionPolicy Bypass -Scope Process -Force
#   .\setup_servidor.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$REPO_URL    = "https://github.com/emaiscontrol-cpu/emais-consultoria.git"
$APP_DIR     = "C:\emals-app"
$SVC_DIR     = "C:\emals-service"
$PYTHON_URL  = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
$WINSW_URL   = "https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe"
$PORT        = 8000

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  E Mais Consultoria — Setup Servidor" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ── 1. Verificar / instalar Python ────────────────────────────────────────────
Write-Host "[1/7] Verificando Python..." -ForegroundColor Yellow
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) {
    Write-Host "     Python não encontrado. Baixando instalador..." -ForegroundColor Yellow
    $pyInstaller = "$env:TEMP\python-installer.exe"
    Invoke-WebRequest -Uri $PYTHON_URL -OutFile $pyInstaller
    Start-Process -FilePath $pyInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_pip=1" -Wait
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "     Python instalado." -ForegroundColor Green
} else {
    Write-Host "     Python encontrado: $($py.Source)" -ForegroundColor Green
}

# ── 2. Clonar ou atualizar repositório ────────────────────────────────────────
Write-Host "[2/7] Clonando repositório..." -ForegroundColor Yellow
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host "     ERRO: Git não encontrado. Instale o Git para Windows e execute novamente." -ForegroundColor Red
    Write-Host "     Download: https://git-scm.com/download/win" -ForegroundColor Red
    exit 1
}
if (Test-Path "$APP_DIR\.git") {
    Write-Host "     Repositório já existe — atualizando..." -ForegroundColor Yellow
    Set-Location $APP_DIR
    git pull origin main
} else {
    git clone $REPO_URL $APP_DIR
    Set-Location $APP_DIR
}
Write-Host "     Repositório pronto em $APP_DIR" -ForegroundColor Green

# ── 3. Criar venv e instalar dependências ─────────────────────────────────────
Write-Host "[3/7] Configurando ambiente Python..." -ForegroundColor Yellow
$backendDir = "$APP_DIR\backend"
Set-Location $backendDir
if (-not (Test-Path "$backendDir\venv")) {
    python -m venv venv
}
& "$backendDir\venv\Scripts\pip.exe" install -r requirements.txt --quiet
Write-Host "     Dependências instaladas." -ForegroundColor Green

# ── 4. Criar arquivo .env ──────────────────────────────────────────────────────
Write-Host "[4/7] Configurando .env..." -ForegroundColor Yellow
$envFile = "$backendDir\.env"
if (-not (Test-Path $envFile)) {
    $secret = [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    @"
SECRET_KEY=$secret
DATABASE_URL=sqlite:///./emais_consultoria.db
"@ | Out-File -FilePath $envFile -Encoding utf8
    Write-Host "     .env criado com SECRET_KEY gerada aleatoriamente." -ForegroundColor Green
} else {
    Write-Host "     .env já existe — mantido." -ForegroundColor Green
}

# ── 5. Criar diretório do serviço WinSW ───────────────────────────────────────
Write-Host "[5/7] Configurando serviço WinSW..." -ForegroundColor Yellow
if (-not (Test-Path $SVC_DIR)) { New-Item -ItemType Directory -Path $SVC_DIR | Out-Null }
if (-not (Test-Path "$SVC_DIR\logs")) { New-Item -ItemType Directory -Path "$SVC_DIR\logs" | Out-Null }

# Baixar WinSW se necessário
if (-not (Test-Path "$SVC_DIR\emals-backend.exe")) {
    Write-Host "     Baixando WinSW..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $WINSW_URL -OutFile "$SVC_DIR\emals-backend.exe"
}

# Criar XML do serviço
$pythonExe = "$backendDir\venv\Scripts\python.exe"
@"
<service>
  <id>EmaisBackend</id>
  <name>E Mais Consultoria — Backend</name>
  <description>API FastAPI do sistema E Mais Consultoria</description>
  <executable>$pythonExe</executable>
  <arguments>-m uvicorn main:app --host 0.0.0.0 --port $PORT</arguments>
  <workingdirectory>$backendDir</workingdirectory>
  <startmode>Automatic</startmode>
  <logmode>rotate</logmode>
  <log>
    <logpath>$SVC_DIR\logs</logpath>
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>
  <onfailure action="restart" delay="10 sec"/>
  <onfailure action="restart" delay="20 sec"/>
  <onfailure action="restart" delay="30 sec"/>
</service>
"@ | Out-File -FilePath "$SVC_DIR\emals-backend.xml" -Encoding utf8
Write-Host "     XML do serviço criado." -ForegroundColor Green

# ── 6. Instalar e iniciar serviço ─────────────────────────────────────────────
Write-Host "[6/7] Instalando e iniciando serviço..." -ForegroundColor Yellow
Set-Location $SVC_DIR

# Remove serviço anterior se existir
$existing = Get-Service -Name "EmaisBackend" -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "     Serviço já existe — parando e reinstalando..." -ForegroundColor Yellow
    .\emals-backend.exe stop 2>$null
    Start-Sleep -Seconds 2
    .\emals-backend.exe uninstall 2>$null
    Start-Sleep -Seconds 1
}
.\emals-backend.exe install
Start-Sleep -Seconds 2
.\emals-backend.exe start
Start-Sleep -Seconds 3
$status = .\emals-backend.exe status
Write-Host "     Status do serviço: $status" -ForegroundColor Green

# ── 7. Liberar porta no Firewall ─────────────────────────────────────────────
Write-Host "[7/7] Configurando Firewall..." -ForegroundColor Yellow
$rule = Get-NetFirewallRule -DisplayName "E Mais Consultoria HTTP" -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName "E Mais Consultoria HTTP" `
        -Direction Inbound -Protocol TCP -LocalPort $PORT `
        -Action Allow -Profile Any | Out-Null
    Write-Host "     Regra de firewall criada para porta $PORT." -ForegroundColor Green
} else {
    Write-Host "     Regra de firewall já existe." -ForegroundColor Green
}

# ── Resultado final ────────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Implantação concluída!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.*" } | Select-Object -First 1).IPAddress
Write-Host "  Acesso interno:  http://$ip`:$PORT" -ForegroundColor White
Write-Host "  Logs do serviço: $SVC_DIR\logs\" -ForegroundColor White
Write-Host "`n  Para acesso externo, configure port forwarding:" -ForegroundColor Yellow
Write-Host "  Porta externa (ex: 8000) --> $ip`:$PORT" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan
