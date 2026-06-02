# AI Image Generator

NestJS-приложение для генерации изображений через OpenAI-совместимый API (Midjourney, DALL-E и др.) со встроенной галереей.

## Стек

- **[NestJS](https://nestjs.com/)** — серверный фреймворк
- **TypeScript** — язык разработки
- **Axios** — HTTP-клиент для обращений к API
- **Pure CSS** — стилизация фронтенда, без фреймворков
- **Node.js `fs`** — хранение изображений на диске

## Возможности

- Генерация изображений по текстовому описанию
- Сохранение изображений в виде файлов на сервере (`generated/`)
- Галерея всех сгенерированных изображений с лайтбоксом
- Поддержка любого OpenAI-совместимого API генерации изображений

## Структура проекта

```
src/
├── main.ts                        # Запуск приложения + статические файлы
├── app.module.ts                  # Корневой модуль
├── app.controller.ts              # GET / → отдаёт index.html
└── modules/
    └── images/
        ├── images.module.ts
        ├── images.controller.ts   # POST /api/images/generate
        │                          # GET  /api/images
        ├── images.service.ts      # Вызов API + сохранение файлов
        └── dto/
            └── generate.dto.ts
public/
└── index.html                     # Фронтенд (чистый HTML + CSS + JS)
generated/                         # Сохранённые изображения (создаётся автоматически)
```

## API

| Метод  | Маршрут                 | Тело запроса      | Описание                    |
|--------|-------------------------|-------------------|-----------------------------|
| GET    | `/`                     | —                 | Отдаёт страницу фронтенда   |
| POST   | `/api/images/generate`  | `{ "prompt": "" }`| Генерирует изображение      |
| GET    | `/api/images`           | —                 | Список всех изображений     |

## Запуск

**1. Установить зависимости**

```bash
npm install
```

**2. Настроить переменные окружения**

```bash
cp .env.example .env
```

Заполнить `.env`:

```env
API_KEY=ваш_ключ_api
API_URL=https://bothub.chat/api/v2/openai/v1
MODEL=dall-e-3
PORT=3000
```

**3. Запустить**

```bash
# Режим разработки
npm run start:dev

# Продакшн
npm run build && npm run start:prod
```

Открыть [http://localhost:3000](http://localhost:3000)

## Поддерживаемые провайдеры

Любой OpenAI-совместимый API генерации изображений:

| Провайдер | API_URL | MODEL |
|-----------|---------|-------|
| [bothub.chat](https://bothub.chat) | `https://bothub.chat/api/v2/openai/v1` | `midjourney`, `dall-e-3` |
| OpenAI | `https://api.openai.com/v1` | `dall-e-3`, `dall-e-2` |
| OpenRouter | `https://openrouter.ai/api/v1` | slug модели |
