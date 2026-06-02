# pip install openai
# Requires: Ollama running on :11434, vLLM running on :8000
import asyncio
import time
from openai import AsyncOpenAI


async def benchmark(base_url: str, api_key: str, model: str, n: int = 20):
    client = AsyncOpenAI(base_url=base_url, api_key=api_key)
    prompt = "Summarize: RAG combines retrieval with generation for better accuracy."
    start = time.perf_counter()
    results = await asyncio.gather(*[
        client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=50,
        )
        for _ in range(n)
    ])
    elapsed = time.perf_counter() - start
    return elapsed, [len(r.choices[0].message.content) for r in results]


async def main():
    n = 20

    t, lens = await benchmark("http://localhost:11434/v1", "ollama", "qwen2.5:7b", n)
    avg_chars = sum(lens) / len(lens)
    print(f"Ollama  — total: {t:.2f}s, avg: {t/n*1000:.0f}ms/req, avg_chars: {avg_chars:.0f}")

    t, lens = await benchmark("http://localhost:8000/v1", "vllm", "mistralai/Mistral-7B-Instruct-v0.2", n)
    avg_chars = sum(lens) / len(lens)
    print(f"vLLM    — total: {t:.2f}s, avg: {t/n*1000:.0f}ms/req, avg_chars: {avg_chars:.0f}")


if __name__ == "__main__":
    asyncio.run(main())
