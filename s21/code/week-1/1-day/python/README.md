# Примеры настроек Cursor AI — Python

Эта папка содержит примеры настройки Cursor AI для Python-проектов.

## 📁 Структура

```
python/
├── hooks/          # Исполняемые скрипты для контроля AI (bash/python)
├── commands/       # Slash-команды для быстрых задач (/review, /tests)
├── subagents/      # Субагенты (markdown с YAML frontmatter)
├── skills/         # Навыки для решения типовых задач
└── rules/          # Правила и соглашения для кода
```

## Стек

- **API:** FastAPI + Pydantic
- **БД:** SQLAlchemy (async) + PostgreSQL (psycopg2/asyncpg)
- **Тесты:** pytest + pytest-asyncio
- **Типизация:** mypy (strict)
- **Форматирование:** black + ruff
- **Документация:** Sphinx / docstrings (Google style)

## Использование

Скопируй содержимое в `.cursor/` в корне своего Python-проекта:

```
my-project/
└── .cursor/
    ├── hooks/
    ├── commands/
    ├── subagents/
    ├── skills/
    └── rules/
```

Подробнее о каждом типе настроек — в README.md соответствующей директории.
