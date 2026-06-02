# pip install sentence-transformers

from sentence_transformers import CrossEncoder

MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"

model = CrossEncoder(MODEL_NAME)


def rerank(query: str, passages: list[str], top_n: int = 3) -> list[tuple[float, str]]:
    pairs = [(query, passage) for passage in passages]
    scores = model.predict(pairs)
    ranked = sorted(zip(scores, passages), key=lambda x: x[0], reverse=True)
    return ranked[:top_n]


if __name__ == "__main__":
    query = "Как настроить VPN?"

    passages = [
        "Для подключения к корпоративному VPN установите клиент Cisco AnyConnect и введите адрес vpn.technocorp.ru.",
        "Сотрудники могут взять отпуск продолжительностью до 28 календарных дней в год.",
        "Подключение к VPN доступно только с корпоративного устройства, прошедшего проверку службой ИБ.",
        "Представительские расходы до 5000 руб. согласовываются с руководителем.",
        "При проблемах с VPN обратитесь в IT-поддержку по адресу helpdesk@technocorp.ru.",
    ]

    print(f"Запрос: {query}\n")
    print("До ранжирования:")
    for i, p in enumerate(passages, 1):
        print(f"  {i}. {p}")

    print("\nПосле реранкинга (top-3):")
    results = rerank(query, passages, top_n=3)
    for score, text in results:
        print(f"  [{score:.4f}] {text}")
