# День 8 (Неделя 2) • HITL, fallback-стратегии, надёжность агентов

## 📋 Темы:

- ⚠️ Типы сбоев агентов (10 мин)
- 👥 HITL в LangGraph: interrupt и resume (30 мин)
- 🔄 Fallback-стратегии (25 мин)
- 🛡️ Output validation с Pydantic (15 мин)
- 🔭 Observability: LangSmith (20 мин)
- ⚡ Практика (60 мин)

---

### ⚠️ Типы сбоев: что именно ломается

| Тип | Пример | Стратегия |
|---|---|---|
| **API failure** | 429, 500, timeout | Retry с backoff |
| **Галлюцинация** | Модель придумывает факты | Confidence check + fallback |
| **Неверный формат** | Ожидали JSON, получили текст | Output validation |
| **Цикл** | Агент вызывает инструмент снова и снова | max_iterations |
| **Неподходящее действие** | Агент хочет удалить файл без разрешения | HITL interrupt |
| **Устаревший контекст** | Модель использует старую информацию | RAG + источники |

Ни одну из этих ошибок нельзя устранить полностью. Цель: **перехватить, обработать, задокументировать**.

---

### 👥 HITL: полный цикл

LangGraph реализует HITL через `interrupt()` — граф приостанавливается, ждёт внешнего ввода, затем продолжается.

**Жизненный цикл:**
```
graph.invoke(input, config)
    → узел вызывает interrupt(payload)
    → граф приостановлен, сохранён в checkpoint
    → snapshot.next = ["имя_узла"]
    
# Человек смотрит на payload, принимает решение

graph.invoke(Command(resume=decision), config)
    → граф продолжается с результатом interrupt()
```

---

### 👥 HITL: реализация

```python
from langgraph.types import interrupt, Command

def review_and_post(state: AgentState) -> dict:
    draft = state["draft_reply"]
    
    # Пауза — возвращаем черновик человеку
    decision = interrupt({
        "draft": draft,
        "question": "Отправить этот ответ клиенту?"
    })
    
    if decision["action"] == "approve":
        send_to_customer(draft)
        return {"status": "sent", "final_reply": draft}
    elif decision["action"] == "edit":
        edited = decision["edited_text"]
        send_to_customer(edited)
        return {"status": "sent", "final_reply": edited}
    else:
        return {"status": "rejected"}

graph = builder.compile(checkpointer=SqliteSaver.from_conn_string("db.sqlite"))
config = {"configurable": {"thread_id": "ticket-001"}}

# Шаг 1: запуск (граф остановится на interrupt)
result = graph.invoke({"input_text": "Не работает VPN"}, config)
snapshot = graph.get_state(config)
# snapshot.values["draft_reply"] — черновик для проверки
# snapshot.next = ["review_and_post"] — ждёт резюме

# Шаг 2: человек принял решение, продолжаем
graph.invoke(Command(resume={"action": "approve"}), config)
```

---

### 👥 HITL: прерывание перед узлом

Альтернативный способ — без изменения кода узла:

```python
graph = builder.compile(
    checkpointer=checkpointer,
    interrupt_before=["create_github_issue", "send_email"]
)

# Граф остановится ПЕРЕД этими узлами
# Смотрим state, принимаем решение
snapshot = graph.get_state(config)

# Продолжаем (без дополнительных данных — просто resume)
graph.invoke(None, config)

# Или обновляем state перед продолжением
graph.update_state(config, {"pr_title": "fix: corrected validation"})
graph.invoke(None, config)
```

---

### 🔄 Fallback-стратегии

**1. Retry только на временные ошибки:**

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    retry=retry_if_exception_type((RateLimitError, APITimeoutError)),
    wait=wait_exponential(min=1, max=60),
    stop=stop_after_attempt(5)
)
async def call_llm_with_retry(messages):
    return await llm.ainvoke(messages)
```

**2. Provider fallback:**

```python
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

primary = ChatOpenAI(model="gpt-4o")
fallback = ChatAnthropic(model="claude-sonnet-4-6")

# LangChain встроенный fallback
llm_with_fallback = primary.with_fallbacks([fallback])
result = await llm_with_fallback.ainvoke(messages)
```

---

### 🔄 Confidence-based fallback

Просим модель оценить свою уверенность — и действуем по-разному:

```python
from pydantic import BaseModel

class RAGResponse(BaseModel):
    answer: str
    confidence: float  # 0.0 – 1.0
    sources_used: bool # использованы ли источники из контекста

async def answer_with_fallback(question: str, context: str) -> str:
    llm_structured = ChatOpenAI(model="gpt-4o").with_structured_output(RAGResponse)
    
    response = await llm_structured.ainvoke([
        SystemMessage("Отвечай только по контексту. Если не знаешь — скажи честно."),
        HumanMessage(f"Контекст:\n{context}\n\nВопрос: {question}")
    ])
    
    if response.confidence < 0.7 or not response.sources_used:
        return "По данному вопросу недостаточно информации в базе знаний. Обратитесь к администратору."
    
    return response.answer
```

---

### 🛡️ Output Validation: защита от неверного формата

Модели иногда возвращают текст вместо JSON, несмотря на `with_structured_output`. Добавьте валидацию:

```python
from pydantic import ValidationError

async def safe_structured_call(prompt: str, schema: type[BaseModel]) -> BaseModel | None:
    llm_structured = llm.with_structured_output(schema, include_raw=True)
    raw = await llm_structured.ainvoke(prompt)
    
    if raw["parsing_error"]:
        # Логируем ошибку парсинга
        logger.error("parsing_error", error=str(raw["parsing_error"]), raw=raw["raw"])
        return None
    
    return raw["parsed"]

# В графе:
def structured_node(state: AgentState) -> dict:
    result = await safe_structured_call(state["prompt"], CommitMessage)
    if result is None:
        return {"error": "Не удалось получить структурированный ответ"}
    return {"commit": result}
```

---

### 🔭 LangSmith: observability

LangSmith — официальный инструмент трассировки для LangChain/LangGraph.

```bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY="ls__..."
export LANGCHAIN_PROJECT="my-agent"
```

После этого каждый вызов цепочки или графа автоматически трассируется.

**Что видно в UI:**
- Каждый вызов LLM: промпт, ответ, токены, латентность
- Дерево вызовов: какой узел вызвал какой инструмент
- Ошибки и исключения с контекстом
- Сравнение runs (A/B prompts)

```python
# Кастомные теги для фильтрации
result = graph.invoke(
    {"input": query},
    config={"tags": ["production", "user-facing"], "metadata": {"user_id": user_id}}
)
```

---

### 🔭 LangSmith: оценка (Evaluation)

```python
from langsmith import Client
from langsmith.evaluation import evaluate

client = Client()

def correctness_evaluator(run, example):
    predicted = run.outputs["answer"]
    expected  = example.outputs["answer"]
    score = 1.0 if expected.lower() in predicted.lower() else 0.0
    return {"key": "correctness", "score": score}

results = evaluate(
    lambda inputs: graph.invoke(inputs),
    data="my-test-dataset",      # датасет в LangSmith
    evaluators=[correctness_evaluator],
    experiment_prefix="hybrid-rag-v2"
)
```

Подходит для регрессионного тестирования: изменили промпт → прогнали датасет → сравнили результаты.

---

### 🎯 Итоги дня

**Что взять с собой:**

- **HITL = interrupt + checkpoint + resume** — три части, все три нужны
- **`interrupt_before`** — HITL без изменения кода узла; `interrupt()` — для сложных сценариев
- **Confidence check** — явно просите модель оценить уверенность и действуйте по значению
- **`with_fallbacks()`** — встроенный LangChain provider fallback в одну строку
- **LangSmith** — включается двумя env-переменными, даёт полный observability бесплатно

**Следующее занятие (пятница — соло-проект):** LangGraph-агент с RAG — самостоятельно.
