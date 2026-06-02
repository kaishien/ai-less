#!/bin/bash
# Hook: beforeShellExecution
# Контролирует выполнение shell команд, блокирует опасные операции

# Читаем JSON input
input=$(cat)

# Извлекаем команду
command=$(echo "$input" | jq -r '.command // ""')

# Логируем попытку выполнения
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Shell command requested: $command" >> /tmp/cursor-shell.log

# Список опасных паттернов
dangerous_patterns=(
  "rm -rf /"
  "dd if="
  "> /dev/sda"
  "mkfs"
  "format"
  ":(){:|:&};:"  # fork bomb
)

# Проверка на опасные команды
for pattern in "${dangerous_patterns[@]}"; do
  if [[ "$command" == *"$pattern"* ]]; then
    cat << EOF
{
  "permission": "deny",
  "user_message": "⛔ Команда заблокирована: потенциально опасная операция",
  "agent_message": "Команда '$command' содержит опасный паттерн '$pattern' и была заблокирована хуком безопасности."
}
EOF
    exit 0
  fi
done

# Команды требующие подтверждения
confirm_patterns=(
  "npm install"
  "pip install"
  "apt-get install"
  "brew install"
  "git push"
  "docker run"
)

for pattern in "${confirm_patterns[@]}"; do
  if [[ "$command" == *"$pattern"* ]]; then
    cat << EOF
{
  "permission": "ask",
  "user_message": "⚠️ Команда требует подтверждения: $command",
  "agent_message": "Команда '$command' изменяет систему или зависимости. Требуется подтверждение пользователя."
}
EOF
    exit 0
  fi
done

# Разрешаем безопасные команды
cat << EOF
{
  "permission": "allow"
}
EOF

exit 0
