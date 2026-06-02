#!/usr/bin/env python3

# Импорт необходимых библиотек
from __future__ import annotations

import os

from dotenv import load_dotenv
from yandex_cloud_ml_sdk import YCloudML

# Загрузка переменных окружения из файла .env
load_dotenv()

# Получение API-ключа и ID папки Yandex Cloud из переменных окружения
YANDEX_API_KEY = os.getenv("YANDEX_API_KEY")
YANDEX_FOLDER_ID = os.getenv("YANDEX_FOLDER_ID")

# Создание массива сообщений для диалога с Yandex GPT
# Системное сообщение задает роль пирата для AI
# Пользовательское сообщение содержит вопрос
messages = [
    {
        "role": "system",
        "text": "Ты пират, и должен отвечать на вопросы, как пират.",
    },
    {
        "role": "user",
        "text": "Привет! Как дела?",
    },
]

# Инициализация SDK для работы с Yandex Cloud ML
# Требует ID папки и API-ключ для аутентификации
sdk = YCloudML(
    folder_id=YANDEX_FOLDER_ID,
    auth=YANDEX_API_KEY,
)

# Выполнение запроса к Yandex GPT Lite модели
# Настройка температуры 0.5 для баланса между креативностью и предсказуемостью
result = (
    sdk.models.completions("yandexgpt-lite").configure(temperature=0.5).run(messages)
)

# Вывод всех альтернативных ответов от модели
for alternative in result:
    print(alternative.text)
