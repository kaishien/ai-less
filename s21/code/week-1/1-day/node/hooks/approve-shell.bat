@echo off
REM Hook: beforeShellExecution для Windows
REM Контролирует выполнение shell команд

REM Читаем JSON input (простой пример для Windows)
set /p input=

REM В продакшене используй PowerShell или Node.js для парсинга JSON
REM Этот пример просто разрешает все команды

echo {"permission": "allow"}
exit /b 0
