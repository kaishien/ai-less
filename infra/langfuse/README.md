# Local Langfuse

Локальный Langfuse нужен, чтобы смотреть traces/dev-agent runs без облака.

## Start

```bash
pnpm dev:langfuse
```

Панель будет доступна на http://localhost:3100.

Default local login:

```text
Email: dev@ai-less.local
Password: ai-less-langfuse-dev
```

## Backend env

Добавьте в `apps/backend/.env`, чтобы включить трассировку LLM-вызовов (dev-agents, chat, RAG):

```env
LANGFUSE_PUBLIC_KEY=pk-lf-ai-less-local
LANGFUSE_SECRET_KEY=sk-lf-ai-less-local
LANGFUSE_BASE_URL=http://localhost:3100
LANGFUSE_TRACING_ENVIRONMENT=development
```

После этого перезапустите backend. Traces появятся в UI после вызова Dev Agents, чата или RAG.

## Commands

```bash
pnpm dev:langfuse:logs
pnpm dev:langfuse:down
```

Все секреты в compose-файле предназначены только для локальной разработки.
