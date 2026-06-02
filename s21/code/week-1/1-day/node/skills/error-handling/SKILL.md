---
name: error-handling
description: Обработка ошибок. Используй для создания custom error классов, централизованной обработки ошибок, валидации данных и graceful shutdown.
---

# Error Handling Skill

Используй этот навык для создания надежных приложений с правильной обработкой ошибок.

## Когда использовать

- Нужна централизованная обработка ошибок в приложении
- Требуется создать custom типы ошибок
- Необходима валидация входных данных с детальными сообщениями
- Нужно логирование ошибок
- Требуется graceful shutdown и error recovery

## Инструкции

### 1. Custom Error Classes

```typescript
// Базовый класс для ошибок приложения
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Специфичные типы ошибок
class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}
```

### 2. Error Handler Middleware (Express)

```typescript
import { Request, Response, NextFunction } from 'express';

// Глобальный обработчик ошибок
function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Логирование ошибки
  console.error({
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Определение кода ответа
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      status: 'error',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }

  // Непредвиденные ошибки
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      message: error.message,
      stack: error.stack 
    }),
  });
}

// Обработчик для async функций
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Использование
app.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    throw new NotFoundError('User');
  }
  res.json(user);
}));

app.use(errorHandler);
```

### 3. Try-Catch с типизацией

```typescript
// Утилита для безопасного выполнения с обработкой ошибок
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}

// Использование
const result = await tryCatch(() => fetchUserData(userId));

if (result.success) {
  console.log('Data:', result.data);
} else {
  console.error('Error:', result.error.message);
}
```

### 4. Валидация с детальными ошибками

```typescript
import { z } from 'zod';

// Схема валидации
const userSchema = z.object({
  name: z.string().min(2, 'Имя должно быть минимум 2 символа'),
  email: z.string().email('Некорректный email'),
  age: z.number().min(18, 'Возраст должен быть минимум 18'),
  password: z.string()
    .min(8, 'Пароль минимум 8 символов')
    .regex(/[A-Z]/, 'Пароль должен содержать заглавную букву')
    .regex(/[0-9]/, 'Пароль должен содержать цифру'),
});

// Middleware для валидации
function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

// Использование
app.post('/users', validate(userSchema), asyncHandler(async (req, res) => {
  const user = await createUser(req.body);
  res.status(201).json(user);
}));
```

### 5. Graceful Shutdown

```typescript
// Корректное завершение работы приложения
function setupGracefulShutdown(server: any) {
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, closing server gracefully...`);
    
    // Останавливаем прием новых подключений
    server.close(async () => {
      console.log('HTTP server closed');
      
      try {
        // Закрываем соединения с БД
        await pool.end();
        console.log('Database connections closed');
        
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Форсированное завершение через 10 секунд
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Обработка unhandled rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });
}
```

## Чеклист
- [ ] Используются custom error классы
- [ ] Добавлен глобальный error handler
- [ ] Async функции обернуты в asyncHandler
- [ ] Валидация данных перед обработкой
- [ ] Логирование ошибок
- [ ] Graceful shutdown реализован
- [ ] Различные HTTP коды для разных ошибок
