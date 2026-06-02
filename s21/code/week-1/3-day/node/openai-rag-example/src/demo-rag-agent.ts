import "dotenv/config";
import path from "node:path";
import { createAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import * as z from "zod";
import { buildVectorStore } from "./lib/vectorstore.js";

function prettyPrint(msg: unknown) {
  /**
   * Утилита для “красивого” вывода сообщений агента в консоль.
   * В режиме streaming агент может печатать:
   * - пользовательские сообщения
   * - промежуточные сообщения (в т.ч. tool calls)
   * - финальный ответ
   *
   * Мы выводим только роль + контент, чтобы видеть ход рассуждений/шага агента.
   */
  const maybe = msg as { role?: string; content?: unknown };
  if (maybe?.content == null) return;
  const role = maybe.role ?? "assistant";
  console.log(`${role}:`);
  console.log(maybe.content);
}

/**
 * Данные для индексации лежат в `./data`.
 * Важно: `process.cwd()` зависит от того, откуда запускается процесс.
 * В npm-скриптах мы запускаем из корня проекта, поэтому это стабильно.
 */
const dataDir = path.join(process.cwd(), "data");

/**
 * Собираем векторное хранилище:
 * - читает `data/*.txt`
 * - режет на чанки
 * - строит embeddings
 * - кладёт в `MemoryVectorStore`
 */
const { vectorStore, splitsCount, sources } = await buildVectorStore({
  dataDir,
});

console.log(
  `Indexed ${splitsCount} chunks from ${sources.length} files:\n- ${sources
    .map((s) => path.relative(process.cwd(), s))
    .join("\n- ")}\n`
);

/**
 * Схема входных параметров tool'а.
 * Агент будет вызывать инструмент `retrieve({ query })`.
 */
const retrieveSchema = z.object({ query: z.string() });

const retrieve = tool(
  async ({ query }) => {
    /**
     * Retrieval шаг:
     * - берём topK наиболее близких чанков по косинусной близости эмбеддингов
     * - сериализуем их в компактный текст, который модель сможет “прочитать”
     *
     * Почему отдаём и content, и artifact:
     * - `content` — то, что уйдёт в модель
     * - `artifact` — сами документы (удобно для отладки/трассировки)
     */
    const retrievedDocs = await vectorStore.similaritySearch(query, 4);
    const serialized = retrievedDocs
      .map(
        (doc) =>
          `Source: ${doc.metadata.source ?? "unknown"}\nContent: ${doc.pageContent}`
      )
      .join("\n\n");
    return [serialized, retrievedDocs] as const;
  },
  {
    name: "retrieve",
    description: "Retrieve information related to a query from local documents.",
    schema: retrieveSchema,
    responseFormat: "content_and_artifact",
  }
);

/**
 * Chat модель.
 * - Важно: `configuration.baseURL` позволяет работать через OpenAI-совместимый прокси (Polza)
 * - Модель можно переопределить через `OPENAI_MODEL`
 * - Температуру держим 0 для более детерминированных ответов в демо
 */
const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL:
      process.env.OPENAI_BASE_URL ||
      process.env.OPENAI_BASEURL ||
      process.env.BASE_URL ||
      undefined,
  },
  model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  temperature: 0,
});

/**
 * Агент как “оркестратор”:
 * - сам решает, когда вызвать retrieval tool
 * - затем формирует ответ, используя найденный контекст
 */
const agent = createAgent({
  model,
  tools: [retrieve],
});

/**
 * Вопрос берём из аргументов командной строки, иначе — дефолтный.
 * Пример запуска:
 *   npm run dev -- "Что сказано про собаку?"
 */
const question =
  process.argv.slice(2).join(" ").trim() ||
  "Кратко объясни, что содержит документ, и приведи 2-3 ключевых пункта с цитатами.";

const agentInputs = { messages: [{ role: "user" as const, content: question }] };

/**
 * Streaming вывод:
 * - удобно для демо: видно, как агент вызывает tool и как собирает ответ
 */
for await (const step of await agent.stream(agentInputs, { streamMode: "values" })) {
  const last = step.messages[step.messages.length - 1];
  prettyPrint(last);
  console.log("-----\n");
}

