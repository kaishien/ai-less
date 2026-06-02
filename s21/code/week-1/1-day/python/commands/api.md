# Команда: /api

## Описание
Создай FastAPI endpoint с полной реализацией.

## Prompt
Создай FastAPI endpoint:

**Endpoint:** [опиши что должен делать endpoint]

1. **Route setup:**
   ```python
   # GET /api/resource/{id}
   # POST /api/resource
   # PUT /api/resource/{id}
   # DELETE /api/resource/{id}
   ```

2. **Pydantic схемы (разделяй ввод/вывод):**
   ```python
   class ResourceCreate(BaseModel):
       name: str
       ...

   class ResourceResponse(BaseModel):
       model_config = ConfigDict(from_attributes=True)
       id: int
       name: str
       created_at: datetime
   ```

3. **Handler implementation:**
   - Сервисный слой для бизнес-логики
   - Dependency Injection через Depends
   - Обработка ошибок (HTTPException или custom AppError)
   - Логирование

4. **Response format:**
   ```python
   # Success — Pydantic model возвращается автоматически
   # Error
   {"detail": "User-friendly message"}
   ```

5. **HTTP коды:**
   - 200 OK — успешное получение
   - 201 Created — успешное создание
   - 204 No Content — успешное удаление
   - 400 Bad Request — ошибка валидации
   - 401 Unauthorized — не авторизован
   - 403 Forbidden — нет прав
   - 404 Not Found — ресурс не найден
   - 422 Unprocessable Entity — ошибка Pydantic валидации
   - 500 Internal Server Error — серверная ошибка

6. **Безопасность:**
   ```python
   @router.get("/{id}", dependencies=[Depends(get_current_user)])
   async def get_resource(id: int, service: ResourceService = Depends()) -> ResourceResponse:
       ...
   ```

7. **OpenAPI документация:**
   ```python
   @router.post(
       "/",
       response_model=ResourceResponse,
       status_code=201,
       summary="Создать ресурс",
       responses={409: {"description": "Уже существует"}},
   )
   ```

**Результат:**
Полный рабочий endpoint с валидацией, обработкой ошибок, документацией и тестами.
