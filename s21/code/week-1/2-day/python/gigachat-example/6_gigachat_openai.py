import os
import uuid
import requests

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

GIGACHAT_CREDENTIALS = os.getenv("GIGACHAT_CREDENTIALS")
GIGACHAT_BASE_URL = "https://gigachat.devices.sberbank.ru/api/v1"


def get_access_token() -> str:
    response = requests.post(
        "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
        headers={
            "Authorization": f"Basic {GIGACHAT_CREDENTIALS}",
            "RqUID": str(uuid.uuid4()),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        data={"scope": "GIGACHAT_API_PERS"},
        verify=False,
    )
    response.raise_for_status()
    return response.json()["access_token"]


# GigaChat использует OAuth-токен вместо статического API-ключа,
# поэтому получаем токен заранее и передаём его как api_key
token = get_access_token()

client = OpenAI(
    api_key=token,
    base_url=GIGACHAT_BASE_URL,
    http_client=__import__("httpx").Client(verify=False),
)

response = client.chat.completions.create(
    model="GigaChat-2",
    messages=[
        {"role": "system", "content": "Ты полезный ассистент."},
        {"role": "user", "content": "Привет! Как дела?"},
    ],
)

print(response.choices[0].message.content)
