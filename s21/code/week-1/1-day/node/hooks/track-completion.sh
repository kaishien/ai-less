#!/bin/bash
# Hook: stop
# Вызывается при завершении agent loop
# Может автоматически продолжить выполнение отправив followup_message

# Читаем JSON input
input=$(cat)

# Извлекаем данные
status=$(echo "$input" | jq -r '.status // "completed"')
loop_count=$(echo "$input" | jq -r '.loop_count // 0')
conversation_id=$(echo "$input" | jq -r '.conversation_id // "unknown"')

# Логируем завершение
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] Agent stopped: $conversation_id, status: $status, loops: $loop_count" >> /tmp/cursor-completion.log

# Если была ошибка и это первая попытка - можно автоматически повторить
if [ "$status" = "error" ] && [ "$loop_count" -lt 2 ]; then
  cat << EOF
{
  "followup_message": "Попробуй исправить ошибку и продолжить выполнение задачи."
}
EOF
  exit 0
fi

# Если всё успешно - не продолжаем
cat << EOF
{}
EOF

exit 0
