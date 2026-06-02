#!/bin/bash
# Hook: afterFileEdit
# Автоматически форматирует файл после редактирования AI

# Читаем JSON input
input=$(cat)

# Извлекаем путь к файлу
file_path=$(echo "$input" | jq -r '.file_path // ""')

if [ -z "$file_path" ]; then
  echo "{}" 
  exit 0
fi

# Логируем редактирование
echo "[$(date '+%Y-%m-%d %H:%M:%S')] File edited: $file_path" >> /tmp/cursor-edits.log

# Определяем расширение файла
ext="${file_path##*.}"

# Запускаем соответствующий форматтер
case "$ext" in
  js|jsx|ts|tsx|json|css|md)
    # Prettier для JS/TS/JSON/CSS/MD
    if command -v prettier &> /dev/null; then
      prettier --write "$file_path" 2>/dev/null
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Formatted with prettier: $file_path" >> /tmp/cursor-edits.log
    fi
    ;;
  py)
    # Black для Python
    if command -v black &> /dev/null; then
      black "$file_path" 2>/dev/null
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Formatted with black: $file_path" >> /tmp/cursor-edits.log
    fi
    ;;
  go)
    # gofmt для Go
    if command -v gofmt &> /dev/null; then
      gofmt -w "$file_path" 2>/dev/null
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] Formatted with gofmt: $file_path" >> /tmp/cursor-edits.log
    fi
    ;;
esac

# Возвращаем пустой JSON (форматтер не требует output)
echo "{}"
exit 0
