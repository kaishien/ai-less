# День 9 (Неделя 3) • Мультиагентные системы: Swarm и Supervisor

## 📋 Темы:

- 🤔 Когда НЕ нужна мультиагентность (10 мин)
- 🏗️ Архитектурные паттерны: Supervisor, Swarm, Handoff (25 мин)
- 🔗 Изоляция состояния и субграфы (20 мин)
- 💰 Токен-экономика мультиагентных систем (15 мин)
- 🛠️ Реализация Supervisor на LangGraph (20 мин)
- ⚡ Практика (70 мин)

---

### 🤔 Когда НЕ нужна мультиагентность

Первый вопрос: нужен ли вам второй агент вообще?

**Не добавляйте агентов, если:**
- Задачу решает один агент с 3–5 инструментами — это дешевле и проще
- Подзадачи не параллельны и не специализированы
- Контекстное окно не переполняется
- У вас нет опыта отлаживать мультиагентные системы

**Переходите к мультиагентности когда:**
- Один промпт пытается делать слишком много разных вещей → качество падает
- Подзадачи параллельны и независимы → ускорение
- Разные части системы разрабатывают разные команды
- Контекстное окно одного агента переполняется

> Правило: сначала решите задачу одним агентом. Рефакторинг в мультиагентную систему — когда появится конкретная проблема.

---

### 🏗️ Паттерны: Supervisor

**Supervisor** — центральный агент распределяет работу, изолированные субагенты выполняют.

```
User Query
    │
    ▼
[Supervisor LLM] ──► выбирает: tech_support | billing | sales
    │
    ├──► [TechSupport Agent]  ──► изолированный контекст
    ├──► [Billing Agent]      ──► изолированный контекст  
    └──► [Sales Agent]        ──► изолированный контекст
              │
              └──► результат возвращается Supervisor
                        │
                        ▼
                   финальный ответ
```

**Ключевые свойства:**
- У каждого субагента свой изолированный state
- В глобальный state возвращается только результат
- Supervisor принимает решение через structured output
- Экономичен по токенам: субагенты не видят историю друг друга

---

### 🏗️ Supervisor: реализация

```python
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel
from typing import Literal

class RouteDecision(BaseModel):
    next: Literal["tech_support", "billing", "sales", "FINISH"]
    reasoning: str

class SupervisorState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    next_agent: str
    final_answer: str | None

def supervisor_node(state: SupervisorState) -> dict:
    llm = ChatOpenAI(model="gpt-4o").with_structured_output(RouteDecision)
    decision = llm.invoke([
        SystemMessage("Ты — менеджер поддержки. Определи нужный отдел."),
        *state["messages"]
    ])
    return {"next_agent": decision.next}

def route_after_supervisor(state: SupervisorState) -> str:
    return state["next_agent"]

builder = StateGraph(SupervisorState)
builder.add_node("supervisor", supervisor_node)
builder.add_node("tech_support", tech_support_node)
builder.add_node("billing", billing_node)
builder.add_node("sales", sales_node)

builder.add_edge(START, "supervisor")
builder.add_conditional_edges("supervisor", route_after_supervisor)
# После каждого агента — обратно к supervisor для завершения
for agent in ["tech_support", "billing", "sales"]:
    builder.add_edge(agent, "supervisor")
```

---

### 🏗️ Паттерн: Swarm (децентрализованный)

Агенты видят общий контекст и могут передавать управление друг другу напрямую.

```python
from langgraph.prebuilt import create_react_agent
from langgraph_sdk import get_client

# Каждый агент знает о существовании других через свой system prompt
developer_agent = create_react_agent(
    llm,
    tools=[write_code, run_tests],
    state_modifier="""Ты — разработчик. Если QA найдёт проблему,
    исправь код. Если код одобрен (LGTM) — работа завершена."""
)

qa_agent = create_react_agent(
    llm,
    tools=[run_tests, analyze_code],
    state_modifier="""Ты — QA-инженер. Проверяй код на ошибки.
    Если всё OK — напиши LGTM. Иначе — опиши проблемы разработчику."""
)
```

**Когда Swarm хуже Supervisor:** общий контекст растёт с каждым ходом → агенты тратят токены на чужую историю.

---

### 🏗️ Паттерн: Handoff (прямая передача)

Агент завершает свою часть и явно передаёт управление следующему — без центрального менеджера:

```python
from langgraph.types import Command

def planner_node(state: AgentState) -> Command:
    plan = llm.invoke(f"Составь план статьи о: {state['topic']}")
    return Command(
        update={"plan": plan.content},
        goto="writer"  # явная передача управления
    )

def writer_node(state: AgentState) -> Command:
    article = llm.invoke(f"Напиши статью по плану:\n{state['plan']}")
    return Command(
        update={"article": article.content},
        goto=END
    )
```

Handoff — самый простой паттерн: когда порядок выполнения детерминирован.

---

### 🔗 Изоляция состояния: субграфы

Субграф — полноценный скомпилированный граф, используемый как узел в другом графе. Это основа иерархических систем.

```python
# Субграф: отдельный агент со своим state
class ResearchState(TypedDict):
    query: str
    search_results: list[str]
    summary: str

research_builder = StateGraph(ResearchState)
research_builder.add_node("search", search_node)
research_builder.add_node("summarize", summarize_node)
research_builder.add_edge("search", "summarize")
research_builder.add_edge("summarize", END)
research_subgraph = research_builder.compile()

# Родительский граф
class MainState(TypedDict):
    task: str
    research_result: str  # только итог субграфа

def call_researcher(state: MainState) -> dict:
    result = research_subgraph.invoke({"query": state["task"]})
    return {"research_result": result["summary"]}  # только нужное поле

main_builder = StateGraph(MainState)
main_builder.add_node("research", call_researcher)
```

---

### 💰 Токен-экономика мультиагентных систем

Каждый вызов LLM в агентной системе стоит денег. Посчитайте перед запуском в прод.

**Supervisor (пример):**
```
1 запрос пользователя:
  Supervisor call:     ~500 tokens  × $0.003 = $0.0015
  SubAgent call:       ~800 tokens  × $0.003 = $0.0024
  Supervisor (финал):  ~300 tokens  × $0.003 = $0.0009
  Итого: ~$0.005 за запрос

1000 запросов/день = $5/день = $150/месяц
```

**Swarm с 3 агентами по 3 раунда каждый:**
```
9 LLM-вызовов × растущий контекст → в 3-5× дороже Supervisor
```

**Оптимизации:**
- Используйте дешёвые модели для routing (gpt-4o-mini, claude-haiku)
- Дорогие модели только для «умной» работы
- Кешируйте системные промпты субагентов (prefix caching)

---

### 🎯 Итоги дня

**Что взять с собой:**

- **Сначала один агент** — переходите к мультиагентности когда появится конкретная проблема
- **Supervisor** = центральный маршрутизатор + изолированные субагенты → экономичен
- **Swarm** = общий контекст → гибко, но дорого; хорошо для дебатов и ревью
- **Handoff** = детерминированная передача через `Command(goto=...)` → самый простой паттерн
- **Субграфы** = инкапсуляция сложного агента как узла
- **Считайте токены** перед деплоем

**Следующее занятие:** Локальный LLM — Ollama для разработки, vLLM для production, закрытый контур.
