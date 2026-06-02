# Cursor Rules - Руководство

Rules (Правила) — это markdown файлы с инструкциями для AI Agent. Определяют стандарты кодирования, best practices и соглашения проекта.

## 📋 Что такое Rules?

Rules — это инструкции для Agent о том как писать код в твоем проекте:
- ✅ **Стандарты кодирования** - TypeScript strict mode, naming conventions
- ✅ **Best practices** - React patterns, error handling
- ✅ **Соглашения команды** - архитектурные решения, структура проекта
- ✅ **Чек-листы** - что проверять перед коммитом

## 📁 Размещение

Rules размещаются в папке `.cursor/rules/`:

```
.cursor/
└── rules/
    ├── typescript-best-practices.md
    ├── react-conventions.md
    └── code-review-checklist.md
```

Или в корне проекта как `.cursorrules` файл (простой вариант).

## 📝 Формат

Rules — это markdown файлы с опциональным YAML frontmatter:

```markdown
---
globs: ['*.ts', '*.tsx']     # Применять к этим файлам
alwaysApply: false           # Agent решает когда применять
---

# Rule Name

Инструкции для Agent...
```

### Поля YAML frontmatter

| Поле         | Описание                                           | Пример                  |
|--------------|---------------------------------------------------|-------------------------|
| `globs`      | Паттерны файлов когда применять rule               | `['*.ts', '*.tsx']`     |
| `alwaysApply`| Всегда применять (`true`) или Agent решает (`false`)| `false`                |

### Типы применения Rules

1. **Always Apply** (`alwaysApply: true`) - В каждой сессии
2. **Apply Intelligently** (`alwaysApply: false`) - Agent решает когда релевантно
3. **Apply to Specific Files** (`globs: ['*.ts']`) - Когда работаешь с файлами паттерна
4. **Apply Manually** - Через `@rule-name` в чате

## 🚀 Быстрый старт

### 1. Скопируй rules в проект

```bash
# Создай папку
mkdir -p .cursor/rules

# Скопируй rules
cp forCursor/rules/*.md <your-project>/.cursor/rules/
```

### 2. Используй rules

**Автоматически (на основе globs):**
```
# Открываешь file.ts
→ Agent автоматически применяет typescript-best-practices.md

# Открываешь Component.tsx  
→ Agent применяет react-conventions.md
```

**Явно (через @-mention):**
```
@typescript-best-practices проверь этот код
```

### 3. Или используй .cursorrules (простой вариант)

Создай файл `.cursorrules` в корне проекта:

```
Ты работаешь в TypeScript проекте с React.

Правила:
- Всегда используй strict mode TypeScript
- Никогда не используй 'any'
- Функциональные компоненты с хуками
- Мemoization для производительности (useMemo, useCallback)

Следуй правилам из .cursor/rules/
```

## 📚 Доступные rules

### 1. `typescript-best-practices.md` - TypeScript стандарты

**Применяется к:** `*.ts`, `*.tsx`

**Основные правила:**
- ✅ Всегда явная типизация функций
- ❌ Никогда не используй `any`
- ✅ Предпочитай `interface` для объектов, `type` для unions
- ✅ Используй `readonly` где возможно
- ✅ Type guards для runtime проверок

**Примеры:**
```typescript
// ✅ ХОРОШО
interface User {
  readonly id: number;
  name: string;
}

function getUser(id: number): Promise<User> {
  return fetch(`/api/users/${id}`).then(r => r.json());
}

// ❌ ПЛОХО
function getUser(id: any): any {
  return fetch(`/api/users/${id}`).then(r => r.json());
}
```

---

### 2. `react-conventions.md` - React соглашения

**Применяется к:** `*.tsx`, `*.jsx`

**Основные правила:**
- ✅ Функциональные компоненты + хуки
- ✅ TypeScript для всех props
- ✅ Мemoization (useMemo, useCallback, React.memo)
- ✅ Custom hooks для переиспользуемой логики
- ✅ Error boundaries для критичных компонентов

**Примеры:**
```typescript
// ✅ ХОРОШО
interface UserCardProps {
  user: User;
  onEdit: (id: number) => void;
}

export const UserCard = React.memo(({ user, onEdit }: UserCardProps) => {
  const handleEdit = useCallback(() => {
    onEdit(user.id);
  }, [user.id, onEdit]);

  return <div onClick={handleEdit}>{user.name}</div>;
});
```

---

### 3. `code-review-checklist.md` - Чек-лист для ревью

**Применяется:** Когда Agent делает code review

**Категории проверок:**
- ✅ Читаемость (понятные имена, SRP)
- ✅ Производительность (оптимальные структуры данных)
- ✅ Безопасность (SQL injection, XSS, CSRF)
- ✅ Обработка ошибок (try-catch, валидация)
- ✅ Тестирование (unit тесты, edge cases)
- ✅ TypeScript (отсутствие any)

**Быстрая проверка перед коммитом:**
```bash
npm run lint        # Линтер
npm test           # Тесты
npm run type-check # TypeScript
npm run format:check # Форматирование
```

## 🔧 Создание кастомного rule

### Шаг 1: Создай файл

```bash
touch .cursor/rules/my-rule.md
```

### Шаг 2: Напиши rule

```markdown
---
globs: ['src/api/**/*.ts']   # Применять к API файлам
alwaysApply: false           # Agent решает когда применять
---

# API Endpoint Standards

Когда создаешь API endpoints:

1. Используй валидацию с Zod
2. Добавь error handling с asyncHandler
3. Используй правильные HTTP коды
4. Добавь rate limiting
5. Логируй все запросы

## Пример

\`\`\`typescript
app.post('/api/users', 
  validate(userSchema),
  rateLimit({ max: 100 }),
  asyncHandler(async (req, res) => {
    const user = await createUser(req.body);
    res.status(201).json(user);
  })
);
\`\`\`
```

### Шаг 3: Проверь загрузку

1. Открой **Cursor Settings → Rules**
2. Твой rule должен отобразиться

## 💡 Best Practices

### ✅ Делай

1. **Будь конкретным** - четкие инструкции, не расплывчатые
2. **Добавляй примеры** - покажи правильный vs неправильный код
3. **Используй globs** - применяй rule к specific файлам
4. **Держи rules короткими** - до 500 строк
5. **Версионируй в git** - commit `.cursor/rules/` в репозиторий

### ❌ Не делай

1. **Не копируй весь код** - ссылайся на существующие файлы
2. **Не документируй edge cases** - это дублирование
3. **Не делай rules слишком длинными** - Agent не увидит важное
4. **Не используй alwaysApply: true везде** - засорит контекст

## 📂 Организация rules

### По назначению
```
.cursor/rules/
├── languages/
│   ├── typescript.md
│   ├── python.md
│   └── sql.md
├── frameworks/
│   ├── react.md
│   └── express.md
└── project/
    ├── architecture.md
    └── api-standards.md
```

### Приоритеты
Если несколько rules конфликтуют:
1. Более специфичные globs побеждают
2. Project rules > User rules
3. Более поздние rules в алфавитном порядке

## 🎯 Rules vs Skills

| Rules                               | Skills                              |
|-------------------------------------|-------------------------------------|
| Стандарты и соглашения              | Готовые паттерны решения            |
| "Как писать код"                    | "Как реализовать X"                 |
| Применяются к файлам (globs)        | Применяются к задачам               |
| Примеры: code style, naming         | Примеры: create API client, deploy  |

**Когда что использовать:**
- **Rule**: "Всегда типизируй функции в TypeScript"
- **Skill**: "Как создать API клиент с retry механизмом"

## 📍 Размещение rules

### Project Rules (рекомендуется)
```
<project>/.cursor/rules/
```
- ✅ Версионируются в git
- ✅ Работают для всей команды
- ✅ Специфичны для проекта

### User Rules (глобальные)
```
~/.cursor/rules/
```
- ✅ Работают во всех проектах
- ✅ Личные предпочтения

### Simple Rules (.cursorrules файл)
```
<project>/.cursorrules
```
- ✅ Простой текстовый файл
- ✅ Легко редактировать
- ⚠️ Меньше контроля (нет globs)

## 🔗 Дополнительные ресурсы

- [Официальная документация Cursor Rules](https://cursor.com/docs/context/rules)
- [Best Practices for Rules](https://cursor.fan/tutorial/HowTo/best-practices-for-cursor-rules/)
- [Community Rules Collection](https://www.cursorhow.com/en/cursor-rules)

---

**Rules — это руководство для Agent как писать код.** Для реализации конкретных задач используй [Skills](../skills/).
