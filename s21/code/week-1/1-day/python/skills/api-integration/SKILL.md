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

### 1. REST API Client (httpx)

```python
import httpx
import os
from typing import Any


class ApiClient:
    def __init__(self, base_url: str, api_key: str | None = None) -> None:
        self.base_url = base_url.rstrip("/")
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        self._client = httpx.AsyncClient(headers=headers, timeout=30.0)

    async def __aenter__(self) -> "ApiClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self._client.aclose()

    async def request(self, method: str, endpoint: str, **kwargs: Any) -> Any:
        try:
            response = await self._client.request(
                method, f"{self.base_url}{endpoint}", **kwargs
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"HTTP {e.response.status_code}: {e.response.text}") from e

    async def get(self, endpoint: str) -> Any:
        return await self.request("GET", endpoint)

    async def post(self, endpoint: str, data: dict[str, Any]) -> Any:
        return await self.request("POST", endpoint, json=data)
```

### 2. Retry механизм (tenacity)

```python
import asyncio
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.ConnectError, httpx.TimeoutException)),
)
async def fetch_with_retry(client: ApiClient, endpoint: str) -> Any:
    return await client.get(endpoint)
```

Или вручную без библиотеки:

```python
async def with_retry(fn, max_retries: int = 3, delay: float = 1.0):
    last_error: Exception | None = None
    for attempt in range(max_retries):
        try:
            return await fn()
        except Exception as e:
            last_error = e
            if attempt < max_retries - 1:
                await asyncio.sleep(delay * (attempt + 1))
    raise last_error  # type: ignore[misc]
```

### 3. Rate Limiting

```python
import asyncio
from asyncio import Semaphore


class RateLimiter:
    def __init__(self, max_concurrent: int, min_interval: float) -> None:
        self._semaphore = Semaphore(max_concurrent)
        self._min_interval = min_interval

    async def execute(self, fn) -> Any:
        async with self._semaphore:
            result = await fn()
            await asyncio.sleep(self._min_interval)
            return result
```

## Примеры использования

```python
import asyncio

async def main() -> None:
    async with ApiClient("https://api.example.com", os.getenv("API_KEY")) as api:
        # Простой запрос
        data = await api.get("/users")

        # С retry
        data = await with_retry(lambda: api.get("/users"))

        # С rate limiting
        limiter = RateLimiter(max_concurrent=5, min_interval=0.2)
        result = await limiter.execute(lambda: api.post("/data", {"value": 123}))

asyncio.run(main())
```

## Чеклист
- [ ] Добавлена обработка ошибок
- [ ] Настроена авторизация
- [ ] Реализован retry механизм
- [ ] Добавлен rate limiting при необходимости
- [ ] Логируются ошибки API
- [ ] Используется async/await (httpx.AsyncClient)
- [ ] Клиент закрывается через context manager
