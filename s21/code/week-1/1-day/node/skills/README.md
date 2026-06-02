# Cursor Skills - Руководство

Skills (Навыки) — это переносимые пакеты знаний, которые обучают AI Agent выполнять специфичные задачи. Skills включают инструкции, примеры кода и чек-листы.

## 📋 Что такое Skills?

Skills — это портативные, версионированные пакеты, которые:
- ✅ **Портативны** - работают в любом агенте поддерживающем Agent Skills стандарт
- ✅ **Версионируются** - хранятся как файлы в git
- ✅ **Действенны** - включают скрипты, шаблоны и примеры
- ✅ **Прогрессивны** - загружают ресурсы по требованию

## 🎯 Skills vs Subagents

| Используй Skills когда...                           | Используй Subagents когда...                    |
|----------------------------------------------------|------------------------------------------------|
| Задача однократная (format, create API client)    | Нужна изоляция контекста для долгих задач     |
| Нужно быстрое повторяемое действие                | Запускаешь несколько задач параллельно        |
| Задача выполняется в один шаг                     | Задача требует многошаговой экспертизы        |
| Не нужен отдельный context window                 | Нужна независимая верификация работы          |

## 📁 Структура файлов

Skills — это **markdown файлы с YAML frontmatter** в структуре:

```
.cursor/
└── skills/
    ├── api-integration/
    │   ├── SKILL.md           # Главный файл навыка
    │   ├── scripts/           # Опционально: исполняемые скрипты
    │   │   └── setup-api.sh
    │   ├── references/        # Опционально: дополнительная документация
    │   │   └── REFERENCE.md
    │   └── assets/            # Опционально: шаблоны, данные
    │       └── config.json
    ├── database-operations/
    │   └── SKILL.md
    └── error-handling/
        └── SKILL.md
```

## 📝 Формат SKILL.md

Каждый skill определяется в `SKILL.md` с YAML frontmatter:

```markdown
---
name: skill-name
description: Краткое описание когда использовать этот навык.
license: MIT
compatibility: Requires Node.js 18+
disable-model-invocation: false
---

# Skill Name

Детальные инструкции для агента.

## Когда использовать

- Используй этот skill когда...
- Этот skill помогает с...

## Инструкции

Пошаговые инструкции для агента:
1. Шаг 1
2. Шаг 2
3. Используй ask questions tool если нужно уточнить требования

## Примеры кода

\`\`\`typescript
// Примеры реализации
\`\`\`

## Чеклист

- [ ] Проверка 1
- [ ] Проверка 2
```

### Поля YAML frontmatter

| Поле                       | Обязательно | Описание                                                |
|----------------------------|-------------|---------------------------------------------------------|
| `name`                     | ✅ Да       | Идентификатор навыка (lowercase, hyphens)               |
| `description`              | ✅ Да       | Когда использовать (Agent решает на основе этого)       |
| `license`                  | ❌ Нет      | Лицензия (MIT, Apache-2.0, etc.)                        |
| `compatibility`            | ❌ Нет      | Системные требования                                    |
| `metadata`                 | ❌ Нет      | Дополнительные key-value данные                         |
| `disable-model-invocation` | ❌ Нет      | Если `true`, только явный вызов `/skill-name`           |

## 🚀 Быстрый старт

### 1. Скопируй skills в проект

```bash
# Создай папку
mkdir -p .cursor/skills

# Скопируй skills
cp -r forCursor/skills/* <your-project>/.cursor/skills/
```

### 2. Используй skills

**Автоматическое применение:**
```
"Мне нужно подключиться к Stripe API"
→ Agent автоматически применит api-integration skill
```

**Явный вызов (slash-команда):**
```
/api-integration
→ Загрузит skill в контекст явно
```

### 3. Проверь загруженные skills

1. Открой **Cursor Settings** (Cmd+Shift+J / Ctrl+Shift+J)
2. Перейди в **Rules**
3. Skills отображаются в секции **Agent Decides**

## 📚 Доступные skills

### 1. `api-integration` - Интеграция с API

**Когда использовать:**
- Нужно создать HTTP клиент
- Требуется retry механизм
- Нужен rate limiting
- Требуется авторизация (OAuth, JWT, API keys)

**Что включает:**
- REST API Client класс с типизацией
- Retry механизм с exponential backoff
- Rate Limiter для ограничения частоты запросов
- Примеры авторизации

**Примеры:**
```typescript
// Agent создаст клиент на основе skill
const api = new ApiClient('https://api.example.com', API_KEY);
const data = await withRetry(() => api.get('/users'));
```

---

### 2. `database-operations` - Работа с БД

**Когда использовать:**
- Нужны безопасные SQL запросы (prepared statements)
- Требуются транзакции
- Нужны миграции
- Требуется оптимизация (индексы)

**Что включает:**
- Параметризованные запросы (защита от SQL injection)
- Транзакции для атомарных операций
- SQL миграции с триггерами
- Prisma ORM примеры

**Примеры:**
```typescript
// Agent создаст безопасный запрос
const user = await pool.query(
  'SELECT * FROM users WHERE id = $1',
  [userId]
);
```

---

### 3. `error-handling` - Обработка ошибок

**Когда использовать:**
- Нужны custom error классы
- Требуется централизованная обработка ошибок
- Нужна валидация с детальными сообщениями
- Требуется graceful shutdown

**Что включает:**
- Custom Error классы (ValidationError, NotFoundError, etc.)
- Express error handler middleware
- Zod валидация с детальными ошибками
- Graceful shutdown паттерн

**Примеры:**
```typescript
// Agent создаст error handler
app.use(errorHandler);

app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) throw new NotFoundError('User');
  res.json(user);
}));
```

## 🔧 Добавление скриптов в Skills

Skills могут включать папку `scripts/` с исполняемым кодом:

```
api-integration/
├── SKILL.md
└── scripts/
    ├── setup-client.sh
    └── test-api.js
```

Ссылайся на скрипты в `SKILL.md`:

```markdown
## Использование

Запусти скрипт настройки: `bash scripts/setup-client.sh <api-key>`

Протестируй API: `node scripts/test-api.js`
```

Agent прочитает инструкции и выполнит скрипты когда skill применяется.

## 📂 Опциональные папки

| Папка         | Назначение                                      |
|---------------|-------------------------------------------------|
| `scripts/`    | Исполняемый код (bash, python, js)              |
| `references/` | Дополнительная документация (загружается по требованию) |
| `assets/`     | Статичные ресурсы (шаблоны, конфиги, данные)   |

Держи основной `SKILL.md` фокусированным. Детальную документацию выноси в `references/` — Agent загрузит её только когда нужно.

## 🎨 Отключение автоматического применения

По умолчанию skills применяются автоматически когда Agent решит что они релевантны. Для создания "slash-only" skills:

```yaml
---
name: my-skill
description: Описание
disable-model-invocation: true
---
```

Теперь skill загружается только при явном вызове `/my-skill`.

## 💡 Создание кастомного skill

### Шаг 1: Создай структуру

```bash
mkdir -p .cursor/skills/my-skill
touch .cursor/skills/my-skill/SKILL.md
```

### Шаг 2: Напиши SKILL.md

```markdown
---
name: my-skill
description: Краткое описание когда использовать.
---

# My Skill

Детальные инструкции для Agent.

## Когда использовать

- Используй когда...
- Помогает с...

## Инструкции

1. Шаг 1: Сделай X
2. Шаг 2: Проверь Y
3. Шаг 3: Создай Z

## Примеры

\`\`\`typescript
// Пример кода
\`\`\`

## Чеклист

- [ ] Проверка 1
- [ ] Проверка 2
```

### Шаг 3: Тестируй

```bash
# Открой Cursor и попробуй:
"Мне нужно [задача из description]"
# или явно:
/my-skill
```

## 📖 Best Practices

### ✅ Делай

1. **Пиши четкие descriptions** - Agent решает на основе description когда применить skill
2. **Будь конкретным** - один skill = одна задача
3. **Добавляй примеры кода** - покажи как правильно реализовывать
4. **Используй чек-листы** - Agent проверит что ничего не пропущено
5. **Версионируй в git** - commit `.cursor/skills/` в репозиторий

### ❌ Не делай

1. **Не создавай универсальные skills** - "помощник для всего" не эффективен
2. **Не дублируй в skills и subagents** - выбирай что подходит по задаче
3. **Не пиши длинные инструкции** - будь кратким и конкретным
4. **Не забывай YAML frontmatter** - без него skill не загрузится

## 🔄 Миграция из Rules и Commands

Cursor 2.4+ включает `/migrate-to-skills` для конвертации:
- **Dynamic rules** (alwaysApply: false) → skills
- **Slash commands** → skills с `disable-model-invocation: true`

```bash
# В Cursor Agent:
/migrate-to-skills
→ Автоматически конвертирует rules и commands в skills
```

## 📍 Размещение skills

### Project Skills (рекомендуется)
```
<project>/.cursor/skills/
```
- ✅ Версионируются в git
- ✅ Работают для всей команды
- ✅ Специфичны для проекта

### User Skills (глобальные)
```
~/.cursor/skills/
```
- ✅ Работают во всех проектах
- ✅ Личные настройки

## 🌍 Установка skills из GitHub

Можно импортировать skills из GitHub:

1. **Cursor Settings → Rules**
2. **Project Rules** → **Add Rule**
3. **Remote Rule (Github)**
4. Введи URL GitHub репозитория

Agent загрузит skills из репозитория.

## 📊 Примеры использования

### Сценарий 1: Создание API клиента

```
Запрос: "Мне нужно подключиться к OpenAI API"

Agent:
1. Применяет api-integration skill автоматически
2. Создает ApiClient класс с retry
3. Настраивает авторизацию с API key
4. Добавляет rate limiting
5. Показывает примеры использования

Результат: Готовый API клиент с обработкой ошибок
```

### Сценарий 2: Создание миграции БД

```
Запрос: "Создай таблицу users с email и password"

Agent:
1. Применяет database-operations skill
2. Создает миграцию с CREATE TABLE
3. Добавляет индексы для email
4. Создает триггер для updated_at
5. Использует правильные типы данных

Результат: Безопасная миграция готова к применению
```

### Сценарий 3: Настройка error handling

```
Запрос: "Добавь обработку ошибок в API"

Agent:
1. Применяет error-handling skill
2. Создает custom error классы
3. Добавляет error handler middleware
4. Настраивает asyncHandler для routes
5. Добавляет валидацию с Zod

Результат: Централизованная обработка ошибок
```

## 🔗 Дополнительные ресурсы

- [Официальная документация Cursor Skills](https://cursor.com/docs/context/skills)
- [Agent Skills Standard](https://agentskills.io)
- [Skills vs Subagents](https://cursor.com/docs/context/subagents)

---

**Skills — это quick reference для Agent.** Для сложных многошаговых задач с изоляцией контекста используй [Subagents](../subagents/).
