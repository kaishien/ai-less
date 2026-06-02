#!/bin/bash
# Hook: beforeMCPExecution
# Аудит выполнения MCP инструментов

# Читаем JSON input
input=$(cat)

# Извлекаем данные
tool_name=$(echo "$input" | jq -r '.tool_name // "unknown"')
tool_input=$(echo "$input" | jq -r '.tool_input // "{}"')

# Логируем использование MCP
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] MCP Tool: $tool_name" >> /tmp/cursor-mcp-audit.log
echo "[$timestamp] Input: $tool_input" >> /tmp/cursor-mcp-audit.log

# Проверка на чувствительные операции
if [[ "$tool_name" == *"write"* ]] || [[ "$tool_name" == *"delete"* ]]; then
  cat << EOF
{
  "permission": "ask",
  "user_message": "⚠️ MCP инструмент '$tool_name' требует подтверждения",
  "agent_message": "MCP инструмент '$tool_name' выполняет операцию записи/удаления. Требуется подтверждение."
}
EOF
  exit 0
fi

# Разрешаем read-only операции
cat << EOF
{
  "permission": "allow"
}
EOF

exit 0
