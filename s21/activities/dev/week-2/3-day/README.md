# День 7 (Неделя 2) • Практика: LangGraph — StateGraph и маршрутизация

Три задачи на понимание LangGraph: как состояние передаётся между узлами, как маршрутизировать по данным в state, как строить циклы. Выберите минимум две.

Стек: `langgraph`, `langchain-openai`.

---

## Задача 1: «Разбор обращения в тикет»

**Цель:** из текста обращения пользователя получить структурированный тикет. Каждый узел добавляет своё поле в state — следующие узлы опираются на уже накопленные данные.

**State:**
```python
class TicketState(TypedDict):
    input_text: str
    language: str | None        # "ru" / "en"
    category: str | None        # "auth" / "billing" / "bug" / "other"
    priority: str | None        # "low" / "medium" / "high"
    entities: dict | None       # email, order_id, platform и т.п.
    summary: str | None
    clarifying_questions: list[str]
    draft_reply: str | None
    next_actions: list[str]
```

**Узлы:** `ingest → detect_language → extract_entities → classify → prioritize → summarize → reply_drafter → actions_builder`

**Задание:**
1. Реализуйте все узлы (каждый делает один LLM-вызов)
2. Каждый узел возвращает только своё поле — не перезаписывает чужие
3. Проверьте на трёх обращениях разного типа (авторизация, оплата, баг)
4. Добавьте узел `redact_pii` — маскирует email/телефон в `summary` и `draft_reply`, но сохраняет в `entities`

**Промпт для старта:**
```
Напиши LangGraph StateGraph для разбора обращений в службу поддержки.
State: TicketState (TypedDict с полями выше).
Узел detect_language: LLM-вызов, возвращает {"language": "ru"|"en"}.
Узел extract_entities: LLM-вызов с текстом и полем language, возвращает {"entities": dict}.
Покажи как добавить узлы и рёбра, скомпилировать и вызвать граф.
```

---

## Задача 2: «Триаж инцидента» с conditional edges

**Цель:** построить граф с условными рёбрами — маршрут зависит от типа инцидента в state.

**State:**
```python
class IncidentState(TypedDict):
    incident: dict              # симптом, метрики, логи, окружение
    signals: dict               # {auth_failures, http_5xx_spike, db_timeouts, ...}
    severity: str               # "sev1" / "sev2" / "sev3"
    hypotheses: list[str]
    chosen_path: str            # для отладки — какая ветка сработала
    recommended_checks: list[str]
    runbook: str
```

**Граф:**
```
ingest → extract_signals → assess_severity → generate_hypotheses
    → route_by_signals
         ├── auth_failures    → auth_checks
         ├── http_5xx_spike   → backend_checks
         ├── db_timeouts      → db_checks
         └── default          → generic_checks
    все ветки → compose_runbook → END
```

**Задание:**
1. Реализуйте граф с 4 ветками
2. `route_by_signals` — функция, возвращает строку-имя ветки
3. Проверьте на 3 разных инцидентах — убедитесь что граф идёт по правильным веткам
4. Выведите `draw_mermaid()` и проверьте что схема соответствует коду
5. Добавьте `chosen_path` в state — каждая ветка записывает своё имя

**Промпт:**
```
Напиши LangGraph граф триажа инцидентов с conditional edges.
Функция route_by_signals(state): проверяет state["signals"], возвращает одно из:
"auth_branch", "backend_branch", "db_branch", "generic_branch".
add_conditional_edges("generate_hypotheses", route_by_signals, {ветки}).
Все ветки сходятся в "compose_runbook".
Покажи полный граф с компиляцией и тестовым вызовом.
```

---

## Задача 3: «Конспект статьи» с quality check и циклом

**Цель:** построить граф с узлом-валидатором, который при неудовлетворительном результате возвращает обратно к предыдущему узлу.

**State:**
```python
class StudyState(TypedDict):
    source_text: str
    title: str | None
    key_points: list[str]       # должно быть >= 5
    glossary: dict[str, str]    # термин → определение
    quiz_questions: list[str]   # должно быть >= 5
    study_plan: str | None
    needs_revision: bool
    revision_count: int         # защита от бесконечного цикла
    output_markdown: str | None
```

**Граф с циклом:**
```
load_text → infer_title → extract_keypoints → build_glossary
    → generate_quiz → quality_check
         ├── needs_revision=True AND revision_count < 2 → extract_keypoints (снова)
         └── OK → compose_study_plan → render_markdown → END
```

**Задание:**
1. Узел `quality_check`: если `len(key_points) < 5` или `len(quiz_questions) < 5` → `needs_revision = True`
2. Цикл: при `needs_revision=True` и `revision_count < 2` — возврат к `extract_keypoints` с промптом «расширь»
3. Защита от зацикливания: при `revision_count >= 2` — продолжить с тем, что есть
4. Проверьте на коротком (< 200 слов) и длинном (> 1000 слов) тексте

**Промпт:**
```
Напиши LangGraph граф конспектирования статьи с циклом ревизии.
Узел quality_check: проверяет len(key_points) >= 5 и len(quiz_questions) >= 5,
устанавливает needs_revision и инкрементирует revision_count.
Conditional edge из quality_check: если needs_revision and revision_count < 2 → extract_keypoints,
иначе → compose_study_plan.
Покажи как предотвратить бесконечный цикл.
```
