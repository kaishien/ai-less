# Cursor Hooks - Руководство

Hooks в Cursor — это исполняемые скрипты (bash/python/typescript), которые автоматически запускаются при определенных событиях в Agent/Composer. Hooks получают JSON через stdin и возвращают JSON через stdout.

## 📋 Что такое Hooks?

Hooks позволяют:
- ✅ Контролировать выполнение команд и операций с файлами
- ✅ Автоматически форматировать код после редактирования
- ✅ Блокировать опасные операции (удаление, shell команды)
- ✅ Вести аудит всех действий AI
- ✅ Добавлять контекст при запуске сессии
- ✅ Автоматически продолжать выполнение при ошибках

## 🎯 Типы событий (Hooks)

### Agent Events (Cmd+K / Agent Chat)

| Hook                      | Когда срабатывает                             | Может блокировать |
|---------------------------|-----------------------------------------------|-------------------|
| `sessionStart`            | При создании новой сессии                     | ✅ Да             |
| `sessionEnd`              | При завершении сессии                         | ❌ Нет            |
| `preToolUse`              | Перед использованием любого инструмента       | ✅ Да             |
| `postToolUse`             | После использования инструмента               | ❌ Нет            |
| `postToolUseFailure`      | При ошибке выполнения инструмента            | ❌ Нет            |
| `beforeShellExecution`    | Перед выполнением shell команды               | ✅ Да             |
| `afterShellExecution`     | После выполнения shell команды                | ❌ Нет            |
| `beforeMCPExecution`      | Перед выполнением MCP инструмента             | ✅ Да             |
| `afterMCPExecution`       | После выполнения MCP инструмента              | ❌ Нет            |
| `beforeReadFile`          | Перед чтением файла                           | ✅ Да             |
| `afterFileEdit`           | После редактирования файла                    | ❌ Нет            |
| `beforeSubmitPrompt`      | Перед отправкой промпта                       | ✅ Да             |
| `stop`                    | При завершении agent loop                     | ❌ Нет            |
| `subagentStart`           | Перед запуском субагента (Task tool)          | ✅ Да             |
| `subagentStop`            | После завершения субагента                    | ❌ Нет            |
| `preCompact`              | Перед сжатием контекста                       | ❌ Нет            |
| `afterAgentResponse`      | После ответа агента                           | ❌ Нет            |
| `afterAgentThought`       | После блока мышления агента                   | ❌ Нет            |

### Tab Events (inline completions)

| Hook                  | Когда срабатывает                   | Может блокировать |
|-----------------------|-------------------------------------|-------------------|
| `beforeTabFileRead`   | Перед чтением файла для Tab         | ✅ Да             |
| `afterTabFileEdit`    | После редактирования файла через Tab| ❌ Нет            |

## 🚀 Быстрый старт

### 1. Создай структуру для Project Hooks

**Linux/Mac:**
```bash
mkdir -p .cursor/hooks
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Path .cursor\hooks -Force
```

### 2. Создай файл конфигурации

Скопируй `hooks.json` из этой папки в `.cursor/hooks.json` проекта:

**Linux/Mac:**
```bash
cp forCursor/hooks/hooks.json <your-project>/.cursor/hooks.json
```

**Windows:**
```powershell
Copy-Item forCursor\hooks\hooks.json <your-project>\.cursor\hooks.json
```

### 3. Скопируй скрипты хуков

**Linux/Mac:**
```bash
cp forCursor/hooks/*.sh <your-project>/.cursor/hooks/
chmod +x <your-project>/.cursor/hooks/*.sh
```

**Windows (используй .ps1 или .bat):**
```powershell
Copy-Item forCursor\hooks\*.ps1 <your-project>\.cursor\hooks\
# Или используй Node.js для кросс-платформенности
```

**Рекомендация для Windows:** Используй PowerShell скрипты (.ps1) или Node.js для лучшей поддержки JSON парсинга.

### 4. Обнови пути в hooks.json (Windows)

Для Windows измени расширения в `hooks.json`:
```json
{
  "hooks": {
    "beforeShellExecution": [
      {
        "command": ".cursor/hooks/approve-shell.ps1"
      }
    ]
  }
}
```

### 5. Перезапусти Cursor

Hooks загрузятся автоматически при следующем запуске Cursor.

## 📁 Структура файлов

**Linux/Mac:**
```
.cursor/
├── hooks.json              # Конфигурация hooks
└── hooks/
    ├── session-start.sh       # Инициализация сессии
    ├── format-file.sh         # Автоформатирование после редактирования
    ├── approve-shell.sh       # Контроль shell команд
    ├── audit-mcp.sh           # Аудит MCP инструментов
    ├── track-completion.sh    # Отслеживание завершения
    ├── validate-tool.sh       # Валидация инструментов
    └── audit-response.sh      # Аудит ответов агента
```

**Windows:**
```
.cursor\
├── hooks.json              # Конфигурация hooks
└── hooks\
    ├── approve-shell.ps1      # PowerShell скрипт
    ├── approve-shell.bat      # Batch скрипт (базовый)
    └── ...                    # Или используй Node.js (.js)
```

**Кросс-платформенный вариант (рекомендуется):**
```
.cursor/
├── hooks.json
└── hooks/
    └── *.js                   # Node.js скрипты (работают везде)
```

## 🔧 Примеры использования

### Пример 1: sessionStart - Инициализация окружения

```bash
#!/bin/bash
# session-start.sh

input=$(cat)

# Возвращаем переменные окружения и контекст
cat << EOF
{
  "env": {
    "PROJECT_NAME": "MyProject",
    "CODE_STYLE": "typescript-strict"
  },
  "additional_context": "Используй TypeScript strict mode. Избегай 'any'.",
  "continue": true
}
EOF

exit 0
```

**Результат:** AI получит дополнительный контекст и будет писать код по строгим правилам TypeScript.

---

### Пример 2: afterFileEdit - Автоформатирование

```bash
#!/bin/bash
# format-file.sh

input=$(cat)
file_path=$(echo "$input" | jq -r '.file_path')

# Запускаем prettier для форматирования
if [[ "$file_path" == *.ts ]] || [[ "$file_path" == *.js ]]; then
  prettier --write "$file_path" 2>/dev/null
fi

echo "{}"
exit 0
```

**Результат:** После каждого редактирования AI код автоматически форматируется prettier.

---

### Пример 3: beforeShellExecution - Блокировка опасных команд

```bash
#!/bin/bash
# approve-shell.sh

input=$(cat)
command=$(echo "$input" | jq -r '.command')

# Блокируем опасные команды
if [[ "$command" == *"rm -rf /"* ]]; then
  cat << EOF
{
  "permission": "deny",
  "user_message": "⛔ Команда заблокирована: опасная операция",
  "agent_message": "Команда содержит опасный паттерн и была заблокирована."
}
EOF
  exit 0
fi

# Требуем подтверждение для npm install
if [[ "$command" == *"npm install"* ]]; then
  cat << EOF
{
  "permission": "ask",
  "user_message": "⚠️ Подтвердите: $command",
  "agent_message": "Команда изменяет зависимости. Требуется подтверждение."
}
EOF
  exit 0
fi

# Разрешаем остальное
cat << EOF
{
  "permission": "allow"
}
EOF

exit 0
```

**Результат:** 
- `rm -rf /` → заблокировано
- `npm install` → требует подтверждения
- `ls`, `cat` → разрешено автоматически

---

### Пример 4: stop - Автоматический retry при ошибке

```bash
#!/bin/bash
# track-completion.sh

input=$(cat)
status=$(echo "$input" | jq -r '.status')
loop_count=$(echo "$input" | jq -r '.loop_count')

# Если ошибка и это первая попытка - повторяем
if [ "$status" = "error" ] && [ "$loop_count" -lt 2 ]; then
  cat << EOF
{
  "followup_message": "Исправь ошибку и продолжи выполнение."
}
EOF
  exit 0
fi

echo "{}"
exit 0
```

**Результат:** При ошибке AI автоматически получает сообщение и пытается исправить проблему (до 2 раз).

---

### Пример 5: preToolUse - Защита критических файлов

```bash
#!/bin/bash
# validate-tool.sh

input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')
tool_input=$(echo "$input" | jq -r '.tool_input')

# Блокируем удаление package.json
if [ "$tool_name" = "Delete" ]; then
  file_path=$(echo "$tool_input" | jq -r '.path')
  if [[ "$file_path" == *"package.json" ]]; then
    cat << EOF
{
  "decision": "deny",
  "reason": "Удаление package.json запрещено."
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
```

**Результат:** AI не сможет удалить `package.json` даже если попытается.

## 🎛️ Конфигурация hooks.json

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [
      {
        "command": ".cursor/hooks/format-file.sh"
      }
    ],
    "beforeShellExecution": [
      {
        "command": ".cursor/hooks/approve-shell.sh",
        "timeout": 30
      }
    ],
    "preToolUse": [
      {
        "command": ".cursor/hooks/validate-tool.sh",
        "matcher": "Shell|Write|Delete"
      }
    ]
  }
}
```

### Параметры hook

| Параметр     | Тип    | Описание                                                    |
|--------------|--------|-------------------------------------------------------------|
| `command`    | string | Путь к скрипту (относительно project root)                  |
| `timeout`    | number | Таймаут выполнения в секундах (по умолчанию 30)             |
| `matcher`    | string | Regex паттерн для фильтрации (для preToolUse, subagentStart)|
| `loop_limit` | number | Лимит автоматических повторений (для stop hook)             |

## 📍 Размещение hooks

### Project Hooks (рекомендуется)
```
<project>/.cursor/
├── hooks.json
└── hooks/
    └── *.sh
```

**Плюсы:**
- ✅ Версионируются в git
- ✅ Работают для всей команды
- ✅ Специфичны для проекта

**Пути в hooks.json:** `.cursor/hooks/script.sh` (от корня проекта)

---

### User Hooks (глобальные)
```
~/.cursor/
├── hooks.json
└── hooks/
    └── *.sh
```

**Плюсы:**
- ✅ Работают во всех проектах
- ✅ Личные настройки

**Пути в hooks.json:** `./hooks/script.sh` или `hooks/script.sh`

---

### Enterprise Hooks (системные)
- **macOS:** `/Library/Application Support/Cursor/hooks.json`
- **Linux:** `/etc/cursor/hooks.json`
- **Windows:** `C:\\ProgramData\\Cursor\\hooks.json`

## 🔒 Fail-safe поведение

### Fail-closed (блокирует при ошибке)
- `beforeMCPExecution`
- `beforeReadFile`

Если скрипт упадет → операция будет заблокирована.

### Fail-open (разрешает при ошибке)
- `beforeShellExecution`
- Все остальные hooks

Если скрипт упадет → операция будет выполнена.

### Exit коды

| Код | Значение                                 |
|-----|------------------------------------------|
| `0` | Успех, использовать JSON output          |
| `2` | Заблокировать операцию (deny)            |
| другие | Ошибка скрипта, fail-open/closed |

## 🌍 Переменные окружения

Hooks получают следующие переменные:

| Переменная           | Описание                          |
|----------------------|-----------------------------------|
| `CURSOR_PROJECT_DIR` | Корневая директория проекта       |
| `CURSOR_VERSION`     | Версия Cursor                     |
| `CURSOR_USER_EMAIL`  | Email пользователя (если залогинен)|
| `CURSOR_CODE_REMOTE` | Путь для remote workspace         |

## 🧪 Тестирование hooks

### Ручное тестирование

```bash
# Создай test input
echo '{"command": "ls -la", "cwd": "/home/user"}' | .cursor/hooks/approve-shell.sh

# Ожидаемый output:
# {"permission": "allow"}
```

### Проверка JSON валидности

```bash
# Проверь что hook возвращает валидный JSON
echo '{}' | .cursor/hooks/format-file.sh | jq .
```

### Проверка exit кода

```bash
echo '{"command": "rm -rf /"}' | .cursor/hooks/approve-shell.sh
echo "Exit code: $?"  # Должен быть 0 или 2
```

## 🐛 Отладка

### 1. Проверь загрузку hooks

В Cursor: **Settings → Hooks** — покажет загруженные hooks.

### 2. Проверь логи

```bash
# Project hooks логи
cat /tmp/cursor-*.log

# Системные логи Cursor
# Help → Toggle Developer Tools → Console
```

### 3. Проверь права на выполнение

```bash
ls -la .cursor/hooks/*.sh
# Должно быть: -rwxr-xr-x

# Если нет:
chmod +x .cursor/hooks/*.sh
```

### 4. Проверь пути

Project hooks используют пути относительно **корня проекта**:
- ✅ `.cursor/hooks/script.sh` (Linux/Mac)
- ✅ `.cursor/hooks/script.ps1` (Windows)
- ✅ `.cursor/hooks/script.js` (Node.js, кросс-платформенно)
- ❌ `./hooks/script.sh` (неправильно)

### 5. Windows особенности

На Windows:
- Используй PowerShell (.ps1) для полной функциональности
- Batch (.bat) ограничен в работе с JSON
- **Рекомендуется Node.js** для кросс-платформенности
- Cursor поддерживает все типы скриптов

## 📚 Дополнительные примеры

### Node.js hook (кросс-платформенный, рекомендуется)

```json
{
  "hooks": {
    "beforeShellExecution": [
      {
        "command": "node .cursor/hooks/approve-shell.js"
      }
    ],
    "afterFileEdit": [
      {
        "command": "node .cursor/hooks/format-file.js"
      }
    ]
  }
}
```

```javascript
#!/usr/bin/env node
// approve-shell.js

let inputData = '';
process.stdin.on('data', chunk => inputData += chunk);

process.stdin.on('end', () => {
  const input = JSON.parse(inputData);
  const command = input.command || '';
  
  // Блокируем опасные команды
  if (command.includes('rm -rf /')) {
    console.log(JSON.stringify({
      permission: 'deny',
      user_message: '⛔ Опасная команда заблокирована'
    }));
    process.exit(0);
  }
  
  // Разрешаем остальное
  console.log(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
});
```

**Преимущества Node.js:**
- ✅ Работает на Windows, Linux, Mac
- ✅ Встроенная поддержка JSON
- ✅ Доступ к npm пакетам
- ✅ Async/await для сложной логики

---

### Python hook для сложной логики

```json
{
  "hooks": {
    "beforeShellExecution": [
      {
        "command": "python3 .cursor/hooks/validate_k8s.py"
      }
    ]
  }
}
```

```python
#!/usr/bin/env python3
import json
import sys

# Читаем input
payload = json.load(sys.stdin)
command = payload.get("command", "")

# Логика проверки
if "kubectl delete" in command and "prod" in command:
    result = {
        "permission": "deny",
        "user_message": "❌ Удаление в prod запрещено"
    }
else:
    result = {"permission": "allow"}

# Выводим result
print(json.dumps(result))
sys.exit(0)
```

### TypeScript hook с Bun

```json
{
  "hooks": {
    "stop": [
      {
        "command": "bun run .cursor/hooks/track-stop.ts"
      }
    ]
  }
}
```

```typescript
import { stdin } from 'bun';

type StopInput = {
  status: 'completed' | 'error' | 'aborted';
  loop_count: number;
  conversation_id: string;
};

// Читаем input
const input: StopInput = await stdin.json();

// Логируем
console.error(`[${new Date().toISOString()}] Stop: ${input.status}`);

// Возвращаем output
const output = {
  followup_message: input.status === 'error' ? 'Попробуй еще раз' : undefined
};

console.log(JSON.stringify(output));
```

## 🎓 Лучшие практики

1. **Всегда проверяй JSON валидность** — используй `jq` для валидации output
2. **Логируй в файл, не в stdout** — stdout зарезервирован для JSON ответа
3. **Используй `2>/dev/null`** — подавляй stderr от внешних команд
4. **Возвращай `{}` если output не нужен** — пустой JSON валиден
5. **Используй exit 0** — всегда, даже при deny/блокировке
6. **Тестируй локально** — перед добавлением в проект
7. **Версионируй hooks** — commit в git для всей команды

## 🔗 Полезные ссылки

- [Официальная документация Cursor Hooks](https://cursor.com/docs/agent/hooks)
- [Примеры от партнеров](https://cursor.com/blog/hooks-partners)
- [JSON валидатор](https://jqplay.org/)
