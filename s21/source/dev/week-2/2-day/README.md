# День 6 (Неделя 2) • LangChain: первый AI-агент

## 📋 Темы:

- 🗺️ LangChain в 2025: когда использовать (10 мин)
- 🔗 LCEL: цепочки через pipe-оператор (20 мин)
- 🛠️ Tools: @tool, схема, типизация (20 мин)
- 🤖 ReAct-агент: create_react_agent (20 мин)
- 📦 Структурированный вывод: with_structured_output (15 мин)
- 🧠 Память: RunnableWithMessageHistory (15 мин)
- ⚡ Практика (60 мин)

---

### 🗺️ LangChain в 2025: место в экосистеме

LangChain эволюционировал. Не фреймворк «для всего» — набор слоёв с разными уровнями абстракции:

| Пакет | Назначение | Когда использовать |
|---|---|---|
| `langchain-core` | Базовые интерфейсы, LCEL | Всегда, как фундамент |
| `langchain` | Chains, agents, retrieval | Стандартные паттерны |
| `langchain-openai` / `-anthropic` | Провайдеры | Конкретный LLM |
| `langgraph` | Граф-агенты с состоянием | Сложные сценарии, циклы |
| `langsmith` | Трассировка, отладка | Observability в prod |

**Когда LangChain достаточно:** линейные цепочки, простые ReAct-агенты, RAG с retriever.
**Когда нужен LangGraph:** циклы, ветвления, HITL, multi-agent — завтра.

---

### 🔗 LCEL: Runnable и pipe-оператор

LangChain Expression Language — унифицированный способ строить цепочки:

```python
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

llm = ChatOpenAI(model="gpt-4o")

chain = (
    ChatPromptTemplate.from_messages([
        ("system", "Ты — код-ревьюер. Отвечай кратко."),
        ("human",  "{code}")
    ])
    | llm
    | StrOutputParser()
)

result = await chain.ainvoke({"code": "def foo(): pass"})
```

Оператор `|` создаёт `RunnableSequence`. Любой компонент — `Runnable` с одинаковым интерфейсом: `invoke`, `ainvoke`, `stream`, `batch`.

---

### 🔗 LCEL: параллельность и ветвления

```python
from langchain_core.runnables import RunnableParallel, RunnableLambda

# Параллельный запуск
parallel = RunnableParallel(
    summary=summarize_chain,
    keywords=keywords_chain,
)
result = await parallel.ainvoke({"text": document})
# result = {"summary": "...", "keywords": [...]}

# Условное ветвление
from langchain_core.runnables import RunnableBranch

router = RunnableBranch(
    (lambda x: x["lang"] == "ru", russian_chain),
    (lambda x: x["lang"] == "en", english_chain),
    default_chain
)
```

---

### 🛠️ Tools: определение инструментов

LangChain `@tool` — то же, что MCP-инструменты, но для агентов внутри Python:

```python
from langchain_core.tools import tool
import subprocess

@tool
def run_git_diff() -> str:
    """Возвращает staged diff текущего репозитория (git diff --staged)."""
    result = subprocess.run(
        ["git", "diff", "--staged"],
        capture_output=True, text=True
    )
    return result.stdout or "Нет staged изменений"

@tool
def get_recent_commits(n: int = 5) -> str:
    """Возвращает последние N коммитов в формате oneline.
    
    Args:
        n: Количество коммитов (по умолчанию 5)
    """
    result = subprocess.run(
        ["git", "log", f"--oneline", f"-{n}"],
        capture_output=True, text=True
    )
    return result.stdout
```

Docstring становится описанием инструмента для модели — пишите точно.

---

### 🛠️ Tools: Pydantic-схема для сложных параметров

```python
from pydantic import BaseModel, Field
from langchain_core.tools import tool

class ReadFileArgs(BaseModel):
    path: str = Field(description="Путь к файлу")
    lines: int = Field(default=50, description="Количество строк с начала файла")

@tool(args_schema=ReadFileArgs)
def read_file(path: str, lines: int = 50) -> str:
    """Читает содержимое файла по указанному пути."""
    try:
        with open(path) as f:
            content = f.readlines()
        return "".join(content[:lines])
    except FileNotFoundError:
        return f"Файл не найден: {path}"
    except Exception as e:
        return f"Ошибка чтения: {e}"
```

**Правило:** инструмент никогда не должен поднимать исключение — только возвращать строку с описанием ошибки.

---

### 🤖 ReAct-агент: create_react_agent

ReAct (Reasoning + Acting) — стандартный паттерн: думаем → выбираем инструмент → смотрим на результат → думаем снова.

```python
from langchain.agents import create_react_agent, AgentExecutor
from langchain import hub

llm = ChatOpenAI(model="gpt-4o", temperature=0)
tools = [run_git_diff, get_recent_commits]

# Стандартный ReAct промпт из хаба
prompt = hub.pull("hwchase17/react")

agent = create_react_agent(llm, tools, prompt)
executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,        # показывает chain-of-thought
    max_iterations=10,
    handle_parsing_errors=True
)

result = await executor.ainvoke({
    "input": "Предложи сообщение для коммита в формате Conventional Commits"
})
```

---

### 🤖 Tool Calling Agent (предпочтительный в 2025)

`create_react_agent` использует текстовый формат. Современный подход — tool calling через API провайдера:

```python
from langchain.agents import create_tool_calling_agent

# Работает с OpenAI, Anthropic, GigaChat (новые версии)
agent = create_tool_calling_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
```

**Разница:**
- `react`: парсит текстовый `Thought/Action/Observation` цикл — ненадёжно
- `tool_calling`: нативный JSON tool call от провайдера — надёжнее, стабильнее

---

### 📦 Структурированный вывод

Когда нужен не текст, а структурированные данные:

```python
from pydantic import BaseModel
from typing import Literal

class CommitMessage(BaseModel):
    type: Literal["feat", "fix", "refactor", "docs", "chore"]
    scope: str | None
    description: str
    breaking: bool = False

llm_structured = ChatOpenAI(model="gpt-4o").with_structured_output(CommitMessage)

chain = (
    ChatPromptTemplate.from_template(
        "Проанализируй diff и предложи коммит:\n{diff}"
    )
    | llm_structured
)

commit: CommitMessage = await chain.ainvoke({"diff": staged_diff})
print(f"{commit.type}({commit.scope}): {commit.description}")
# feat(auth): add email validation before registration
```

---

### 🧠 Память: RunnableWithMessageHistory

Для хранения истории диалога между вызовами:

```python
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_community.chat_message_histories import ChatMessageHistory

# In-memory хранилище (для prod замените на Redis или DB)
store: dict[str, ChatMessageHistory] = {}

def get_session_history(session_id: str) -> ChatMessageHistory:
    if session_id not in store:
        store[session_id] = ChatMessageHistory()
    return store[session_id]

chain_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)

await chain_with_history.ainvoke(
    {"input": "Что такое LCEL?"},
    config={"configurable": {"session_id": "user-123"}}
)
```

---

### 🤔 LangChain или голый SDK?

LangChain добавляет абстракцию. Иногда это лишнее:

| Задача | Рекомендация |
|---|---|
| Один-два LLM-вызова | Голый `openai` SDK |
| Цепочка из 3+ шагов | LCEL |
| Агент с 2-5 инструментами | `create_tool_calling_agent` |
| Сложный граф с циклами, HITL | LangGraph |
| RAG с retrieval | LangChain `retriever` + LCEL |

**Когда LangChain мешает:** если вам нужен полный контроль над промптами и потоком — пишите напрямую. LangChain удобен для стандартных паттернов, но добавляет debugging overhead.

---

### 🎯 Итоги дня

**Что взять с собой:**

- **LCEL `|` оператор** — compose любых Runnable в цепочку с batch/stream из коробки
- **`@tool` + docstring** — агент выбирает инструмент по описанию; пишите его точно
- **`create_tool_calling_agent`** — предпочтительнее ReAct для совместимых провайдеров
- **`with_structured_output`** — Pydantic схема вместо парсинга текста
- **Инструмент не поднимает исключения** — возвращает строку с ошибкой

**Следующее занятие:** LangGraph — StateGraph, память, условные переходы.
