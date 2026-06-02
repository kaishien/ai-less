---
globs: ['*.py']
alwaysApply: false
---

# FastAPI Conventions

Соглашения и лучшие практики для разработки FastAPI приложений.

## Правила

### 1. Структура роутеров

```python
# ✅ ХОРОШО: роутер с префиксом и тегами
from fastapi import APIRouter, Depends, HTTPException, status
from app.dependencies import get_current_user
from app.schemas import UserCreate, UserResponse
from app.services import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    service: UserService = Depends(),
    _: dict = Depends(get_current_user),
) -> UserResponse:
    user = await service.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    service: UserService = Depends(),
) -> UserResponse:
    return await service.create(body)
```

### 2. Pydantic схемы

```python
# ✅ ХОРОШО: разделяй входные и выходные схемы
from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    created_at: datetime

# ❌ ПЛОХО: одна схема для всего
class User(BaseModel):
    id: int | None = None
    name: str | None = None
    email: str | None = None
    password: str | None = None  # никогда не возвращай пароль в ответе
```

### 3. Dependency Injection

```python
# ✅ ХОРОШО: зависимости через Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    user = await verify_token(token, session)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# Использование в роутере
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
```

### 4. Сервисный слой

```python
# ✅ ХОРОШО: бизнес-логика в сервисах, не в роутерах
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


class UserService:
    def __init__(self, session: AsyncSession = Depends(get_session)) -> None:
        self.session = session

    async def get_by_id(self, user_id: int) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create(self, data: UserCreate) -> User:
        user = User(
            name=data.name,
            email=data.email,
            hashed_password=hash_password(data.password),
        )
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user
```

### 5. Middleware

```python
# ✅ ХОРОШО: middleware для логирования и метрик
import time
from fastapi import Request

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start

    logger.info(
        "Request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round(duration * 1000, 2),
    )
    return response
```

### 6. Background Tasks

```python
# ✅ ХОРОШО: фоновые задачи для не-критичных операций
from fastapi import BackgroundTasks


async def send_welcome_email(email: str) -> None:
    # долгая операция — не блокируем ответ
    await email_client.send(email, subject="Welcome!")


@router.post("/users", status_code=201)
async def create_user(
    body: UserCreate,
    background_tasks: BackgroundTasks,
    service: UserService = Depends(),
) -> UserResponse:
    user = await service.create(body)
    background_tasks.add_task(send_welcome_email, user.email)
    return user
```

### 7. Структура проекта

```
app/
├── api/
│   ├── v1/
│   │   ├── users.py
│   │   ├── posts.py
│   │   └── __init__.py
│   └── __init__.py
├── core/
│   ├── config.py       # Pydantic settings
│   ├── security.py     # JWT, password hashing
│   └── logging.py
├── db/
│   ├── models.py       # SQLAlchemy models
│   ├── session.py      # engine, SessionLocal
│   └── migrations/     # Alembic
├── schemas/            # Pydantic schemas
├── services/           # Business logic
├── dependencies.py     # FastAPI Depends
└── main.py             # app factory
```

### 8. Конфигурация

```python
# ✅ ХОРОШО: Pydantic Settings для конфига
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 30
    debug: bool = False


settings = Settings()
```

## Применение правил
1. Разделяй роутеры, сервисы, схемы и модели
2. Используй Pydantic для всей валидации
3. Dependency Injection через Depends
4. Бизнес-логика — в сервисах, не в роутерах
5. Разные схемы для ввода и вывода (не возвращай пароли)
6. Middleware для сквозной функциональности
7. Background Tasks для не-критичных операций
8. Конфиг через pydantic-settings
