import "dotenv/config";
import path from "node:path";
import { ChatOpenAI } from "@langchain/openai";
import { buildVectorStore } from "./lib/vectorstore.js";

/**
 * Упрощённый RAG chain:
 * - retrieval делаем вручную (similaritySearch)
 * - затем одним вызовом LLM генерируем ответ по CONTEXT
 *
 * Плюсы:
 * - быстро и предсказуемо (1 вызов к LLM на запрос)
 *
 * Минусы:
 * - меньше гибкости, чем у агента (агент может сам решать, сколько раз искать)
 */
const dataDir = path.join(process.cwd(), "data");
const { vectorStore } = await buildVectorStore({ dataDir });

/**
 * Chat модель (через OpenAI-совместимый endpoint при необходимости).
 * - `OPENAI_MODEL` позволяет подставить модель, доступную у прокси (Polza)
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
 * Вопрос берём из аргументов.
 * Пример:
 *   npm run dev:chain -- "О чём договор?"
 */
const question =
  process.argv.slice(2).join(" ").trim() ||
  "Сформулируй, какие основные темы/разделы есть в документах из data, и приведи источники.";

/**
 * Retrieval: находим несколько наиболее релевантных фрагментов.
 * TopK можно тюнить; в демо 4 обычно достаточно.
 */
const retrievedDocs = await vectorStore.similaritySearch(question, 4);

/**
 * Склеиваем контекст так, чтобы:
 * - сохранялись источники (source)
 * - было понятно, какой текст откуда взят (для отладки и доверия к ответу)
 */
const context = retrievedDocs
  .map(
    (doc) =>
      `Source: ${doc.metadata.source ?? "unknown"}\nContent: ${doc.pageContent}`
  )
  .join("\n\n");

/**
 * Простейшая “инструкция” модели:
 * - отвечать только по CONTEXT
 * - если данных нет — явно сказать об этом
 *
 * Для продакшна обычно лучше делать system message + отдельные поля,
 * но для демо такой текстовый prompt проще и нагляднее.
 */
const prompt = [
  "Ты — помощник, отвечающий строго по CONTEXT.",
  "Если ответа нет в CONTEXT — так и скажи.",
  "",
  `QUESTION:\n${question}`,
  "",
  `CONTEXT:\n${context}`,
].join("\n");

const res = await model.invoke(prompt);
console.log(res.content);

