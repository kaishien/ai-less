---
name: database-operations
description: Работа с базами данных. Используй для создания безопасных SQL запросов (параметризованные запросы), транзакций, миграций и оптимизации производительности БД.
---

# Database Operations Skill

Используй этот навык для безопасной и эффективной работы с базами данных.

## Когда использовать

- Нужно создать или изменить схему базы данных
- Требуются CRUD операции с защитой от SQL injection
- Необходима оптимизация запросов и индексы
- Нужны транзакции для атомарных операций
- Требуется создать миграции (Alembic)

## Инструкции

### 1. Безопасные запросы (psycopg2)

```python
import os
import psycopg2
from psycopg2.pool import ThreadedConnectionPool

pool = ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    host=os.getenv("DB_HOST"),
    dbname=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
)


def get_user(user_id: int) -> dict | None:
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            # ВСЕГДА используй параметризованные запросы
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if row is None:
                return None
            columns = [desc[0] for desc in cur.description]
            return dict(zip(columns, row))
    finally:
        pool.putconn(conn)


def create_user(name: str, email: str) -> dict:
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (name, email) VALUES (%s, %s) RETURNING *",
                (name, email),
            )
            conn.commit()
            row = cur.fetchone()
            columns = [desc[0] for desc in cur.description]
            return dict(zip(columns, row))
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
```

### 2. Транзакции

```python
def transfer_money(from_id: int, to_id: int, amount: float) -> dict:
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE accounts SET balance = balance - %s WHERE user_id = %s",
                (amount, from_id),
            )
            cur.execute(
                "UPDATE accounts SET balance = balance + %s WHERE user_id = %s",
                (amount, to_id),
            )
        conn.commit()
        return {"success": True}
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
```

### 3. Миграции (Alembic)

```bash
alembic init alembic
alembic revision --autogenerate -m "create_users_table"
alembic upgrade head
```

```python
# alembic/versions/001_create_users_table.py
from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime,
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("idx_users_email", "users", ["email"])


def downgrade() -> None:
    op.drop_table("users")
```

### 4. ORM (SQLAlchemy)

```python
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    posts: Mapped[list["Post"]] = relationship(back_populates="author")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str | None] = mapped_column(String, nullable=True)
    published: Mapped[bool] = mapped_column(default=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    author: Mapped["User"] = relationship(back_populates="posts")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# Создание пользователя с постом
async def create_user_with_post(
    session: AsyncSession, name: str, email: str, post_title: str
) -> User:
    user = User(name=name, email=email, posts=[Post(title=post_title)])
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


# Поиск с пагинацией
from sqlalchemy import select, func as sqlfunc


async def get_paginated_posts(
    session: AsyncSession, page: int, limit: int
) -> dict:
    offset = (page - 1) * limit
    posts_q = select(Post).offset(offset).limit(limit).order_by(Post.created_at.desc())
    total_q = select(sqlfunc.count(Post.id))

    posts_result = await session.execute(posts_q)
    total_result = await session.execute(total_q)

    return {
        "posts": posts_result.scalars().all(),
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_result.scalar(),
            "pages": -(-total_result.scalar() // limit),  # ceil division
        },
    }
```

## Чеклист
- [ ] Используются параметризованные запросы (защита от SQL injection)
- [ ] Добавлены индексы для часто используемых полей
- [ ] Транзакции для атомарных операций
- [ ] Создан пул соединений
- [ ] Обработка ошибок и откат транзакций
- [ ] Миграции версионированы (Alembic)
- [ ] Используется async SQLAlchemy для async приложений
