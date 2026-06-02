# День 10 (Неделя 3) • Практика: локальный LLM — Ollama и vLLM

Компания хочет замкнутый контур: данные не покидают периметр. Юридический отдел заблокировал все вызовы к облачным API. Пора запускать модели локально.

---

## Релиз 0: Ollama — локальный LLM за 5 минут

Установите Ollama, поднимите модель и убедитесь, что она работает как drop-in замена OpenAI API.

**Задание:**

1. Установите Ollama: `https://ollama.com`
2. Загрузите модель под вашу машину:
   - `ollama pull qwen2.5:7b` — влезает в 8 ГБ RAM
   - `ollama pull gemma2:9b` — лучше качество, нужно 16 ГБ
3. Проверьте, что OpenAI-совместимый сервер поднялся:
   ```bash
   curl http://localhost:11434/v1/models

   curl http://localhost:11434/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{"model":"qwen2.5:7b","messages":[{"role":"user","content":"Назови три принципа SOLID"}]}'
   ```
4. Возьмите `LLMClient` из недели 1 дня 2 (`llm_client.py`) и поменяйте ровно две строки:
   ```python
   base_url="http://localhost:11434/v1"
   api_key="ollama"
   ```
   Остальной код не трогайте — убедитесь, что `complete()` и `complete_stream()` работают без изменений.
5. Замерьте задержку: сделайте 10 последовательных запросов к локальной модели и 10 к облаку через `time`, запишите разницу в среднем. Типичный ожидаемый диапазон: локально — 2–8 с на 7B, облако (GPT-4o) — 0.5–2 с.

**Промпт:**
```
Возьми существующий класс LLMClient с AsyncOpenAI.
Добавь параметр provider: Literal["openai", "ollama"] = "openai".
При "ollama": base_url="http://localhost:11434/v1", api_key="ollama", model="qwen2.5:7b".
При "openai": стандартные параметры из env.
Напиши скрипт measure_latency.py: 10 запросов к каждому провайдеру,
выведи min/max/avg latency в миллисекундах для каждого.
```

---

## Релиз 1: Структурированный вывод с локальной моделью

Локальные модели менее надёжны в tool calling — используйте JSON mode вместо `with_structured_output`.

**Задание:**

1. Реализуйте метод `complete_json(messages: list[dict], schema: dict) -> dict` в `LLMClient`:
   - Вставляет схему в system prompt: `"Отвечай строго в JSON по схеме: {schema}. Никакого текста вне JSON."`
   - Вызывает модель с `response_format={"type": "json_object"}`
   - Парсит ответ через `json.loads()`
   - При `json.JSONDecodeError` — одна повторная попытка с явным напоминанием: `"Твой предыдущий ответ не был валидным JSON. Ответь только JSON без пояснений."`
2. Возьмите задачу маршрутизации тикетов из недели 2 (классификация на `tech_support` / `billing` / `sales`). Определите схему:
   ```python
   ROUTING_SCHEMA = {
       "type": "object",
       "properties": {
           "department": {"type": "string", "enum": ["tech_support", "billing", "sales"]},
           "confidence": {"type": "number"},
           "reason": {"type": "string"}
       },
       "required": ["department", "confidence", "reason"]
   }
   ```
3. Прогоните 10 тестовых тикетов через `complete_json` на локальной модели и через нативный `with_structured_output` на GPT-4o.
4. Зафиксируйте: сколько раз понадобился ретрай? Были ли ошибки после двух попыток?

**Промпт:**
```
Добавь в LLMClient метод complete_json(messages, schema: dict) -> dict.
JSON-схема передаётся в system prompt как строка.
Используй response_format={"type": "json_object"}.
При json.JSONDecodeError — одна повторная попытка: добавь сообщение ассистента
с кривым ответом и user-сообщение "Ответь только валидным JSON по схеме."
После второй неудачи — raise ValueError с исходным текстом ответа.
Напиши тест: прогони 10 тикетов через complete_json и подсчитай retry_count и failure_count.
```

---

## Релиз 2: Фабрика провайдеров

Разные задачи требуют разных моделей: маршрутизацию дёшево делает 7B, генерацию — нужна модель получше.

**Задание:**

1. Реализуйте `get_llm(task: Literal["routing", "generation", "embedding"]) -> LLMClient`, читающую конфиг из env:
   ```
   LLM_ROUTING_PROVIDER=local       # local | openai
   LLM_GENERATION_PROVIDER=openai   # local | openai
   LLM_EMBEDDING_PROVIDER=openai

   LOCAL_LLM_URL=http://localhost:11434/v1
   LOCAL_ROUTING_MODEL=qwen2.5:7b
   LOCAL_GENERATION_MODEL=qwen2.5:14b
   ```
2. Декорируйте `get_llm` через `@lru_cache` — клиент создаётся один раз на процесс.
3. Добавьте обёртку `LoggingLLMClient`, которая перехватывает каждый вызов `complete()` и пишет в список: `provider`, `latency_ms`, `prompt_tokens`, `completion_tokens`.
4. После 100 вызовов (или по явному запросу) выведите сводку:

   ```
   provider         | avg_latency_ms | total_tokens | est_cost_usd
   local/qwen2.5:7b |           3420 |        12400 |        $0.00
   openai/gpt-4o    |            980 |         8100 |        $0.08
   ```

   Для оценки стоимости используйте: GPT-4o — $2.50/1M input tokens, $10/1M output; локально — $0.

**Промпт:**
```
Напиши функцию get_llm(task: Literal["routing", "generation", "embedding"]) -> LLMClient.
Читает LLM_ROUTING_PROVIDER, LLM_GENERATION_PROVIDER, LLM_EMBEDDING_PROVIDER из env.
При "local": base_url из LOCAL_LLM_URL, модель из LOCAL_*_MODEL.
Добавь @lru_cache(maxsize=None) — клиент создаётся один раз.
Оберни LLMClient в LoggingLLMClient: перехватывает complete(), замеряет time.perf_counter(),
пишет запись в список [{provider, latency_ms, prompt_tokens, completion_tokens}].
Метод print_stats() выводит таблицу: provider | avg_latency_ms | total_tokens | est_cost_usd.
Стоимость считай только для openai-провайдера по текущим ценам GPT-4o.
```

---

## Релиз 3: vLLM — production-вариант

Ollama обрабатывает запросы последовательно. vLLM использует continuous batching — несколько запросов делят GPU-время одновременно. Разница ощутима при нагрузке.

**Задание:**

1. Запустите vLLM через Docker:
   ```bash
   docker run --gpus all \
     -p 8000:8000 \
     -e HUGGING_FACE_HUB_TOKEN=$HF_TOKEN \
     vllm/vllm-openai:latest \
     --model mistralai/Mistral-7B-Instruct-v0.2 \
     --max-model-len 4096
   ```
   Без GPU — добавьте `--device cpu` (медленно, только для проверки API).
2. Подключитесь: поменяйте `base_url="http://localhost:8000/v1"` — интерфейс идентичен Ollama.
3. Напишите нагрузочный тест: 20 конкурентных запросов через `asyncio.gather`:
   ```python
   async def load_test(base_url: str, n: int = 20):
       client = AsyncOpenAI(base_url=base_url, api_key="test")
       start = time.perf_counter()
       tasks = [client.chat.completions.create(...) for _ in range(n)]
       results = await asyncio.gather(*tasks)
       total = time.perf_counter() - start
       latencies = [r._response_ms for r in results]  # если доступно
       print(f"Total: {total:.2f}s | p50: {sorted(latencies)[n//2]}ms | p95: {sorted(latencies)[int(n*0.95)]}ms")
   ```
4. Запустите тест последовательно: сначала против Ollama (`http://localhost:11434/v1`), потом против vLLM (`http://localhost:8000/v1`). Сравните total time и p95 latency.
5. Когда что использовать:
   - **Ollama** — один разработчик, локальная разработка и эксперименты, нет GPU-сервера, нужно запустить за 5 минут.
   - **vLLM** — production-сервис с > 5 RPS, есть GPU, нужен OpenAI-совместимый endpoint для команды.
   - **vLLM со сложным деплоем** оправдан когда стоимость облачного API за месяц превышает стоимость GPU-инстанса (обычно > 10 млн токенов/мес).

**Промпт:**
```
Напиши async load_test(base_url: str, model: str, n: int = 20) -> dict.
Создаёт AsyncOpenAI с base_url.
Запускает n конкурентных запросов через asyncio.gather — один и тот же короткий промпт.
Для каждого запроса замеряет latency через time.perf_counter() до и после await.
Возвращает: {"total_sec": float, "rps": float, "p50_ms": int, "p95_ms": int, "p99_ms": int}.
Вызови функцию дважды: для Ollama и для vLLM, выведи сравнительную таблицу.
```
