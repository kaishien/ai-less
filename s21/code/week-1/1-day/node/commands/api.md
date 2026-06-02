# Команда: /api

## Описание
Создай REST API endpoint с полной реализацией.

## Prompt
Создай REST API endpoint:

**Endpoint:** [опиши что должен делать endpoint]

1. **Route setup (Express пример):**
   ```typescript
   // GET /api/resource/:id
   // POST /api/resource
   // PUT /api/resource/:id
   // DELETE /api/resource/:id
   ```

2. **Request validation:**
   - Используй Zod/Joi для валидации
   - Проверь обязательные поля
   - Валидация типов данных
   - Бизнес-логика валидация

3. **Handler implementation:**
   - Обработка запроса
   - Взаимодействие с БД/сервисами
   - Обработка ошибок
   - Логирование

4. **Response format:**
   ```typescript
   // Success
   {
     "status": "success",
     "data": {...}
   }
   
   // Error
   {
     "status": "error",
     "message": "User-friendly message",
     "code": "ERROR_CODE"
   }
   ```

5. **HTTP коды:**
   - 200 OK - успешное получение
   - 201 Created - успешное создание
   - 204 No Content - успешное удаление
   - 400 Bad Request - ошибка валидации
   - 401 Unauthorized - не авторизован
   - 403 Forbidden - нет прав
   - 404 Not Found - ресурс не найден
   - 500 Internal Server Error - серверная ошибка

6. **Безопасность:**
   - Авторизация (JWT middleware)
   - Rate limiting
   - Input sanitization
   - CORS настройки

7. **Документация (OpenAPI):**
   ```yaml
   /api/resource:
     post:
       summary: Создать ресурс
       requestBody:
         required: true
         content:
           application/json:
             schema: {...}
       responses:
         201: {...}
   ```

**Результат:**
Полный рабочий endpoint с валидацией, обработкой ошибок и документацией.
