# AI-Ассистенты и Инструменты

Этот проект содержит набор Python-скриптов для работы с различными AI-моделями и сервисами. Проект организован в три основные папки по типам AI-провайдеров: GigaChat, OpenAI и Yandex GPT.

## Структура проекта

```
├── gigachat-example/          # Примеры работы с GigaChat API
│   ├── 1_gigachat_simple.py   # Простой чат с GigaChat
│   ├── 2_gigachat_with_messages.py  # Чат с системными сообщениями
│   ├── 3_giga_insurance.py    # Страховой помощник
│   ├── 4_giga_shop_assistant.py     # AI-ассистент магазина
│   ├── 5_giga_api_server.py   # Веб-сервер для GigaChat API
│   └── requirements.txt        # Зависимости для GigaChat
├── open-ai-example/           # Примеры работы с OpenAI API
│   ├── open_ai_translator.py  # Переводчик на базе OpenAI
│   ├── openai_sdk.py          # Универсальный SDK для AI-провайдеров
│   └── requirements.txt       # Зависимости для OpenAI
├── yandex-gpt-example/        # Примеры работы с Yandex GPT
│   ├── 1_yandex_gpt.py        # Простой чат с Yandex GPT
│   ├── 2_yandex_gpt_chat.py   # Корректор текста
│   └── requirements.txt       # Зависимости для Yandex GPT
└── README.md                  # Документация проекта
```

## Требования

- Python 3.7+
- Установленные зависимости из requirements.txt в каждой папке
- Настроенный файл .env с необходимыми API-ключами

## Установка

1. Клонируйте репозиторий
2. Установите зависимости для каждой папки:
```bash
# Для GigaChat
cd gigachat-example
pip install -r requirements.txt

# Для OpenAI
cd ../open-ai-example
pip install -r requirements.txt

# Для Yandex GPT
cd ../yandex-gpt-example
pip install -r requirements.txt
```

3. Создайте файл `.env` в корневой директории проекта и добавьте необходимые API-ключи:
```env
# GigaChat API
GIGACHAT_API_KEY=ваш_ключ_gigachat
GIGACHAT_CREDENTIALS=ваш_ключ_gigachat

# OpenAI API
OPENAI_API_KEY=ваш_ключ_openai
PROVIDER_API_KEY=ваш_ключ_провайдера
PROVIDER_BASE_URL=https://api.провайдер.com/v1

# Yandex Cloud ML
YANDEX_FOLDER_ID=ваш_id_папки
YANDEX_SECRET=ваш_секретный_ключ
YANDEX_API_KEY=ваш_api_ключ
```

## Описание скриптов

### GigaChat Examples (gigachat-example/)

#### 1. Простой чат (1_gigachat_simple.py)
Базовый пример работы с GigaChat API. Отправляет простое сообщение и получает ответ.

**Использование:**
```bash
cd gigachat-example
python 1_gigachat_simple.py
```

#### 2. Чат с системными сообщениями (2_gigachat_with_messages.py)
Пример создания диалога с заданием роли AI-модели через системные сообщения.

**Использование:**
```bash
python 2_gigachat_with_messages.py
```

#### 3. Страховой помощник (3_giga_insurance.py)
Скрипт для получения информации о факторах, влияющих на стоимость страховки на дом.

**Использование:**
```bash
python 3_giga_insurance.py
```

#### 4. AI-ассистент магазина (4_giga_shop_assistant.py)
AI-ассистент для интернет-магазина альпснаряжения с защитой от обхода роли. Демонстрирует создание специализированного помощника с ограниченной областью знаний.

**Использование:**
```bash
python 4_giga_shop_assistant.py
```

#### 5. Веб-сервер API (5_giga_api_server.py)
Flask-сервер для предоставления GigaChat API через HTTP. Принимает POST-запросы на `/ai` и возвращает ответы от AI.

**Использование:**
```bash
python 5_giga_api_server.py
# Сервер запустится на http://localhost:3000
```

**Пример запроса:**
```bash
curl -X POST http://localhost:3000/ai \
  -H "Content-Type: application/json" \
  -d '{"message": "Привет! Как дела?"}'
```

### OpenAI Examples (open-ai-example/)

#### 1. Переводчик (open_ai_translator.py)
Интерактивный переводчик текста на русский язык с помощью OpenAI GPT-3.5.

**Использование:**
```bash
cd open-ai-example
python open_ai_translator.py
```

#### 2. Универсальный SDK (openai_sdk.py)
Пример использования OpenAI-совместимого API с различными провайдерами (DeepSeek, GPT-3.5 и др.).

**Использование:**
```bash
python openai_sdk.py
```

### Yandex GPT Examples (yandex-gpt-example/)

#### 1. Простой чат (1_yandex_gpt.py)
Базовый пример работы с Yandex GPT через Yandex Cloud ML SDK.

**Использование:**
```bash
cd yandex-gpt-example
python 1_yandex_gpt.py
```

#### 2. Корректор текста (2_yandex_gpt_chat.py)
Скрипт для проверки и исправления ошибок в тексте с помощью Yandex GPT.

**Использование:**
```bash
python 2_yandex_gpt_chat.py
```

## Зависимости

### Общие зависимости
- `python-dotenv` - для работы с переменными окружения

### GigaChat
- `gigachat` - официальный SDK для GigaChat API
- `flask` - для создания веб-сервера

### OpenAI
- `openai` - официальный SDK для OpenAI API

### Yandex GPT
- `yandex-cloud-ml-sdk` - официальный SDK для Yandex Cloud ML

## Особенности реализации

### Безопасность
- Все API-ключи хранятся в файле .env
- Файл .env должен быть добавлен в .gitignore
- Использование контекстных менеджеров для правильного закрытия соединений
- Обработка ошибок во всех скриптах

### Архитектура
- Модульная структура по типам AI-провайдеров
- Единообразный подход к работе с переменными окружения
- Подробные комментарии в коде для понимания логики
- Примеры как простых, так и сложных сценариев использования

### Функциональность
- Простые чат-боты для демонстрации базовых возможностей
- Специализированные ассистенты с ограниченной областью знаний
- Веб-API для интеграции с внешними системами
- Универсальные SDK для работы с различными провайдерами

## Поддержка

При возникновении проблем:
1. Проверьте правильность API-ключей в файле .env
2. Убедитесь, что все зависимости установлены в соответствующей папке
3. Проверьте подключение к интернету
4. Убедитесь, что у вас достаточно средств на балансе используемых API-сервисов
5. Проверьте логи ошибок в консоли для диагностики проблем 