# Rules (Python)

Правила для Cursor AI — применяются при работе с Python кодом.

## Файлы

| Файл | Применяется к | Описание |
|------|--------------|----------|
| `python-best-practices.md` | `*.py` | Type hints, dataclass, Enum, async, immutability |
| `fastapi-conventions.md` | `*.py` | Структура роутеров, Pydantic схемы, DI, сервисный слой |
| `code-review-checklist.md` | любые | Чек-лист для code review |

## Использование

Скопируй в `.cursor/rules/` проекта. Правило с `globs: ['*.py']` применяется только к Python файлам. `alwaysApply: false` — применяется по запросу.
