# Skills (Python)

Навыки для решения типовых задач в Python проектах. Cursor AI использует их автоматически при упоминании соответствующей задачи.

## Доступные навыки

| Навык | Когда используется |
|-------|-------------------|
| `api-integration` | Интеграция с внешними API (httpx, retry, rate limiting, OAuth) |
| `database-operations` | Работа с БД (psycopg2, SQLAlchemy async, Alembic, транзакции) |
| `error-handling` | Обработка ошибок (custom exceptions, FastAPI handlers, Pydantic, graceful shutdown) |
| `deploy-app` | Деплой приложения (Docker, Kubernetes, валидация через `validate.py`) |

## Использование

Скопируй в `.cursor/skills/` проекта. Cursor AI подключит навык автоматически по описанию `description` в frontmatter.
