import json
import os
from typing import Annotated

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.messages.modifier import RemoveMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, MessagesState, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import Literal, TypedDict

primary_llm = ChatOpenAI(model="gpt-4o-mini")
fallback_llm = ChatOpenAI(model="gpt-4o")

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

llm_with_tools = primary_llm.bind_tools(tools)
fallback_llm_with_tools = fallback_llm.bind_tools(tools)


class State(TypedDict):
    messages: Annotated[list, add_messages]


def chatbot(state: MessagesState):
    return {"messages": [llm_with_tools.invoke(state["messages"])]}


def should_continue(state: MessagesState) -> Literal["tools", END]:
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return END


def call_tool(state: MessagesState):
    messages = state["messages"]
    last_message = messages[-1]
    output_messages = []
    for tool_call in last_message.tool_calls:
        try:
            tool_result = tool_map[tool_call["name"]].invoke(tool_call["args"])
            output_messages.append(
                ToolMessage(
                    content=json.dumps(tool_result, ensure_ascii=False),
                    name=tool_call["name"],
                    tool_call_id=tool_call["id"],
                )
            )
        except Exception as e:
            output_messages.append(
                ToolMessage(
                    content="",
                    name=tool_call["name"],
                    tool_call_id=tool_call["id"],
                    additional_kwargs={"error": e},
                )
            )
    return {"messages": output_messages}


def should_fallback(
    state: MessagesState,
) -> Literal["chatbot", "remove_failed_tool_call_attempt"]:
    messages = state["messages"]
    failed_tool_messages = [
        msg
        for msg in messages
        if isinstance(msg, ToolMessage)
        and (
            msg.additional_kwargs.get("error") is not None
            or "Error" in str(msg.content)
            or "HTTPError" in str(msg.content)
        )
    ]
    if failed_tool_messages:
        return "remove_failed_tool_call_attempt"
    return "chatbot"


def remove_failed_tool_call_attempt(state: MessagesState):
    messages = state["messages"]
    last_ai_message_index = next(
        i
        for i, msg in reversed(list(enumerate(messages)))
        if isinstance(msg, AIMessage)
    )
    messages_to_remove = messages[last_ai_message_index:]
    return {"messages": [RemoveMessage(id=m.id) for m in messages_to_remove]}


def call_fallback_model(state: MessagesState):
    messages = state["messages"]
    response = fallback_llm_with_tools.invoke(messages)
    return {"messages": [response]}


graph_builder = StateGraph(State)
graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("tools", call_tool)
graph_builder.add_node("remove_failed_tool_call_attempt", remove_failed_tool_call_attempt)
graph_builder.add_node("fallback_agent", call_fallback_model)

graph_builder.set_entry_point("chatbot")
graph_builder.add_conditional_edges("chatbot", should_continue, ["tools", END])
graph_builder.add_conditional_edges("tools", should_fallback)
graph_builder.add_edge("remove_failed_tool_call_attempt", "fallback_agent")
graph_builder.add_edge("fallback_agent", "tools")

memory = MemorySaver()
graph = graph_builder.compile(checkpointer=memory)

config = {"configurable": {"thread_id": "fallback-demo"}}

if __name__ == "__main__":
    while True:
        user_input = input("\nHuman: ").strip()
        if user_input.lower() in ["quit", "exit", "q"]:
            print("Goodbye!")
            break
        for event in graph.stream(
            {"messages": [HumanMessage(user_input)]},
            config,
        ):
            for event_name, value in event.items():
                print(f"\n[{event_name}]")
                if value and "messages" in value:
                    msg = value["messages"][-1]
                    if hasattr(msg, "content") and msg.content:
                        print(f"  {msg.content}")
