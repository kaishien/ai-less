import { HttpException, HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { RagAskRequest, RagAskResponse, RagChunk, RagIndexResponse, RagStreamEvent } from './rag.types';
import { OpenAiClientProvider } from '../common/openai/openai-client.provider';

interface SourceDocument {
  text: string;
  source: string;
  date: string;
}

interface IndexedChunk {
  text: string;
  source: string;
  date: string;
  chunkId: number;
}

interface QdrantSearchPoint {
  score: number;
  payload?: {
    text?: string;
    source?: string;
    date?: string;
    chunk_id?: number;
  };
}

const VECTOR_SIZE = 1536;
const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_OVERLAP = 500;
const DEFAULT_SCORE_THRESHOLD = 0.35;
const FALLBACK_ANSWER = 'Информация не найдена в базе знаний.';

@Injectable()
export class RagService implements OnModuleInit {
  private readonly qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  private readonly collection = process.env.RAG_COLLECTION ?? 'docs';
  private readonly docsDir = resolve(process.env.RAG_DOCS_DIR ?? './data/rag-docs');
  private readonly embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  private readonly chatModel = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';

  constructor(@Inject(OpenAiClientProvider) private readonly openAiClient: OpenAiClientProvider) {}

  async onModuleInit() {
    if (process.env.RAG_INDEX_ON_STARTUP === 'false') {
      return;
    }

    try {
      const result = await this.indexDocuments();
      console.log(
        `[rag] indexed collection=${result.collection} documents=${result.documents} chunks=${result.chunks}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown indexing error';
      console.warn(`[rag] startup indexing skipped: ${message}`);
    }
  }

  async ask(request: RagAskRequest): Promise<RagAskResponse> {
    const { question, chunks, sources } = await this.retrieve(request);

    if (chunks.length === 0) {
      return {
        answer: FALLBACK_ANSWER,
        sources,
        chunks,
      };
    }

    const answer = await this.generateAnswer(question, chunks);

    return {
      answer,
      sources,
      chunks,
    };
  }

  async *askStream(request: RagAskRequest): AsyncGenerator<RagStreamEvent> {
    const { question, chunks, sources } = await this.retrieve(request);

    yield {
      type: 'retrieval',
      sources,
      chunks,
    };

    if (chunks.length === 0) {
      yield {
        type: 'delta',
        delta: FALLBACK_ANSWER,
      };
      yield {
        type: 'done',
        answer: FALLBACK_ANSWER,
        sources,
        chunks,
      };
      return;
    }

    let answer = '';

    for await (const delta of this.generateAnswerStream(question, chunks)) {
      answer += delta;
      yield {
        type: 'delta',
        delta,
      };
    }

    yield {
      type: 'done',
      answer: answer.trim() || FALLBACK_ANSWER,
      sources,
      chunks,
    };
  }

  async indexDocuments(): Promise<RagIndexResponse> {
    const documents = await this.loadDocuments();
    const chunks = documents.flatMap((document) =>
      this.recursiveSplit(document.text, DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP).map((text, chunkId) => ({
        text,
        source: document.source,
        date: document.date,
        chunkId,
      })),
    );

    await this.recreateCollection();

    for (let index = 0; index < chunks.length; index += 100) {
      const batch = chunks.slice(index, index + 100);
      const embeddings = await this.embed(batch.map((chunk) => chunk.text));

      await this.qdrant(`/collections/${this.collection}/points?wait=true`, {
        method: 'PUT',
        body: {
          points: batch.map((chunk, offset) => ({
            id: randomUUID(),
            vector: embeddings[offset],
            payload: {
              text: chunk.text,
              source: chunk.source,
              date: chunk.date,
              chunk_id: chunk.chunkId,
            },
          })),
        },
      });
    }

    return {
      collection: this.collection,
      documents: documents.length,
      chunks: chunks.length,
    };
  }

  recursiveSplit(text: string, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    const units = this.splitLargeUnits(
      normalized
        .split(/\n{2,}/)
        .map((part) => part.trim())
        .filter(Boolean),
      chunkSize,
    );
    const chunks: string[] = [];
    let current = '';

    for (const unit of units) {
      const candidate = current ? `${current}\n\n${unit}` : unit;

      if (candidate.length <= chunkSize) {
        current = candidate;
        continue;
      }

      if (current) {
        chunks.push(current);
      }

      current = unit;
    }

    if (current) {
      chunks.push(current);
    }

    if (overlap <= 0 || chunks.length <= 1) {
      return chunks;
    }

    return chunks.map((chunk, index) => {
      if (index === 0) {
        return chunk;
      }

      const prefix = this.overlapPrefix(chunks[index - 1], overlap);
      return prefix ? `${prefix}\n\n${chunk}` : chunk;
    });
  }

  private overlapPrefix(text: string, overlap: number) {
    const suffix = text.slice(-overlap).trim();
    const boundary = suffix.search(/\s/);

    if (boundary <= 0) {
      return suffix;
    }

    return suffix.slice(boundary).trim();
  }

  private splitLargeUnits(units: string[], chunkSize: number) {
    return units.flatMap((unit) => {
      if (unit.length <= chunkSize) {
        return [unit];
      }

      const lines = unit
        .split(/\n+/)
        .map((part) => part.trim())
        .filter(Boolean);

      if (lines.every((line) => line.length <= chunkSize)) {
        return lines;
      }

      return lines.flatMap((line) => this.splitSentences(line, chunkSize));
    });
  }

  private splitSentences(text: string, chunkSize: number) {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [text];
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      const candidate = current ? `${current} ${sentence}` : sentence;

      if (candidate.length <= chunkSize) {
        current = candidate;
        continue;
      }

      if (current) {
        chunks.push(current);
      }

      if (sentence.length <= chunkSize) {
        current = sentence;
        continue;
      }

      for (let index = 0; index < sentence.length; index += chunkSize) {
        chunks.push(sentence.slice(index, index + chunkSize));
      }
      current = '';
    }

    if (current) {
      chunks.push(current);
    }

    return chunks;
  }

  private async search(query: string, k: number, threshold: number): Promise<RagChunk[]> {
    const [vector] = await this.embed([query]);
    const response = await this.qdrant<{ result: QdrantSearchPoint[] }>(
      `/collections/${this.collection}/points/search`,
      {
        method: 'POST',
        body: {
          vector,
          limit: k,
          with_payload: true,
        },
      },
    );

    return response.result
      .filter((point) => point.score >= threshold)
      .map((point) => ({
        text: point.payload?.text ?? '',
        source: point.payload?.source ?? 'unknown',
        date: point.payload?.date ?? '',
        chunkId: point.payload?.chunk_id ?? 0,
        score: point.score,
      }))
      .filter((chunk) => chunk.text.length > 0);
  }

  private async retrieve(request: RagAskRequest) {
    const question = String(request.question ?? '').trim();

    if (!question) {
      throw new HttpException(
        {
          message: 'Question is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.ensureCollection();

    const chunks = await this.search(
      question,
      this.normalizeLimit(request.k),
      this.normalizeThreshold(request.threshold),
    );
    const sources = [...new Set(chunks.map((chunk) => chunk.source))];

    return {
      question,
      chunks,
      sources,
    };
  }

  private async generateAnswer(question: string, chunks: IndexedChunk[]) {
    const completion = await this.getClient().chat.completions.create({
      model: this.chatModel,
      messages: this.buildAnswerMessages(question, chunks),
    });

    return completion.choices[0]?.message.content?.trim() || FALLBACK_ANSWER;
  }

  private async *generateAnswerStream(question: string, chunks: IndexedChunk[]) {
    const stream = await this.getClient().chat.completions.create({
      model: this.chatModel,
      stream: true,
      messages: this.buildAnswerMessages(question, chunks),
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;

      if (typeof delta === 'string' && delta.length > 0) {
        yield delta;
      }
    }
  }

  private buildAnswerMessages(question: string, chunks: IndexedChunk[]) {
    const context = chunks
      .map((chunk, index) => `[${index + 1}] ${chunk.source} (${chunk.date})\n${chunk.text}`)
      .join('\n\n');

    return [
      {
        role: 'system' as const,
        content:
          'Ты — корпоративный ассистент. Отвечай ТОЛЬКО на основе предоставленного контекста. Если ответа в контексте нет — скажи об этом явно.',
      },
      {
        role: 'user' as const,
        content: `Контекст:\n${context}\n\nВопрос: ${question}`,
      },
    ];
  }

  private async loadDocuments(): Promise<SourceDocument[]> {
    const entries = await readdir(this.docsDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();

    if (files.length === 0) {
      throw new HttpException(
        {
          message: `No documents found in ${this.docsDir}.`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return Promise.all(
      files.map(async (file) => {
        const raw = await readFile(resolve(this.docsDir, file), 'utf8');
        const { text, date } = this.parseFrontMatter(raw);

        return {
          text,
          source: `rag-docs/${basename(file)}`,
          date,
        };
      }),
    );
  }

  private parseFrontMatter(raw: string) {
    const match = raw.match(/^---\n(?<frontMatter>[\s\S]*?)\n---\n(?<text>[\s\S]*)$/);

    if (!match?.groups) {
      return {
        text: raw.trim(),
        date: new Date().toISOString().slice(0, 10),
      };
    }

    const date = match.groups.frontMatter.match(/^date:\s*(?<date>.+)$/m)?.groups?.date.trim();

    return {
      text: match.groups.text.trim(),
      date: date ?? new Date().toISOString().slice(0, 10),
    };
  }

  private async embed(input: string[]) {
    const response = await this.getClient().embeddings.create({
      model: this.embeddingModel,
      input,
    });

    return response.data.map((item) => item.embedding);
  }

  private async ensureCollection() {
    const response = await fetch(`${this.qdrantUrl}/collections/${this.collection}`);

    if (response.status === 404) {
      await this.createCollection();
      return;
    }

    if (!response.ok) {
      await this.throwQdrantError(response);
    }
  }

  private async recreateCollection() {
    await this.qdrant(`/collections/${this.collection}`, {
      method: 'DELETE',
      tolerateNotFound: true,
    });
    await this.createCollection();
  }

  private async createCollection() {
    await this.qdrant(`/collections/${this.collection}`, {
      method: 'PUT',
      body: {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine',
        },
      },
    });
  }

  private async qdrant<T = unknown>(
    path: string,
    options: { method: string; body?: unknown; tolerateNotFound?: boolean },
  ): Promise<T> {
    const response = await fetch(`${this.qdrantUrl}${path}`, {
      method: options.method,
      headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (options.tolerateNotFound && response.status === 404) {
      return {} as T;
    }

    if (!response.ok) {
      await this.throwQdrantError(response);
    }

    return (await response.json().catch(() => ({}))) as T;
  }

  private async throwQdrantError(response: Response): Promise<never> {
    const message = await response.text();

    throw new HttpException(
      {
        message: `Qdrant request failed: ${response.status} ${message}`,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }

  private getClient() {
    return this.openAiClient.getClient();
  }

  private normalizeLimit(value: unknown) {
    const limit = Number(value ?? 4);

    if (!Number.isFinite(limit)) {
      return 4;
    }

    return Math.min(Math.max(Math.trunc(limit), 1), 10);
  }

  private normalizeThreshold(value: unknown) {
    const threshold = Number(value ?? process.env.RAG_SCORE_THRESHOLD ?? DEFAULT_SCORE_THRESHOLD);

    if (!Number.isFinite(threshold)) {
      return DEFAULT_SCORE_THRESHOLD;
    }

    return Math.min(Math.max(threshold, 0), 1);
  }
}
