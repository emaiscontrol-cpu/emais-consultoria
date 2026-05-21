Set-ExecutionPolicy Bypass -Scope Process -Force

$APP_DIR  = 'C:\emals-app'
$SVC_DIR  = 'C:\emals-service'
$PORT     = 8000

Write-Host '=== E Mais Consultoria - Setup ===' -ForegroundColor Cyan

# 1. Clonar ou atualizar repo
Write-Host '[1/6] Repositorio...' -ForegroundColor Yellow
if (Test-Path "$APP_DIR\.git") {
    Set-Location $APP_DIR
    git pull origin main
} else {
    git clone 'https://github.com/emaiscontrol-cpu/emais-consultoria.git' $APP_DIR
    Set-Location $APP_DIR
}

# 2. Venv e dependencias
Write-Host '[2/6] Ambiente Python...' -ForegroundColor Yellow
$backendDir = "$APP_DIR\backend"
Set-Location $backendDir
if (-not (Test-Path "$backendDir\venv")) {
    python -m venv venv
}
& "$backendDir\venv\Scripts\pip.exe" install -r requirements.txt --quiet
Write-Host '     OK' -ForegroundColor Green

# 3. Arquivo .env
Write-Host '[3/6] Configurando .env...' -ForegroundColor Yellow
$envFile = "$backendDir\.env"
if (-not (Test-Path $envFile)) {
    $secret = [System.Convert]::ToBase64String([byte[]] (1..32 | ForEach-Object { Get-Random -Maximum 256 }))
    "SECRET_KEY=$secret`nDATABASE_URL=sqlite:///./emais_consultoria.db" | Out-File $envFile -Encoding ascii
    Write-Host '     .env criado' -ForegroundColor Green
} else {
    Write-Host '     .env ja existe' -ForegroundColor Green
}

# 4. Diretorio do servico
Write-Host '[4/6] Servico WinSW...' -ForegroundColor Yellow
if (-not (Test-Path $SVC_DIR))        { New-Item -ItemType Directory -Path $SVC_DIR | Out-Null }
if (-not (Test-Path "$SVC_DIR\logs")) { New-Item -ItemType Directory -Path "$SVC_DIR\logs" | Out-Null }

if (-not (Test-Path "$SVC_DIR\emals-backend.exe")) {
    $winsw = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe'
    Invoke-WebRequest -Uri $winsw -OutFile "$SVC_DIR\emals-backend.exe"
}

$pythonExe = "$backendDir\venv\Scripts\python.exe"
$xml = "<service><id>EmaisBackend</id><name>E Mais Consultoria Backend</name><executable>$pythonExe</executable><arguments>-m uvicorn main:app --host 0.0.0.0 --port $PORT</arguments><workingdirectory>$backendDir</workingdirectory><startmode>Automatic</startmode><logmode>rotate</logmode><log><logpath>$SVC_DIR\logs</logpath><keepFiles>5</keepFiles></log><onfailure action='restart' delay='10 sec'/></service>"
$xml | Out-File "$SVC_DIR\emals-backend.xml" -Encoding utf8

# 5. Instalar e iniciar servico
Write-Host '[5/6] Iniciando servico...' -ForegroundColor Yellow
Set-Location $SVC_DIR
$svc = Get-Service -Name 'EmaisBackend' -ErrorAction SilentlyContinue
if ($svc) {
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
Write-Host "     Status: $status" -ForegroundColor Green

# 6. Firewall
Write-Host '[6/6] Firewall...' -ForegroundColor Yellow
$rule = Get-NetFirewallRule -DisplayName 'E Mais HTTP' -ErrorAction SilentlyContinue
if (-not $rule) {
    New-NetFirewallRule -DisplayName 'E Mais HTTP' -Direction Inbound -Protocol TCP -LocalPort $PORT -Action Allow -Profile Any | Out-Null
    Write-Host '     Porta 8000 liberada' -ForegroundColor Green
} else {
    Write-Host '     Regra ja existe' -ForegroundColor Green
}

Write-Host ''
Write-Host '=== Implantacao concluida! ===' -ForegroundColor Green
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
Write-Host "Acesso interno: http://$ip`:$PORT" -ForegroundColor White
Write-Host "Configure port forwarding: porta externa --> $ip`:$PORT" -ForegroundColor Yellow
