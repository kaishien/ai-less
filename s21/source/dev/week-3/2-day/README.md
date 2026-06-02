# День 10 (Неделя 3) • Локальный LLM и закрытый контур

## 📋 Темы:

- 🎯 Зачем локальный LLM (10 мин)
- 🧠 Актуальные модели и выбор (15 мин)
- 🏠 Ollama: разработка и прототипирование (20 мин)
- ⚡ vLLM: production-сервер (25 мин)
- 🔒 Закрытый контур: архитектура (15 мин)
- 🔌 Интеграция с LangChain/LangGraph (15 мин)
- ⚡ Практика (60 мин)

---

### 🎯 Зачем запускать LLM локально

Не все проекты могут или хотят отправлять данные во внешние API:

| Причина | Детали |
|---|---|
| **Data sovereignty** | Персональные данные, медицинские, финансовые — нельзя в облако |
| **Закрытый контур** | Корпоративная среда без доступа к интернету |
| **Экономика** | Высокий объём запросов — собственный GPU дешевле |
| **Latency** | Локальный inference быстрее для некоторых задач |
| **Контроль** | Версионирование модели, воспроизводимость, no vendor lock-in |

**ТЗ явно требует:** self-hosted решения для работы в закрытом контуре.

---

### 🧠 Модели для локального запуска (2025)

| Модель | Параметры | RAM/VRAM | Когда использовать |
|---|---|---|---|
| **Qwen3** | 8B / 14B / 32B | 8–24 GB | Русский язык, два режима thinking/fast |
| **DeepSeek-R1** | 8B / 14B / 70B | 8–48 GB | Сложные рассуждения, математика |
| **Llama 4** | Scout 17B-A16B | 10–16 GB | Агентные задачи, инструменты |
| **Gemma 3** | 2B / 9B / 27B | 2–20 GB | Слабое железо, быстрый старт |
| **CodeQwen** | 7B / 32B | 8–24 GB | Генерация и ревью кода |

**Квантизация:** Q4_K_M — стандартный выбор для баланса скорости/качества. FP16 нужен только для максимальной точности.

---

### 🏠 Ollama: для разработки и прототипов

Ollama — наиболее простой способ запустить LLM локально. Устанавливается в одну команду, управляет загрузкой и памятью.

```bash
# Установка (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Загрузка и запуск
ollama pull qwen3:14b
ollama run qwen3:14b

# Сервер запускается автоматически на :11434
# OpenAI-совместимый API на /v1/*
```

**OpenAI SDK с Ollama:**
```python
from openai import AsyncOpenAI

client = AsyncOpenAI(
    base_url="http://localhost:11434/v1",
    api_key="ollama"  # игнорируется, но обязательное поле
)

response = await client.chat.completions.create(
    model="qwen3:14b",
    messages=[{"role": "user", "content": "Проанализируй этот код..."}]
)
```

---

### 🏠 Ollama: ограничения

Ollama удобен для dev, но имеет ограничения:

| Параметр | Ollama | Для чего |
|---|---|---|
| Concurrent requests | 1 (по умолчанию) | Dev-использование |
| Throughput | ~20–50 tokens/sec на GPU | Медленно для prod |
| API совместимость | Частичная | Нет batching, streaming в некоторых версиях |
| Горизонтальное масштабирование | Нет из коробки | Prod требует обёртки |

**Вывод:** Ollama = идеален для dev и экспериментов. В production нужен vLLM.

---

### ⚡ vLLM: production inference

vLLM — high-throughput inference engine с OpenAI-совместимым API. Использует PagedAttention для эффективного управления KV-cache.

```bash
# Установка
pip install vllm

# Запуск сервера
python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen3-14B \
    --tensor-parallel-size 2 \      # для 2 GPU
    --max-model-len 32768 \
    --host 0.0.0.0 \
    --port 8000
```

**Тот же OpenAI SDK — только меняем base_url:**
```python
client = AsyncOpenAI(
    base_url="http://localhost:8000/v1",
    api_key="vllm"
)
```

---

### ⚡ vLLM vs Ollama: когда что

| | Ollama | vLLM |
|---|---|---|
| **Установка** | Одна команда | pip + драйверы NVIDIA |
| **Throughput** | ~20–50 tok/s | 100–500+ tok/s (continuous batching) |
| **Параллельные запросы** | 1 (серия) | Много (автоматический batching) |
| **Квантизация** | GGUF (Q4/Q8) | GPTQ, AWQ, FP8 |
| **CPU-inference** | ✅ | ❌ (только GPU) |
| **Горизонтальное масштабирование** | ❌ | ✅ tensor parallel |
| **Применение** | Dev, прототипы, CPU | Production, GPU, high load |

---

### ⚡ vLLM: Docker для production

```dockerfile
# Dockerfile
FROM vllm/vllm-openai:latest

ENV MODEL_NAME=Qwen/Qwen3-14B
ENV MAX_MODEL_LEN=32768
ENV TENSOR_PARALLEL_SIZE=1

CMD python -m vllm.entrypoints.openai.api_server \
    --model $MODEL_NAME \
    --max-model-len $MAX_MODEL_LEN \
    --tensor-parallel-size $TENSOR_PARALLEL_SIZE \
    --host 0.0.0.0 --port 8000
```

```yaml
# docker-compose.yml
services:
  vllm:
    image: vllm/vllm-openai:latest
    runtime: nvidia
    volumes:
      - ~/.cache/huggingface:/root/.cache/huggingface
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
    ports:
      - "8000:8000"
    command: >
      --model Qwen/Qwen3-14B
      --host 0.0.0.0
```

---

### 🔒 Архитектура закрытого контура

Полный стек без внешних зависимостей:

```
┌─────────────────────────────────────────────┐
│            Закрытая сеть компании            │
│                                             │
│  ┌──────────┐    ┌──────────┐    ┌───────┐ │
│  │ LangGraph│───►│  vLLM    │    │Qdrant │ │
│  │  Agent   │    │ (GPU VM) │    │(VDB)  │ │
│  └──────────┘    └──────────┘    └───────┘ │
│        │                                    │
│        └───────────────────────────────────►│
│                   FastAPI                   │
│                   (port 8000)               │
└─────────────────────────────────────────────┘
          ▲
          │ HTTPS (Nginx)
          │
      Пользователи
```

Все компоненты — в Docker-контейнерах. Модели — в локальном volume. Нет исходящего трафика.

---

### 🔌 Интеграция с LangGraph: один интерфейс

Переключение между облаком и локальным сервером — через `base_url`:

```python
import os
from langchain_openai import ChatOpenAI

def get_llm(use_local: bool = False) -> ChatOpenAI:
    if use_local:
        return ChatOpenAI(
            base_url=os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1"),
            api_key="local",
            model=os.getenv("LOCAL_MODEL", "qwen3:14b"),
            temperature=0
        )
    return ChatOpenAI(model="gpt-4o", temperature=0)

# В LangGraph-графе — без изменений
llm = get_llm(use_local=os.getenv("USE_LOCAL_LLM") == "true")
agent = create_react_agent(llm, tools)
```

---

### 🔌 Structured output с локальными моделями

Не все локальные модели поддерживают native tool calling. Используйте `response_format`:

```python
# Через JSON mode (работает в vLLM и Ollama)
response = await client.chat.completions.create(
    model="qwen3:14b",
    messages=[
        {"role": "system", "content": "Отвечай строго в JSON."},
        {"role": "user",   "content": f"Классифицируй: {text}"}
    ],
    response_format={"type": "json_object"}
)
import json
result = json.loads(response.choices[0].message.content)

# LangChain wrapper с валидацией
llm_local = ChatOpenAI(base_url="...", model="qwen3:14b")
structured = llm_local.with_structured_output(MySchema, method="json_mode")
```

---

### 🎯 Итоги дня

**Что взять с собой:**

- **Ollama = dev** — быстрый старт, CPU-поддержка, один процесс
- **vLLM = prod** — высокий throughput, continuous batching, tensor parallel
- **Один `base_url`** меняет провайдер без изменений кода агента
- **Qwen3** — лучший выбор для русскоязычных задач в закрытом контуре
- **JSON mode** — portable structured output для локальных моделей без tool calling

**Следующее занятие:** Production — Docker, PostgreSQL checkpointer, Mermaid-схемы, доставка артефактов ТЗ.
