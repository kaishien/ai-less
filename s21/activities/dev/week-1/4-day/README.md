# День 4 • Практика: MCP — подключение и разработка

Задача дня — двойная: разобраться с готовыми MCP-серверами как пользователь, а потом написать собственный. Сценарий: компания хочет дать разработчикам возможность спрашивать агента о корпоративных данных (сотрудники, отделы, иерархия) без прямого доступа к production-БД.

---

## Релиз 0: Подключение готовых MCP-серверов

Исследуйте MCP-экосистему и подключите несколько серверов в Cursor.

**Задание:**
1. Откройте `cursor.directory/mcp` и выберите **два сервера** из списка (рекомендуется: `filesystem` + один по вкусу)
2. Добавьте оба в `~/.cursor/mcp.json` с корректной конфигурацией
3. Перезапустите Cursor, проверьте что серверы появились в Agent-режиме
4. Для каждого сервера придумайте и выполните **два реальных запроса** через Cursor Agent
5. Запишите: какие инструменты агент вызвал, что вернул, где было неожиданное поведение

**Примеры запросов для `filesystem`:**
```
Найди все Python-файлы в папке ~/projects/my-service и выведи их список
Посчитай сколько строк в каждом файле в папке src/
```

**Промпт для настройки:**
```
Помоги настроить MCP-сервер filesystem для Cursor.
Директории для доступа: ~/projects и ~/Documents.
Покажи конфиг для ~/.cursor/mcp.json и объясни каждый параметр.
```

---

## Релиз 1: Минимальный MCP-сервер

Напишите первый рабочий MCP-сервер с нуля и подключите к Cursor.

**Задание:**
1. Создайте `tools-server/server.py`, установите `mcp` через `uv` или `pip`
2. Реализуйте три утилитарных инструмента:
   - `word_count(text: str)` — возвращает `{words: N, chars: N, lines: N}`
   - `to_snake_case(text: str)` — конвертирует `getUserById` → `get_user_by_id`
   - `current_moscow_time()` — текущее время в Москве в формате ISO
3. Протестируйте через MCP Inspector: `npx @modelcontextprotocol/inspector python server.py`
4. Подключите к Cursor и проверьте что агент использует инструменты

**Промпт:**
```
Напиши MCP-сервер на Python с FastMCP.
Три инструмента: word_count(text)->dict, to_snake_case(text)->str, current_moscow_time()->str.
Docstring для каждого инструмента должен объяснять когда его использовать.
Запускается через stdio: if __name__ == "__main__": mcp.run()
```

---

## Релиз 2: HR Directory — mock-БД сотрудников

Реализуйте MCP-сервер для корпоративного справочника на синтетических данных.

**Задание:**
1. Сгенерируйте `employees.json` — 50 синтетических сотрудников с полями:
   `id, name, position, department, email, manager_id, hire_date`
2. Реализуйте `hr-server/server.py` с инструментами:
   - `search_employees(query, department?)` — поиск по имени/должности
   - `get_employee(employee_id)` — карточка сотрудника
   - `list_departments()` — список отделов
   - `get_team(manager_id)` — прямые подчинённые
3. Подключите к Cursor и убедитесь, что работают запросы:
   ```
   Найди всех Senior-разработчиков в Engineering
   Покажи команду менеджера с ID 5
   Сколько сотрудников в отделе HR?
   ```

**Промпт для генерации данных:**
```
Сгенерируй employees.json: список 50 сотрудников вымышленной IT-компании "ТехноКорп".
Поля: id(int), name(str), position(str), department(str из [Engineering, HR, Finance, Product, DevOps]),
email(str), manager_id(int|null), hire_date(str ISO).
Создай реалистичную иерархию: 5 директоров, ~10 менеджеров, остальные — исполнители.
```

**Промпт для сервера:**
```
Напиши MCP-сервер hr-server/server.py с FastMCP.
Загружает employees.json при старте.
Инструменты: search_employees, get_employee, list_departments, get_team.
Обработка ошибок: если ID не найден — возвращай строку с описанием ошибки, не raise.
```

---

## Релиз 3: Добавить Resource и расширенный поиск

Улучшите HR-сервер: добавьте Resource с org-chart и сложный фильтр.

**Задание:**
1. Добавьте Resource `hr://org-chart` — возвращает иерархию отделов в виде дерева (вложенные dict)
2. Расширьте `search_employees` — добавьте параметры `hired_after: str | None` и `sort_by: str = "name"`
3. Добавьте инструмент `department_stats(department: str)` — возвращает `{headcount, avg_tenure_days, positions: [...]}`
4. Проверьте что агент использует Resource автоматически при вопросах об структуре компании

**Промпт:**
```
Добавь в hr-server:
1. Resource "hr://org-chart" — дерево структуры компании, вложенные dict {name, department, reports:[]}
2. Параметры hired_after(ISO date) и sort_by("name"|"hire_date") в search_employees
3. Инструмент department_stats(department)->dict с headcount, avg_tenure_days, list of unique positions
Не меняй интерфейс существующих инструментов — только расширяй.
```
