#!/bin/bash
# Hook: sessionStart
# Инициализация окружения для Python проекта

input=$(cat)

session_id=$(echo "$input" | jq -r '.session_id // "unknown"')
composer_mode=$(echo "$input" | jq -r '.composer_mode // "agent"')

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session started: $session_id (mode: $composer_mode)" >> /tmp/cursor-sessions.log

cat << EOF
{
  "env": {
    "PROJECT_NAME": "Python-Project",
    "CODE_STYLE": "black+ruff"
  },
  "additional_context": "Проект использует Python 3.12 с strict type hints (mypy). Форматирование: black + ruff. Тесты: pytest. Async: httpx + SQLAlchemy async. Всегда добавляй type hints и используй dataclass/Pydantic для структур данных.",
  "continue": true
}
EOF

exit 0
