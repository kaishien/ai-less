# День 4 • MCP: использование и разработка серверов

## 📋 Темы:

- 🏗️ Что такое MCP: протокол, не фреймворк (15 мин)
- 🔌 Готовые MCP-серверы: топ для разработчика (20 мин)
- 🛠️ Примитивы MCP: Tools, Resources, Prompts (15 мин)
- 🐍 Пишем MCP-сервер на Python (30 мин)
- 🗄️ Сценарий: mock-БД сотрудников (20 мин)
- ⚡ Практика (60 мин)

---

### 🏗️ MCP: что это на самом деле

MCP (Model Context Protocol) — открытый стандарт от Anthropic (ноябрь 2024), описывающий **как AI-модель взаимодействует с внешними инструментами**.

Не язык, не фреймворк, не библиотека. **Протокол** — набор правил обмена сообщениями поверх JSON-RPC 2.0.

**До MCP:** каждый инструмент — своя интеграция под каждую модель. Cursor интегрировал GitHub по-своему, ChatGPT — по-своему.

**После MCP:** один сервер — работает в Cursor, Claude Desktop, VS Code Copilot, любом MCP-клиенте.

> Похоже на то, что LSP (Language Server Protocol) сделал для поддержки языков в редакторах.

---

### 🏗️ Архитектура: клиент — хост — сервер

```
┌─────────────────────────────┐
│         Host (Cursor)        │
│  ┌──────────┐  ┌──────────┐ │
│  │ MCP      │  │ MCP      │ │
│  │ Client 1 │  │ Client 2 │ │
│  └────┬─────┘  └────┬─────┘ │
└───────┼─────────────┼───────┘
        │             │
   ┌────▼────┐   ┌────▼──────┐
   │ MCP     │   │ MCP       │
   │ Server  │   │ Server    │
   │ (github)│   │ (postgres)│
   └─────────┘   └───────────┘
```

**Host** — приложение (Cursor, Claude Desktop), управляет соединениями.
**Client** — встроен в host, одно соединение = один сервер.
**Server** — ваш процесс, предоставляет инструменты модели.

---

### 🏗️ Транспорты

MCP поддерживает два транспорта:

**stdio (локальный):**
- Host запускает сервер как дочерний процесс
- Общение через stdin/stdout
- Для локальных инструментов (файловая система, БД, CLI)

```json
{
  "mcpServers": {
    "my-server": {
      "command": "python",
      "args": ["server.py"],
      "env": { "DB_URL": "..." }
    }
  }
}
```

**SSE / HTTP (удалённый):**
- Сервер — отдельный HTTP-процесс
- Для облачных сервисов, командных серверов
- Требует аутентификации

---

### 🔌 Топ MCP-серверов для разработчика

| Сервер | Что даёт агенту | Установка |
|---|---|---|
| **github** | PR, issues, репозитории, поиск по коду | `npx @modelcontextprotocol/server-github` |
| **postgres** | SQL-запросы к БД, анализ схемы | `npx @modelcontextprotocol/server-postgres` |
| **playwright** | Управление браузером, e2e-тесты | `npx @playwright/mcp@latest` |
| **filesystem** | Чтение/запись файлов в заданных директориях | `npx @modelcontextprotocol/server-filesystem` |
| **fetch** | HTTP-запросы, scraping веб-страниц | `npx @modelcontextprotocol/server-fetch` |
| **docker** | Контейнеры, образы, логи | `docker run mcp/docker` |

**Каталог:** `cursor.directory/mcp` — более 1000 серверов.

---

### 🔌 Подключение в Cursor

`Cursor Settings → Features → MCP → + Add New MCP Server`

Или вручную в `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://localhost:5432/mydb"]
    }
  }
}
```

После добавления: Cursor Agent видит инструменты и может вызывать их по запросу.

---

### 🛠️ Примитивы MCP

MCP-сервер может предоставлять три типа объектов:

**Tools** — функции, которые модель может вызвать:
```python
@mcp.tool()
def search_employees(query: str, department: str | None = None) -> list[dict]:
    """Поиск сотрудников по имени или должности."""
    ...
```

**Resources** — данные, которые модель может прочитать (как файлы или URL):
```python
@mcp.resource("employees://list")
def employee_list() -> str:
    """Полный список сотрудников в формате JSON."""
    ...
```

**Prompts** — шаблоны промптов с параметрами (reusable conversation starters):
```python
@mcp.prompt()
def hr_query_prompt(question: str) -> str:
    return f"Ответь на вопрос по HR-базе: {question}"
```

Для большинства практических задач достаточно **Tools**.

---

### 🐍 Python MCP SDK: быстрый старт

Установка:
```bash
pip install mcp
# или с uv (рекомендуется)
uv add mcp
```

Минимальный сервер:

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("hello-server")

@mcp.tool()
def greet(name: str) -> str:
    """Поприветствовать пользователя по имени."""
    return f"Привет, {name}!"

if __name__ == "__main__":
    mcp.run()  # stdio transport по умолчанию
```

Запуск и тест:
```bash
python server.py
# В отдельном терминале через MCP inspector:
npx @modelcontextprotocol/inspector python server.py
```

---

### 🐍 Tool schema: типизация через аннотации

FastMCP автоматически генерирует JSON Schema из Python type hints:

```python
from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel

mcp = FastMCP("typed-server")

class SearchParams(BaseModel):
    query: str
    department: str | None = None
    limit: int = 10

@mcp.tool()
def search_employees(params: SearchParams) -> list[dict]:
    """
    Поиск сотрудников в корпоративной базе.
    
    Args:
        params: Параметры поиска — запрос, опциональный отдел, лимит результатов
    """
    results = db.search(params.query, params.department, params.limit)
    return [emp.dict() for emp in results]
```

Описание функции (docstring) становится описанием инструмента для модели — пишите его тщательно.

---

### 🗄️ Сценарий: mock-БД сотрудников

Практический сценарий по ТЗ: агент должен обращаться к корпоративной базе без прямого доступа к production-данным.

**Архитектура:**
```
Cursor Agent
    │
    ▼ MCP tool call: search_employees(query="Иван")
MCP Server (Python)
    │
    ▼ читает JSON / SQLite (синтетические данные)
[employees.json / employees.db]
    │
    ▼ возвращает результат
Cursor Agent → включает в ответ
```

**Что реализуем:**
- `search_employees` — поиск по имени/должности
- `get_employee` — карточка по ID
- `list_departments` — список отделов
- `get_org_chart` — иерархия для отдела

---

### 🗄️ Mock-БД: полная реализация

```python
import json
from pathlib import Path
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("hr-directory")

EMPLOYEES = json.loads(Path("employees.json").read_text())

@mcp.tool()
def search_employees(query: str, department: str | None = None) -> list[dict]:
    """Поиск сотрудников по имени или должности."""
    results = [
        e for e in EMPLOYEES
        if query.lower() in e["name"].lower()
        or query.lower() in e["position"].lower()
    ]
    if department:
        results = [e for e in results if e["department"] == department]
    return results[:10]

@mcp.tool()
def get_employee(employee_id: int) -> dict | str:
    """Получить полную карточку сотрудника по ID."""
    emp = next((e for e in EMPLOYEES if e["id"] == employee_id), None)
    return emp if emp else f"Сотрудник с ID {employee_id} не найден"

@mcp.tool()
def list_departments() -> list[str]:
    """Список всех отделов компании."""
    return sorted(set(e["department"] for e in EMPLOYEES))

if __name__ == "__main__":
    mcp.run()
```

---

### 🗄️ Подключение к Cursor

После написания сервера — добавить в `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "hr-directory": {
      "command": "python",
      "args": ["/absolute/path/to/server.py"],
      "env": {}
    }
  }
}
```

**Проверка:** перезапустить Cursor → в Agent-режиме написать:
```
Найди всех сотрудников из отдела Engineering с должностью Senior
```

Агент должен вызвать `search_employees` и вернуть реальные данные из вашего JSON.

---

### ⚠️ Что может пойти не так

**Сервер не запускается:**
- Проверить путь Python (используйте абсолютный путь или `uv run`)
- `npx @modelcontextprotocol/inspector python server.py` — отладка в браузере

**Инструмент не вызывается:**
- Docstring слишком размыт — агент не понимает, когда использовать
- Пропишите явно: «Используй этот инструмент когда нужно найти сотрудника»

**Ошибка в tool — агент зависает:**
```python
@mcp.tool()
def search_employees(query: str) -> list[dict] | str:
    try:
        return db.search(query)
    except Exception as e:
        return f"Ошибка поиска: {e}"  # Возвращать ошибку как строку, не raise
```

---

### 🎯 Итоги дня

**Что взять с собой:**

- **MCP = JSON-RPC протокол** — один сервер работает в любом MCP-клиенте
- **stdio для локальных инструментов** — запускается как дочерний процесс Cursor
- **FastMCP + type hints** — минимальный boilerplate, схема генерируется автоматически
- **Docstring = описание для модели** — пишите его так, чтобы агент знал когда вызывать
- **Возвращайте ошибки строкой**, не raise — агент может восстановиться
- **MCP + RAG** — следующий уровень: сервер, который поднимает вектоный поиск по документам

**Следующее занятие (пятница — соло-проект):** Самостоятельно — API-клиент + базовый RAG-пайплайн.
