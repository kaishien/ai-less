# RAG evaluation

Dataset: small
k: 5

| Method | hit_rate | mrr | precision@k |
|---|---:|---:|---:|
| BM25 | 0.643 | 0.560 | 0.129 |
| Sparse | 0.500 | 0.452 | 0.100 |
| Dense | 0.714 | 0.542 | 0.143 |
| Hybrid (RRF) | 0.643 | 0.467 | 0.129 |
| HyDE + Hybrid | 0.857 | 0.621 | 0.171 |
| MultiQuery + Hybrid | 0.714 | 0.595 | 0.143 |

| Question | Relevant IDs | BM25 | Sparse | Dense | Hybrid (RRF) | HyDE + Hybrid | MultiQuery + Hybrid |
|---|---|---|---|---|---|---|---|
| Какой текущий статус заказа ORD-3311? | bm25_A_ord_002 | hit | hit | miss | miss | miss | miss |
| Заказ ORD-3313 уже отправили? | bm25_A_ord_004 | hit | hit | hit | hit | hit | hit |
| Мне нужен номер отслеживания для ORD-3310. | bm25_A_ord_001 | hit | hit | hit | hit | hit | hit |
| Почему был отменён заказ ORD-3312? | bm25_A_ord_003 | hit | hit | hit | hit | hit | hit |
| Контейнер постоянно падает сразу после запуска. | dense_A_k8s_001 | hit | hit | hit | hit | hit | hit |
| Приложение потребляет слишком много памяти и его убивают. | dense_A_k8s_002 | miss | miss | hit | hit | hit | hit |
| Под завис и никогда не переходит в Running. | dense_A_k8s_003 | miss | miss | miss | miss | hit | miss |
| Kubernetes не может скачать мой Docker-образ. | dense_A_k8s_004 | hit | hit | hit | hit | hit | hit |
| Поды исчезают из кластера без объяснений. | dense_A_k8s_005 | hit | miss | hit | hit | hit | hit |
| Какой уровень доступности гарантирует тариф Enterprise? | rerank_A_sla_003 | hit | hit | hit | hit | hit | hit |
| Как быстро отвечает поддержка на тарифе Pro? | rerank_A_sla_002 | hit | miss | hit | hit | hit | hit |
| Что мне полагается, если сервис недоступен дольше положенного? | rerank_A_sla_005 | miss | miss | hit | miss | hit | hit |
| Есть ли возможность отслеживать текущий статус сервиса? | rerank_A_sla_004 | miss | miss | miss | miss | miss | miss |
| Какова гарантия времени ответа на самом дешёвом тарифе? | rerank_A_sla_001 | miss | miss | miss | miss | hit | miss |