# Hook: beforeShellExecution для Windows PowerShell
# Контролирует выполнение shell команд

# Читаем JSON input из stdin
$input = [Console]::In.ReadToEnd()
$data = $input | ConvertFrom-Json

# Извлекаем команду
$command = $data.command

# Логируем
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Add-Content -Path "$env:TEMP\cursor-shell.log" -Value "[$timestamp] Command: $command"

# Опасные паттерны
$dangerous = @(
    "rm -rf /",
    "Remove-Item -Recurse -Force C:\",
    "Format-Volume",
    "Clear-Disk"
)

# Проверка на опасные команды
foreach ($pattern in $dangerous) {
    if ($command -like "*$pattern*") {
        $response = @{
            permission = "deny"
            user_message = "⛔ Команда заблокирована: опасная операция"
            agent_message = "Команда содержит опасный паттерн и была заблокирована."
        } | ConvertTo-Json -Compress
        
        Write-Output $response
        exit 0
    }
}

# Команды требующие подтверждения
$confirm = @("npm install", "pip install")

foreach ($pattern in $confirm) {
    if ($command -like "*$pattern*") {
        $response = @{
            permission = "ask"
            user_message = "⚠️ Подтвердите: $command"
        } | ConvertTo-Json -Compress
        
        Write-Output $response
        exit 0
    }
}

# Разрешаем остальное
Write-Output '{"permission": "allow"}'
exit 0
