# Импорт необходимых библиотек
from __future__ import annotations
import os
from dotenv import load_dotenv
from yandex_cloud_ml_sdk import YCloudML

# Загрузка переменных окружения из файла .env
load_dotenv()

# Создание промпта для коррекции текста
# Системное сообщение задает роль корректора текста
# Пользовательское сообщение содержит текст с ошибками для исправления
messages = [
    {
        "role": "system",
        "text": "Найди ошибки в тексте и исправь их",
    },
    {
        "role": "user",
        "text": """Ламинат подойдет для укладке на кухне или в детской 
комнате – он не боиться влаги и механических повреждений благодаря 
защитному слою из облицованных меламиновых пленок толщиной 0,2 мм и 
обработанным воском замкам.""",
    },
]

# Функция для работы с Yandex GPT API
def main():
    # Инициализация SDK для работы с Yandex Cloud ML
    # Использует ID папки и секретный ключ для аутентификации
    sdk = YCloudML(
        folder_id=os.getenv("YANDEX_FOLDER_ID"),
        auth=os.getenv("YANDEX_SECRET"),
    )

    # Выполнение запроса к основной модели Yandex GPT
    # Настройка температуры 0.5 для точной коррекции текста
    result = (
        sdk.models.completions("yandexgpt").configure(temperature=0.5).run(messages)
    )

    # Вывод всех альтернативных вариантов исправленного текста
    for alternative in result:
        print(alternative)

# Запуск основной функции при выполнении скрипта
if __name__ == "__main__":
    main()
