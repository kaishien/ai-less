# Примеры настроек Cursor AI

Эта папка содержит базовые примеры настройки новых возможностей Cursor AI для повышения эффективности разработки.

## 📁 Структура

```
forCursor/
├── hooks/          # Исполняемые скрипты для контроля AI (bash/python/ts)
├── commands/       # Slash-команды для быстрых задач (/review, /tests)
├── subagents/      # Субагенты (markdown с YAML frontmatter)
├── skills/         # Навыки для решения типовых задач
└── rules/          # Правила и соглашения для кода
```

---

## 🪝 Hooks (Исполняемые скрипты)

Hooks — это исполняемые скрипты (bash/python/typescript), которые автоматически запускаются при определенных событиях в Cursor Agent. Hooks получают JSON через stdin и возвращают JSON через stdout, позволяя контролировать, блокировать или модифицировать действия AI.

### Как работают
1. Событие происходит (например, AI хочет выполнить shell команду)
2. Cursor запускает соответствующий hook скрипт
3. Скрипт получает JSON с данными через stdin
4. Скрипт обрабатывает данные и возвращает JSON через stdout
5. Cursor выполняет действие согласно ответу (allow/deny/ask)

### Типы событий

#### Agent Events (Cmd+K / Agent Chat)

| Hook                      | Когда срабатывает                  | Может блокировать |
|---------------------------|------------------------------------|-------------------|
| `sessionStart`            | При создании новой сессии          | ✅ Да             |
| `sessionEnd`              | При завершении сессии              | ❌ Нет            |
| `beforeShellExecution`    | Перед выполнением shell команды    | ✅ Да             |
| `afterShellExecution`     | После выполнения команды           | ❌ Нет            |
| `beforeMCPExecution`      | Перед выполнением MCP инструмента  | ✅ Да (fail-closed) |
| `afterMCPExecution`       | После выполнения MCP               | ❌ Нет            |
| `beforeReadFile`          | Перед чтением файла                | ✅ Да (fail-closed) |
| `afterFileEdit`           | После редактирования файла         | ❌ Нет            |
| `preToolUse`              | Перед любым инструментом           | ✅ Да             |
| `postToolUse`             | После использования инструмента    | ❌ Нет            |
| `stop`                    | При завершении agent loop          | ❌ Нет            |
| `subagentStart`           | Перед запуском субагента           | ✅ Да             |
| `subagentStop`            | После завершения субагента         | ❌ Нет            |

#### Tab Events (inline completions)

| Hook                  | Когда срабатывает          |
|-----------------------|----------------------------|
| `beforeTabFileRead`   | Перед чтением файла для Tab|
| `afterTabFileEdit`    | После редактирования Tab   |

### Доступные hooks (примеры)

#### `session-start.sh` - Инициализация окружения
```bash
#!/bin/bash
input=$(cat)

# Возвращаем контекст и переменные окружения
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

**Результат:** AI получает дополнительный контекст при старте сессии.

---

#### `format-file.sh` - Автоформатирование
```bash
#!/bin/bash
input=$(cat)
file_path=$(echo "$input" | jq -r '.file_path')

# Форматируем с prettier
if [[ "$file_path" == *.ts ]] || [[ "$file_path" == *.js ]]; then
  prettier --write "$file_path" 2>/dev/null
fi

echo "{}"
exit 0
```

**Результат:** После каждого редактирования код автоматически форматируется.

---

#### `approve-shell.sh` - Контроль shell команд
```bash
#!/bin/bash
input=$(cat)
command=$(echo "$input" | jq -r '.command')

# Блокируем опасные команды
if [[ "$command" == *"rm -rf /"* ]]; then
  cat << EOF
{
  "permission": "deny",
  "user_message": "⛔ Команда заблокирована",
  "agent_message": "Опасная операция запрещена хуком."
}
EOF
  exit 0
fi

# Требуем подтверждение для npm install
if [[ "$command" == *"npm install"* ]]; then
  cat << EOF
{
  "permission": "ask",
  "user_message": "⚠️ Подтвердите: $command"
}
EOF
  exit 0
fi

# Разрешаем безопасные команды
echo '{"permission": "allow"}'
exit 0
```

**Результат:**
- `rm -rf /` → заблокировано автоматически
- `npm install` → требует подтверждения пользователя
- `ls`, `cat` → разрешено

---

#### `track-completion.sh` - Автоматический retry
```bash
#!/bin/bash
input=$(cat)
status=$(echo "$input" | jq -r '.status')
loop_count=$(echo "$input" | jq -r '.loop_count')

# При ошибке и первой попытке - повторяем
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

**Результат:** При ошибке AI автоматически пытается исправить (до 2 раз).

---

#### `validate-tool.sh` - Защита критических файлов
```bash
#!/bin/bash
input=$(cat)
tool_name=$(echo "$input" | jq -r '.tool_name')

# Блокируем удаление package.json
if [ "$tool_name" = "Delete" ]; then
  file_path=$(echo "$input" | jq -r '.tool_input.path')
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

echo '{"decision": "allow"}'
exit 0
```

**Результат:** AI не может удалить критические файлы.

### Конфигурация hooks.json

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "command": ".cursor/hooks/session-start.sh"
      }
    ],
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
    ],
    "stop": [
      {
        "command": ".cursor/hooks/track-completion.sh",
        "loop_limit": 5
      }
    ]
  }
}
```

### Размещение hooks

**Project Hooks (рекомендуется):**
```
<project>/.cursor/
├── hooks.json          # Конфигурация
└── hooks/
    ├── *.sh            # Скрипты
    └── README.md       # Документация
```
- ✅ Версионируются в git
- ✅ Работают для всей команды
- ✅ Специфичны для проекта

**User Hooks (глобальные):**
```
~/.cursor/
├── hooks.json
└── hooks/*.sh
```
- ✅ Работают во всех проектах
- ✅ Личные настройки

### Fail-safe поведение

- **Fail-closed** (блокирует при ошибке): `beforeMCPExecution`, `beforeReadFile`
- **Fail-open** (разрешает при ошибке): остальные hooks

### Exit коды

| Код | Действие                    |
|-----|-----------------------------|
| 0   | Успех, использовать output  |
| 2   | Заблокировать операцию      |
| другие | Ошибка hook            |

📖 **Подробное руководство:** См. `hooks/README.md` для детальной документации и дополнительных примеров.

---

## ⚙️ Commands (Slash-команды для Cursor AI)

Кастомные команды, которые вызываются через `/` в чате Cursor для быстрого выполнения типовых задач.

### Как использовать
В чате Cursor напиши `/` и название команды:
```
/review - детальное code review
/tests - генерация тестов
/docs - создание документации
/optimize - оптимизация производительности
/refactor - рефакторинг кода
/security - проверка безопасности
/debug - поиск и исправление багов
/api - создание API endpoint
/component - создание React компонента
/sql - создание SQL запросов/миграций
```

### Настройка команд в Cursor
1. Открой Cursor Settings (Ctrl+,)
2. Найди раздел "AI" → "Custom Commands"
3. Добавь новую команду с содержимым из файлов в папке `commands/`

Или создай `.cursor/commands/` в корне проекта и помести туда файлы команд.

### Доступные команды

#### `/review` - Code Review
**Что делает:**
- Проверяет безопасность (SQL injection, XSS, CSRF)
- Анализирует производительность
- Оценивает читаемость и структуру
- Находит проблемы с обработкой ошибок
- Проверяет TypeScript типизацию

**Использование:**
```
# Выдели код и напиши:
/review
```

**Результат:** Список проблем с приоритетами (🔴 критично, 🟡 важно, 🟢 рекомендация) и примеры исправлений.

---

#### `/tests` - Генерация тестов
**Что делает:**
- Создает unit тесты
- Покрывает edge cases и граничные условия
- Генерирует негативные тесты
- Настраивает моки для зависимостей

**Использование:**
```
# Выдели функцию/класс и напиши:
/tests
```

**Результат:** Полный набор тестов с описательными названиями и комментариями.

---

#### `/docs` - Документация
**Что делает:**
- Создает JSDoc/PyDoc комментарии
- Генерирует API документацию
- Пишет README секции
- Добавляет inline комментарии для сложной логики

**Использование:**
```
# Выдели код и напиши:
/docs
```

**Результат:** Полная документация с примерами использования.

---

#### `/optimize` - Оптимизация
**Что делает:**
- Улучшает алгоритмическую сложность
- Предлагает оптимальные структуры данных
- Добавляет React оптимизации (useMemo, useCallback)
- Оптимизирует database запросы
- Внедряет кэширование

**Использование:**
```
# Выдели медленный код и напиши:
/optimize
```

**Результат:** Оптимизированный код с объяснением улучшений и замерами производительности.

---

#### `/refactor` - Рефакторинг
**Что делает:**
- Применяет Clean Code принципы
- Устраняет дублирование (DRY)
- Улучшает naming
- Разделяет ответственности
- Внедряет паттерны проектирования

**Использование:**
```
# Выдели запутанный код и напиши:
/refactor
```

**Результат:** Чистый, читаемый код с объяснением каждого изменения.

---

#### `/security` - Security Audit
**Что делает:**
- Ищет injection уязвимости (SQL, XSS, Command)
- Проверяет аутентификацию и авторизацию
- Анализирует работу с секретами
- Проверяет CSRF защиту
- Рекомендует rate limiting

**Использование:**
```
# Выдели код с запросами/auth и напиши:
/security
```

**Результат:** Список уязвимостей с уровнями критичности и исправлениями.

---

#### `/debug` - Отладка
**Что делает:**
- Анализирует stack trace
- Находит root cause проблемы
- Проверяет типичные ошибки
- Предлагает решение с тестом
- Дает рекомендации по профилактике

**Использование:**
```
# Вставь error message и код:
/debug

TypeError: Cannot read property 'name' of undefined
[вставь код]
```

**Результат:** Объяснение бага, исправленный код и тест.

---

#### `/api` - Создание API Endpoint
**Что делает:**
- Создает REST endpoint с валидацией
- Настраивает обработку ошибок
- Добавляет авторизацию и rate limiting
- Генерирует OpenAPI документацию

**Использование:**
```
/api

Создай endpoint для создания пользователя:
POST /api/users
Body: { name, email, password }
```

**Результат:** Полный рабочий endpoint с валидацией и документацией.

---

#### `/component` - React компонент
**Что делает:**
- Создает типизированный React компонент
- Добавляет оптимизацию (memo, useMemo, useCallback)
- Настраивает accessibility
- Обрабатывает loading/error состояния

**Использование:**
```
/component

Создай компонент карточки продукта с:
- изображением
- названием и ценой
- кнопкой "В корзину"
```

**Результат:** Полный компонент с типами, оптимизацией и примером использования.

---

#### `/sql` - SQL запросы/миграции
**Что делает:**
- Создает оптимизированные SQL запросы
- Генерирует миграции с индексами
- Настраивает триггеры
- Добавляет транзакции
- Проверяет план выполнения (EXPLAIN)

**Использование:**
```
/sql

Создай таблицу orders с связью на users
и миграцию для добавления индексов
```

**Результат:** SQL код с индексами, триггерами и примерами использования из приложения.

---

## 🤖 Subagents (Специализированные субагенты)

Субагенты — это специализированные AI-ассистенты, которым основной Agent может делегировать задачи. Каждый субагент работает в своем context window и имеет фокусированную экспертизу.

### Формат

Субагенты — это **markdown файлы с YAML frontmatter** в папке `.cursor/agents/`:

```markdown
---
name: code-reviewer
description: Специалист по code review. Используй для проверки безопасности и производительности.
model: fast
readonly: true
---

Ты опытный код-ревьюер...
(Инструкции для субагента)
```

### Размещение

```
.cursor/
└── agents/
    ├── code-reviewer.md      # Ревью кода
    ├── test-generator.md     # Генерация тестов
    ├── doc-writer.md         # Документация
    ├── debugger.md           # Отладка
    └── verifier.md           # Валидация работы
```

### Использование

**Автоматическое делегирование:**
```
"Проверь этот код на безопасность"
→ Agent автоматически делегирует code-reviewer субагенту
```

**Явный вызов (slash-синтаксис):**
```
/code-reviewer проверь UserService.ts на безопасность
/test-generator создай тесты для calculateTotal
/debugger помоги с ошибкой TypeError
```

**Параллельное выполнение:**
```
"Проверь код и создай тесты параллельно"
→ Запустит code-reviewer и test-generator одновременно
```

### Доступные субагенты

#### `code-reviewer.md` - Ревьюер кода
**Специализация:**
- Безопасность (SQL injection, XSS, CSRF)
- Производительность (N+1, неоптимальные циклы)
- Читаемость и поддерживаемость
- TypeScript типизация
- Обработка ошибок

**Вызов:** `/code-reviewer проверь src/api/users.ts`

**Формат отчета:**
- 🔴 КРИТИЧНО - требует немедленного исправления
- 🟡 ВАЖНО - исправить в ближайшее время
- 🟢 РЕКОМЕНДАЦИИ - улучшения
- ✅ ХОРОШО - что сделано правильно

---

#### `test-generator.md` - Генератор тестов
**Специализация:**
- Unit тесты (happy path + edge cases)
- Integration тесты
- Негативные тесты (error handling)
- Моки и стабы для зависимостей
- React Testing Library для компонентов

**Вызов:** `/test-generator создай тесты для calculateTotal`

**Что создает:**
```typescript
describe('calculateTotal', () => {
  it('должен вернуть сумму для валидных данных', () => {
    expect(calculateTotal([{price: 100}])).toBe(100);
  });
  
  it('должен обработать пустой массив', () => {
    expect(calculateTotal([])).toBe(0);
  });
  
  it('должен выбросить ошибку для null', () => {
    expect(() => calculateTotal(null)).toThrow();
  });
});
```

---

#### `doc-writer.md` - Писатель документации
**Специализация:**
- JSDoc/PyDoc комментарии с примерами
- README файлы (установка, использование, API)
- API документация (request/response, errors)
- Архитектурные описания

**Вызов:** `/doc-writer создай API docs для POST /api/users`

**Что создает:**
```typescript
/**
 * Создает нового пользователя в системе
 * 
 * @param name - Полное имя пользователя
 * @param email - Email адрес (должен быть уникальным)
 * @returns Созданный пользователь с ID
 * @throws {ValidationError} Если email невалидный
 * 
 * @example
 * const user = await createUser('John Doe', 'john@example.com');
 * console.log(user.id); // 123
 */
```

---

#### `debugger.md` - Отладчик
**Специализация:**
- Root cause analysis (находит корень проблемы)
- Анализ stack trace
- Проверка типичных ошибок (null access, race conditions)
- Предложение минимального fix
- Регрессионные тесты

**Вызов:** `/debugger помоги с TypeError в UserService`

**Что делает:**
1. Анализирует error message и stack trace
2. Находит root cause (не симптом!)
3. Предлагает fix с объяснением
4. Создает тест для предотвращения регрессии

---

#### `verifier.md` - Валидатор (проактивный)
**Специализация:**
- Независимая проверка выполненной работы
- Запуск тестов для проверки
- Проверка edge cases
- End-to-end верификация

**Особенность:** `readonly: true` - не может менять код

**Вызов:** `/verifier проверь что auth flow полностью работает`

**Что проверяет:**
- ✅ Код действительно существует и скомпилирован
- ✅ Тесты запускаются и проходят
- ✅ Edge cases обработаны
- ✅ End-to-end функциональность работает

**Отчет:**
```
✅ ПРОВЕРЕНО И РАБОТАЕТ
- Auth middleware корректно проверяет JWT
- Tests: 15/15 passed

⚠️ ТРЕБУЕТ ВНИМАНИЯ
- Edge case: expired token не протестирован
- Рекомендация: добавить тест для expired JWT
```

### Встроенные субагенты

Cursor включает 3 встроенных субагента (не нужно создавать):

| Субагент  | Назначение                     |
|-----------|--------------------------------|
| `explore` | Поиск и анализ кодбазы         |
| `bash`    | Выполнение shell команд        |
| `browser` | Управление браузером через MCP |

Agent автоматически использует их когда нужно.

---

## 🎯 Skills (Навыки)

Skills — это портативные пакеты знаний, которые обучают Agent выполнять специфичные задачи. Это markdown файлы с YAML frontmatter, инструкциями и примерами кода.

### Формат

Skills — это markdown файлы с YAML frontmatter в папке `.cursor/skills/`:

```markdown
---
name: api-integration
description: Интеграция с API. Используй для создания HTTP клиентов, retry, rate limiting.
---

# API Integration Skill

## Когда использовать
- Нужно подключиться к внешнему API...

## Инструкции
1. Создай ApiClient класс
2. Добавь retry механизм
3. Настрой rate limiting

## Примеры кода
\`\`\`typescript
// Примеры реализации
\`\`\`
```

### Структура

```
.cursor/
└── skills/
    ├── api-integration/
    │   ├── SKILL.md          # Главный файл
    │   ├── scripts/          # Опционально: скрипты
    │   ├── references/       # Опционально: доп. документация
    │   └── assets/           # Опционально: шаблоны
    ├── database-operations/
    │   └── SKILL.md
    ├── error-handling/
    │   └── SKILL.md
    └── deploy-app/
        ├── SKILL.md
        └── scripts/
            ├── validate.py
            ├── deploy.sh
            └── rollback.sh
```

### Использование

**Автоматическое применение:**
```
"Мне нужно подключиться к Stripe API с retry"
→ Agent автоматически применяет api-integration skill
```

**Явный вызов (slash-команда):**
```
/api-integration
→ Загружает skill в контекст явно
```

### Доступные skills

#### `api-integration` - Интеграция с API

**Когда Agent применит:**
- Упоминается "API", "HTTP client", "REST"
- Нужен retry механизм или rate limiting
- Требуется авторизация (OAuth, JWT)

**Что включает:**
- ApiClient класс с типизацией
- Retry с exponential backoff
- RateLimiter для ограничения запросов
- Примеры авторизации

**Agent создаст:**
```typescript
const api = new ApiClient('https://api.example.com', API_KEY);
const data = await withRetry(() => api.get('/users'), 3, 1000);

const limiter = new RateLimiter(5, 200);
await limiter.execute(() => api.post('/data', payload));
```

---

#### `database-operations` - Работа с БД

**Когда Agent применит:**
- Упоминается "database", "SQL", "migration"
- Нужны CRUD операции
- Требуются транзакции

**Что включает:**
- Параметризованные запросы (защита от SQL injection)
- Транзакции для атомарных операций
- SQL миграции с индексами и триггерами
- Prisma ORM примеры

**Agent создаст:**
```typescript
// Безопасный запрос
const user = await pool.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);

// Транзакция
await client.query('BEGIN');
try {
  await client.query('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
  await client.query('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

---

#### `error-handling` - Обработка ошибок

**Когда Agent применит:**
- Упоминается "error handling", "validation"
- Нужны custom error классы
- Требуется centralized error handling

**Что включает:**
- Custom Error классы (ValidationError, NotFoundError)
- Express error handler middleware
- AsyncHandler для автоматического catch
- Zod валидация с детальными ошибками
- Graceful shutdown паттерн

**Agent создаст:**
```typescript
// Custom errors
throw new NotFoundError('User');
throw new ValidationError('Invalid email');

// Error handler
app.use(errorHandler);

// AsyncHandler
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) throw new NotFoundError('User');
  res.json(user);
}));

// Валидация
app.post('/users', validate(userSchema), async (req, res) => {
  const user = await createUser(req.body);
  res.status(201).json(user);
});
```

### Skills со скриптами

Skills могут включать исполняемый код в папке `scripts/`:

**Пример: `deploy-app`**
```
deploy-app/
├── SKILL.md                  # Инструкции
└── scripts/
    ├── validate.py           # Pre-deployment проверки
    ├── deploy.sh             # Деплой в K8s
    └── rollback.sh           # Откат версии
```

Agent прочитает `SKILL.md` и выполнит скрипты когда нужно:
```bash
python scripts/validate.py    # Проверка перед деплоем
bash scripts/deploy.sh staging  # Деплой в staging
```

### Skills vs Subagents

| Skills                                | Subagents                               |
|---------------------------------------|-----------------------------------------|
| Однократная задача                    | Многошаговая задача                     |
| Инструкции + примеры                  | Отдельный context window                |
| Quick reference для Agent             | Изолированное выполнение                |
| Примеры: format, create client, deploy| Примеры: code review, debugging, verify |

---

## 📋 Rules (Правила и соглашения)

Rules — это markdown файлы с инструкциями для Agent о стандартах кодирования и соглашениях проекта.

### Формат

Rules — это markdown с YAML frontmatter в `.cursor/rules/`:

```markdown
---
globs: ['*.ts', '*.tsx']     # К каким файлам применять
alwaysApply: false           # Agent решает когда применять
---

# Rule Name

Инструкции для Agent...
```

### Типы применения

1. **Always Apply** - В каждой сессии (`alwaysApply: true`)
2. **Apply Intelligently** - Agent решает (`alwaysApply: false`)
3. **Apply to Files** - По паттернам (`globs: ['*.ts']`)
4. **Apply Manually** - Через `@rule-name`

### Настройка

**Вариант А: Структурированные rules (рекомендуется)**
```bash
mkdir -p .cursor/rules
cp forCursor/rules/*.md .cursor/rules/
```

**Вариант Б: Простой .cursorrules файл**
```bash
# В корне проекта создай .cursorrules
echo "Используй TypeScript strict mode. Никогда не используй 'any'." > .cursorrules
```

### Доступные rules

#### `typescript-best-practices.md`

**Применяется к:** TypeScript файлы (`*.ts`, `*.tsx`)

**Ключевые правила:**
- ✅ Явная типизация всех функций
- ❌ Никогда `any`
- ✅ `interface` для объектов, `type` для unions
- ✅ `readonly` для immutable данных
- ✅ Type guards для runtime проверок

```typescript
// ✅ Agent будет писать так
interface User {
  readonly id: number;
  name: string;
}

function getUser(id: number): Promise<User> {
  return fetch(`/api/users/${id}`).then(r => r.json());
}
```

---

#### `react-conventions.md`

**Применяется к:** React файлы (`*.tsx`, `*.jsx`)

**Ключевые правила:**
- ✅ Functional components + hooks
- ✅ TypeScript props
- ✅ Мemoization (useMemo, useCallback, React.memo)
- ✅ Custom hooks
- ✅ Error boundaries

```typescript
// ✅ Agent будет создавать компоненты так
interface Props {
  user: User;
  onEdit: (id: number) => void;
}

export const UserCard = React.memo(({ user, onEdit }: Props) => {
  const handleEdit = useCallback(() => {
    onEdit(user.id);
  }, [user.id, onEdit]);

  return <div onClick={handleEdit}>{user.name}</div>;
});
```

---

#### `code-review-checklist.md`

**Применяется:** Когда Agent делает code review

**Проверяет:**
- ✅ Читаемость и поддерживаемость
- ✅ Производительность и оптимизация
- ✅ Безопасность (injection, XSS, CSRF)
- ✅ Обработка ошибок
- ✅ Покрытие тестами
- ✅ TypeScript типизация

### Rules vs Skills

| Rules                               | Skills                              |
|-------------------------------------|-------------------------------------|
| "Как писать код"                    | "Как реализовать задачу"            |
| Стандарты и соглашения              | Готовые паттерны решения            |
| Применяются к файлам (globs)        | Применяются к задачам               |
| Примеры: code style, conventions    | Примеры: create client, deploy      |

---

## 🚀 Быстрый старт

### 1. Настройка Hooks
```bash
# Создай структуру в проекте
mkdir -p .cursor/hooks

# Скопируй конфигурацию
cp forCursor/hooks/hooks.json <your-project>/.cursor/hooks.json

# Скопируй скрипты
cp forCursor/hooks/*.sh <your-project>/.cursor/hooks/

# Сделай исполняемыми (Linux/Mac)
chmod +x <your-project>/.cursor/hooks/*.sh

# Перезапусти Cursor
```

### 2. Настройка команд
Добавь команды в Cursor Settings → AI → Custom Commands или создай `.cursor/commands/` и помести туда файлы команд

### 3. Настройка субагентов
```bash
# Скопируй субагенты в проект
mkdir -p .cursor/agents
cp forCursor/subagents/*.md <your-project>/.cursor/agents/

# Используй через slash-синтаксис или естественный язык
/code-reviewer проверь код
/test-generator создай тесты
```

### 4. Применение правил

**Вариант А: Структурированные rules**
```bash
mkdir -p .cursor/rules
cp forCursor/rules/*.md .cursor/rules/
```

**Вариант Б: Простой .cursorrules**
```bash
# В корне проекта
cat > .cursorrules << 'EOF'
TypeScript strict mode. Никогда не используй 'any'.
Функциональные React компоненты с хуками.
Мemoization для производительности.
EOF
```

---

## 💡 Примеры использования

### Сценарий 1: Создание нового API endpoint
```typescript
// 1. Создай endpoint
app.post('/api/products', async (req, res) => {
  const product = await createProduct(req.body);
  res.status(201).json(product);
});

// 2. AI отредактирует файл → hook afterFileEdit автоформатирует код
// 3. /code-reviewer проверь код на безопасность
// 4. /test-generator создай тесты
// 5. /doc-writer создай API документацию
// 6. /verifier проверь что всё работает
// 7. AI выполнит npm test → hook beforeShellExecution спросит подтверждение
```

### Сценарий 2: Комплексная задача с субагентами
```
Запрос: "Реализуй user authentication с OAuth"

AI автоматически:
1. Реализует feature
2. Делегирует code-reviewer для проверки безопасности
3. Делегирует test-generator для создания тестов
4. Делегирует verifier для финальной проверки

Все субагенты работают в своих контекстах, 
основной conversation остается чистым.
```

### Сценарий 3: Отладка с debugger субагентом
```
/debugger помоги с ошибкой:
TypeError: Cannot read property 'map' of undefined
at UserList (UserList.tsx:15)

Субагент debugger:
1. Проанализирует stack trace
2. Найдет root cause (users может быть undefined)
3. Предложит fix с optional chaining
4. Создаст регрессионный тест
5. Объяснит профилактику

Изоляция контекста: вся отладка происходит
в отдельном контексте, не засоряя основной conversation.
```

---

## 📚 Дополнительные ресурсы

### Полезные команды
```bash
# Проверка всего проекта перед push
npm run lint && npm test && npm run type-check

# Автоисправление проблем
npm run lint:fix && npm run format

# Генерация документации
npm run docs

# Запуск в режиме разработки
npm run dev
```

### Структура идеального проекта
```
my-project/
├── .cursor/
│   ├── hooks.json         # Конфигурация hooks
│   ├── hooks/             # Исполняемые скрипты (.sh, .py, .ts)
│   ├── agents/            # Субагенты (markdown с YAML)
│   │   ├── code-reviewer.md
│   │   ├── test-generator.md
│   │   ├── doc-writer.md
│   │   ├── debugger.md
│   │   └── verifier.md
│   └── commands/          # Slash команды (опционально)
├── .cursorrules           # Ссылка на правила кодирования
├── src/
│   ├── components/        # React компоненты
│   ├── features/          # Feature modules
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Утилиты (используй skills)
│   └── types/             # TypeScript типы
├── tests/                 # Тесты (создавай с /test-generator)
└── docs/                  # Документация (создавай с /doc-writer)
```

---

## 🎓 Рекомендации

1. **Настрой Hooks** - контролируй действия AI, блокируй опасные операции, автоформатируй код
2. **Используй slash-команды** - `/review`, `/tests`, `/optimize` для быстрой работы
3. **Создавай субагенты** - markdown файлы в `.cursor/agents/` для повторяющихся задач
4. **Используй verifier** - проактивно для проверки завершенной работы
5. **Параллелизуй задачи** - запускай несколько субагентов одновременно
6. **Расширяй skills** - добавляй паттерны характерные для твоего проекта
7. **Обновляй rules** - когда команда принимает новые соглашения
8. **Версионируй всё** - commit `.cursor/` в git для всей команды

---

## 📞 Troubleshooting

### Hooks не срабатывают
```bash
# 1. Проверь наличие hooks.json:
cat .cursor/hooks.json

# 2. Проверь права на выполнение (Linux/Mac):
ls -la .cursor/hooks/*.sh
# Должно быть: -rwxr-xr-x

# Если нет прав:
chmod +x .cursor/hooks/*.sh

# 3. Проверь логи в Cursor:
# Settings → Hooks (вкладка для отладки)
# View → Output → Hooks (output channel)

# 4. Тестируй hooks вручную:
echo '{"command": "ls"}' | .cursor/hooks/approve-shell.sh

# 5. Перезапусти Cursor
```

### Субагенты не работают
```
# Проверь наличие файлов:
ls .cursor/agents/*.md

# Проверь формат файлов (должен быть markdown с YAML):
cat .cursor/agents/code-reviewer.md

# Используй правильный синтаксис вызова:
/code-reviewer проверь этот файл
# или
Используй code-reviewer субагент для проверки

# Проверь что Agent загрузил субагенты:
# В Cursor они автоматически загружаются из .cursor/agents/
```

### Skills не применяются
```
# AI автоматически использует skills на основе контекста
# Если нужно явно - упомяни задачу:
"Создай API клиент" → использует api-integration skill
"Создай миграцию БД" → использует database-operations skill
```



