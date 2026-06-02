# Hooks для Python проектов

Исполняемые скрипты для автоматизации и контроля действий Cursor AI в Python проекте.

## Файлы

| Файл | Hook | Описание |
|------|------|----------|
| `format-file.py` | `afterFileEdit` | Автоформатирование через `black` (Python) и `prettier` (JS/JSON/MD) |
| `approve-shell.py` | `beforeShellExecution` | Блокирует опасные команды, запрашивает подтверждение для `pip install`, `git push`, `alembic` |
| `session-start.sh` | `sessionStart` | Добавляет контекст: Python 3.12, black+ruff, mypy strict, pytest |
| `validate-tool.sh` | `preToolUse` | Блокирует удаление `pyproject.toml`, `.env`, `alembic.ini` и запись в `/etc/` |
| `track-completion.sh` | `stop` | Логирует завершение агента, повторяет при ошибках |
| `audit-mcp.sh` | `beforeMCPExecution` | Логирует MCP вызовы |
| `audit-response.sh` | `afterAgentResponse` | Логирует ответы агента |

## Подключение

Скопируй нужные файлы в `.cursor/hooks/` своего проекта и подключи `hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [{"command": "python .cursor/hooks/format-file.py"}],
    "beforeShellExecution": [{"command": "python .cursor/hooks/approve-shell.py", "timeout": 30}]
  }
}
```

## Требования

- Python 3.7+ (для `format-file.py` и `approve-shell.py`)
- `black` (`pip install black`) — для авто-форматирования Python
- `jq` — для shell hooks
