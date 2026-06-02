import os
import random
from datetime import datetime

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o-mini")

KB_SNIPPETS = {
    "vpn": "Для подключения к VPN установите Cisco AnyConnect и укажите сервер vpn.technocorp.ru.",
    "отпуск": "Сотрудники ТехноКорп имеют право на 28 дней отпуска в год. Заявление подаётся через HR-портал за 2 недели.",
    "расходы": "Расходы на командировку возмещаются по чекам через систему Expenses в течение 10 дней после поездки.",
    "dev": "Dev-окружение разворачивается через Docker Compose: склонируй репозиторий dev-env и выполни make up.",
    "пароль": "Пароли должны содержать минимум 12 символов: буквы верхнего/нижнего регистра, цифры и спецсимволы.",
}


@tool
def add(a: int, b: int) -> int:
    """Складывает два числа и возвращает сумму"""
    return a + b


@tool
def multiply(a: int, b: int) -> int:
    """Умножает два числа и возвращает произведение"""
    return a * b


@tool
def get_today_date() -> str:
    """Инструмент для получения сегодняшней даты"""
    return datetime.now().strftime("%Y-%m-%d")


@tool
def get_random_number() -> int:
    """Инструмент для получения случайного числа"""
    return random.randint(0, 100)


@tool
def search_kb(query: str) -> str:
    """
    Поиск по корпоративной базе знаний ТехноКорп.
    Используй этот инструмент для ответов на вопросы о внутренних процессах компании.
    Передай ключевое слово или краткий вопрос.
    """
    query_lower = query.lower()
    for keyword, snippet in KB_SNIPPETS.items():
        if keyword in query_lower:
            return snippet
    return "Информация по данному запросу не найдена в корпоративной базе знаний."


tools = [add, multiply, get_today_date, get_random_number, search_kb]
tool_names = [t.name for t in tools]
tool_descriptions = [t.name + ": " + t.description for t in tools]
llm_with_tools = model.bind_tools(tools)


def process_with_tools(messages, max_iterations=5, current_iteration=0):
    if current_iteration >= max_iterations:
        return llm_with_tools.invoke(messages)

    response = llm_with_tools.invoke(messages)
    print(f"[AI] content={response.content!r} tool_calls={[tc['name'] for tc in response.tool_calls]}")

    if not response.tool_calls:
        return response

    messages.append(response)

    tool_map = {t.name: t for t in tools}
    for tool_call in response.tool_calls:
        selected_tool = tool_map[tool_call["name"].lower()]
        tool_msg = selected_tool.invoke(tool_call)
        print(f"[Tool: {tool_call['name']}] args={tool_call['args']} -> {tool_msg.content}")
        messages.append(tool_msg)

    return process_with_tools(messages, max_iterations, current_iteration + 1)


system_prompt = (
    "Ответь на данные вопросы настолько хорошо, насколько это возможно.\n"
    "У тебя есть доступ к инструментам, которые помогут тебе ответить на вопрос.\n"
    "{tool_descriptions}\n\n"
    "Любое действие, которое ты выполняешь, должно быть одним из {tool_names}."
).format(tool_descriptions=tool_descriptions, tool_names=tool_names)

query = "Сколько будет 3 * 12? Какой сейчас год? Как настроить VPN в ТехноКорп?"

initial_messages = [
    SystemMessage(system_prompt),
    HumanMessage(query),
]

print(f"[Human] {query}\n")
final_result = process_with_tools(initial_messages)
print(f"\n[Final] {final_result.content}")
