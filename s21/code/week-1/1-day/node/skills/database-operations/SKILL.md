---
name: database-operations
description: Работа с базами данных. Используй для создания безопасных SQL запросов (prepared statements), транзакций, миграций и оптимизации производительности БД.
---

# Database Operations Skill

Используй этот навык для безопасной и эффективной работы с базами данных.

## Когда использовать

- Нужно создать или изменить схему базы данных
- Требуются CRUD операции с защитой от SQL injection
- Необходима оптимизация запросов и индексы
- Нужны транзакции для атомарных операций
- Требуется создать миграции

## Инструкции

### 1. Безопасные запросы (Prepared Statements)

```typescript
// PostgreSQL с использованием pg
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// ВСЕГДА используй параметризованные запросы
async function getUser(userId: number) {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  return result.rows[0];
}

async function createUser(name: string, email: string) {
  const result = await pool.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [name, email]
  );
  return result.rows[0];
}
```

### 2. Транзакции

```typescript
// Используй транзакции для атомарных операций
async function transferMoney(fromId: number, toId: number, amount: number) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Снятие со счета
    await client.query(
      'UPDATE accounts SET balance = balance - $1 WHERE user_id = $2',
      [amount, fromId]
    );
    
    // Пополнение счета
    await client.query(
      'UPDATE accounts SET balance = balance + $1 WHERE user_id = $2',
      [amount, toId]
    );
    
    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### 3. Миграции

```sql
-- migrations/001_create_users_table.sql
-- Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по email
CREATE INDEX idx_users_email ON users(email);

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

### 4. ORM пример (Prisma)

```prisma
// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())

  @@index([authorId])
}
```

```typescript
// Использование Prisma Client
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Создание пользователя с постом
async function createUserWithPost(name: string, email: string, postTitle: string) {
  return await prisma.user.create({
    data: {
      name,
      email,
      posts: {
        create: {
          title: postTitle,
        },
      },
    },
    include: {
      posts: true,
    },
  });
}

// Поиск с пагинацией
async function getPaginatedPosts(page: number, limit: number) {
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      skip: (page - 1) * limit,
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
    prisma.post.count(),
  ]);

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
```

## Чеклист
- [ ] Используются параметризованные запросы (защита от SQL injection)
- [ ] Добавлены индексы для часто используемых полей
- [ ] Транзакции для атомарных операций
- [ ] Создан пул соединений
- [ ] Обработка ошибок и откат транзакций
- [ ] Миграции версионированы
