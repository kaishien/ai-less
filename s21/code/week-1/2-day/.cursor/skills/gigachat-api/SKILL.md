---
name: gigachat-api
description: How to authenticate and make requests to the GigaChat API
---

# GigaChat API

## When to Use

Apply this skill whenever the user needs to:
- Connect to the GigaChat API for the first time
- Implement token refresh logic
- Send chat completion requests to GigaChat
- Use GigaChat in place of OpenAI (the API is largely compatible)

## Instructions

### Overview

GigaChat auth is a two-step flow:
1. Exchange your **Authorization Key** for a short-lived **Access Token** (30 min TTL)
2. Pass that token as `Bearer` on every API request

### Step 1 — Obtain Access Token

**Endpoint:** `POST https://ngw.devices.sberbank.ru:9443/api/v2/oauth`

| Header | Value |
|---|---|
| `Authorization` | `Basic <Authorization Key>` |
| `Content-Type` | `application/x-www-form-urlencoded` |
| `Accept` | `application/json` |
| `RqUID` | Any UUID v4 (unique per request) |

**Body** (form-encoded):
```
scope=GIGACHAT_API_PERS
```

**Response fields to store:**
- `access_token` — use as Bearer token
- `expires_at` — Unix timestamp; refresh before this time

### Step 2 — Make API Requests

**Base URL:** `https://gigachat.devices.sberbank.ru/api/v1`

Always include:
```
Authorization: Bearer <access_token>
```

#### Chat Completion

`POST /api/v1/chat/completions`

Request body:
```json
{
  "model": "GigaChat",
  "messages": [
    { "role": "user", "content": "Привет! Как дела?" }
  ],
  "stream": false,
  "repetition_penalty": 1
}
```

Response (same shape as OpenAI):
```json
{
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Все отлично, спасибо. А как ваши дела?"
      }
    }
  ],
  "created": 1706096547,
  "model": "GigaChat",
  "object": "chat.completion",
  "usage": {
    "prompt_tokens": 173,
    "completion_tokens": 12,
    "total_tokens": 185
  }
}
```

Read the reply from `choices[0].message.content`.

#### List Models

`GET /api/v1/models`

### Token Refresh Pattern (language-agnostic)

```
state = { auth_key, token: null, expires_at: 0 }

function ensure_token(state):
    if now() >= state.expires_at:
        resp = POST oauth_endpoint(state.auth_key)
        state.token = resp.access_token
        state.expires_at = resp.expires_at
    return state.token

function chat(state, messages):
    token = ensure_token(state)
    return POST /api/v1/chat/completions
        headers: { Authorization: "Bearer {token}" }
        body: { model: "GigaChat", messages: messages, stream: false }
```

### Environment Variable

Store the Authorization Key as:
```
GIGACHAT_AUTH_KEY=<your Base64 key from the developer console>
```

### Notes

- **SSL:** Sberbank uses a custom CA. In development you may need to disable SSL verification (`verify=False`, `--insecure`). In production, add their root certificate.
- **OpenAI compatibility:** You can often reuse an OpenAI SDK client by pointing `base_url` at `https://gigachat.devices.sberbank.ru/api/v1` and setting `api_key` to the current Bearer token.
- **`repetition_penalty`** is GigaChat-specific; omit it when using an OpenAI-compatible client.
