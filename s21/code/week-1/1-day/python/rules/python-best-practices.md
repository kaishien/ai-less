---
globs: ['*.py']
alwaysApply: false
---

# Python Best Practices

Правила и рекомендации для написания качественного Python кода.

## Правила

### 1. Аннотации типов (Type Hints)

```python
# ✅ ХОРОШО: явные аннотации параметров и возвращаемых значений
def calculate_total(price: float, quantity: int) -> float:
    return price * quantity

# ❌ ПЛОХО: отсутствие аннотаций
def calculate_total(price, quantity):
    return price * quantity

# ✅ ХОРОШО: dataclass для структур данных
from dataclasses import dataclass

@dataclass
class User:
    id: int
    name: str
    email: str

# ✅ ХОРОШО: TypedDict для словарей с фиксированной схемой
from typing import TypedDict

class UserDict(TypedDict):
    id: int
    name: str
    email: str
```

### 2. Избегай Any

```python
# ❌ ПЛОХО: использование Any
from typing import Any
def process_data(data: Any) -> Any:
    return data["value"]

# ✅ ХОРОШО: конкретный тип или TypeVar
from typing import TypeVar
T = TypeVar("T", bound=dict)

def process_data(data: dict[str, str]) -> str:
    return data["value"]

# ✅ ХОРОШО: Protocol для структурной типизации
from typing import Protocol

class HasValue(Protocol):
    value: str

def process_data(data: HasValue) -> str:
    return data.value
```

### 3. Null Safety

```python
# ✅ ХОРОШО: явная проверка на None
def get_display_name(user: User | None) -> str:
    if user is None:
        return "Anonymous"
    return user.name

# ✅ ХОРОШО: walrus operator для компактных проверок
if user := find_user(user_id):
    print(user.name)

# ✅ ХОРОШО: Optional и явная обработка
from typing import Optional

def find_user(user_id: int) -> Optional[User]:
    ...
```

### 4. Immutability

```python
# ✅ ХОРОШО: frozen dataclass для неизменяемых объектов
from dataclasses import dataclass

@dataclass(frozen=True)
class Config:
    api_url: str
    timeout: int

# ✅ ХОРОШО: tuple вместо list для неизменяемых последовательностей
ALLOWED_ROLES: tuple[str, ...] = ("admin", "user", "guest")

# ✅ ХОРОШО: константы в верхнем регистре
MAX_RETRIES: int = 3
DEFAULT_TIMEOUT: float = 30.0
```

### 5. Генераторы и comprehensions

```python
# ✅ ХОРОШО: list comprehension вместо map/filter
active_users = [u for u in users if u.is_active]
names = [u.name.upper() for u in users]

# ✅ ХОРОШО: generator для ленивых вычислений
def generate_ids(start: int, count: int):
    for i in range(count):
        yield start + i

# ✅ ХОРОШО: dict comprehension
role_map = {user.id: user.role for user in users}
```

### 6. Context Managers

```python
# ✅ ХОРОШО: with для управления ресурсами
with open("file.txt") as f:
    data = f.read()

# ✅ ХОРОШО: contextmanager для кастомных контекстов
from contextlib import contextmanager

@contextmanager
def db_transaction(conn):
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
```

### 7. Async/Await типизация

```python
# ✅ ХОРОШО: явная типизация async функций
import asyncio
from typing import Coroutine

async def fetch_user(user_id: int) -> User:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/api/users/{user_id}")
        response.raise_for_status()
        return User(**response.json())

# ✅ ХОРОШО: обработка ошибок в async
async def safe_fetch_user(user_id: int) -> User | None:
    try:
        return await fetch_user(user_id)
    except httpx.HTTPError as e:
        logger.error("Fetch error: %s", e)
        return None
```

### 8. Enums

```python
# ✅ ХОРОШО: Enum для перечислений
from enum import Enum, auto

class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"

# Использование в аннотациях
def set_role(user: User, role: UserRole) -> None:
    user.role = role

# ✅ ХОРОШО: IntEnum для числовых значений
from enum import IntEnum

class HttpStatus(IntEnum):
    OK = 200
    CREATED = 201
    BAD_REQUEST = 400
    UNAUTHORIZED = 401
    NOT_FOUND = 404
```

## Конфигурация инструментов

```toml
# pyproject.toml
[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = false
disallow_any_generics = true
disallow_untyped_defs = true
no_implicit_optional = true

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "B", "C4", "SIM"]
ignore = ["E501"]

[tool.black]
target-version = ["py312"]
line-length = 100
```

## Применение правил
1. Всегда используй type hints (mypy strict)
2. Избегай Any, используй Protocol или TypeVar
3. Предпочитай dataclass и TypedDict для структур данных
4. Используй Enum для фиксированных наборов значений
5. Применяй contextmanager для управления ресурсами
6. Типизируй async функции явно
7. Используй frozen dataclass для неизменяемых объектов
