#!/bin/bash
# Hook: afterAgentResponse
# Вызывается после каждого ответа агента
# Используется для аудита и аналитики

# Читаем JSON input
input=$(cat)

# Извлекаем текст ответа
response_text=$(echo "$input" | jq -r '.text // ""')
conversation_id=$(echo "$input" | jq -r '.conversation_id // "unknown"')

# Подсчитываем длину ответа
response_length=${#response_text}

# Логируем ответ
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] Agent response: $conversation_id, length: $response_length chars" >> /tmp/cursor-responses.log

# Можно добавить проверку на утечку чувствительных данных
if [[ "$response_text" =~ (password|api[_-]key|secret|token)[[:space:]]*[:=][[:space:]]*[\"']?[a-zA-Z0-9]{8,} ]]; then
  echo "[$timestamp] WARNING: Potential secret in response!" >> /tmp/cursor-responses.log
fi

# Hook не требует output для afterAgentResponse
echo "{}"
exit 0
