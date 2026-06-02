# Команда: /optimize

## Описание
Оптимизируй Python код для лучшей производительности.

## Prompt
Проанализируй этот код и оптимизируй его:

1. **Алгоритмическая сложность:**
   - Проверь временную сложность (O(n), O(n²), etc.)
   - Найди возможности уменьшить сложность
   - Используй `set` для O(1) lookups вместо `list`

2. **Python-специфичные оптимизации:**
   ```python
   # ❌ МЕДЛЕННО: проверка в list O(n)
   if item in list_of_items:
       ...

   # ✅ БЫСТРО: проверка в set O(1)
   if item in set_of_items:
       ...

   # ❌ МЕДЛЕННО: конкатенация строк в цикле
   result = ""
   for s in strings:
       result += s

   # ✅ БЫСТРО: join
   result = "".join(strings)
   ```

3. **Async оптимизации:**
   ```python
   # ❌ МЕДЛЕННО: последовательные запросы
   user = await fetch_user(user_id)
   posts = await fetch_posts(user_id)

   # ✅ БЫСТРО: параллельные запросы
   user, posts = await asyncio.gather(
       fetch_user(user_id),
       fetch_posts(user_id),
   )
   ```

4. **Кэширование:**
   ```python
   from functools import lru_cache, cache

   @lru_cache(maxsize=128)
   def expensive_computation(n: int) -> int:
       ...

   # Для async
   from cachetools import TTLCache
   ```

5. **Database запросы:**
   - Добавь индексы для часто используемых полей
   - Используй `selectinload` / `joinedload` вместо N+1
   - Batch операции вместо множества одиночных
   - `SELECT` только нужных полей

6. **Memory:**
   - Используй генераторы вместо list для больших данных
   - `__slots__` для классов с фиксированными атрибутами
   - Избегай ненужных копий (slice vs view)

**Результат:**
Оптимизированный код с объяснением изменений и (если возможно) замерами производительности (до/после с timeit / cProfile).
