import { makeAutoObservable, runInAction } from 'mobx';
import { readNdjsonStream } from '@/lib/read-ndjson-stream';

export interface RagChunk {
  docId?: string;
  text: string;
  source: string;
  date: string;
  chunkId: number;
  score: number;
  denseScore?: number;
  bm25Score?: number;
  sparseScore?: number;
  rrfScore?: number;
  rerankScore?: number;
  retrieval?: string[];
}

export interface RagTraceStep {
  title: string;
  description: string;
  durationMs?: number;
  query?: string;
  model?: string;
  output?: string | string[];
  chunks?: Array<{
    rank: number;
    source: string;
    chunkId: number;
    docId?: string;
    score: number;
    why: string[];
    text: string;
  }>;
}

export type RagSearchMode = 'bm25' | 'sparse' | 'dense' | 'hybrid' | 'hyde' | 'multiQuery' | 'advanced';
export type RagEvaluationDataset = 'small' | 'full';

export interface RagIndexResult {
  collection: string;
  documents: number;
  chunks: number;
}

export interface RagUploadResult extends RagIndexResult {
  uploaded: {
    fileName: string;
    source: string;
    size: number;
  };
}

export interface RagEvaluationResult {
  k: number;
  dataset: RagEvaluationDataset;
  resultsPath: string;
  metrics: Record<string, { hitRate: number; mrr: number; precisionAtK: number }>;
  markdown: string;
}

type RagStreamEvent =
  | {
      type: 'retrieval';
      mode: RagSearchMode;
      sources: string[];
      chunks: RagChunk[];
      trace: RagTraceStep[];
    }
  | {
      type: 'delta';
      delta: string;
    }
  | {
      type: 'done';
      answer: string;
      mode: RagSearchMode;
      sources: string[];
      chunks: RagChunk[];
      trace: RagTraceStep[];
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
  trace: RagTraceStep[] = [];
  isAsking = false;
  isIndexing = false;
  isUploading = false;
  isEvaluating = false;
  searchMode: RagSearchMode = 'hybrid';
  evaluationDataset: RagEvaluationDataset = 'small';
  indexResult: RagIndexResult | null = null;
  uploadResult: RagUploadResult | null = null;
  evaluationResult: RagEvaluationResult | null = null;
  error: string | null = null;
  askedQuestion = '';

  constructor() {
    makeAutoObservable(this);
  }

  setQuestion(value: string) {
    this.question = value;
  }

  setSearchMode(value: RagSearchMode) {
    if (this.isBusy) {
      return;
    }

    this.searchMode = value;
  }

  setEvaluationDataset(value: RagEvaluationDataset) {
    if (this.isBusy) {
      return;
    }

    this.evaluationDataset = value;
  }

  async index() {
    if (this.isBusy) {
      return;
    }

    this.isIndexing = true;
    this.error = null;
    this.indexResult = null;

    try {
      const response = await fetch('/api/rag/index', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(await this.readError(response, `Indexing failed: ${response.status}`));
      }

      const result = (await response.json()) as RagIndexResult;

      runInAction(() => {
        this.indexResult = result;
        this.uploadResult = null;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unknown indexing error';
      });
    } finally {
      runInAction(() => {
        this.isIndexing = false;
      });
    }
  }

  async uploadFile(file: File | null) {
    if (!file || this.isBusy) {
      return;
    }

    this.isUploading = true;
    this.error = null;
    this.indexResult = null;
    this.uploadResult = null;

    try {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body,
      });

      if (!response.ok) {
        throw new Error(await this.readError(response, `Upload failed: ${response.status}`));
      }

      const result = (await response.json()) as RagUploadResult;

      runInAction(() => {
        this.uploadResult = result;
        this.indexResult = result;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unknown upload error';
      });
    } finally {
      runInAction(() => {
        this.isUploading = false;
      });
    }
  }

  async ask() {
    const question = this.question.trim();

    if (!question || this.isAsking || this.isIndexing) {
      return;
    }

    const abortController = new AbortController();
    this.abortController = abortController;
    this.isAsking = true;
    this.error = null;
    this.answer = '';
    this.sources = [];
    this.chunks = [];
    this.trace = [];
    this.askedQuestion = question;

    try {
      const response = await fetch('/api/rag/ask/stream', {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question, mode: this.searchMode }),
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

  async evaluate() {
    if (this.isBusy) {
      return;
    }

    this.isEvaluating = true;
    this.error = null;
    this.evaluationResult = null;

    try {
      const response = await fetch('/api/rag/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dataset: this.evaluationDataset, k: 5 }),
      });

      if (!response.ok) {
        throw new Error(await this.readError(response, `Evaluation failed: ${response.status}`));
      }

      const result = (await response.json()) as RagEvaluationResult;

      runInAction(() => {
        this.evaluationResult = result;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Unknown evaluation error';
      });
    } finally {
      runInAction(() => {
        this.isEvaluating = false;
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
    if (this.isBusy) {
      return;
    }

    this.question = question;
  }

  get isBusy() {
    return this.isAsking || this.isIndexing || this.isUploading || this.isEvaluating;
  }

  private applyStreamEvent(event: RagStreamEvent) {
    if (event.type === 'retrieval') {
      runInAction(() => {
        this.sources = event.sources;
        this.chunks = event.chunks;
        this.trace = event.trace;
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
        this.trace = event.trace;
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
