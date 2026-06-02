---
name: api-integration
description: Интеграция с внешними API. Используй когда нужно создать API клиент, настроить retry механизм, rate limiting или авторизацию (OAuth, JWT).
---

# API Integration Skill

Используй этот навык для интеграции с внешними REST, GraphQL или WebSocket API.

## Когда использовать

- Нужно подключиться к внешнему API
- Требуется создать HTTP клиент с обработкой ошибок
- Необходим retry механизм для failed запросов
- Нужен rate limiting для ограничения частоты запросов
- Требуется настроить авторизацию (OAuth, JWT, API keys)

## Инструкции

### 1. REST API Client

```typescript
// Создай базовый HTTP клиент с обработкой ошибок
class ApiClient {
  private baseURL: string;
  private headers: Record<string, string>;

  constructor(baseURL: string, apiKey?: string) {
    this.baseURL = baseURL;
    this.headers = {
      'Content-Type': 'application/json',
      ...(apiKey && { 'Authorization': `Bearer ${apiKey}` })
    };
  }

  async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: { ...this.headers, ...options.headers }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  post<T>(endpoint: string, data: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
}
```

### 2. Retry механизм

```typescript
// Добавь автоматические повторные попытки при ошибках
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError!;
}
```

### 3. Rate Limiting

```typescript
// Ограничение частоты запросов
class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(
    private maxConcurrent: number,
    private minInterval: number
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    while (this.running >= this.maxConcurrent) {
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.running++;
    
    try {
      return await fn();
    } finally {
      await new Promise(resolve => setTimeout(resolve, this.minInterval));
      this.running--;
      this.queue.shift()?.();
    }
  }
}
```

## Примеры использования

```typescript
// Инициализация клиента
const api = new ApiClient('https://api.example.com', process.env.API_KEY);

// Использование с retry
const data = await withRetry(() => api.get('/users'));

// С rate limiting
const limiter = new RateLimiter(5, 200); // 5 запросов, минимум 200мс между ними
const result = await limiter.execute(() => api.post('/data', { value: 123 }));
```

## Чеклист
- [ ] Добавлена обработка ошибок
- [ ] Настроена авторизация
- [ ] Реализован retry механизм
- [ ] Добавлен rate limiting при необходимости
- [ ] Логируются ошибки API
