# Импорт необходимых библиотек
import os

from dotenv import load_dotenv
from gigachat import GigaChat
from gigachat.models import Chat

# Загрузка переменных окружения из файла .env
load_dotenv()

# Получение API-ключа GigaChat из переменных окружения
GIGA_API_KEY = os.getenv("GIGACHAT_CREDENTIALS")

# Инициализация клиента GigaChat с указанием модели и отключением проверки SSL-сертификатов
giga = GigaChat(credentials=GIGA_API_KEY, model="GigaChat-2", verify_ssl_certs=False)

# Создание массива сообщений для диалога с AI-моделью
# Системное сообщение задает роль и поведение модели
# Пользовательское сообщение содержит вопрос
messages = [
    {"role": "system", "content": "Ты пират, и должен отвечать на вопросы, как пират."},
    {"role": "user", "content": "Привет! Как дела?"},
]

# Создание объекта Chat с массивом сообщений для отправки в API
payload = Chat(messages=messages)

# Отправка диалога в GigaChat и получение ответа
response = giga.chat(payload)

# Вывод содержимого ответа от AI-модели
print(response.choices[0].message.content)
