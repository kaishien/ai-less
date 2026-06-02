import os
import requests
import uuid

from dotenv import load_dotenv

load_dotenv()

GIGACHAT_CREDENTIALS = os.getenv("GIGACHAT_CREDENTIALS")

# GigaChat отдаёт самоподписанный сертификат — в продакшне передайте путь к CA-бандлу
VERIFY_SSL = False


def get_access_token() -> str:
    """Обменивает Base64-encoded credentials на Bearer-токен."""
    response = requests.post(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        headers={
            "Authorization": f"Basic {GIGACHAT_CREDENTIALS}",
            "RqUID": str(uuid.uuid4()),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"scope": "GIGACHAT_API_PERS"},
        verify=VERIFY_SSL,
    )
    response.raise_for_status()
    return response.json()["access_token"]


def chat(token: str, user_message: str) -> str:
    """Отправляет сообщение в GigaChat и возвращает текст ответа."""
    response = requests.post(
        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        json={
            "model": "GigaChat-2",
            "messages": [{"role": "user", "content": user_message}],
        },
        verify=VERIFY_SSL,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


if __name__ == "__main__":
    token = get_access_token()
    answer = chat(token, "Привет! Как дела?")
    print(answer)
