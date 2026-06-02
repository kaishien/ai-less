import os

from langchain_core.messages import HumanMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o-mini")


@tool
def add(a: int, b: int) -> int:
    """Складывает два числа и возвращает сумму"""
    return a + b


tools = [add]
llm_with_tools = model.bind_tools(tools)

query = "Сколько будет 3 + 12? Также ответь, сколько будет 32 + 4?"

messages = [HumanMessage(query)]
response = llm_with_tools.invoke(messages)
messages.append(response)

print(f"[AI] tool_calls={response.tool_calls}")

tool_map = {t.name: t for t in tools}

for tool_call in response.tool_calls:
    selected_tool = tool_map[tool_call["name"].lower()]
    tool_msg = selected_tool.invoke(tool_call)
    print(f"[Tool: {tool_call['name']}] args={tool_call['args']} -> {tool_msg.content}")
    messages.append(tool_msg)

result = llm_with_tools.invoke(messages)
messages.append(result)
print(f"[AI] {result.content}")
