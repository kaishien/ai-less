# Генератор изображений с GigaChat

Проект представляет собой сервис для генерации изображений с помощью API GigaChat. Сервис реализован с использованием FastMCP и позволяет генерировать изображения на основе текстовых описаний.

## Требования

- Python 3.13 или выше
- Учетные данные GigaChat API (токен доступа)

## Установка

1. Клонируйте репозиторий:
```bash
git clone [url-репозитория]
cd image-generator
```

2. Установите зависимости с помощью pip:
```bash
pip install -r requirements.txt
```

3. Создайте файл `.env` в корневой директории проекта и добавьте ваш токен GigaChat:
```
GIGACHAT_CREDENTIALS=ваш_токен
```

## Использование

Проект предоставляет два основных метода:

### 1. Генерация изображения

```python
from mcp.client import Client

client = Client("image-generator")
file_id = await client.generate_image(prompt="Ваше описание изображения")
```

### 2. Скачивание изображения

```python
await client.download_image(
    file_id="полученный_id_файла",
    output_path="C:/путь/к/файлу/image.png"
)
```

## Пример использования

```python
from mcp.client import Client

async def main():
    client = Client("image-generator")
    
    # Генерируем изображение
    file_id = await client.generate_image(
        prompt="Красивый закат на море в стиле импрессионизма"
    )
    
    # Скачиваем сгенерированное изображение
    result = await client.download_image(
        file_id=file_id,
        output_path="C:/Images/sunset.png"
    )
    print(result)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

## Структура проекта

- `image-generator.py` - основной файл с реализацией функций генерации и скачивания изображений
- `main.py` - пример использования сервиса
- `pyproject.toml` - файл с зависимостями проекта
- `.env` - файл с переменными окружения (необходимо создать)

## Зависимости

- bs4 - для парсинга HTML
- python-dotenv - для работы с переменными окружения
- gigachat - SDK для работы с GigaChat API
- httpx - HTTP клиент
- mcp[cli] - инструментарий для создания MCP сервисов

## Примечания

- Убедитесь, что у вас есть действующий токен GigaChat API
- При указании путей для сохранения файлов используйте абсолютные пути, начинающиеся с `C:/`
- Сервис использует стиль Василия Кандинского для генерации изображений

## Возможные ошибки

1. "Error generating image" - проверьте правильность токена GigaChat и подключение к интернету
2. "Error downloading image" - проверьте правильность указанного пути и права доступа к директории

## Лицензия

ISC 
