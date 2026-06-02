import os
from typing import Annotated

from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from typing_extensions import TypedDict

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
llm_with_tools = llm.bind_tools(tools)


class State(TypedDict):
    messages: Annotated[list, add_messages]


graph_builder = StateGraph(State)


def chatbot(state: State):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


graph_builder.add_node("chatbot", chatbot)

tool_node = ToolNode(tools=tools)
graph_builder.add_node("tools", tool_node)

graph_builder.add_conditional_edges("chatbot", tools_condition)
graph_builder.add_edge("tools", "chatbot")
graph_builder.set_entry_point("chatbot")

memory = MemorySaver()
graph = graph_builder.compile(checkpointer=memory)

config = {"configurable": {"thread_id": "1"}}


def stream_graph_updates(user_input: str):
    for event in graph.stream({"messages": [HumanMessage(user_input)]}, config):
        for event_name, value in event.items():
            print(f"\n[{event_name}]")
            msg = value["messages"][-1]
            if hasattr(msg, "content") and msg.content:
                print(f"  {msg.content}")


while True:
    user_input = input("Human: ")
    if user_input.lower() in ["quit", "exit", "q"]:
        print("Goodbye!")
        break
    stream_graph_updates(user_input)
