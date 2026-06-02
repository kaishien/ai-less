#!/bin/bash
# Hook: sessionStart
# Вызывается при создании новой сессии Agent/Composer
# Используется для инициализации окружения и добавления контекста

# Читаем JSON input из stdin
input=$(cat)

# Извлекаем данные из input
session_id=$(echo "$input" | jq -r '.session_id // "unknown"')
composer_mode=$(echo "$input" | jq -r '.composer_mode // "agent"')

# Логируем начало сессии
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Session started: $session_id (mode: $composer_mode)" >> /tmp/cursor-sessions.log

# Возвращаем JSON output с дополнительным контекстом и переменными окружения
cat << EOF
{
  "env": {
    "PROJECT_NAME": "Training-AI",
    "CODE_STYLE": "typescript-strict"
  },
  "additional_context": "Проект использует TypeScript в strict mode. Все функции должны быть типизированы. Избегай использования 'any'.",
  "continue": true
}
EOF

exit 0
