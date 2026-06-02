import os
from typing import Annotated

from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt
from typing_extensions import Literal, TypedDict

llm = ChatOpenAI(model="gpt-4o-mini")

FAKE_WEATHER = {
    "москва": "Москва: +18°C, облачно, ветер 5 м/с.",
    "санкт-петербург": "Санкт-Петербург: +12°C, дождь, ветер 8 м/с.",
    "новосибирск": "Новосибирск: +8°C, ясно, ветер 3 м/с.",
}


@tool
def get_weather(city: str) -> str:
    """Возвращает текущую погоду для указанного города."""
    return FAKE_WEATHER.get(city.lower(), f"{city}: данные о погоде недоступны.")


tools = [get_weather]
tool_map = {t.name: t for t in tools}
llm_with_tools = llm.bind_tools(tools)


class State(TypedDict):
    messages: Annotated[list, add_messages]


def chatbot(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


def human_review_node(state: State) -> Command[Literal["chatbot", "run_tool"]]:
    last_message = state["messages"][-1]
    tool_call = last_message.tool_calls[-1]

    human_review = interrupt(
        {
            "question": "Это верно?",
            "tool_call": tool_call,
        }
    )

    review_action = human_review["action"]
    review_payload = human_review.get("payload")

    if review_action == "continue":
        return Command(goto="run_tool")

    elif review_action == "update":
        updated_message = {
            "role": "ai",
            "content": last_message.content,
            "tool_calls": [
                {
                    "id": tool_call["id"],
                    "name": tool_call["name"],
                    "args": review_payload,
                }
            ],
            "id": last_message.id,
        }
        return Command(goto="run_tool", update={"messages": [updated_message]})

    elif review_action == "feedback":
        tool_message = {
            "role": "tool",
            "content": "Error: user provided extra feedback",
            "name": tool_call["name"],
            "tool_call_id": tool_call["id"],
        }
        human_feedback_message = HumanMessage(review_payload["query"])
        return Command(
            goto="chatbot", update={"messages": [tool_message, human_feedback_message]}
        )


def run_tool(state: State):
    new_messages = []
    tool_calls = state["messages"][-1].tool_calls
    for tool_call in tool_calls:
        result = tool_map[tool_call["name"].lower()].invoke(tool_call["args"])
        new_messages.append(
            {
                "role": "tool",
                "name": tool_call["name"],
                "content": result,
                "tool_call_id": tool_call["id"],
            }
        )
    return {"messages": new_messages}


def route_after_llm(state: State) -> Literal[END, "human_review_node"]:
    if len(state["messages"][-1].tool_calls) == 0:
        return END
    return "human_review_node"


graph_builder = StateGraph(State)
graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("run_tool", run_tool)
graph_builder.add_node("human_review_node", human_review_node)

graph_builder.set_entry_point("chatbot")
graph_builder.add_conditional_edges("chatbot", route_after_llm)
graph_builder.add_edge("run_tool", "chatbot")

memory = MemorySaver()
graph = graph_builder.compile(checkpointer=memory)


def process_graph_stream(input_data, config):
    for event in graph.stream(input_data, config):
        for event_name, value in event.items():
            print(f"\n[{event_name}]")

            if isinstance(value, tuple) and hasattr(value[0], "value"):
                interrupt_data = value[0].value
                print(f"  Вопрос: {interrupt_data['question']}")
                tool_call = interrupt_data["tool_call"]
                print(f"  Инструмент: {tool_call['name']}")
                print(f"  Аргументы: {tool_call['args']}")

                print("\n  Действия:")
                print("    [1] continue  — одобрить вызов")
                print("    [2] update    — изменить аргументы")
                print("    [3] feedback  — отправить обратную связь в LLM")
                choice = input("  Выберите действие (1/2/3): ").strip()

                if choice == "1":
                    action = "continue"
                    payload = None
                elif choice == "2":
                    city = input("  Введите новый город: ").strip()
                    action = "update"
                    payload = {"city": city}
                else:
                    feedback = input("  Введите обратную связь: ").strip()
                    action = "feedback"
                    payload = {"query": feedback}

                print(f"  Выбрано: {action}")
                return process_graph_stream(
                    Command(resume={"action": action, "payload": payload}),
                    config,
                )

            elif value and "messages" in value:
                msg = value["messages"][-1]
                if hasattr(msg, "content") and msg.content:
                    print(f"  {msg.content}")


if __name__ == "__main__":
    config = {"configurable": {"thread_id": "hitl-demo"}}

    while True:
        user_input = input("\nHuman: ").strip()
        if user_input.lower() in ["quit", "exit", "q"]:
            print("Goodbye!")
            break
        process_graph_stream({"messages": [HumanMessage(user_input)]}, config)
