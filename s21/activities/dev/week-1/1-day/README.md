# AI IDE и продвинутый промпт-инжиниринг

Вы — senior-разработчик в команде, которая переходит на AI-assisted разработку. Все уже слышали про Cursor и ChatGPT, но большинство коллег использует их как «умный автокомплит» — получают посредственный код и разочаровываются. Ваша задача: разобраться, как выжать из AI IDE максимум, настроить рабочее окружение правильно и выработать промпт-практики, которые реально ускоряют разработку, а не добавляют лишний код-ревью.

---

## Релиз 0: Настройка AI IDE под реальный проект

Установка — не проблема. Проблема — что большинство разработчиков открывают Cursor «из коробки» и не настраивают ничего. В результате AI не знает ни стек, ни соглашения команды, ни ограничения проекта. Три механизма закрывают 90% этой проблемы: Rules, Skills и Hooks.

---

### Релиз 0.1: Rules — контекст, который всегда в чате

Rules — это инструкции, которые AI получает при каждом запросе, не требуя от вас копипасты. В Cursor это файлы `.cursor/rules/*.mdc` — можно делать глобальные правила и правила, привязанные к конкретным файлам.

**Ваше задание:**
1. Откройте любой свой рабочий проект (или склонируйте open-source репозиторий)
2. Создайте `.cursor/rules/main.mdc` — опишите стек, соглашения по коду, явные запреты
3. Проверьте эффект: задайте одинаковый вопрос до и после создания файла

**Пример `.cursor/rules/main.mdc`:**
```
---
description: Main project rules
alwaysApply: true
---

# Project context
FastAPI backend service. PostgreSQL + SQLAlchemy async.

## Code conventions
- Use async/await everywhere, never sync DB calls
- Pydantic v2 for all schemas — use `model_validator`, not `validator`
- Raise HTTPException, never return error dicts
- No docstrings; inline comments only for non-obvious logic
- Tests: pytest + httpx AsyncClient, real DB via docker-compose

## Forbidden
- Never add `try/except Exception` — catch specific exceptions only
- Never use `SELECT *` in raw queries
- No `print()` — use structlog
```

**Продвинутый приём — scoped rules:** правила можно привязать к глобам файлов, чтобы они применялись только к тестам или только к миграциям. Создайте отдельный файл `.cursor/rules/tests.mdc`:

```
---
description: Rules for test files
globs: tests/**/*.py
alwaysApply: false
---

All test functions must be async. Use pytest.mark.asyncio.
Fixtures with DB access use the `db_session` fixture from conftest.
Never mock the database — use the test DB instead.
```

**На что обратить внимание:** насколько меньше вы корректируете вывод AI после того, как правила описаны явно.

---

### Релиз 0.2: Skills — переиспользуемые агентные команды

Skills в Cursor — это готовые шаблоны действий для агента: написать тест, сделать код-ревью, создать миграцию. Хранятся в `.cursor/rules/` с указанием типа `agent-requested` и описанием, по которому агент сам решает, когда их применять.

**Ваше задание:**
1. Создайте три skill-файла под ваш проект (примеры ниже)
2. Попросите агента в Composer выполнить задачу, где skill должен сработать автоматически
3. Проверьте, что агент подхватывает нужный skill без явного упоминания

**Примеры skills:**

`.cursor/rules/skill-review.mdc` — код-ревью:
```
---
description: Use when asked to review code or check a diff
alwaysApply: false
---

Review code as a senior engineer.

Focus on:
- Correctness: edge cases, error handling, concurrency issues
- Security: injection, auth bypass, data exposure
- Performance: N+1 queries, missing indexes, blocking calls

For each finding: file:line → problem → suggested fix.
Skip style issues covered by the linter.
Output findings only, no summary paragraph.
```

`.cursor/rules/skill-test.mdc` — написание тестов:
```
---
description: Use when asked to write tests for existing code
alwaysApply: false
---

Write pytest tests for the specified code.

Requirements:
- Use pytest + httpx AsyncClient for HTTP endpoints
- Cover: happy path, validation errors, auth failure, DB constraint violation
- Use `db_session` fixture for DB access — no mocks
- Each test function has a single assert or a logical group of related asserts
- Test function names: test_<what>_<condition>_<expected>
```

`.cursor/rules/skill-migration.mdc` — Alembic миграция:
```
---
description: Use when asked to create a database migration
alwaysApply: false
---

Generate an Alembic migration for the described schema change.

Output:
1. The migration file content (upgrade + downgrade)
2. Any indexes that should be added
3. Warning if the migration is unsafe for zero-downtime deploy
   (e.g., NOT NULL without default on large table)

Use op.execute() for data migrations, never touch application models directly.
```

**Почему это важно:** команда договаривается об одном шаблоне код-ревью — и агент везде выдаёт вывод в одном формате, который легко читать и включать в PR.

---

### Релиз 0.3: Hooks — автоматизация по событиям

Hooks в Cursor позволяют запускать команды автоматически до или после действий агента: форматирование, линтинг, запуск тестов. Настраиваются в Cursor Settings → Rules → Hooks.

**Ваше задание:**
1. Настройте hook, который запускает линтер после каждого изменения файла агентом
2. Настройте pre-run hook, который логирует bash-команды агента
3. Проверьте: сломайте типизацию намеренно, попросите агента что-то изменить, убедитесь что hook поймал проблему

**Пример конфигурации hooks:**
```json
{
  "hooks": {
    "onFileEdit": {
      "command": "ruff check --fix {file} && mypy {file}",
      "runInBackground": false
    },
    "onAgentCommand": {
      "command": "echo \"[hook] {command}\" >> .cursor/audit.log",
      "runInBackground": true
    }
  }
}
```

**Продвинутые сценарии:**
- После изменения `models.py` — запустить `alembic check` чтобы напомнить о миграции
- После изменения тестов — запустить только затронутые тесты через `pytest --co -q`
- Pre-hook: блокировать опасные команды (`DROP TABLE`, `rm -rf`) вне CI-контекста

**На что обратить внимание:** AI не всегда чинит то, что ломает. Hook, который сразу сообщает об ошибке, радикально сокращает итерации — агент получает фидбек и исправляет сам.

---

## Релиз 1: Промпт-инжиниринг для production-кода

Базовый промпт «напиши функцию X» даёт джуниорский код. Senior-разработчик формулирует контекст, ограничения, ожидаемое поведение и edge cases — и получает код, который не стыдно смерджить.

**Ваше задание:**

Напишите промпт, который генерирует следующий модуль: сервис для батч-обработки задач с ограничением по concurrency, retry-логикой и структурированными логами. Требования:
- Python, asyncio
- Максимум N одновременных задач (N задаётся при инициализации)
- При ошибке — до 3 повторных попыток с экспоненциальным backoff
- Логи в JSON-формате (structlog или аналог)
- Интерфейс: `submit(task_id, coro)` + `wait_all()`

Сначала напишите «плохой» промпт (одна строка), запустите, оцените результат. Затем перепишите с учётом техник ниже и сравните.

**Техники для улучшения промпта:**
- **Контекст и роль:** «Ты senior Python backend engineer, пишешь production-ready код»
- **Ограничения явно:** что использовать, что запрещено
- **Ожидаемый формат вывода:** «верни только код, без объяснений»
- **Few-shot:** покажи пример вызова готового API
- **Chain-of-thought для архитектуры:** «сначала опиши подход, потом пиши код»

---

## Релиз 2: Composer — работа с существующим кодом

Генерация нового кода — простая задача. Сложнее — попросить AI изменить существующий код, не сломав то, что уже работает. Cursor Composer (агентный режим) позволяет работать с несколькими файлами одновременно.

**Ваше задание:**
1. Возьмите код из Релиза 1 (или любой свой модуль размером 100–300 строк)
2. Откройте Composer (`Cmd/Ctrl+I`), добавьте в контекст несколько связанных файлов
3. Поставьте задачу: добавить observability — метрики (Prometheus) или трейсинг (OpenTelemetry) без изменения публичного интерфейса модуля
4. Итеративно доработайте результат: попросите AI объяснить конкретное решение, предложить альтернативу, убрать лишнее

**Промпт:**
```
Add Prometheus metrics to the batch processor:
- active_tasks (gauge): current number of running tasks
- task_duration_seconds (histogram): time per task
- task_retries_total (counter): retry count by task_id

Requirements:
- Don't change the public interface (submit / wait_all)
- Metrics registry injected via constructor, default = CollectorRegistry()
- No new dependencies except prometheus_client
```

**Что изучить:** как AI справляется с конфликтующими изменениями, где ошибается, как правильно итерировать через диалог.

---

## Полезные ссылки

- [Cursor Rules (официальная документация)](https://cursor.com/docs/rules)
- [Agent Skills](https://agentskills.io/home)
- [Cursor Hooks](https://cursor.com/docs/hooks)
- [Знаменитые Rules от Андрея Карпатого](https://github.com/multica-ai/andrej-karpathy-skills/blob/main/.cursor/rules/karpathy-guidelines.mdc)
