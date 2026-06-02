# День 7 (Неделя 2) • LangGraph: StateGraph, память, сложные сценарии

## 📋 Темы:

- 🤔 Почему граф: когда цепочки ломаются (15 мин)
- 🏗️ StateGraph: State, Node, Edge (25 мин)
- 🔀 Conditional edges: маршрутизация (20 мин)
- 💾 Checkpointers: память между вызовами (20 мин)
- ⏸️ Interrupts: пауза для HITL (preview) (10 мин)
- 🗺️ Визуализация графа (10 мин)
- ⚡ Практика (60 мин)

---

### 🤔 Когда цепочки перестают работать

LCEL-цепочки хороши для линейных пайплайнов. Они ломаются когда:

- **Нужны циклы**: агент проверяет результат и при неудаче повторяет
- **Нужны ветвления**: разный путь в зависимости от данных
- **Нужна память**: состояние персистится между вызовами пользователя
- **Нужен HITL**: остановить, спросить человека, продолжить
- **Нужна изоляция**: ошибка в одном узле не ломает весь граф

LangGraph решает всё это через модель **граф состояний**.

---

### 🏗️ StateGraph: четыре концепции

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

# 1. State — общий объект, который путешествует по графу
class TicketState(TypedDict):
    input_text: str
    language: str | None
    category: str | None
    priority: str | None
    summary: str | None
    draft_reply: str | None

# 2. Node — функция: State → частичное обновление State
def detect_language(state: TicketState) -> dict:
    lang = llm.invoke(f"Определи язык (ru/en): {state['input_text']}")
    return {"language": lang.content.strip()}

# 3 & 4. Сборка графа + Edge
builder = StateGraph(TicketState)
builder.add_node("detect_language", detect_language)
builder.add_node("classify", classify_node)
builder.add_edge("detect_language", "classify")   # безусловное ребро
builder.set_entry_point("detect_language")
builder.add_edge("classify", END)

graph = builder.compile()
result = graph.invoke({"input_text": "Не могу войти в аккаунт"})
```

---

### 🏗️ State с накоплением сообщений

Для чат-агентов используйте `Annotated` + `add_messages` — LangGraph сам объединяет сообщения из разных узлов:

```python
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    # Обычные поля просто перезаписываются
    current_query: str
    retrieved_docs: list[dict]
    
    # messages накапливаются (не перезаписываются)
    messages: Annotated[list[BaseMessage], add_messages]

def agent_node(state: AgentState) -> dict:
    response = llm.invoke(state["messages"])
    return {"messages": [response]}  # добавится к существующим
```

---

### 🔀 Conditional Edges: маршрутизация

Узел-роутер возвращает строку — имя следующего узла:

```python
def route_by_severity(state: IncidentState) -> str:
    severity = state["severity"]
    signals = state["signals"]
    
    if signals.get("auth_failures"):
        return "auth_branch"
    elif signals.get("http_5xx_spike"):
        return "backend_branch"
    elif signals.get("db_timeouts"):
        return "db_branch"
    else:
        return "generic_branch"

# Регистрация условного перехода
builder.add_conditional_edges(
    "assess_severity",          # из этого узла
    route_by_severity,          # функция возвращает имя следующего
    {
        "auth_branch":    "auth_checks",
        "backend_branch": "backend_checks",
        "db_branch":      "db_checks",
        "generic_branch": "generic_checks",
    }
)
```

---

### 🔀 Цикл с условием выхода

```python
def should_continue(state: AgentState) -> str:
    last_message = state["messages"][-1]
    # Если последнее сообщение — вызов инструмента
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return END  # иначе завершаем

builder.add_node("agent", call_llm)
builder.add_node("tools", execute_tools)
builder.set_entry_point("agent")

builder.add_conditional_edges("agent", should_continue, {
    "tools": "tools",
    END: END
})
builder.add_edge("tools", "agent")  # после инструментов — обратно к агенту

graph = builder.compile()
```

Это стандартный ReAct-цикл в LangGraph.

---

### 💾 Checkpointers: персистентное состояние

Без чекпоинтера каждый вызов `graph.invoke()` начинает с нуля. С чекпоинтером — состояние сохраняется по `thread_id`:

```python
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver

# Dev: in-memory (теряется при перезапуске)
checkpointer = InMemorySaver()

# Prod: SQLite (персистентно)
checkpointer = SqliteSaver.from_conn_string("checkpoints.db")

graph = builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "session-42"}}

# Первый вызов
graph.invoke({"messages": [HumanMessage("Привет")]}, config=config)

# Второй вызов — граф помнит предыдущее состояние
graph.invoke({"messages": [HumanMessage("Что я сказал раньше?")]}, config=config)
```

---

### 💾 Инспекция состояния

```python
# Получить текущее состояние потока
snapshot = graph.get_state(config)
print(snapshot.values)          # всё состояние
print(snapshot.next)            # следующие узлы (если граф прерван)

# История всех состояний
for state in graph.get_state_history(config):
    print(state.created_at, state.values.get("messages", [])[-1])
```

Полезно для отладки и реализации UI «показать историю разговора».

---

### ⏸️ Interrupts: пауза перед действием

Граф можно прервать перед выполнением конкретного узла — для подтверждения человеком:

```python
from langgraph.types import interrupt

def create_pr_node(state: AgentState) -> dict:
    # Запросить подтверждение перед созданием PR
    confirmation = interrupt({
        "action": "create_pr",
        "title": state["pr_title"],
        "message": "Создать PR с этим заголовком?"
    })
    
    if confirmation["approved"]:
        github.create_pr(state["pr_title"])
        return {"status": "pr_created"}
    return {"status": "cancelled"}

# Компиляция с прерыванием
graph = builder.compile(
    checkpointer=checkpointer,
    interrupt_before=["create_pr_node"]  # альтернативный способ
)
```

Завтра разберём полный цикл interrupt → resume.

---

### 🗺️ Визуализация графа

```python
# ASCII-представление
print(graph.get_graph().draw_ascii())

# Mermaid (для документации)
print(graph.get_graph().draw_mermaid())

# PNG (требует graphviz)
graph.get_graph().draw_mermaid_png(output_file_path="graph.png")
```

Пример Mermaid-диаграммы из `draw_mermaid()`:
```
graph TD
    __start__ --> detect_language
    detect_language --> classify
    classify -->|auth| auth_branch
    classify -->|backend| backend_branch
    auth_branch --> compose_runbook
    backend_branch --> compose_runbook
    compose_runbook --> __end__
```

ТЗ требует сдать Mermaid-схемы для финального проекта — инструмент уже встроен.

---

### 🎯 Итоги дня

**Что взять с собой:**

- **State — TypedDict** с явными полями; `Annotated[list, add_messages]` для истории
- **Node — чистая функция**: State in → dict out (только изменённые поля)
- **Conditional edges** — функция-роутер возвращает строку с именем следующего узла
- **Checkpointer + thread_id** — персистентная память; `InMemorySaver` для dev, `SqliteSaver` для prod
- **`draw_mermaid()`** — визуализируйте граф во время разработки, ловите логические ошибки

**Следующее занятие:** HITL и fallback — полный цикл interrupt/resume, стратегии fallback, LangSmith.
