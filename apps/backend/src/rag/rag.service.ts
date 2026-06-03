import { HttpException, HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { RecursiveChunker } from 'chonkie';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import {
  RagAskRequest,
  RagAskResponse,
  RagChunk,
  RagIndexResponse,
  RagStreamEvent,
  RagUploadResponse,
} from './rag.types';
import { OpenAiClientProvider } from '../common/openai/openai-client.provider';

export interface UploadedTextFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

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
const DEFAULT_SCORE_THRESHOLD = 0.35;
const FALLBACK_ANSWER = 'Информация не найдена в базе знаний.';
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);

@Injectable()
export class RagService implements OnModuleInit {
  private readonly qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  private readonly collection = process.env.RAG_COLLECTION ?? 'docs';
  private readonly docsDir = resolve(process.env.RAG_DOCS_DIR ?? './data/rag-docs');
  private readonly embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  private readonly chatModel = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';
  private chunker?: Awaited<ReturnType<typeof RecursiveChunker.create>>;

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
    const chunksByDocument = await Promise.all(
      documents.map(async (document) => ({
        document,
        chunks: await this.chunkText(document.text),
      })),
    );
    const chunks = chunksByDocument.flatMap(({ document, chunks: documentChunks }) =>
      documentChunks.map((text, chunkId) => ({
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

  async uploadDocument(file: UploadedTextFile | undefined): Promise<RagUploadResponse> {
    const upload = this.validateUpload(file);
    const fileName = await this.getAvailableFileName(upload.originalname);
    const text = upload.buffer.toString('utf8').trim();

    if (!text) {
      throw new HttpException(
        {
          message: 'Uploaded file is empty.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await mkdir(this.docsDir, { recursive: true });
    await writeFile(resolve(this.docsDir, fileName), text, 'utf8');

    const index = await this.indexDocuments();

    return {
      ...index,
      uploaded: {
        fileName,
        source: `rag-docs/${fileName}`,
        size: upload.size,
      },
    };
  }

  private async chunkText(text: string): Promise<string[]> {
    const normalized = text.replace(/\r\n/g, '\n').trim();

    if (!normalized) {
      return [];
    }

    const chunks = await (await this.getChunker()).chunk(normalized);

    return chunks.map((chunk) => chunk.text.trim()).filter(Boolean);
  }

  private async getChunker() {
    this.chunker ??= await RecursiveChunker.create({
      chunkSize: DEFAULT_CHUNK_SIZE,
      tokenizer: 'word',
      minCharactersPerChunk: 80,
    });

    return this.chunker;
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

    console.log(response.result.map(s => s.score));

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

  private validateUpload(file: UploadedTextFile | undefined): UploadedTextFile & { buffer: Buffer } {
    if (!file?.buffer) {
      throw new HttpException(
        {
          message: 'Text file is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const extension = extname(file.originalname).toLowerCase();

    if (!ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
      throw new HttpException(
        {
          message: 'Only .txt, .md, and .markdown files are supported.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    return file as UploadedTextFile & { buffer: Buffer };
  }

  private async getAvailableFileName(originalName: string) {
    const extension = extname(originalName).toLowerCase();
    const rawStem = basename(originalName, extname(originalName));
    const stem = rawStem
      .normalize('NFKD')
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    const safeStem = stem || 'document';
    let candidate = `${safeStem}${extension}`;
    let suffix = 2;

    while (await this.fileExists(resolve(this.docsDir, candidate))) {
      candidate = `${safeStem}-${suffix}${extension}`;
      suffix += 1;
    }

    return candidate;
  }

  private async fileExists(path: string) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
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
