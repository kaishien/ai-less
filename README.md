# ai-less

Монорепозиторий с двумя приложениями:

- `apps/backend` — NestJS API
- `apps/frontend` — Vite + React UI

## Запуск

```bash
pnpm install
pnpm dev:backend
pnpm dev:frontend
```

Backend по умолчанию слушает `http://localhost:3000`, frontend — `http://localhost:5173`.

## API

- `GET /api/hello` — базовый endpoint, который вызывает frontend через MobX-store.
