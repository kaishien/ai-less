# Импорт необходимых библиотек
import os

from dotenv import load_dotenv
from gigachat import GigaChat

# Загрузка переменных окружения из файла .env
load_dotenv()

# Получение API-ключа GigaChat из переменных окружения
GIGA_API_KEY = os.getenv("GIGACHAT_CREDENTIALS")

# Инициализация клиента GigaChat с указанием модели и отключением проверки SSL-сертификатов
giga = GigaChat(credentials=GIGA_API_KEY, model="GigaChat-2", verify_ssl_certs=False)

# Отправка простого сообщения в чат и получение ответа
response = giga.chat("Привет! Как дела?")

# Вывод содержимого ответа от AI-модели
print(response.choices[0].message.content)
