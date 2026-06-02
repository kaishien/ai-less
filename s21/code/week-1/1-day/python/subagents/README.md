# Subagents (Python)

Специализированные субагенты для работы с Python кодом.

## Доступные субагенты

| Субагент | Модель | Когда использовать |
|---------|--------|-------------------|
| `code-reviewer` | fast (readonly) | Code review: безопасность, производительность, типизация |
| `debugger` | fast | Ошибки, traceback, неожиданное поведение |
| `test-generator` | fast | Создание pytest тестов (unit, async, FastAPI) |
| `doc-writer` | fast | Docstrings (Google style), README, API документация |
| `verifier` | fast (readonly) | Проверка что задача действительно выполнена |

## Использование

Скопируй в `.cursor/subagents/` проекта. Cursor AI подключит субагент по `description` в frontmatter или при явном упоминании имени.
