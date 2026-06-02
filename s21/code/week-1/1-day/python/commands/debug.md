# Команда: /debug

## Описание
Найди и исправь баг в Python коде.

## Prompt
Помоги найти и исправить баг:

**Проблема:** [опиши проблему или вставь traceback]

**Анализ:**

1. **Root Cause Analysis:**
   - Изучи traceback (читай снизу вверх — последняя строка = место ошибки)
   - Определи точное место ошибки
   - Найди причину (не симптом, а корень)

2. **Проверь типичные Python ошибки:**
   - `None` доступы (AttributeError: 'NoneType' object has no attribute ...)
   - Mutable default arguments (`def f(items=[])`)
   - Sync I/O в async функциях (блокирует event loop)
   - Exception "глотание" (`except Exception: pass`)
   - Неправильный scope переменных
   - Circular imports

3. **Воспроизведение:**
   ```bash
   python -m pytest tests/test_failing.py::test_name -xvs
   # или
   python script.py
   ```

4. **Отладка:**
   ```python
   # Добавь breakpoint для интерактивной отладки
   breakpoint()  # Python 3.7+

   # Или логирование
   import logging
   logging.basicConfig(level=logging.DEBUG)
   logger = logging.getLogger(__name__)
   logger.debug("value: %s", value)
   ```

5. **Решение:**
   - Минимальное исправление
   - Добавь проверки для предотвращения похожих багов
   - Добавь комментарий объясняющий fix если неочевидно

6. **Профилактика:**
   - Как избежать подобных проблем?
   - Нужны ли дополнительные проверки?

**Результат:**
- Объяснение причины бага
- Исправленный код с комментариями
- Регрессионный тест
