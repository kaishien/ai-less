# pip install langgraph langchain-openai langgraph-swarm python-dotenv
from langchain_core.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.prebuilt import create_react_agent
from langgraph_swarm import create_handoff_tool, create_swarm

from model import model

MAX_REVISIONS = 3

transfer_to_qa = create_handoff_tool(
    agent_name="qa",
    description="Send code to QA for review.",
)
transfer_to_developer = create_handoff_tool(
    agent_name="developer",
    description="Send code back to Developer for fixes.",
)

developer = create_react_agent(
    model=model,
    tools=[transfer_to_qa],
    prompt=(
        "You are a Developer. Write clean Python code for the given task. "
        f"You have a budget of {MAX_REVISIONS} revisions total. "
        "After writing or fixing code, hand off to QA for review."
    ),
    name="developer",
)

qa = create_react_agent(
    model=model,
    tools=[transfer_to_developer],
    prompt=(
        "You are a QA engineer. Review the code for bugs, edge cases, and style issues. "
        "If the code is acceptable, respond with exactly 'LGTM' (nothing else). "
        "Otherwise, describe the issues clearly and hand off back to the Developer."
    ),
    name="qa",
)

swarm = create_swarm(
    agents=[developer, qa],
    default_active_agent="developer",
).compile(checkpointer=InMemorySaver())


if __name__ == "__main__":
    task = "Write a Python function that returns the N most frequent words in a string."
    print(f"TASK: {task}\n{'='*60}")

    config = {"configurable": {"thread_id": "review-1"}}
    revision = 0

    for chunk in swarm.stream(
        {"messages": [HumanMessage(task)]},
        config=config,
    ):
        for node, value in chunk.items():
            msg = value["messages"][-1]
            name = getattr(msg, "name", None) or node
            content = msg.content
            if not content:
                continue

            print(f"\n[{name}]:\n{content}")

            if name == "qa" and "LGTM" in content:
                print("\n--- Review passed. Done. ---")
                raise SystemExit(0)

            if name == "developer":
                revision += 1
                if revision >= MAX_REVISIONS:
                    print(f"\n--- Max revisions ({MAX_REVISIONS}) reached. Stopping. ---")
                    raise SystemExit(0)
