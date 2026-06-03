export interface RagAskRequest {
  question: string;
  k?: number;
  threshold?: number;
}

export interface RagAskResponse {
  answer: string;
  sources: string[];
  chunks: RagChunk[];
}

export interface RagChunk {
  text: string;
  source: string;
  date: string;
  chunkId: number;
  score: number;
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

export type RagStreamEvent =
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
