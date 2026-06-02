# Команда: /tests

## Описание
Создай comprehensive pytest тесты для выбранного Python кода.

## Prompt
Создай тесты для этого кода:

1. **Unit тесты (pytest):**
   - Проверка основной функциональности
   - Граничные случаи (None, [], 0, пустая строка)
   - Edge cases (минимум, максимум, границы)

2. **Негативные тесты:**
   ```python
   def test_raises_on_invalid_input() -> None:
       with pytest.raises(ValueError, match="discount must be 0-100"):
           calculate_total([], discount=150)
   ```

3. **Async тесты (pytest-asyncio):**
   ```python
   @pytest.mark.asyncio
   async def test_fetch_returns_user() -> None:
       ...
   ```

4. **FastAPI тесты (TestClient):**
   ```python
   def test_endpoint_returns_200(client: TestClient) -> None:
       response = client.get("/resource/1")
       assert response.status_code == 200
   ```

5. **Моки (unittest.mock / pytest-mock):**
   ```python
   from unittest.mock import AsyncMock, patch

   @pytest.fixture
   def mock_session():
       with patch("app.services.get_session") as mock:
           yield AsyncMock()
   ```

6. **Требования:**
   - Используй pytest (не unittest)
   - Описательные имена: `test_returns_none_when_user_not_found`
   - Arrange / Act / Assert структура
   - Один тест — одна проверка
   - Стремись к 80%+ покрытию

**Структура:**
```python
class TestCalculateTotal:
    def test_returns_sum(self) -> None:
        # arrange
        items = [Item(price=100)]
        # act
        result = calculate_total(items, discount=0)
        # assert
        assert result == 100.0
```

**Запуск:**
```bash
pytest tests/ -xvs
pytest tests/ --cov=app --cov-report=term-missing
```
