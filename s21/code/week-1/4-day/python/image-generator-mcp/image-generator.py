#!/usr/bin/env python3
"""
Модуль для генерации изображений с помощью GigaChat API.
Предоставляет функционал для создания и скачивания изображений
на основе текстовых описаний в стиле Василия Кандинского.
"""

import base64
import os

from bs4 import BeautifulSoup
from dotenv import load_dotenv
from gigachat import GigaChat
from gigachat.models import Chat, Image, Messages, MessagesRole
from mcp.server.fastmcp import FastMCP

# Загружаем переменные окружения из .env файла
load_dotenv()

# Инициализируем FastMCP сервер с именем "image-generator"
mcp = FastMCP("image-generator")

# Получаем учетные данные GigaChat из переменных окружения
GIGACHAT_CREDENTIALS = os.getenv("GIGACHAT_CREDENTIALS")

@mcp.tool()
async def generate_image(prompt: str) -> str:
    """Генерирует изображение используя GigaChat API на основе текстового описания.

    Args:
        prompt (str): Текстовое описание желаемого изображения.
            Например: "Красивый закат на море в стиле импрессионизма"

    Returns:
        str: ID сгенерированного изображения в случае успеха,
             или сообщение об ошибке в случае неудачи.

    Raises:
        Exception: При проблемах с API или некорректных данных.
    """
    try:
        # Инициализируем клиент GigaChat
        giga = GigaChat(credentials=GIGACHAT_CREDENTIALS, verify_ssl_certs=False)

        # Формируем запрос к API
        # Устанавливаем роль системы как "Василий Кандинский" для стилизации
        payload = Chat(
            messages=[
                Messages(role=MessagesRole.SYSTEM, content="Ты — Василий Кандинский"),
                Messages(role=MessagesRole.USER, content=prompt),
            ],
            function_call="auto",
        )

        # Отправляем запрос и получаем ответ
        response = giga.chat(payload).choices[0].message.content
        # Извлекаем ID изображения из HTML ответа
        file_id = BeautifulSoup(response, "html.parser").find("img").get("src")

        return file_id
    except Exception as e:
        return f"Error generating image: {str(e)}"


@mcp.tool()
async def download_image(file_id: str, output_path: str) -> str:
    """Скачивает сгенерированное изображение из GigaChat API и сохраняет на диск.

    Args:
        file_id (str): ID изображения, полученный от функции generate_image
        output_path (str): Путь для сохранения изображения.
            Должен быть абсолютным и начинаться с C:/
            Например: "C:/Images/my_image.png"

    Returns:
        str: Сообщение об успешном сохранении или об ошибке.

    Raises:
        Exception: При проблемах с доступом к файловой системе или API.
    """
    try:
        # Инициализируем клиент GigaChat
        giga = GigaChat(credentials=GIGACHAT_CREDENTIALS, verify_ssl_certs=False)
        # Получаем изображение по его ID
        image = giga.get_image(file_id)

        # Создаем директорию для сохранения, если она не существует
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Декодируем base64 контент и сохраняем как файл
        with open(output_path, mode="wb") as fd:
            fd.write(base64.b64decode(image.content))

        return f"Image successfully saved to {output_path}"
    except Exception as e:
        return f"Error downloading image: {str(e)}"


if __name__ == "__main__":
    # Запускаем MCP сервер в режиме stdio для взаимодействия с клиентом
    mcp.run(transport="stdio")
