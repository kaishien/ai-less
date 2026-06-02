# pip install qdrant-client openai rank-bm25

import os
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from rank_bm25 import BM25Okapi

DOCS = [
    "Для подключения к корпоративному VPN необходимо установить клиент Cisco AnyConnect и ввести адрес сервера vpn.technocorp.ru.",
    "Подключение к VPN доступно только с корпоративного устройства, прошедшего проверку службой ИБ.",
    "При проблемах с VPN обратитесь в IT-поддержку по адресу helpdesk@technocorp.ru или звоните на 8800.",
    "Сотрудники ТехноКорп могут взять отпуск продолжительностью до 28 календарных дней в год.",
    "Заявление на отпуск подаётся через HR-портал не позднее чем за две недели до его начала.",
    "Отпуск без сохранения заработной платы согласовывается с непосредственным руководителем и HR-отделом.",
    "В первый день сотрудник получает ноутбук, корпоративный пропуск и приглашение в Slack от команды онбординга.",
    "Онбординг включает трёхдневный вводный курс: знакомство с продуктом, процессами и командами.",
    "Доступ к внутренним системам выдаётся в течение 24 часов после подписания трудового договора.",
    "Все пароли должны содержать минимум 12 символов и включать буквы верхнего и нижнего регистра, цифры и спецсимволы.",
    "Запрещается использовать корпоративный ноутбук для установки несертифицированного ПО без согласования с IT.",
    "Фишинговые письма необходимо пересылать на адрес security@technocorp.ru и удалять из входящих.",
    "Расходы на командировку возмещаются по факту предоставления чеков через систему Expenses не позднее 10 дней после поездки.",
    "Представительские расходы до 5000 руб. согласовываются с руководителем, свыше — с финансовым директором.",
    "Для авиабилетов класса эконом предусмотрено полное возмещение; бизнес-класс оплачивается только при перелётах дольше 6 часов.",
    "Dev-окружение разворачивается через Docker Compose: склонируй репозиторий dev-env и выполни make up.",
    "Для работы с внутренним PyPI-зеркалом добавь в pip.conf строку index-url = https://pypi.technocorp.ru/simple.",
    "CI/CD пайплайны запускаются автоматически при пуше в ветку main или при создании pull request.",
    "Корпоративный Git-сервер расположен по адресу git.technocorp.ru; доступ осуществляется через SSH-ключ.",
    "При онбординге каждому разработчику назначается ментор на первые 30 дней для помощи в адаптации.",
]

COLLECTION_NAME = "hybrid-demo"
EMBEDDING_MODEL = "text-embedding-3-small"

client = OpenAI()
qdrant = QdrantClient(":memory:")


def embed(texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    return [item.embedding for item in response.data]


def build_indexes():
    vectors = embed(DOCS)
    dim = len(vectors[0])

    qdrant.recreate_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
    )

    points = [
        PointStruct(id=i, vector=vectors[i], payload={"text": DOCS[i]})
        for i in range(len(DOCS))
    ]
    qdrant.upsert(collection_name=COLLECTION_NAME, points=points)

    tokenized = [doc.lower().split() for doc in DOCS]
    bm25 = BM25Okapi(tokenized)
    return bm25


def rrf(rankings: list[list[int]], k: int = 60) -> dict[int, float]:
    scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)
    return scores


def hybrid_search(query: str, k: int = 5) -> list[dict]:
    top_n = 20

    query_vector = embed([query])[0]
    dense_results = qdrant.search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        limit=top_n,
    )
    dense_ranking = [hit.id for hit in dense_results]

    tokenized_query = query.lower().split()
    bm25_scores = bm25_index.get_scores(tokenized_query)
    bm25_ranking = sorted(range(len(DOCS)), key=lambda i: bm25_scores[i], reverse=True)[:top_n]

    fused = rrf([dense_ranking, bm25_ranking])
    top_ids = sorted(fused, key=lambda i: fused[i], reverse=True)[:k]

    results = []
    for doc_id in top_ids:
        source = []
        if doc_id in dense_ranking:
            source.append("dense")
        if doc_id in bm25_ranking:
            source.append("bm25")
        results.append({
            "text": DOCS[doc_id],
            "score": round(fused[doc_id], 6),
            "source": "+".join(source),
        })
    return results


bm25_index = build_indexes()


if __name__ == "__main__":
    queries = [
        "Как настроить VPN?",
        "Как возместить расходы в командировке?",
        "Как развернуть dev-окружение?",
    ]

    for query in queries:
        print(f"\nЗапрос: {query}")
        print("-" * 60)
        for i, result in enumerate(hybrid_search(query, k=3), 1):
            print(f"{i}. [{result['source']}] score={result['score']}")
            print(f"   {result['text']}")
