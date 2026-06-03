import { makeAutoObservable, runInAction } from 'mobx';
import { readNdjsonStream } from '@/lib/read-ndjson-stream';

export interface RagChunk {
  text: string;
  source: string;
  date: string;
  chunkId: number;
  score: number;
}

type RagStreamEvent =
  | {
      type: 'retrieval';
      sources: string[];
      chunks: RagChunk[];
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
      answer: string;
      sources: string[];
      chunks: RagChunk[];
    }
  | {
      type: 'error';
      message: string;
    };

export class RagStore {
  private abortController: AbortController | null = null;

  question = '';
  answer = '';
  sources: string[] = [];
  chunks: RagChunk[] = [];
  isAsking = false;
  error: string | null = null;
  askedQuestion = '';

  constructor() {
    makeAutoObservable(this);
  }

  setQuestion(value: string) {
    this.question = value;
  }

  async ask() {
    const question = this.question.trim();

    if (!question || this.isAsking) {
      return;
    }

    const abortController = new AbortController();
    this.abortController = abortController;
    this.isAsking = true;
    this.error = null;
    this.answer = '';
    this.sources = [];
    this.chunks = [];
    this.askedQuestion = question;

    try {
      const response = await fetch('/api/rag/ask/stream', {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        throw new Error(await this.readError(response, `RAG request failed: ${response.status}`));
      }

      await readNdjsonStream<RagStreamEvent>(response, (event) => this.applyStreamEvent(event));
    } catch (error) {
      runInAction(() => {
        this.error = this.isAbortError(error) ? null : error instanceof Error ? error.message : 'Unknown RAG error';
      });
    } finally {
      runInAction(() => {
        this.isAsking = false;
        if (this.abortController === abortController) {
          this.abortController = null;
        }
      });
    }
  }

  cancel() {
    this.abortController?.abort();
    this.abortController = null;
  }

  dispose() {
    this.cancel();
  }

  usePreset(question: string) {
    if (this.isAsking) {
      return;
    }

    this.question = question;
  }

  private applyStreamEvent(event: RagStreamEvent) {
    if (event.type === 'retrieval') {
      runInAction(() => {
        this.sources = event.sources;
        this.chunks = event.chunks;
      });
      return;
    }

    if (event.type === 'delta') {
      runInAction(() => {
        this.answer += event.delta;
      });
      return;
    }

    if (event.type === 'done') {
      runInAction(() => {
        this.answer = event.answer;
        this.sources = event.sources;
        this.chunks = event.chunks;
      });
      return;
    }

    throw new Error(event.message);
  }

  private async readError(response: Response, fallback: string) {
    const body = await response.json().catch(() => null);

    return typeof body?.message === 'string' ? body.message : fallback;
  }

  private isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError';
  }

  get hasResults() {
    return Boolean(this.answer || this.sources.length > 0 || this.chunks.length > 0);
  }

  get topScore() {
    return this.chunks.reduce((best, chunk) => Math.max(best, chunk.score), 0);
  }
}

