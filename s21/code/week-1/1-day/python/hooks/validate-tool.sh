#!/bin/bash
# Hook: preToolUse
# Matcher: "Shell|Write|Delete"

input=$(cat)

tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')
tool_input=$(echo "$input" | jq -r '.tool_input // "{}"')
cwd=$(echo "$input" | jq -r '.cwd // ""')

timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] Tool use: $tool_name in $cwd" >> /tmp/cursor-tools.log

# Блокируем удаление критических Python файлов
if [ "$tool_name" = "Delete" ]; then
  file_path=$(echo "$tool_input" | jq -r '.path // ""')
  basename=$(basename "$file_path")

  critical_files=(
    "pyproject.toml"
    "requirements.txt"
    "requirements-dev.txt"
    "setup.py"
    "setup.cfg"
    "alembic.ini"
    ".env"
    "README.md"
    "Dockerfile"
  )

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

# Блокируем запись в системные директории
if [ "$tool_name" = "Write" ]; then
  file_path=$(echo "$tool_input" | jq -r '.path // ""')

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

cat << EOF
{
  "decision": "allow"
}
EOF

exit 0
