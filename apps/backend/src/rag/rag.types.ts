export type RagSearchMode = 'bm25' | 'sparse' | 'dense' | 'hybrid' | 'hyde' | 'multiQuery' | 'advanced';

export type RagEvaluationDataset = 'small' | 'full';

export interface RagAskRequest {
  question: string;
  k?: number;
  threshold?: number;
  mode?: RagSearchMode;
}

export interface RagEvaluationRequest {
  dataset?: RagEvaluationDataset;
  k?: number;
}

export interface RagAskResponse {
  answer: string;
  mode: RagSearchMode;
  sources: string[];
  chunks: RagChunk[];
  trace: RagTraceStep[];
}

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

export interface RagIndexResponse {
  collection: string;
  documents: number;
  chunks: number;
}

export interface RagUploadResponse extends RagIndexResponse {
  uploaded: {
    fileName: string;
    source: string;
    size: number;
  };
}

export interface RagSearchResponse {
  mode: RagSearchMode;
  sources: string[];
  chunks: RagChunk[];
  trace: RagTraceStep[];
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

export interface RagEvaluationCase {
  question: string;
  relevantIds: string[];
  note?: string;
}

export interface RagEvaluationRow extends RagEvaluationCase {
  results: Record<string, string[]>;
}

export interface RagEvaluationResponse {
  k: number;
  dataset: RagEvaluationDataset;
  resultsPath: string;
  metrics: Record<string, RagEvaluationMetrics>;
  rows: RagEvaluationRow[];
  markdown: string;
}

export interface RagEvaluationMetrics {
  hitRate: number;
  mrr: number;
  precisionAtK: number;
}

export type RagStreamEvent =
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
