# День 5 (Неделя 2) • Практика: Advanced RAG

Вы улучшаете поисковый сервис из прошлой недели. Пользователи жалуются: точные запросы вроде `"ошибка 403"` или аббревиатуры типа `"VPN"` возвращают нерелевантные результаты. Задача: добавить гибридный поиск и reranking.

Продолжайте работу с базой документов `technocorp-docs` из прошлой недели. Если нет — используйте документы из `s21/code/week-2/1-day/docs/`.

---

## Релиз 0: BM25 — найти то, что dense пропускает

Поймите на конкретных примерах, где sparse превосходит dense.

**Задание:**
1. Установите `rank_bm25`
2. Реализуйте `bm25_search(query, k=5)` поверх ваших чанков
3. Запустите оба поиска на 5 запросах — 3 семантических и 2 точных (аббревиатура или код ошибки)
4. Заполните таблицу: какой метод нашёл нужный документ

| Запрос | Dense top-1 source | BM25 top-1 source | Правильный? |
|---|---|---|---|
| "Как настроить VPN?" | | | |
| "403 forbidden" | | | |
| "удалённая работа пятница" | | | |

**Промпт:**
```
Напиши функцию bm25_search(query: str, chunks: list[dict], k: int = 5) -> list[dict].
Используй BM25Okapi из rank_bm25.
Токенизация: lower + split по пробелам после удаления пунктуации через re.
Возвращай список dict с полями text, source, score (нормализованный 0-1).
```

---

## Релиз 1: Hybrid Search с RRF

Объедините dense и sparse через Reciprocal Rank Fusion.

**Задание:**
1. Реализуйте `reciprocal_rank_fusion(result_lists, k=60)` — принимает несколько списков ID, возвращает объединённый рейтинг
2. Реализуйте `hybrid_search(query, dense_k=20, sparse_k=20, final_k=5)`
3. Убедитесь что оба запроса из Релиза 0, где один метод проваливался, теперь получают правильный результат
4. Измерьте: `recall@5` на ваших тестовых вопросах (dense vs hybrid)

**Промпт:**
```
Реализуй reciprocal_rank_fusion(result_lists: list[list[str]], k: int = 60) -> list[tuple[str, float]].
result_lists — списки строковых ID в порядке ранга.
Формула: score(doc) += 1 / (k + rank) для каждого списка где встречается doc.
Возвращай список (doc_id, score) отсортированный по убыванию.
```

---

## Релиз 2: Cross-encoder reranking

Добавьте reranking поверх гибридного поиска.

**Задание:**
1. Установите `sentence-transformers`
2. Загрузите `cross-encoder/ms-marco-MiniLM-L-6-v2` (или `DiTy/cross-encoder-russian-msmarco` для русского)
3. Реализуйте `rerank(query, candidates, top_k=5)`
4. Сравните порядок результатов: `hybrid top-5` vs `hybrid top-20 → reranked top-5`
5. Найдите хотя бы один запрос где reranking поменял порядок — объясните почему

**Промпт:**
```
Напиши функцию rerank(query: str, candidates: list[dict], top_k: int = 5) -> list[dict].
Используй CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2").
candidates — список dict с полем "text".
Возвращай top_k candidates отсортированных по score от cross-encoder.
Добавь поле "rerank_score" в каждый возвращаемый dict.
```

---

## Релиз 3: Полный пайплайн и сравнение

Соберите итоговый пайплайн и измерьте реальный прирост качества.

**Задание:**
1. Реализуйте `advanced_search(query, k=5)`:
   - Hybrid (dense + BM25, k=20 кандидатов)
   - Cross-encoder reranking → top-5
2. Создайте тестовый датасет: 10 вопросов + ожидаемый источник (`expected_source`)
3. Посчитайте `recall@3` для трёх систем: naive dense / hybrid / hybrid+rerank
4. Сохраните результаты в `results.md` с таблицей

| Система | recall@3 |
|---|---|
| Naive dense | |
| Hybrid (RRF) | |
| Hybrid + rerank | |

**Промпт:**
```
Напиши скрипт evaluate.py:
- Принимает список тестовых случаев: [{question, expected_source}]
- Запускает три поиска: naive_search, hybrid_search, advanced_search
- Для каждого считает recall@3 (нашёлся ли expected_source в top-3 источниках)
- Выводит таблицу сравнения
```
