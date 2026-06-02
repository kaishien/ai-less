# Соло-проект • Неделя 2 — LangGraph-агент с RAG

**Формат:** самостоятельная работа, без преподавателя  
**Время:** ~6 часов  
**Результат:** LangGraph-агент, который отвечает на вопросы по корпоративной документации, логирует уверенность, поддерживает HITL для неоднозначных случаев

---

## Контекст

Продолжаем историю «ТехноКорп». Базовый RAG-пайплайн с прошлой недели работает, но у него есть проблемы:
1. Точность поиска низкая для технических терминов → нужен hybrid search
2. Агент иногда галлюцинирует → нужен confidence check + HITL
3. Нет трассировки → непонятно что происходит в production

Задача: обернуть RAG в LangGraph-граф с надлежащей надёжностью.

---

## Архитектура

```
User Query
    │
    ▼
[rewrite_query]         — при необходимости улучшает запрос (HyDE или multi-query)
    │
    ▼
[hybrid_search]         — dense + BM25 + RRF, top-20 кандидатов
    │
    ▼
[rerank]                — cross-encoder top-5
    │
    ▼
[generate_answer]       — LLM с контекстом, возвращает RAGResponse (answer, confidence, sources)
    │
    ▼
[confidence_router] ────── confidence >= 0.7 ──► [format_response] ──► END
    │
    └─── confidence < 0.7 ──► [interrupt: HITL] ──► [format_response] ──► END
```

LangSmith трассирует каждый запрос.

---

## Структура проекта

```
rag-agent/
  agent/
    graph.py          # LangGraph StateGraph
    nodes.py          # функции узлов
    state.py          # AgentState TypedDict + RAGResponse
  retrieval/
    hybrid.py         # dense + BM25 + RRF (из прошлой недели)
    reranker.py       # cross-encoder
  .env
  main.py             # CLI точка входа
```

---

## State

```python
from typing import TypedDict, Annotated
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from pydantic import BaseModel

class RAGResponse(BaseModel):
    answer: str
    confidence: float      # 0.0 – 1.0
    sources: list[str]     # имена файлов-источников
    sources_used: bool     # использовал ли контекст

class AgentState(TypedDict):
    query: str
    rewritten_query: str | None
    retrieved_chunks: list[dict]
    rag_response: RAGResponse | None
    final_answer: str | None
    hitl_triggered: bool
    messages: Annotated[list[BaseMessage], add_messages]
```

---

## Вехи

### Веха 1: Retrieval интегрирован

Граф содержит узлы `hybrid_search` и `rerank`, результаты попадают в state.

**Готово когда:**
- `graph.invoke({"query": "Как подключиться к VPN?"})` возвращает `retrieved_chunks` с полем `source`
- `len(retrieved_chunks) == 5`

---

### Веха 2: Generation с confidence

Узел `generate_answer` возвращает `RAGResponse` с заполненным `confidence`.

**Готово когда:**
- На вопрос по документации `confidence >= 0.7` и `sources_used = True`
- На вопрос вне тематики `confidence < 0.5` или `sources_used = False`

---

### Веха 3: HITL работает

На низкой уверенности граф прерывается и ждёт решения человека.

**Готово когда:**
- Вопрос с низкой уверенностью → `graph.get_state(config).next == ["hitl_node"]`
- После `graph.invoke(Command(resume={"action": "approve"}), config)` граф завершается
- В ответе видно: был ли triggered HITL

---

### Веха 4: LangSmith трассировка

Каждый запрос трассируется, видны токены и latency.

**Готово когда:**
- Открыт LangSmith UI, проект `technocorp-rag-agent`
- Для каждого запроса виден вызов LLM с `confidence` в metadata
- Видно было ли вызвано `rerank` и сколько кандидатов было до/после

---

## Требования к реализации

- [ ] Граф использует `SqliteSaver` checkpointer (не in-memory)
- [ ] Confidence threshold: константа в `.env` (`CONFIDENCE_THRESHOLD=0.7`)
- [ ] HITL: `interrupt()` с `{"draft_answer": ..., "confidence": ..., "sources": ...}`
- [ ] Три варианта resume: `approve`, `edit`, `escalate_to_human`
- [ ] LangSmith включён: каждый запрос имеет `tags=["production"]` и `metadata={"query_length": N}`
- [ ] Граф экспортирует `graph.get_graph().draw_mermaid()` в файл `docs/graph.md`

---

## Stretch goals

**+Query rewriting:** узел `rewrite_query` применяет HyDE или multi-query expansion когда `len(query.split()) < 4` (короткий запрос).

**+Feedback loop:** после `format_response` добавьте узел `log_feedback` который сохраняет `{query, answer, confidence, hitl_triggered}` в SQLite. Раз в N запросов выводите статистику: средняя уверенность, % HITL, топ-5 источников.

**+Evaluation run:** создайте тестовый датасет 15 вопросов + ожидаемых источников. Прогоните через LangSmith `evaluate()`. Метрика: `source_recall@3`. Сравните с результатом Релиза 0 прошлой недели.

---

## Подсказки

**HITL не resume после interrupt:**  
Убедитесь что используете `SqliteSaver` (не `InMemorySaver`) — иначе state теряется между вызовами.

**Confidence всегда > 0.9:**  
Добавьте явный пример в системный промпт: «Если контекст не содержит информации по вопросу — confidence должен быть < 0.5». Модели склонны быть оптимистичными по умолчанию.

**Cross-encoder слишком медленный:**  
Используйте `cross-encoder/ms-marco-MiniLM-L-6-v2` (6 слоёв, быстрый). Или вынесите в отдельный поток через `asyncio.to_thread`.

**Граф не видит LangSmith:**  
Переменные окружения должны быть установлены ДО импорта langchain. Проверьте порядок: `load_dotenv()` → `import langchain`.

---

## Критерии демо (понедельник, 10 минут)

1. Показать Mermaid-схему графа (файл `docs/graph.md`) — студент объясняет что делает каждый узел
2. Два запроса в live:
   - Вопрос с хорошим контекстом → ответ с источниками без HITL
   - Вопрос вне темы → HITL triggered, студент выполняет resume
3. LangSmith: показать trace двух запросов, указать где confidence и latency
