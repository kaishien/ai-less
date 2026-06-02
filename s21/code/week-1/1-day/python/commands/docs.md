# Команда: /docs

## Описание
Создай полную документацию для Python кода.

## Prompt
Создай документацию для этого кода:

1. **Docstrings (Google style):**
   ```python
   def function_name(param1: str, param2: int = 0) -> str:
       """Краткое описание функции.

       Args:
           param1: Описание параметра.
           param2: Описание опционального параметра.

       Returns:
           Описание возвращаемого значения.

       Raises:
           ValueError: Когда param1 пустой.

       Example:
           >>> function_name("hello", 5)
           'HELLO (5)'
       """
   ```

2. **API документация (FastAPI OpenAPI):**
   ```python
   @router.post(
       "/resource",
       response_model=ResourceResponse,
       status_code=201,
       summary="Создать ресурс",
       description="Создает новый ресурс. Требует авторизации.",
       responses={
           201: {"description": "Ресурс создан"},
           400: {"description": "Некорректные данные"},
           409: {"description": "Уже существует"},
       },
   )
   ```

3. **README секция:**
   - Краткое описание назначения
   - Примеры использования
   - Список зависимостей
   - Конфигурация

4. **Inline комментарии:**
   - Объяснение "почему", а не "что"
   - Сложная бизнес-логика
   - Нетривиальные алгоритмы
   - Известные ограничения / workarounds

Используй Google-style docstrings, чёткие примеры, не абстрактные foo/bar.
