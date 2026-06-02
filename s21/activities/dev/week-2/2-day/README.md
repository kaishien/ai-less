# День 6 (Неделя 2) • Практика: LangChain — утилитарные AI-агенты

Построите несколько практичных агентов для повседневной разработки. Каждый агент — самостоятельный мини-проект. Выберите минимум два из пяти.

Стек: `langchain`, `langchain-openai`, `langchain-anthropic` (на выбор).

---

## Релиз 0: LCEL chain — разогрев

Прежде чем строить агентов, освойте LCEL на простом примере.

**Задание:**
1. Реализуйте LCEL-цепочку: получает diff файла → возвращает `CommitMessage` через `with_structured_output`
2. `CommitMessage`: `type` (feat/fix/refactor/docs/chore), `scope: str | None`, `description: str`
3. Запустите на 3 разных diff'ах — проверьте что тип выбирается корректно
4. Добавьте стриминг через `.astream()` — выведите токены по мере генерации

**Промпт:**
```
Напиши LCEL-цепочку на LangChain:
- ChatPromptTemplate с system: "Ты — эксперт Conventional Commits"
- ChatOpenAI gpt-4o
- with_structured_output(CommitMessage) где CommitMessage — Pydantic модель
- Вход: {diff}, выход: CommitMessage объект
Покажи как вызвать через ainvoke и через astream.
```

---

## Релиз 1: Git Commit Agent

Агент, который сам читает staged diff и предлагает коммит.

**Задание:**
1. Определите два инструмента через `@tool`:
   - `get_staged_diff()` — выполняет `git diff --staged`
   - `get_recent_commits(n: int = 5)` — выполняет `git log --oneline -N`
2. Создайте агент через `create_tool_calling_agent`
3. Системный промпт: агент — эксперт Conventional Commits, использует стиль из истории коммитов проекта
4. Вывод: строка вида `feat(auth): add email validation before registration`
5. Проверьте на реальном репозитории или создайте тестовый

**Промпт:**
```
Напиши LangChain агента с двумя инструментами: get_staged_diff() и get_recent_commits(n).
Используй subprocess.run для вызова git команд.
create_tool_calling_agent + AgentExecutor(verbose=True).
Системный промпт: агент предлагает один коммит в формате type(scope): description,
опираясь на diff и стиль последних коммитов.
```

---

## Релиз 2: Error Log Analyzer

Агент читает лог-файл и объясняет ошибку с предложением исправления.

**Задание:**
1. Инструменты:
   - `read_log_file(path: str, last_n_lines: int = 50)` — последние N строк файла
   - `read_source_context(filepath: str, line_number: int, context: int = 10)` — N строк вокруг указанной строки
2. Агент извлекает из лога имя файла и строку ошибки, затем читает исходный код
3. Возвращает: причина ошибки + конкретное исправление (можно с кодом)
4. Создайте тестовый `error.log` с несколькими типами ошибок (KeyError, TypeError, FileNotFoundError)

**Промпт:**
```
Напиши LangChain агента-анализатора логов.
Инструменты: read_log_file(path, last_n_lines=50)->str и read_source_context(filepath, line_number, context=10)->str.
Агент должен: прочитать лог, найти последнюю ошибку, извлечь путь и строку, прочитать исходный код,
объяснить причину и предложить исправление.
```

---

## Релиз 3: README Generator

Агент читает проект и генерирует README.md с нуля.

**Задание:**
1. Инструменты:
   - `read_pyproject(path: str = ".")` — читает `pyproject.toml` или `requirements.txt`
   - `get_project_structure(path: str = ".", depth: int = 2)` — дерево файлов, исключая `.git`, `__pycache__`, `node_modules`
   - `read_entry_point(path: str)` — первые 50 строк главного файла
2. README должен содержать: Description, Installation, Usage, Project Structure
3. Выведите результат в файл `README_generated.md`
4. Сравните с реальным README если есть

**Промпт:**
```
Напиши LangChain агента — генератор README.
Три инструмента: read_pyproject, get_project_structure (используй os.walk + отступы для дерева), read_entry_point.
Агент вызывает все три инструмента, затем генерирует Markdown README с разделами:
Description, Installation, Usage, Project Structure.
Результат сохрани в README_generated.md через tool write_file(path, content).
```

---

## Релиз 4: .env Auditor

Агент сравнивает `.env.example` с реальным `.env` и сообщает о расхождениях.

**Задание:**
1. Инструменты:
   - `read_env_keys(path: str)` — возвращает **только ключи** (без значений!), один ключ на строку
2. Агент сравнивает два файла и выводит три категории: отсутствующие, лишние, совпадающие
3. Важно: `read_env_keys` никогда не возвращает значения переменных — только имена

**Вывод агента:**
```
❌ Отсутствуют в .env: DATABASE_URL, REDIS_HOST
⚠️  Лишние в .env (нет в .env.example): OLD_API_KEY
✅ Совпадают: OPENAI_API_KEY, PORT, NODE_ENV
```

**Промпт:**
```
Напиши LangChain агента — аудитор переменных окружения.
Один инструмент read_env_keys(path)->str: читает файл, возвращает ТОЛЬКО имена ключей (до знака =),
без значений, разделённые переводом строки.
Агент вызывает инструмент дважды (.env.example и .env) и выводит три категории расхождений.
```

---

## Релиз 5: Трейсинг с Langfuse

Добавьте трейсинг к любому агенту из предыдущих релизов — наблюдайте входы, выходы, latency и стоимость в реальном времени.

**Задание:**

1. Запустите Langfuse локально: `docker run -d -p 3000:3000 langfuse/langfuse`
2. Установите: `pip install langfuse`
3. Создайте проект на localhost:3000, скопируйте `LANGFUSE_PUBLIC_KEY` и `LANGFUSE_SECRET_KEY` в `.env`
4. Оберните цепочку из Релиза 0 в `CallbackHandler`:

```python
from langfuse.callback import CallbackHandler

handler = CallbackHandler()  # читает ключи из env
result = chain.invoke({"input": "..."}, config={"callbacks": [handler]})
```

5. Откройте localhost:3000 → Traces → найдите только что созданный trace
6. Проверьте: input, output, latency, model, количество токенов

**На что обратить внимание:** как выглядит вложенный trace при нескольких вызовах инструментов — каждый tool call отображается отдельным span.

**Альтернатива:** LangSmith (cloud) — аналогичный API, требует `LANGCHAIN_API_KEY` и VPN из России.
