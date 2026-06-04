# ai-less

A monorepo with an AI chat app where one model can both answer with text and generate images. The model decides whether to respond with text or call the image tool; the client does not route the request itself.

- `apps/backend` - NestJS API for orchestration and OpenAI integrations
- `apps/frontend` - Vite + React + MobX UI with streamed responses

## Running

```bash
pnpm install
pnpm dev # run backend and frontend in parallel
# or run them separately:
pnpm dev:backend
pnpm dev:frontend
```

The backend listens on `http://localhost:3000`, and the frontend runs on `http://localhost:5173` with `/api` proxied to the backend.

### Environment Variables (`apps/backend/.env`)


| Variable                | Purpose                   | Default                 |
| ----------------------- | ------------------------- | ----------------------- |
| `OPENAI_API_KEY`        | OpenAI API key (required) | -                       |
| `OPENAI_MODEL`          | Chat/orchestrator model   | `gpt-5.4-mini`          |
| `OPENAI_GUARD_MODEL`    | Guard classifier model    | `OPENAI_MODEL`          |
| `OPENAI_IMAGE_MODEL`    | Image generation model    | `gpt-image-1`           |
| `TOKEN_BUDGET_PER_HOUR` | Hourly token budget       | `20000`                 |
| `FRONTEND_ORIGIN`       | Frontend CORS origin      | `http://localhost:5173` |
| `PORT`                  | Backend port              | `3000`                  |


## API

- `POST /api/chat` - non-streaming text response.
- `POST /api/chat/stream` - primary endpoint. Returns an NDJSON event stream, one event per line. Both text responses and image generation flow through this endpoint.

## Flow

All user input goes through a single endpoint: `/api/chat/stream`. On the backend, the request passes through this pipeline: safety check -> budget check -> model with tools -> branch into text response or image generation.

```mermaid
flowchart TD
    U["User enters a message"] --> FE["chatStore.sendMessage"]
    FE -->|"creates empty assistant bubble"| FE2["POST /api/chat/stream<br/>full conversation history"]
    FE2 --> CTRL["ChatController.streamChat<br/>NDJSON response"]
    CTRL --> SVC["ChatService.streamChat"]

    SVC --> NORM["normalizeMessages<br/>keep user/assistant and trim"]
    NORM --> GUARD{"InputGuard.inspect"}
    GUARD -->|"LLM classifier"| GC["OpenAiGuardClient<br/>allow / prompt_injection / out_of_scope"]
    GC -.->|"classifier error"| FAILOPEN["fail-open allow"]

    GUARD -->|"blocked"| REFUSE["Stream polite refusal<br/>0 tokens"]
    GUARD -->|"allow"| BUDGET{"TokenBudget.canSpend?"}
    BUDGET -->|"no"| E429["HTTP 429<br/>budget exhausted"]
    BUDGET -->|"yes"| LLM["OpenAiLlmClient.stream<br/>generate_image tool<br/>retry on 429"]

    LLM --> DEC{"What did the model return?"}
    DEC -->|"text deltas"| TEXT["Stream delta to done"]
    DEC -->|"tool_call generate_image"| IMG["runImageTool"]

    IMG --> P["image_pending event<br/>frontend shows loader"]
    P --> ISVC["ImagesService.generate<br/>prompt_injection check"]
    ISVC --> OIMG["OpenAiImageClient<br/>images.generate gpt-image-1"]
    OIMG --> IEV["image event<br/>frontend renders image"]
    IEV --> DONE2[done event]

    TEXT --> SPEND[TokenBudget.spend]
    DONE2 --> SPEND
```



### Stream Event Sequence

```mermaid
sequenceDiagram
    participant FE as Frontend (chatStore)
    participant API as ChatController
    participant SVC as ChatService
    participant GD as InputGuard / GuardClient
    participant LLM as OpenAiLlmClient
    participant IMG as ImagesService

    FE->>API: POST /api/chat/stream (history)
    API->>SVC: streamChat()
    SVC->>GD: inspect(messages)
    GD-->>SVC: allow | blocked
    alt blocked
        SVC-->>FE: assistant, delta(refusal), done
    else allow
        SVC->>LLM: stream(messages, tools=[generate_image])
        SVC-->>FE: assistant (name/role)
        alt regular response
            LLM-->>SVC: text deltas + finish_reason=stop
            SVC-->>FE: delta..., done
        else image request
            LLM-->>SVC: tool_call generate_image + finish_reason=tool_calls
            SVC-->>FE: image_pending(prompt)
            SVC->>IMG: generate({prompt, size})
            IMG-->>SVC: { dataUrl, usage }
            SVC-->>FE: image(dataUrl), done
        end
    end
```



### Stream Event Types (NDJSON)


| `type`          | When                                   | Fields                                             |
| --------------- | -------------------------------------- | -------------------------------------------------- |
| `assistant`     | At the start of the response           | `assistant: { name, roleDescription }`             |
| `delta`         | Text chunk                             | `delta: string`                                    |
| `image_pending` | The model decided to generate an image | `prompt: string`                                   |
| `image`         | Image is ready                         | `prompt`, `image: { dataUrl, mimeType }`, `usage?` |
| `done`          | End of response                        | `message`, `usage`, `budget`                       |
| `error`         | Stream error                           | `message: string`                                  |


## Logic and Protection Layers

1. **Single entry point.** The frontend does not decide whether the request is text or image-related. It always sends the full conversation to `/api/chat/stream`. The model routes through the `generate_image` tool (`chat-tools.ts`), so natural phrasing and conversational context work, including follow-ups like "make it brighter" after a previous image.
2. **InputGuard (safety).** Before the model call, a cheaper LLM classifier (`OpenAiGuardClient`) labels input as `prompt_injection`, `out_of_scope`, or `allow`. Image generation requests are treated as `allow` because they are a supported capability. If the classifier fails, the system is **fail-open** and relies on the system prompt instead, so the chat does not break.
3. **System prompt as the main role guard.** The assistant persona and constraints live in `assistant-profile.ts`; the model is expected to keep the role and refuse disallowed requests.
4. **TokenBudget.** An hourly sliding-window token limit. When the budget is exceeded, the API returns `429`. Model usage is charged against the budget.
5. **Retries.** Model calls are retried on `429` with exponential backoff, up to 5 attempts.

## Key Files


| File                               | Role                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `chat/chat.controller.ts`          | HTTP endpoints for `/api/chat` and `/api/chat/stream` (NDJSON)                        |
| `chat/chat.service.ts`             | Orchestrator: guard -> budget -> model -> text/image branch                           |
| `chat/chat-tools.ts`               | `generate_image` tool description and model guidance                                  |
| `chat/openai-llm.client.ts`        | OpenAI chat completions adapter and streamed tool-call assembly                       |
| `chat/input-guard.ts`              | `InputGuard`, a fail-open wrapper around the classifier                               |
| `chat/openai-guard.client.ts`      | Safety LLM classifier                                                                 |
| `chat/assistant-profile.ts`        | Assistant name, role description, and system prompt                                   |
| `chat/token-budget.ts`             | Hourly token budget                                                                   |
| `images/images.service.ts`         | Image generation plus prompt-injection check                                          |
| `images/openai-image.client.ts`    | OpenAI Images API adapter                                                             |
| `frontend/src/stores/chatStore.ts` | MobX store for sending requests, reading the NDJSON stream, and rendering text/images |


## Build

```bash
pnpm --filter @ai-less/backend build
pnpm --filter @ai-less/frontend build
```
