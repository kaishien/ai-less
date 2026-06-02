# День 8 (Неделя 2) • Практика: HITL, fallback, observability

Четыре независимые задачи — выберите минимум три. Каждая изолирует один паттерн надёжности.

---

## Задача 1: HITL в LangGraph — одобрение перед действием

Постройте граф службы поддержки, который останавливается перед отправкой ответа клиенту.

**Задание:**
1. Граф: `classify_ticket → draft_reply → **[INTERRUPT]** → send_reply`
2. Узел `draft_reply` вызывает `interrupt({"draft": ..., "category": ...})`
3. Запустите граф, получите snapshot с черновиком
4. Реализуйте три сценария resume: `approve`, `edit` (с изменённым текстом), `reject`
5. Проверьте через `graph.get_state_history()` — должны быть видны оба checkpoint'а (до и после interrupt)

**Промпт:**
```
Напиши LangGraph граф с HITL через interrupt().
State: {input_text, draft_reply, final_reply, status}.
Узел review_node вызывает interrupt({"draft": state["draft_reply"], "question": "Отправить?"}).
Результат interrupt: {"action": "approve"|"edit"|"reject", "edited_text": str|None}.
Используй SqliteSaver как checkpointer.
Покажи полный цикл: invoke → get_state → inspect draft → invoke(Command(resume=...)).
```

---

## Задача 2: Confidence-based fallback с Pydantic

Агент отвечает на вопросы по документации. При низкой уверенности — возвращает шаблонный ответ вместо потенциальной галлюцинации.

**Задание:**
1. Определите `RAGResponse(BaseModel)`: `answer: str`, `confidence: float` (0–1), `sources_used: bool`
2. Реализуйте `answer_with_fallback(question, context) -> str`:
   - Если `confidence < 0.7` или `not sources_used` → шаблонный fallback
   - Иначе → `answer`
3. Проверьте три случая:
   - Вопрос с релевантным контекстом → ответ из модели
   - Вопрос с нерелевантным контекстом → fallback
   - Вопрос без контекста (`context=""`) → fallback
4. Добавьте логирование каждого случая с `confidence` и `status`

**Промпт:**
```
Напиши функцию answer_with_fallback(question: str, context: str) -> str.
Использует ChatOpenAI.with_structured_output(RAGResponse).
RAGResponse: answer(str), confidence(float 0-1), sources_used(bool).
Системный промпт: "Отвечай только по контексту. Если информации нет — confidence < 0.5".
Логируй каждый вызов: question[:50], confidence, status="answer"|"fallback".
```

---

## Задача 3: Provider fallback + retry

Реализуйте устойчивый LLM-клиент с двумя провайдерами и retry на временные ошибки.

**Задание:**
1. Цепочка: primary (gpt-4o) с fallback на secondary (claude-sonnet-4-6 или GigaChat)
2. Используйте `primary.with_fallbacks([secondary])`
3. Добавьте retry только на `RateLimitError` и `APITimeoutError` через tenacity (уже знаем из Дня 2)
4. Напишите тест: `MockLLM` который бросает `RateLimitError` первые 2 раза → функция успешно возвращает ответ
5. Напишите тест: `MockPrimary` бросает `APIError` → срабатывает fallback на secondary

**Промпт:**
```
Напиши LLM-клиент с двумя уровнями защиты:
1. tenacity @retry на RateLimitError и APITimeoutError: wait_exponential(min=1, max=30), stop_after_attempt(3)
2. langchain .with_fallbacks([secondary_llm]) для provider-level fallback
Покажи как написать pytest тест с mocker.patch для симуляции ошибок провайдера.
```

---

## Задача 4: Structured observability с LangSmith

Настройте полную трассировку агента и добавьте кастомные метрики.

**Задание:**
1. Включите LangSmith (env-переменные + `LANGCHAIN_PROJECT`)
2. Запустите любой агент из Дня 6 (LangChain) или Дня 7 (LangGraph) с трассировкой
3. В UI LangSmith найдите:
   - Сколько токенов потратил каждый LLM-вызов
   - Какие инструменты вызывались и с какими аргументами
   - Общую латентность на запрос
4. Добавьте кастомный тег и metadata:
   ```python
   config={"tags": ["practicum", "week-2"], "metadata": {"task": "hitl-practice"}}
   ```
5. Напишите простой evaluator: `correctness_check` — проверяет что ответ содержит ожидаемое ключевое слово

**Промпт:**
```
Настрой LangSmith трассировку для LangGraph агента.
Покажи env-переменные LANGCHAIN_TRACING_V2, LANGCHAIN_API_KEY, LANGCHAIN_PROJECT.
Добавь кастомные tags и metadata в config при вызове.
Напиши простой evaluator-функцию для langsmith.evaluation.evaluate():
принимает run и example, возвращает {"key": "keyword_match", "score": 0.0|1.0}.
```
