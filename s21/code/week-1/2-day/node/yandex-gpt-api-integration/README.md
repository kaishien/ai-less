# Yandex GPT Node.js Server

Готовый к интеграции сервер для работы с Yandex GPT API на Node.js с поддержкой диалогов.

## Требования

- Node.js версии 18+ (рекомендуется 22+)
- npm или yarn
- Аккаунт Yandex Cloud с доступом к Yandex GPT
- Yandex Cloud CLI (опционально, для управления через командную строку)

## Быстрый старт

1. **Клонируйте репозиторий:**
```bash
git clone <url-repository>
cd integration-ready-yandexgpt-node-server
```

2. **Автоматическая настройка:**
```bash
npm run setup
```

3. **Настройте переменные окружения:**
Отредактируйте файл `.env` и укажите ваши данные:
```env
YANDEX_API_KEY=ваш_api_ключ
YANDEX_CATALOGUE_ID=ваш_id_каталога
```

4. **Проверьте конфигурацию:**
```bash
npm run check
```

5. **Запустите сервер:**
```bash
npm start
```

6. **Откройте в браузере:**
```
http://localhost:3000
```

## Установка

### Ручная установка

1. **Установите зависимости:**
```bash
npm install
```

2. **Создайте файл `.env`** (см. раздел "Конфигурация")

## Конфигурация

### 1. Переменные окружения

Создайте файл `.env` в корне проекта со следующими переменными:

```env
# ===================================
# Конфигурация сервера
# ===================================
PORT=3000
NODE_ENV=development

# ===================================
# Конфигурация Yandex Cloud
# ===================================
YANDEX_API_KEY=your_api_key_here
YANDEX_CATALOGUE_ID=your_catalogue_id_here
YANDEX_MODEL_URL=https://llm.api.cloud.yandex.net/foundationModels/v1/completion
YANDEX_MODEL=yandexgpt

# ===================================
# Параметры генерации
# ===================================
TEMPERATURE=0.3
MAX_TOKENS=1024

# ===================================
# Настройки приложения
# ===================================
CORS_ENABLED=false
LOG_LEVEL=info
```

### 2. Получение API ключа (YANDEX_API_KEY)

Существует несколько способов получения API ключа для работы с Yandex GPT:

#### Способ 1: Через консоль управления (Рекомендуется для начинающих)

1. Перейдите в [консоль управления Yandex Cloud](https://console.cloud.yandex.ru/)
2. Выберите нужный каталог из списка слева
3. В левом меню перейдите в раздел **"Сервисные аккаунты"**
4. Если у вас нет сервисного аккаунта:
   - Нажмите **"Создать сервисный аккаунт"**
   - Укажите имя (например, `yandexgpt-service-account`)
   - Добавьте роль **`ai.languageModels.user`** для работы с YandexGPT
   - Нажмите **"Создать"**
5. Выберите созданный сервисный аккаунт из списка
6. На вкладке **"Обзор"** нажмите **"Создать новый ключ"**
7. Выберите **"Создать API-ключ"**
8. В появившемся окне:
   - Добавьте описание ключа (например, "Key for Node.js YandexGPT server")
   - В поле **"Область действия"** выберите или добавьте:
     - `yandex.cloud.ai.foundation-models.v1.user` - для работы с Foundation Models
     - `yandex.cloud.ai.llm.user` - для работы с языковыми моделями
   - При необходимости установите срок действия ключа
9. Нажмите **"Создать"**
10. **ВАЖНО:** Скопируйте и сохраните ключ немедленно! После закрытия окна ключ будет недоступен

#### Способ 2: Через Yandex Cloud CLI

**Предварительная настройка CLI:**

1. Установите Yandex Cloud CLI:
   ```bash
   # Windows (PowerShell)
   iex (New-Object System.Net.WebClient).DownloadString('https://storage.yandexcloud.net/yandexcloud-yc/install.ps1')
   
   # macOS/Linux
   curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash
   ```

2. Инициализируйте CLI:
   ```bash
   yc init
   ```
   Следуйте инструкциям для аутентификации через браузер

**Создание сервисного аккаунта через CLI:**

1. Создайте сервисный аккаунт:
   ```bash
   yc iam service-account create \
     --name yandexgpt-service-account \
     --description "Service account for YandexGPT API access"
   ```

2. Получите ID созданного аккаунта:
   ```bash
   yc iam service-account get yandexgpt-service-account --format json | grep \"id\"
   ```

3. Назначьте необходимые роли:
   ```bash
   # Получите ID вашего каталога
   yc config get folder-id
   
   # Назначьте роль для работы с YandexGPT
   yc resource-manager folder add-access-binding <folder-id> \
     --role ai.languageModels.user \
     --subject serviceAccount:<service-account-id>
   ```

4. Создайте API-ключ:
   ```bash
   # Сохранить в файл
   yc iam api-key create \
     --service-account-name <yandexgpt service account> \
     --description "API key for Node.js server" \
     > api-key.yaml
   
   # Или вывести в консоль
   yc iam api-key create \
     --service-account-name yandexgpt-service-account \
     --description "API key for Node.js server"
   ```

5. Извлеките ключ из JSON файла:
   ```bash
   # Linux/macOS
   cat api-key.json | grep \"secret\" | cut -d'"' -f4
   
   # Windows PowerShell
   (Get-Content api-key.json | ConvertFrom-Json).secret
   ```

#### Способ 3: Через API (для автоматизации)

1. Сначала получите IAM-токен для авторизации:
   ```bash
   yc iam create-token
   ```

2. Выполните запрос к API:
   ```bash
   curl --request POST \
     --header "Content-Type: application/json" \
     --header "Authorization: Bearer <IAM-TOKEN>" \
     --data "{ 
       \"serviceAccountId\": \"<SERVICE-ACCOUNT-ID>\",
       \"description\": \"API key for YandexGPT\"
     }" \
     https://iam.api.cloud.yandex.net/iam/v1/apiKeys
   ```

### 3. Получение ID каталога (YANDEX_CATALOGUE_ID)

#### Через консоль:
1. Откройте [консоль Yandex Cloud](https://console.cloud.yandex.ru/)
2. ID каталога отображается:
   - В адресной строке: `https://console.cloud.yandex.ru/folders/<CATALOGUE_ID>`
   - В левом меню под названием каталога
   - В разделе "Обзор" каталога

#### Через CLI:
```bash
# Список всех каталогов
yc resource-manager folder list

# ID текущего каталога
yc config get folder-id

# Подробная информация о каталоге
yc resource-manager folder get <folder-name>
```

### 4. Системные промпты (опционально)

Файл `src/config/prompts.json` содержит системные промпты для разных ролей AI:

```json
{
  "mentor": "Ты — терпеливый ментор, который помогает изучать JavaScript. Твоя задача — объяснять сложные концепции простым и понятным языком...",
  "autoexpert": "Ты — опытный автоэксперт. Твоя задача — отвечать на вопросы, связанные с автомобилями...",
  // добавьте свои роли
}
```

**Доступные роли:**
- `mentor` - ментор по программированию (используется по умолчанию)
- `autoexpert` - эксперт по автомобилям

Для смены роли отредактируйте файл `src/services/MessageManager.js` и измените строку:
```javascript
"text": systemRoles.mentor  // замените на нужную роль
```

### 5. Middleware

Проект включает модульную систему middleware для обработки различных аспектов HTTP-запросов:

- **CORS middleware** (`src/middlewares/cors.middleware.js`) - настройка CORS для кросс-доменных запросов
- **Error middleware** (`src/middlewares/error.middleware.js`) - централизованная обработка ошибок
- **Log middleware** (`src/middlewares/log.middleware.js`) - логирование HTTP-запросов

Все middleware автоматически подключаются при запуске сервера через функцию `serverConfig()` в `src/config/server.config.js`.

## Структура файлов

```
integration-ready-yandexgpt-node-server/
├── src/                         # Исходный код приложения
│   ├── app.js                   # Основное Express приложение
│   ├── server.js                # Точка входа сервера
│   ├── config/                  # Конфигурация
│   │   ├── server.config.js     # Централизованная конфигурация
│   │   └── prompts.json         # Системные промпты для разных ролей
│   ├── routes/                  # Маршруты API
│   │   └── conversation.routes.js # Маршруты для диалогов
│   ├── services/                # Бизнес-логика
│   │   └── MessageManager.js    # Управление историей сообщений
│   ├── utils/                   # Утилиты
│   │   └── axios.instance.js    # Настроенный HTTP клиент
│   ├── middlewares/             # Промежуточные обработчики
│   │   ├── cors.middleware.js   # CORS middleware
│   │   ├── error.middleware.js  # Обработка ошибок
│   │   └── log.middleware.js    # Логирование запросов
│   └── validators/              # Валидаторы
│       └── config.validator.js  # Валидация конфигурации
├── scripts/                     # Скрипты для настройки и проверки
│   ├── setup.js                 # Автоматическая настройка проекта
│   └── check-config.js          # Проверка конфигурации
├── api-key.yaml                 # API ключ Yandex Cloud (если есть)
├── package.json                 # Зависимости и скрипты проекта
├── .env                         # Переменные окружения (создать вручную)
└── README.md                    # Документация
```

## Запуск

### 1. Автоматическая настройка (рекомендуется для первого запуска):
```bash
npm run setup
```
Этот скрипт:
- Проверит версию Node.js (требуется 18+)
- Создаст файл `.env` из шаблона
- Установит зависимости, если необходимо

### 2. Проверка конфигурации:
```bash
npm run check
```
Этот скрипт:
- Проверит все переменные окружения
- Протестирует подключение к YandexGPT API
- Покажет подробную информацию о конфигурации

### 3. Запуск сервера:

#### Режим разработки (с автоперезагрузкой):
```bash
npm run dev
```

#### Production режим:
```bash
npm start
```

Сервер запустится на порту указанном в `.env` (по умолчанию 3000)

## API Endpoints

### GET /
Веб-интерфейс для просмотра истории диалога с YandexGPT

**Response:** HTML страница с красивым интерфейсом для просмотра истории сообщений

### GET /health
Проверка состояния сервера

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development",
  "version": "1.0.0"
}
```

### GET /api/info
Информация об API и доступных эндпоинтах

**Response:**
```json
{
  "name": "YandexGPT Node.js Server",
  "version": "1.0.0",
  "endpoints": [
    { "method": "GET", "path": "/", "description": "Просмотр истории диалога (HTML)" },
    { "method": "GET", "path": "/health", "description": "Проверка состояния" },
    { "method": "GET", "path": "/api/info", "description": "Информация об API" },
    { "method": "POST", "path": "/conversation", "description": "Отправить сообщение в YandexGPT" },
    { "method": "POST", "path": "/conversation/reset", "description": "Сбросить историю диалога" },
    { "method": "GET", "path": "/conversation/history", "description": "Получить историю диалога (JSON)" }
  ],
  "model": "yandexgpt",
  "environment": "development"
}
```

### POST /conversation
Отправка сообщения и получение ответа от YandexGPT

**Request:**
```json
{
  "message": "Ваше сообщение"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "alternatives": [{
      "message": {
        "role": "assistant",
        "text": "Ответ от YandexGPT"
      },
      "status": "ALTERNATIVE_STATUS_FINAL"
    }],
    "usage": {
      "inputTextTokens": "27",
      "completionTokens": "18",
      "totalTokens": "45"
    },
    "modelVersion": "09.02.2025"
  },
  "conversationLength": 3
}
```

### POST /conversation/reset
Сброс истории диалога (оставляет только системное сообщение)

**Response:**
```json
{
  "success": true,
  "message": "История диалога сброшена"
}
```

### GET /conversation/history
Получение истории диалога в формате JSON

**Response:**
```json
{
  "messages": [
    {
      "role": "user",
      "text": "Привет!"
    },
    {
      "role": "assistant", 
      "text": "Привет! Как дела?"
    }
  ],
  "totalMessages": 2,
  "systemPrompt": "Ты — терпеливый ментор, который помогает изучать JavaScript..."
}
```

## Примеры использования

### 1. Отправка сообщения в YandexGPT

#### С помощью curl:
```bash
curl -X POST http://localhost:3000/conversation \
  -H "Content-Type: application/json" \
  -d '{"message": "Привет, помоги мне с кодом"}'
```

#### С помощью JavaScript:
```javascript
const response = await fetch('http://localhost:3000/conversation', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'Привет, помоги мне с кодом'
  })
});

const data = await response.json();
console.log(data.result.alternatives[0].message.text);
```

### 2. Проверка состояния сервера
```bash
curl http://localhost:3000/health
```

### 3. Получение информации об API
```bash
curl http://localhost:3000/api/info
```

### 4. Получение истории диалога
```bash
curl http://localhost:3000/conversation/history
```

### 5. Сброс истории диалога
```bash
curl -X POST http://localhost:3000/conversation/reset
```

### 6. Просмотр веб-интерфейса
Откройте в браузере: `http://localhost:3000/`

### 7. Полный пример с обработкой ошибок (JavaScript)
```javascript
async function sendMessage(message) {
  try {
    const response = await fetch('http://localhost:3000/conversation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log('Ответ YandexGPT:', data.result.alternatives[0].message.text);
      console.log('Использовано токенов:', data.result.usage.totalTokens);
    } else {
      console.error('Ошибка:', data.error);
    }
  } catch (error) {
    console.error('Ошибка запроса:', error.message);
  }
}

// Использование
sendMessage('Объясни, что такое замыкания в JavaScript');
```

## Доступные модели YandexGPT

Сервер может работать с различными моделями YandexGPT. Для изменения модели отредактируйте переменную `YANDEX_MODEL` в файле `.env`:

### Основные модели:
- **YandexGPT Pro** - самая мощная модель
  ```env
  YANDEX_MODEL=yandexgpt-pro
  ```

- **YandexGPT Lite** - облегчённая версия, быстрее и дешевле
  ```env
  YANDEX_MODEL=yandexgpt-lite
  ```

- **YandexGPT** - стандартная модель (используется по умолчанию)
  ```env
  YANDEX_MODEL=yandexgpt
  ```

- **YandexGPT 32k** - расширенный контекст (32 768 токенов)
  ```env
  YANDEX_MODEL=yandexgpt-32k
  ```

### Настройка параметров генерации:

В файле `.env` можно настроить параметры генерации:

- **TEMPERATURE** (0.0 - 1.0) - креативность ответов. 0 = детерминированные, 1 = максимально креативные
- **MAX_TOKENS** - максимальное количество токенов в ответе
- **stream** - потоковая передача ответа (настраивается в `src/config/index.js`)

## Ограничения и лимиты

### Ограничения моделей:
- **YandexGPT Pro/Lite**: до 8 192 токенов на запрос
- **YandexGPT 32k**: до 32 768 токенов на запрос
- **Максимальный ответ**: до 2000 токенов в ответе

### Квоты API:
- **Запросов в минуту**: 10 запросов
- **Запросов в день**: 1000 запросов
- **Токенов в минуту**: 20 000 токенов

Подробнее о квотах и тарифах: [Документация Yandex Cloud](https://yandex.cloud/ru/docs/foundation-models/concepts/limits)

## Особенности проекта

### 🚀 Готовность к интеграции
- **Модульная архитектура** - код разделен на логические модули (routes, services, config, utils, middlewares, validators)
- **Централизованная конфигурация** - все настройки в одном месте (`src/config/server.config.js`)
- **Валидация конфигурации** - автоматическая проверка обязательных параметров при запуске (`src/validators/config.validator.js`)
- **Обработка ошибок** - подробные сообщения об ошибках с кодами через middleware

### 🎨 Веб-интерфейс
- **Красивый HTML интерфейс** - просмотр истории диалога в браузере
- **Адаптивный дизайн** - работает на всех устройствах
- **Анимации** - плавные переходы и эффекты

### 🔧 Удобство разработки
- **Скрипты автоматизации** - `npm run setup` и `npm run check`
- **Логирование запросов** - подробные логи в development режиме через middleware
- **Hot reload** - автоперезагрузка при изменениях (`npm run dev`)
- **Модульные middleware** - отдельные файлы для CORS, логирования и обработки ошибок
- **TypeScript готовность** - структура проекта готова для миграции на TypeScript

### 🛡️ Безопасность
- **Переменные окружения** - все секретные данные в `.env`
- **Валидация конфигурации** - автоматическая проверка обязательных параметров при запуске
- **Валидация входных данных** - проверка обязательных полей в API
- **Обработка ошибок API** - безопасная обработка ошибок YandexGPT через middleware

## Важные замечания

1. **Безопасность**: 
   - Никогда не коммитьте файл `.env` с реальными ключами в репозиторий
   - Файл `.env` уже добавлен в `.gitignore`
   - Используйте скрипт `npm run setup` для создания `.env`
   
2. **Состояние диалога**: 
   - Текущая версия хранит диалог в памяти
   - При перезапуске сервера история теряется
   - Для продакшн использования рекомендуется добавить Redis или MongoDB
   
3. **Множественные пользователи**: 
   - Для поддержки множественных пользователей необходимо добавить систему сессий
   - Можно использовать express-session или JWT токены

4. **Мониторинг и логирование**:
   - Встроенное логирование запросов в development режиме через middleware
   - Модульная система логирования в `src/middlewares/log.middleware.js`
   - Рекомендуется добавить winston или pino для продакшн логирования
   - Мониторьте количество запросов и токенов для контроля расходов


## Работа с Yandex Cloud CLI

### Основные команды для управления ресурсами

#### Управление профилями и конфигурацией:
```bash
# Просмотр текущей конфигурации
yc config list

# Установка активного профиля
yc config profile activate <profile-name>

# Переключение между каталогами
yc config set folder-id <folder-id>

# Просмотр текущего пользователя
yc config get
```

#### Управление сервисными аккаунтами:
```bash
# Просмотр всех сервисных аккаунтов
yc iam service-account list

# Подробная информация о сервисном аккаунте
yc iam service-account get <service-account-name>

# Создание нового сервисного аккаунта
yc iam service-account create \
  --name my-service-account \
  --description "My service account description"

# Удаление сервисного аккаунта
yc iam service-account delete <service-account-id>
```

#### Управление ролями и правами доступа:
```bash
# Просмотр доступных ролей
yc iam role list

# Назначение роли на уровне каталога
yc resource-manager folder add-access-binding <folder-id> \
  --role <role-name> \
  --subject serviceAccount:<service-account-id>

# Назначение нескольких ролей одновременно
yc resource-manager folder set-access-bindings <folder-id> \
  --access-binding role=editor,subject=serviceAccount:<service-account-id> \
  --access-binding role=viewer,subject=userAccount:<user-id>

# Отзыв роли
yc resource-manager folder remove-access-binding <folder-id> \
  --role <role-name> \
  --subject serviceAccount:<service-account-id>

# Просмотр текущих прав доступа
yc resource-manager folder list-access-bindings <folder-id>
```

#### Управление API-ключами:
```bash
# Список всех API-ключей сервисного аккаунта
yc iam api-key list --service-account-name <service-account-name>

# Создание нового API-ключа с описанием
yc iam api-key create \
  --service-account-id <service-account-id> \
  --description "Production API key" \
  --scope yandex.cloud.ai.foundation-models.v1.user

# Удаление API-ключа
yc iam api-key delete <api-key-id>

# Получение информации об API-ключе
yc iam api-key get <api-key-id>
```

### Полезные скрипты для автоматизации

#### Полная настройка сервисного аккаунта для YandexGPT:
```bash
#!/bin/bash
# setup-yandexgpt.sh

# Переменные
SERVICE_ACCOUNT_NAME="yandexgpt-service-account"
FOLDER_ID=$(yc config get folder-id)

# Создание сервисного аккаунта
SA_ID=$(yc iam service-account create \
  --name $SERVICE_ACCOUNT_NAME \
  --description "Service account for YandexGPT API" \
  --format json | jq -r '.id')

echo "Service Account ID: $SA_ID"

# Назначение ролей
yc resource-manager folder add-access-binding $FOLDER_ID \
  --role ai.languageModels.user \
  --subject serviceAccount:$SA_ID

yc resource-manager folder add-access-binding $FOLDER_ID \
  --role ai.foundationModels.user \
  --subject serviceAccount:$SA_ID

# Создание API-ключа
API_KEY=$(yc iam api-key create \
  --service-account-id $SA_ID \
  --description "API key for Node.js YandexGPT server" \
  --format json | jq -r '.secret')

# Сохранение в .env файл
echo "YANDEX_API_KEY=$API_KEY" > .env
echo "YANDEX_CATALOGUE_ID=$FOLDER_ID" >> .env
echo "YANDEX_MODEL_URL=https://llm.api.cloud.yandex.net/foundationModels/v1/completion" >> .env
echo "PORT=3000" >> .env

echo ""
echo "✅ Настройка завершена!"
echo "Файл .env создан с необходимыми переменными."
echo "Service Account: $SERVICE_ACCOUNT_NAME"
echo "Folder ID: $FOLDER_ID"
```

#### Windows PowerShell скрипт:
```powershell
# setup-yandexgpt.ps1

$SERVICE_ACCOUNT_NAME = "yandexgpt-service-account"
$FOLDER_ID = (yc config get folder-id)

# Создание сервисного аккаунта
$SA_JSON = yc iam service-account create `
  --name $SERVICE_ACCOUNT_NAME `
  --description "Service account for YandexGPT API" `
  --format json

$SA = $SA_JSON | ConvertFrom-Json
$SA_ID = $SA.id

Write-Host "Service Account ID: $SA_ID"

# Назначение ролей
yc resource-manager folder add-access-binding $FOLDER_ID `
  --role ai.languageModels.user `
  --subject serviceAccount:$SA_ID

yc resource-manager folder add-access-binding $FOLDER_ID `
  --role ai.foundationModels.user `
  --subject serviceAccount:$SA_ID

# Создание API-ключа
$API_KEY_JSON = yc iam api-key create `
  --service-account-id $SA_ID `
  --description "API key for Node.js YandexGPT server" `
  --format json

$API_KEY = ($API_KEY_JSON | ConvertFrom-Json).secret

# Создание .env файла
@"
YANDEX_API_KEY=$API_KEY
YANDEX_CATALOGUE_ID=$FOLDER_ID
YANDEX_MODEL_URL=https://llm.api.cloud.yandex.net/foundationModels/v1/completion
PORT=3000
"@ | Out-File -FilePath .env -Encoding utf8

Write-Host ""
Write-Host "✅ Настройка завершена!" -ForegroundColor Green
Write-Host "Файл .env создан с необходимыми переменными."
Write-Host "Service Account: $SERVICE_ACCOUNT_NAME"
Write-Host "Folder ID: $FOLDER_ID"
```

### Отладка и проверка доступа

#### Проверка доступа к YandexGPT API:
```bash
# Тестовый запрос к API
curl -X POST \
  https://llm.api.cloud.yandex.net/foundationModels/v1/completion \
  -H "Authorization: Api-Key YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "modelUri": "gpt://YOUR_FOLDER_ID/yandexgpt-lite",
    "completionOptions": {
      "stream": false,
      "temperature": 0.1,
      "maxTokens": 100
    },
    "messages": [
      {"role": "system", "text": "Ты помощник"},
      {"role": "user", "text": "Привет!"}
    ]
  }'
```

#### Проверка прав сервисного аккаунта:
```bash
# Просмотр всех ролей сервисного аккаунта
yc resource-manager folder list-access-bindings <folder-id> \
  --filter "subject.id='<service-account-id>'"

# Проверка конкретной роли
yc resource-manager folder list-access-bindings <folder-id> \
  | grep -E "(ai.languageModels.user|ai.foundationModels.user)"
```

## Возможные ошибки

### "Failed to get response from Yandex GPT"
- Проверьте правильность `YANDEX_API_KEY` и `YANDEX_CATALOGUE_ID`
- Убедитесь, что у сервисного аккаунта есть права на использование Yandex GPT
- Проверьте правильность `YANDEX_MODEL_URL` (должен быть https://llm.api.cloud.yandex.net/foundationModels/v1/completion)
- Проверьте наличие необходимых ролей: `ai.languageModels.user` или `ai.foundationModels.user`

### "Ошибка аутентификации 401"
- API-ключ неверный или просрочен
- Проверьте формат заголовка Authorization: должен быть `Api-Key YOUR_KEY`

### "Message is required"
- Убедитесь, что в теле запроса передается поле `message`

### Import error для JSON файлов
- Требуется Node.js версии 18+ с поддержкой import assertions
- Убедитесь, что в package.json указан `"type": "module"`

## Полезные ссылки

### Официальная документация:
- [Основная документация YandexGPT API](https://yandex.cloud/ru/docs/foundation-models/)
- [Получение API ключей](https://yandex.cloud/ru/docs/foundation-models/operations/get-api-key)
- [Установка Yandex Cloud CLI](https://yandex.cloud/ru/docs/cli/quickstart)
- [Управление сервисными аккаунтами](https://yandex.cloud/ru/docs/iam/operations/sa/)
- [API Reference](https://yandex.cloud/ru/docs/foundation-models/api-ref/)

### Примеры и туториалы:
- [Примеры использования YandexGPT API](https://yandex.cloud/ru/docs/foundation-models/tutorials/)
- [Примеры промптов](https://yandex.cloud/ru/docs/foundation-models/concepts/prompts)

### Поддержка:
- [Форум Yandex Cloud](https://cloud.yandex.ru/forum/)
- [Техническая поддержка](https://cloud.yandex.ru/support)

## Лицензия

MIT

## Автор

Создано для быстрой интеграции YandexGPT API в Node.js приложения.
