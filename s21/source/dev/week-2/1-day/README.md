# День 5 (Неделя 2) • Advanced RAG: гибридный поиск и reranking

## 📋 Темы:

- ⚠️ Где ломается наивный RAG (10 мин)
- 🔤 Sparse retrieval: BM25 (20 мин)
- 🔀 Hybrid search + Reciprocal Rank Fusion (25 мин)
- 🎯 Cross-encoder reranking (20 мин)
- 🔄 Query transformation: HyDE и multi-query (15 мин)
- 📊 Оценка качества RAG (10 мин)
- ⚡ Практика (60 мин)

---

### ⚠️ Почему наивный RAG проваливается

Напомним failure modes с прошлой недели — теперь разберём решения:

| Проблема | Сценарий | Решение |
|---|---|---|
| **Vocabulary mismatch** | Query: "VPN" → doc: "виртуальная частная сеть" | Hybrid search (BM25) |
| **Semantic drift** | Похожие по стилю, разные по смыслу | Cross-encoder reranking |
| **Context fragmentation** | Ответ разрезан между чанками | Parent-child chunks |
| **Query too narrow** | Один вектор не покрывает вариации | Multi-query expansion |
| **Hallucinated context** | Нет порога — берём любой результат | Score threshold (уже знаем) |

Сегодня закрываем первые три.

---

### 🔤 Sparse retrieval: почему BM25 всё ещё нужен

**Dense retrieval** (эмбеддинги): ловит семантику, но «не видит» точные слова.

**BM25 (sparse retrieval)**: считает статистику слов — точные совпадения, уникальные термины, аббревиатуры, имена.

```python
# Dense: "VPN подключение" ≈ "настройка виртуальной сети" → высокое сходство
# BM25:  "VPN" в запросе → ищет точно "VPN" в документах
```

**Когда BM25 выигрывает:**
- Технические термины, аббревиатуры, коды ошибок (`NullPointerException`)
- Имена собственные, названия продуктов, ID
- Короткие точные запросы (`"ошибка 403"`)

**Когда dense выигрывает:**
- Перефразирование (`"как войти" = "авторизация"`)
- Разные языки / регистры
- Концептуальные вопросы

---

### 🔤 BM25 на практике

```python
from rank_bm25 import BM25Okapi
import re

def tokenize(text: str) -> list[str]:
    return re.sub(r'[^\w\s]', '', text.lower()).split()

# Индексация
corpus = [chunk["text"] for chunk in chunks]
tokenized = [tokenize(doc) for doc in corpus]
bm25 = BM25Okapi(tokenized)

# Поиск
def bm25_search(query: str, k: int = 10) -> list[tuple[int, float]]:
    tokens = tokenize(query)
    scores = bm25.get_scores(tokens)
    top_k = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:k]
    return top_k  # [(chunk_id, score), ...]
```

BM25 не хранится в векторной БД — держите индекс в памяти или в Elasticsearch/Qdrant (встроенный sparse vector).

---

### 🔀 Hybrid Search: объединяем два мира

Запускаем оба поиска параллельно, затем объединяем результаты.

**Проблема объединения:** у dense score и BM25 score несравнимые шкалы.

**Решение: Reciprocal Rank Fusion (RRF)**

```
RRF(doc) = Σ  1 / (k + rank_i)
           i
```

Где `k = 60` (стандартное значение), `rank_i` — позиция документа в i-м списке.

**Почему RRF работает:** ранги нормализованы (1-й, 2-й, 3-й...) независимо от исходных оценок.

---

### 🔀 RRF реализация

```python
def reciprocal_rank_fusion(
    result_lists: list[list[str]],   # каждый список — IDs в порядке ранга
    k: int = 60
) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for results in result_lists:
        for rank, doc_id in enumerate(results, start=1):
            scores[doc_id] = scores.get(doc_id, 0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)

# Использование
dense_ids = [r.id for r in qdrant_search(query_vector, limit=20)]
sparse_ids = [str(idx) for idx, _ in bm25_search(query, k=20)]

fused = reciprocal_rank_fusion([dense_ids, sparse_ids])
top_chunks = [chunks[int(doc_id)] for doc_id, _ in fused[:5]]
```

---

### 🔀 Hybrid Search в Qdrant (нативно)

Qdrant поддерживает sparse vectors напрямую — не нужен отдельный BM25-индекс:

```python
from qdrant_client.models import SparseVector, NamedSparseVector

# При создании коллекции:
client.create_collection(
    collection_name="docs",
    vectors_config={"dense": VectorParams(size=1536, distance=Distance.COSINE)},
    sparse_vectors_config={"sparse": SparseVectorParams()}
)

# Query (hybrid):
results = client.query_points(
    collection_name="docs",
    prefetch=[
        Prefetch(query=dense_vector, using="dense", limit=20),
        Prefetch(query=SparseVector(indices=..., values=...), using="sparse", limit=20),
    ],
    query=FusionQuery(fusion=Fusion.RRF),
    limit=5
)
```

Для генерации sparse vector — используйте `fastembed` с моделью `Qdrant/bm25`.

---

### 🎯 Cross-encoder reranking: зачем

После hybrid search у нас есть top-20 кандидатов. Проблема: bi-encoder (эмбеддинги) сравнивает query и doc независимо. Cross-encoder смотрит на них вместе — точнее, но медленнее.

```
Bi-encoder:   embed(query) × embed(doc)  → fast, approximate
Cross-encoder: model(query + doc)         → slow, precise
```

**Паттерн: retrieve & rerank**
1. Быстрый поиск: top-50 кандидатов (hybrid или dense)
2. Медленный reranker: отсортировать top-50, взять top-5

Так вы получаете скорость bi-encoder + точность cross-encoder.

---

### 🎯 Cross-encoder: реализация

```python
from sentence_transformers import CrossEncoder

# Лёгкая модель для reranking
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
# Русский: "DiTy/cross-encoder-russian-msmarco"

def rerank(query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
    pairs = [(query, c["text"]) for c in candidates]
    scores = reranker.predict(pairs)
    
    ranked = sorted(
        zip(candidates, scores),
        key=lambda x: x[1],
        reverse=True
    )
    return [doc for doc, _ in ranked[:top_k]]

# Использование:
candidates = hybrid_search(query, k=20)   # быстрый поиск
final = rerank(query, candidates, top_k=5) # точный reranking
```

---

### 🎯 Cohere Rerank API

Если не хотите запускать cross-encoder локально — Cohere предоставляет API:

```python
import cohere

co = cohere.Client(api_key="...")

def cohere_rerank(query: str, candidates: list[dict], top_k: int = 5) -> list[dict]:
    results = co.rerank(
        query=query,
        documents=[c["text"] for c in candidates],
        model="rerank-multilingual-v3.0",  # поддерживает русский
        top_n=top_k,
    )
    return [candidates[r.index] for r in results.results]
```

**Цена:** ~$1 за 1000 rerank-запросов. Для MVP дешевле, чем держать GPU.

---

### 🔄 Query Transformation

**Проблема:** пользователь пишет `"vpn не работает"` — слишком коротко, слишком специфично. Один запрос не покрывает всех релевантных документов.

**HyDE (Hypothetical Document Embedding):**
```python
async def hyde(query: str) -> list[float]:
    # Просим LLM написать гипотетический ответ на запрос
    hypothetical_doc = await llm.generate(
        f"Напиши абзац документации, который отвечает на: {query}"
    )
    # Эмбеддим гипотетический документ, а не запрос
    return await embed(hypothetical_doc)
```

**Multi-query expansion:**
```python
async def multi_query(query: str, n: int = 3) -> list[str]:
    prompt = f"""Сгенерируй {n} переформулировки этого поискового запроса:
    "{query}"
    Каждая — на новой строке, без нумерации."""
    variations = await llm.generate(prompt)
    queries = [query] + variations.splitlines()
    return [q.strip() for q in queries if q.strip()]

# Поиск по всем вариациям, RRF для объединения
all_results = await asyncio.gather(*[search(q) for q in queries])
final = rrf_merge(all_results)
```

---

### 📊 Как оценивать RAG

Без метрик — не знаете улучшается ли система.

**Offline evaluation (тестовый датасет):**

```python
test_cases = [
    {"question": "Как подключиться к VPN?", "expected_source": "vpn-setup.md"},
    {"question": "Сколько дней отпуска?",   "expected_source": "leave-policy.md"},
    ...
]

def evaluate(test_cases: list[dict]) -> dict:
    hits = 0
    for case in test_cases:
        results = search(case["question"], k=3)
        sources = [r["source"] for r in results]
        if case["expected_source"] in sources:
            hits += 1
    return {
        "recall@3": hits / len(test_cases),  # нашли нужный источник в top-3?
    }
```

**RAGAS** — библиотека для более глубокой оценки (faithfulness, answer relevancy, context precision). Разберём в финальном проекте.

---

### 🎯 Итоги дня

**Что взять с собой:**

- **Hybrid search = dense + BM25** — покрывает разные типы запросов
- **RRF** — нормализует разные шкалы, простая но эффективная fusion
- **Reranking** — делайте всегда: retrieve 20, rerank → top-5
- **HyDE** улучшает recall, multi-query — coverage; оба добавляют латентность
- **Оценяйте с тестовыми кейсами** — иначе не знаете что улучшили

**Следующее занятие:** LangChain — строим первого агента с инструментами.
