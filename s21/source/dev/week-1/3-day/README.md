# День 3 • RAG: от индексации до генерации

## 📋 Темы:

- 🏗️ Архитектура RAG: зачем и когда (20 мин)
- 🔢 Эмбеддинги: модели и выбор (20 мин)
- ✂️ Chunking: стратегии и подводные камни (25 мин)
- 🗄️ Векторные БД: сравнение и выбор (20 мин)
- 🔍 Retrieval: метрики и параметры (15 мин)
- ⚠️ Где ломается наивный RAG (10 мин)
- ⚡ Практика (70 мин)

---

### 🏗️ Зачем RAG: альтернативы и их пределы

Три способа дать модели знания о вашей предметной области:

| Подход | Как работает | Когда ломается |
|---|---|---|
| **Fine-tuning** | Дообучаем модель на ваших данных | Знания устаревают, дорого, нельзя обновить без переобучения |
| **Context stuffing** | Весь контекст в промпт | Контекстное окно конечно, дорого, модель теряет внимание на длинных промптах |
| **RAG** | Находим релевантные фрагменты, передаём в промпт | Нужна инфраструктура, качество зависит от retrieval |

**RAG — компромисс**: актуальные знания без переобучения, контролируемые источники, масштабируется на миллионы документов.

> Fine-tuning и RAG не исключают друг друга — fine-tune под формат/стиль, RAG для фактических знаний.

---

### 🏗️ Пайплайн RAG: два этапа

**Indexing (офлайн):**
```
Документы → Chunking → Embedding → Vector Store
```

**Retrieval + Generation (онлайн):**
```
Query → Embedding → Similarity Search → Top-K chunks → LLM → Answer
```

Эти этапы разделены по времени и масштабируются независимо. Индексация — батч-операция (минуты-часы), retrieval — realtime (миллисекунды).

---

### 🔢 Эмбеддинги: что внутри

Эмбеддинг — вектор чисел, где семантически близкие тексты геометрически близки.

```python
# "Как подключиться к VPN?" и "VPN connection setup" — близко
# "Как подключиться к VPN?" и "Рецепт борща" — далеко
```

**Выбор embedding-модели:**

| Модель | Размерность | Контекст | Хорошо для |
|---|---|---|---|
| `text-embedding-3-small` | 1536 | 8191 токенов | Общее назначение, дёшево |
| `text-embedding-3-large` | 3072 | 8191 токенов | Максимальное качество |
| `text-embedding-ada-002` | 1536 | 8191 токенов | Легаси, не использовать |
| `intfloat/e5-large-v2` | 1024 | 512 токенов | Локально, Hugging Face |
| GigaChat Embeddings | 1024 | — | Русский текст |

**Правило:** для индексации и retrieval используйте одну и ту же модель. Смена модели = полная переиндексация.

---

### 🔢 Эмбеддинги: cosine similarity

Стандартная метрика — косинусное сходство (от -1 до 1):

```python
import numpy as np

def cosine_similarity(a: list[float], b: list[float]) -> float:
    a, b = np.array(a), np.array(b)
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

# score > 0.85 — очень похожи
# score 0.7–0.85 — умеренно похожи
# score < 0.7 — скорее всего нерелевантны
```

Эти пороги условны и зависят от модели — калибруйте под свои данные.

---

### ✂️ Chunking: от этого зависит всё

Самый недооценённый шаг в RAG. Большинство проблем с качеством ответов — не в LLM, а в плохом chunking.

**Что такое chunk:** минимальная единица, которую вы индексируете и возвращаете. Слишком маленький — теряет контекст, слишком большой — засоряет промпт нерелевантным.

**Баланс:** chunk должен быть самодостаточным для ответа на вопрос, но не длиннее необходимого.

---

### ✂️ Chunking: стратегии

**Fixed-size (наивный):**
```python
def fixed_chunks(text: str, size: int = 512, overlap: int = 50) -> list[str]:
    chunks = []
    for i in range(0, len(text), size - overlap):
        chunks.append(text[i:i + size])
    return chunks
```
Проблема: разрезает предложения и абзацы посередине.

**Recursive (LangChain default):**
Делит по `\n\n`, затем `\n`, затем `. `, затем ` ` — пока chunk не влезет в лимит.
Сохраняет структуру документа, подходит для большинства задач.

**Semantic chunking:**
Группирует предложения по семантической близости эмбеддингов. Лучше по качеству, дороже по вычислениям.

**Document-aware:**
Использует структуру документа (Markdown заголовки, HTML теги, PDF структура). Лучший выбор когда есть чёткая структура.

---

### ✂️ Chunking: overlap и метаданные

**Overlap — важен:**
```python
# Без overlap: конец одного чанка и начало следующего теряют контекст
# Overlap 10-15% от размера чанка — стандартная практика
chunk_size = 512
overlap = 50  # ~10%
```

**Метаданные — обязательны:**
```python
{
    "text": "...chunk content...",
    "metadata": {
        "source": "docs/onboarding.md",
        "page": 3,
        "section": "VPN Setup",
        "created_at": "2025-01-15"
    }
}
```
Метаданные нужны для фильтрации при retrieval и для цитирования источников в ответе.

---

### 🗄️ Векторные БД: сравнение

| БД | Тип | Когда использовать |
|---|---|---|
| **ChromaDB** | In-process / server | Dev, прототипы, небольшие объёмы |
| **FAISS** | In-memory library | Локально, batch-поиск, нет persistence |
| **Qdrant** | Standalone server | Production, filtering по метаданным, горизонтальное масштабирование |
| **pgvector** | Postgres extension | Данные уже в Postgres, не хочется новую инфра |
| **Pinecone** | SaaS | Нет своего сервера, managed service |
| **Weaviate** | Standalone server | GraphQL API, мультимодальные данные |

**Для большинства начальных production-задач: Qdrant** — хорошая документация, богатая фильтрация, Docker в одну команду.

---

### 🗄️ Qdrant: основные операции

```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

client = QdrantClient("localhost", port=6333)

# Создать коллекцию
client.create_collection(
    collection_name="docs",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE)
)

# Добавить векторы
client.upsert(
    collection_name="docs",
    points=[
        PointStruct(id=1, vector=embedding, payload={"text": chunk, "source": "..."})
        for chunk, embedding in zip(chunks, embeddings)
    ]
)

# Поиск
results = client.search(
    collection_name="docs",
    query_vector=query_embedding,
    limit=5,
    query_filter=Filter(must=[FieldCondition(key="source", match=MatchValue(value="docs/vpn.md"))])
)
```

---

### 🔍 Retrieval: параметры качества

**Top-k:** сколько чанков брать.
- Слишком мало (k=1) — высокий риск пропустить нужное
- Слишком много (k=20) — засоряем промпт, модель теряет фокус
- Практика: k=3–5 для ответов на вопрос, k=10+ для суммаризации

**Score threshold:** фильтр по минимальному сходству.
```python
results = [r for r in raw_results if r.score > 0.75]
if not results:
    return "Информация по данному вопросу не найдена."
```

**Diversity (MMR — Maximal Marginal Relevance):**
Если top-3 чанка дублируют одну и ту же информацию — результат хуже, чем 3 разных угла.
MMR балансирует релевантность и разнообразие.

---

### ⚠️ Где ломается наивный RAG

Наивный RAG (fixed-size chunks + cosine similarity + top-k) работает для демо, но проваливается в production:

| Проблема | Пример | Решение |
|---|---|---|
| **Exact keyword miss** | Query: "VPN" → документ содержит "виртуальная частная сеть" | Hybrid search (BM25 + dense) |
| **Semantic drift** | Похожие по стилю, но разные по смыслу чанки | Cross-encoder reranking |
| **Chunk boundary** | Ответ разрезан между чанками | Overlap, parent-child chunks |
| **Multi-hop** | Ответ требует информации из 2 документов | Agentic RAG, graph RAG |
| **Outdated data** | Документ обновился, старый вектор в БД | Версионирование, incremental indexing |

> Эти проблемы — тема следующей недели (Advanced RAG). Сегодня строим foundation.

---

### ⚡ Полный пайплайн: собираем вместе

```python
async def build_rag_pipeline(docs: list[str], metadata: list[dict]):
    # 1. Chunking
    chunks = []
    for doc, meta in zip(docs, metadata):
        for chunk in recursive_split(doc, size=512, overlap=50):
            chunks.append({"text": chunk, "metadata": meta})
    
    # 2. Embedding (batch — дешевле чем по одному)
    embeddings = await embed_batch([c["text"] for c in chunks])
    
    # 3. Index
    index(chunks, embeddings)

async def query(question: str, k: int = 4) -> str:
    # 1. Embed query
    q_vec = await embed(question)
    
    # 2. Retrieve
    results = search(q_vec, k=k, threshold=0.75)
    if not results:
        return "Нет релевантной информации."
    
    # 3. Generate
    context = "\n\n---\n\n".join(r.text for r in results)
    return await llm_generate(context, question)
```

---

### 🎯 Итоги дня

**Что взять с собой:**

- **RAG = indexing + retrieval + generation** — три независимо масштабируемых этапа
- **Chunking важнее, чем кажется** — большинство проблем качества здесь
- **Overlap + метаданные** — обязательны с первого дня
- **Qdrant для production**, ChromaDB для прототипов
- **Score threshold** — лучше вернуть "не знаю", чем галлюцинировать с нерелевантным контекстом
- **Наивный RAG ломается** — следующий шаг: hybrid search + reranking (день 4 следующей недели)

**Следующее занятие:** MCP — подключение внешних инструментов к агенту, написание своего MCP-сервера.
