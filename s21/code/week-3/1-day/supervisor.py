# pip install langgraph langchain-openai langgraph-supervisor python-dotenv
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent
from langgraph_supervisor import create_supervisor

from model import model


def make_tech_agent():
    return create_react_agent(
        model=model,
        tools=[],
        prompt=(
            "You are a TechSupport agent. Help users with technical issues: "
            "bugs, errors, connectivity problems, and how-to questions. "
            "Be concise and solution-focused."
        ),
        name="tech_support",
    )


def make_billing_agent():
    return create_react_agent(
        model=model,
        tools=[],
        prompt=(
            "You are a Billing agent. Handle payment issues, invoice questions, "
            "subscription changes, and refund requests. Be precise about numbers."
        ),
        name="billing",
    )


def make_sales_agent():
    return create_react_agent(
        model=model,
        tools=[],
        prompt=(
            "You are a Sales agent. Help prospects understand pricing, plans, "
            "and feature comparisons. Guide them toward the right product tier."
        ),
        name="sales",
    )


supervisor = create_supervisor(
    agents=[make_tech_agent(), make_billing_agent(), make_sales_agent()],
    model=model,
    prompt=(
        "You are a support routing supervisor. "
        "Route each user request to the appropriate specialist: "
        "tech_support for technical issues, billing for payment/invoice questions, "
        "sales for pricing and plan inquiries. "
        "Delegate immediately — do not answer yourself."
    ),
).compile()


if __name__ == "__main__":
    queries = [
        "My app crashes every time I open the settings page.",
        "I was charged twice for my subscription this month.",
        "What's the difference between the Pro and Enterprise plans?",
    ]

    for query in queries:
        print(f"\n{'='*60}")
        print(f"USER: {query}")
        print("="*60)
        for chunk in supervisor.stream({"messages": [HumanMessage(query)]}):
            for node, value in chunk.items():
                msg = value["messages"][-1]
                name = getattr(msg, "name", None) or node
                print(f"[{name}]: {msg.content}")
