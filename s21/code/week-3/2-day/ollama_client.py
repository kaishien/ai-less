# pip install openai
# ollama pull qwen2.5:7b
import asyncio
from openai import AsyncOpenAI


def get_ollama_client(model: str = "qwen2.5:7b") -> AsyncOpenAI:
    return AsyncOpenAI(base_url="http://localhost:11434/v1", api_key="ollama")


async def chat(prompt: str, model: str = "qwen2.5:7b") -> str:
    client = get_ollama_client(model)
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    async def main():
        reply = await chat("Explain RAG in 2 sentences")
        print(reply)

    asyncio.run(main())
