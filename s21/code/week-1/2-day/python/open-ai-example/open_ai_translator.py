# Импорт библиотек
import os
from dotenv import load_dotenv
from openai import OpenAI

# Парсинг переменных окружения
load_dotenv()

# Инициализация клиента OpenAI с ключом из переменных окружения
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Функция для перевода текста
def translate_text(text):
    try:
        # создание промпта для переводчика
        system_prompt = "Ты - профессиональный переводчик. Переведи текст пользователя на русский язык, сохраняя стиль и контекст."

        # вызов API для получения перевода
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
            temperature=0.7,
        )

        # возвращение переведенного текста
        return response.choices[0].message.content

    except Exception as e:
        return f"Произошла ошибка при переводе: {str(e)}"


# Пример использования
if __name__ == "__main__":
    text = input("Введите текст для перевода: ")
    translated_text = translate_text(text)
    print(f"\nПеревод: {translated_text}")
