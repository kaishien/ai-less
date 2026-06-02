# Импорт необходимых библиотек
import os

from dotenv import load_dotenv
from openai import OpenAI

# Загрузка переменных окружения из файла .env
load_dotenv()

# Получение API-ключа и базового URL провайдера из переменных окружения
# Позволяет использовать различные AI-провайдеры через OpenAI-совместимый API
PROVIDER_API_KEY = os.getenv("PROVIDER_API_KEY")
PROVIDER_BASE_URL = os.getenv("PROVIDER_BASE_URL")

# Инициализация клиента OpenAI с настройками провайдера
# base_url позволяет использовать альтернативные API-провайдеры
client = OpenAI(
    api_key=PROVIDER_API_KEY,
    base_url=PROVIDER_BASE_URL,
)

# Создание диалога с AI-моделью
# Системное сообщение задает роль пирата для AI
# Пользовательское сообщение содержит вопрос
chat_completion = client.chat.completions.create(
    messages=[
        {
            "role": "system",
            "content": "Ты пират, и должен отвечать на вопросы, как пират.",
        },
        {
            "role": "user",
            "content": "Привет! Как дела?",
        },
    ],
    # Использование модели deepseek-r1
    model="deepseek-r1",
    # model="gpt-3.5-turbo",
)

# Вывод ответа от AI-модели
print(chat_completion.choices[0].message.content)
