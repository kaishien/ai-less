---
name: error-handling
description: Обработка ошибок. Используй для создания custom exception классов, централизованной обработки ошибок, валидации данных (Pydantic) и graceful shutdown.
---

# Error Handling Skill

Используй этот навык для создания надежных приложений с правильной обработкой ошибок.

## Когда использовать

- Нужна централизованная обработка ошибок в приложении
- Требуется создать custom типы исключений
- Необходима валидация входных данных с детальными сообщениями
- Нужно логирование ошибок
- Требуется graceful shutdown и error recovery

## Инструкции

### 1. Custom Exception Classes

```python
class AppError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        is_operational: bool = True,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.is_operational = is_operational


class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


class NotFoundError(AppError):
    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found", status_code=404)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Unauthorized") -> None:
        super().__init__(message, status_code=401)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Forbidden") -> None:
        super().__init__(message, status_code=403)
```

### 2. Exception Handlers (FastAPI)

```python
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

app = FastAPI()


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    logger.error(
        "AppError",
        extra={
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": exc.message,
            "path": str(request.url),
            "method": request.method,
        },
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": exc.message},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error")
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal server error"},
    )


# Использование в endpoint
@app.get("/users/{user_id}")
async def get_user(user_id: int):
    user = await find_user(user_id)
    if user is None:
        raise NotFoundError("User")
    return user
```

### 3. Result type (без исключений)

```python
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")
E = TypeVar("E", bound=Exception)


@dataclass
class Ok(Generic[T]):
    value: T
    success: bool = True


@dataclass
class Err(Generic[E]):
    error: E
    success: bool = False


Result = Ok[T] | Err[E]


async def safe_fetch(user_id: int) -> Result:
    try:
        data = await fetch_user_data(user_id)
        return Ok(data)
    except Exception as e:
        return Err(e)


# Использование
result = await safe_fetch(user_id)
if result.success:
    print("Data:", result.value)
else:
    print("Error:", result.error)
```

### 4. Валидация с Pydantic

```python
from pydantic import BaseModel, EmailStr, field_validator, model_validator
import re


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    age: int
    password: str

    @field_validator("name")
    @classmethod
    def name_min_length(cls, v: str) -> str:
        if len(v) < 2:
            raise ValueError("Имя должно быть минимум 2 символа")
        return v

    @field_validator("age")
    @classmethod
    def age_min(cls, v: int) -> int:
        if v < 18:
            raise ValueError("Возраст должен быть минимум 18")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль минимум 8 символов")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Пароль должен содержать заглавную букву")
        if not re.search(r"[0-9]", v):
            raise ValueError("Пароль должен содержать цифру")
        return v


# FastAPI автоматически вернет 422 с деталями при ошибке валидации
@app.post("/users", status_code=201)
async def create_user(body: UserCreate):
    return await save_user(body)
```

### 5. Graceful Shutdown

```python
import asyncio
import signal
import logging

logger = logging.getLogger(__name__)


async def shutdown(signal_name: str, loop: asyncio.AbstractEventLoop) -> None:
    logger.info(f"{signal_name} received, shutting down...")

    tasks = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
    for task in tasks:
        task.cancel()

    await asyncio.gather(*tasks, return_exceptions=True)

    # Закрываем соединения с БД
    await engine.dispose()
    logger.info("Database connections closed")

    loop.stop()


def setup_graceful_shutdown() -> None:
    loop = asyncio.get_event_loop()

    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(
            sig,
            lambda s=sig: asyncio.create_task(shutdown(s.name, loop)),
        )
```

## Чеклист
- [ ] Используются custom exception классы
- [ ] Добавлен глобальный exception handler (FastAPI)
- [ ] Валидация данных через Pydantic
- [ ] Логирование ошибок (structlog / logging)
- [ ] Graceful shutdown реализован
- [ ] Различные HTTP коды для разных ошибок
- [ ] Operational vs non-operational ошибки разделены
