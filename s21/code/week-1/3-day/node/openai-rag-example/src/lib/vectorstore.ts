import path from "node:path";
import fs from "node:fs/promises";
import { Document } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { listTextFiles } from "./data.js";



export type BuildVectorStoreOptions = {
  dataDir: string;
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingModel?: string;
};

// Функция для построения векторного хранилища
export async function buildVectorStore({
  dataDir,
  chunkSize = 1000,
  chunkOverlap = 200,
  embeddingModel = "text-embedding-3-small",
}: BuildVectorStoreOptions) {
  /**
   * Индексация данных для RAG:
   * 1) читаем файлы из `dataDir` (в этом демо — `data/*.txt`)
   * 2) превращаем каждый файл в Document (pageContent + metadata.source)
   * 3) режем документы на чанки (chunking) для более точного retrieval
   * 4) строим эмбеддинги и кладём чанки в векторное хранилище (MemoryVectorStore)
   *
   * Почему чанки нужны:
   * - retrieval по целому документу часто “размывает” релевантность
   * - чанки позволяют выбрать 3–5 наиболее близких фрагментов и дать их в контекст модели
   */
  const filePaths = await listTextFiles(dataDir);
  if (filePaths.length === 0) {
    throw new Error(`No .txt files found in ${dataDir}`);
  }

  /**
   * В демо используем простое чтение текстовых файлов.
   * (Можно заменить на PDF/Docx/HTML лоадеры, если расширять проект.)
   */
  const docs = await Promise.all(
    filePaths.map(async (filePath) => {
      const pageContent = await fs.readFile(filePath, "utf8");
      return new Document({
        pageContent,
        metadata: { source: path.relative(process.cwd(), filePath) },
      });
    })
  );

  /**
   * Разбиение на чанки.
   * chunkSize/chunkOverlap можно подбирать под тип данных:
   * - меньше chunkSize → точнее попадание, но больше запросов/индекса и иногда хуже связность
   * - overlap помогает не терять смысл на границе чанков
   */
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
  const splits = await splitter.splitDocuments(docs);

  /**
   * Embeddings модель:
   * - по умолчанию используем стабильную и дешёвую `text-embedding-3-small`
   * - важно, что baseURL + apiKey должны совпадать с тем же провайдером/прокси,
   *   иначе embeddings и chat будут ходить в разные места
   */
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL:
        process.env.OPENAI_BASE_URL ||
        process.env.OPENAI_BASEURL ||
        process.env.BASE_URL ||
        undefined,
    },
    model: embeddingModel,
  });

  /**
   * Векторное хранилище:
   * - `MemoryVectorStore` из `@langchain/classic` — in-memory, без персистентности
   * - отлично подходит для демо и локальной отладки
   * - для “реального” приложения обычно выбирают persist-хранилище (pgvector, qdrant, pinecone и т.д.)
   */
  const vectorStore = new MemoryVectorStore(embeddings);
  await vectorStore.addDocuments(splits);

  return { vectorStore, splitsCount: splits.length, sources: filePaths };
}

