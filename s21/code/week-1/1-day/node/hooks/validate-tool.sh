#!/bin/bash
# Hook: preToolUse
# Вызывается перед использованием любого инструмента
# Matcher: "Shell|Write|Delete" - срабатывает только для этих инструментов

# Читаем JSON input
input=$(cat)

# Извлекаем данные
tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')
tool_input=$(echo "$input" | jq -r '.tool_input // "{}"')
cwd=$(echo "$input" | jq -r '.cwd // ""')

# Логируем использование инструмента
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] Tool use: $tool_name in $cwd" >> /tmp/cursor-tools.log

# Специальная проверка для Delete инструмента
if [ "$tool_name" = "Delete" ]; then
  file_path=$(echo "$tool_input" | jq -r '.path // ""')
  
  # Проверяем критические файлы
  critical_files=(
    "package.json"
    "tsconfig.json"
    ".env"
    "README.md"
  )
  
  basename=$(basename "$file_path")
  for critical in "${critical_files[@]}"; do
    if [ "$basename" = "$critical" ]; then
      cat << EOF
{
  "decision": "deny",
  "reason": "Удаление критического файла '$basename' заблокировано хуком безопасности."
}
EOF
      exit 0
    fi
  done
fi

# Специальная проверка для Write инструмента
if [ "$tool_name" = "Write" ]; then
  file_path=$(echo "$tool_input" | jq -r '.path // ""')
  
  # Блокируем запись в системные директории
  if [[ "$file_path" == /etc/* ]] || [[ "$file_path" == /sys/* ]]; then
    cat << EOF
{
  "decision": "deny",
  "reason": "Запись в системные директории запрещена."
}
EOF
    exit 0
  fi
fi

# Разрешаем использование инструмента
cat << EOF
{
  "decision": "allow"
}
EOF

exit 0
