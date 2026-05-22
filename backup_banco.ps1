# Backup diário do banco de dados — E Mais Consultoria
# Salva cópia com data/hora em C:\emals-backups\ e mantém últimos 30 dias

$DB_SOURCE = "C:\emals-app\backend\emais_consultoria.db"
$BACKUP_DIR = "C:\emals-backups"
$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm"
$DEST = "$BACKUP_DIR\emais_consultoria_$DATE.db"

# Criar pasta se não existir
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

# Copiar banco
Copy-Item $DB_SOURCE $DEST
Write-Host "Backup salvo: $DEST"

# Remover backups com mais de 30 dias
Get-ChildItem $BACKUP_DIR -Filter "*.db" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force
Write-Host "Limpeza de backups antigos concluída."
