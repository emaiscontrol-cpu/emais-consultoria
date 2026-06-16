# watchdog_setup.ps1
# Rode UMA VEZ no servidor (como Administrador) para instalar o watchdog.
# O watchdog verifica a cada 2 minutos se o backend está no ar e reinicia se necessário.

$serviceName = "EmaisBackend"
$taskName    = "EmaisBackdog"
$scriptPath  = "C:\emals-service\watchdog.ps1"

# Cria o script de watchdog em C:\emals-service\
$watchdogContent = @'
$svc = Get-Service -Name "EmaisBackend" -ErrorAction SilentlyContinue
if (-not $svc) { exit }

# Verifica se a porta 8000 está respondendo
$tcp = New-Object System.Net.Sockets.TcpClient
try {
    $tcp.Connect("127.0.0.1", 8000)
    $tcp.Close()
    # Porta aberta — tudo bem
} catch {
    # Porta fechada — reinicia o serviço
    Add-Content "C:\emals-service\watchdog.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Backend caído. Reiniciando..."
    try {
        Restart-Service -Name "EmaisBackend" -Force -ErrorAction Stop
        Add-Content "C:\emals-service\watchdog.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Reiniciado com sucesso."
    } catch {
        Add-Content "C:\emals-service\watchdog.log" "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - ERRO ao reiniciar: $_"
    }
}
'@

Set-Content -Path $scriptPath -Value $watchdogContent -Encoding UTF8
Write-Host "Script watchdog criado em $scriptPath" -ForegroundColor Green

# Remove tarefa antiga se existir
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# Cria tarefa agendada — roda a cada 2 minutos, para sempre, como SYSTEM
$action  = New-ScheduledTaskAction -Execute "powershell.exe" `
               -Argument "-NonInteractive -WindowStyle Hidden -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 2) `
               -Once -At (Get-Date)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 1) `
               -MultipleInstances IgnoreNew -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Tarefa agendada '$taskName' criada — verifica a cada 2 minutos." -ForegroundColor Green
Write-Host "Log em: C:\emals-service\watchdog.log" -ForegroundColor Yellow
