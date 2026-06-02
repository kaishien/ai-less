---
alwaysApply: false
---

# Code Review Checklist (Python)

Чек-лист для проверки Python кода перед коммитом и ревью.

## Общие проверки

### ✅ Читаемость
- [ ] Понятные имена переменных и функций
- [ ] Функции выполняют одну задачу (Single Responsibility)
- [ ] Максимальная длина функции до 50 строк
- [ ] Нет избыточных комментариев (код сам себя объясняет)
- [ ] Комментарии есть для сложной бизнес-логики
- [ ] Отсутствуют "магические числа" (используются константы)

### ✅ Производительность
- [ ] Нет лишних циклов и итераций
- [ ] Используются правильные структуры данных (dict/set для O(1) lookups)
- [ ] Избегается N+1 проблема в запросах к БД
- [ ] Добавлена пагинация для больших списков
- [ ] Используется lru_cache / functools.cache где уместно
- [ ] Async операции не блокируют event loop (нет sync I/O в async коде)

### ✅ Безопасность
- [ ] Нет SQL injection (используются параметризованные запросы / ORM)
- [ ] Нет XSS уязвимостей (санитизация входных данных)
- [ ] Секреты в environment variables, не в коде
- [ ] Валидация всех пользовательских данных (Pydantic)
- [ ] Защита от CSRF для изменяющих операций
- [ ] Rate limiting для API endpoints
- [ ] Правильная обработка авторизации
- [ ] Пароли хешируются (bcrypt / argon2)

### ✅ Обработка ошибок
- [ ] Try/except для I/O операций
- [ ] Понятные сообщения об ошибках
- [ ] Логирование ошибок
- [ ] Graceful degradation
- [ ] Валидация данных с понятными ошибками (Pydantic)
- [ ] Обработка edge cases

### ✅ Тестирование
- [ ] Добавлены unit тесты для новой логики (pytest)
- [ ] Покрытие критических путей тестами
- [ ] Тесты проходят локально (`pytest`)
- [ ] Проверены граничные случаи
- [ ] Моки используются правильно (unittest.mock / pytest-mock)

### ✅ Python / Типизация
- [ ] Нет использования `Any` без необходимости
- [ ] Все функции типизированы (type hints)
- [ ] Используются dataclass / Pydantic / TypedDict для структур
- [ ] Mypy проходит без ошибок
- [ ] Используется `|` вместо `Optional[X]` (Python 3.10+)

### ✅ FastAPI специфика (если применимо)
- [ ] Разделены входные и выходные Pydantic схемы
- [ ] Бизнес-логика в сервисах, не в роутерах
- [ ] Dependency Injection через Depends
- [ ] Правильные HTTP статус-коды
- [ ] response_model указан явно
- [ ] Нет sync I/O в async endpoint

### ✅ База данных
- [ ] Индексы для часто используемых полей
- [ ] Оптимизированные запросы (EXPLAIN ANALYZE)
- [ ] Транзакции для атомарных операций
- [ ] Миграции версионированы (Alembic)
- [ ] Нет N+1 запросов (используется joinedload/selectinload)

### ✅ Git
- [ ] Осмысленное сообщение коммита
- [ ] Один коммит = одна логическая единица изменений
- [ ] Нет закоммиченных секретов
- [ ] Нет временных файлов / .pyc
- [ ] .gitignore настроен правильно

### ✅ Код стайл
- [ ] ruff проходит без ошибок (`ruff check .`)
- [ ] Код отформатирован (`black .`)
- [ ] Нет print() в production коде (используется logging)
- [ ] Нет закомментированного кода
- [ ] Импорты отсортированы (isort / ruff)

## Примеры проверок

### Пример 1: Безопасный SQL

```python
# ❌ ПЛОХО: SQL injection
def get_user(name: str):
    cursor.execute(f"SELECT * FROM users WHERE name = '{name}'")

# ✅ ХОРОШО: параметризованный запрос
def get_user(name: str) -> User | None:
    cursor.execute("SELECT * FROM users WHERE name = %s", (name,))
    return cursor.fetchone()
```

### Пример 2: Правильный async

```python
# ❌ ПЛОХО: sync I/O в async функции блокирует event loop
async def get_user(user_id: int) -> User:
    import requests  # sync!
    response = requests.get(f"/api/users/{user_id}")
    return User(**response.json())

# ✅ ХОРОШО: async I/O
async def get_user(user_id: int) -> User:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/api/users/{user_id}")
        response.raise_for_status()
        return User(**response.json())
```

### Пример 3: Типизация

```python
# ❌ ПЛОХО
def process(items):
    return [x["name"] for x in items if x.get("active")]

# ✅ ХОРОШО
from dataclasses import dataclass

@dataclass
class Item:
    name: str
    active: bool

def process(items: list[Item]) -> list[str]:
    return [item.name for item in items if item.active]
```

## Быстрая проверка перед коммитом

```bash
# 1. Форматирование
black .

# 2. Линтер
ruff check .

# 3. Типы
mypy . --ignore-missing-imports

# 4. Тесты
pytest --tb=short -q

# 5. Безопасность зависимостей
pip-audit

# 6. Проверить на TODO/FIXME
git diff --cached | grep -i "TODO\|FIXME\|HACK\|XXX"
```
