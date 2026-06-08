import { HttpException, HttpStatus, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { RecursiveChunker } from 'chonkie';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, resolve } from 'node:path';
import {
  RagAskRequest,
  RagAskResponse,
  RagEvaluationDataset,
  RagEvaluationMetrics,
  RagEvaluationRequest,
  RagChunk,
  RagEvaluationRow,
  RagEvaluationResponse,
  RagIndexResponse,
  RagSearchMode,
  RagSearchResponse,
  RagStreamEvent,
  RagTraceStep,
  RagUploadResponse,
} from './rag.types';
import { OpenAiClientProvider } from '../common/openai/openai-client.provider';
import { S21_DATASETS } from './s21-dataset.generated';

export interface UploadedTextFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

interface SourceDocument {
  docId: string;
  text: string;
  source: string;
  date: string;
}

interface IndexedChunk {
  id: string;
  docId: string;
  text: string;
  source: string;
  date: string;
  chunkId: number;
}

interface QdrantSearchPoint {
  id?: string | number;
  score: number;
  payload?: {
    doc_id?: string;
    text?: string;
    source?: string;
    date?: string;
    chunk_id?: number;
  };
}

interface QdrantQueryResponse {
  result?: {
    points?: QdrantSearchPoint[];
  };
}

interface SparseVector {
  indices: number[];
  values: number[];
}

const VECTOR_SIZE = 1536;
const DENSE_VECTOR_NAME = 'dense';
const SPARSE_VECTOR_NAME = 'sparse';
const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_SCORE_THRESHOLD = 0.35;
const FALLBACK_ANSWER = 'Информация не найдена в базе знаний.';
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.txt', '.md', '.markdown']);
const HYBRID_CANDIDATE_LIMIT = 20;
const RRF_K = 60;
const BM25_K1 = 1.5;
const BM25_B = 0.75;

const EVALUATION_METHODS: Array<{ mode: RagSearchMode; label: string }> = [
  { mode: 'bm25', label: 'BM25' },
  { mode: 'sparse', label: 'Sparse' },
  { mode: 'dense', label: 'Dense' },
  { mode: 'hybrid', label: 'Hybrid (RRF)' },
  { mode: 'hyde', label: 'HyDE + Hybrid' },
  { mode: 'multiQuery', label: 'MultiQuery + Hybrid' },
];

@Injectable()
export class RagService implements OnModuleInit {
  private readonly qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  private readonly collection = process.env.RAG_COLLECTION ?? 'docs';
  private readonly docsDir = resolve(process.env.RAG_DOCS_DIR ?? './data/rag-docs');
  private readonly resultsPath = resolve(process.env.RAG_RESULTS_PATH ?? './data/rag-results.md');
  private readonly embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  private readonly chatModel = process.env.OPENAI_MODEL ?? 'gpt-5.4-mini';
  private readonly rerankModel = process.env.RAG_RERANK_MODEL ?? this.chatModel;
  private chunker?: Awaited<ReturnType<typeof RecursiveChunker.create>>;
  private indexedChunks?: IndexedChunk[];

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
    const { question, mode, chunks, sources, trace } = await this.retrieve(request);

    if (chunks.length === 0) {
      return {
        answer: FALLBACK_ANSWER,
        mode,
        sources,
        chunks,
        trace,
      };
    }

    const answerStartedAt = performance.now();
    const answer = await this.generateAnswer(question, chunks);
    this.addTrace(trace, {
      title: 'Answer generation',
      description: 'LLM формирует финальный ответ только по найденным чанкам.',
      model: this.chatModel,
      durationMs: this.elapsedMs(answerStartedAt),
      chunks,
    });

    return {
      answer,
      mode,
      sources,
      chunks,
      trace,
    };
  }

  async *askStream(request: RagAskRequest): AsyncGenerator<RagStreamEvent> {
    const { question, mode, chunks, sources, trace } = await this.retrieve(request);

    yield {
      type: 'retrieval',
      mode,
      sources,
      chunks,
      trace,
    };

    if (chunks.length === 0) {
      yield {
        type: 'delta',
        delta: FALLBACK_ANSWER,
      };
      yield {
        type: 'done',
        answer: FALLBACK_ANSWER,
        mode,
        sources,
        chunks,
        trace,
      };
      return;
    }

    let answer = '';
    const answerStartedAt = performance.now();

    for await (const delta of this.generateAnswerStream(question, chunks)) {
      answer += delta;
      yield {
        type: 'delta',
        delta,
      };
    }

    this.addTrace(trace, {
      title: 'Answer generation',
      description: 'LLM стримит финальный ответ только по найденным чанкам.',
      model: this.chatModel,
      durationMs: this.elapsedMs(answerStartedAt),
      chunks,
    });

    yield {
      type: 'done',
      answer: answer.trim() || FALLBACK_ANSWER,
      mode,
      sources,
      chunks,
      trace,
    };
  }

  async searchOnly(request: RagAskRequest): Promise<RagSearchResponse> {
    const { mode, chunks, sources, trace } = await this.retrieve(request);

    return {
      mode,
      sources,
      chunks,
      trace,
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
        id: this.getChunkKey(document.source, chunkId),
        docId: document.docId,
        text,
        source: document.source,
        date: document.date,
        chunkId,
      })),
    );
    this.indexedChunks = chunks;

    await this.recreateCollection();

    for (let index = 0; index < chunks.length; index += 100) {
      const batch = chunks.slice(index, index + 100);
      const embeddings = await this.embed(batch.map((chunk) => chunk.text));

      await this.qdrant(`/collections/${this.collection}/points?wait=true`, {
        method: 'PUT',
        body: {
          points: batch.map((chunk, offset) => ({
            id: randomUUID(),
            vector: {
              [DENSE_VECTOR_NAME]: embeddings[offset],
              [SPARSE_VECTOR_NAME]: this.createSparseVector(chunk.text),
            },
            payload: {
              doc_id: chunk.docId,
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

  private async denseSearch(query: string, k: number, threshold = 0, trace?: RagTraceStep[]): Promise<RagChunk[]> {
    const startedAt = performance.now();
    const [vector] = await this.embed([query]);
    const response = await this.qdrant<QdrantQueryResponse>(
      `/collections/${this.collection}/points/query`,
      {
        method: 'POST',
        body: {
          query: vector,
          using: DENSE_VECTOR_NAME,
          limit: k,
          with_payload: true,
        },
      },
    );

    const results = this.getQdrantPoints(response)
      .filter((point) => point.score >= threshold)
      .map((point) => ({
        docId: point.payload?.doc_id,
        text: point.payload?.text ?? '',
        source: point.payload?.source ?? 'unknown',
        date: point.payload?.date ?? '',
        chunkId: point.payload?.chunk_id ?? 0,
        score: point.score,
        denseScore: point.score,
        retrieval: ['dense'],
      }))
      .filter((chunk) => chunk.text.length > 0);

    this.addTrace(trace, {
      title: 'Dense search',
      description: `Вопрос превращается в embedding, Qdrant ищет ближайшие векторы. Threshold: ${threshold}.`,
      query,
      model: this.embeddingModel,
      durationMs: this.elapsedMs(startedAt),
      chunks: results,
    });

    return results;
  }

  private async qdrantSparseSearch(query: string, k: number, trace?: RagTraceStep[]): Promise<RagChunk[]> {
    const startedAt = performance.now();
    const sparseVector = this.createSparseVector(query);

    if (sparseVector.indices.length === 0) {
      this.addTrace(trace, {
        title: 'Qdrant sparse search',
        description: 'Sparse search не запущен: запрос не дал токенов.',
        query,
        durationMs: this.elapsedMs(startedAt),
      });
      return [];
    }

    const response = await this.qdrant<QdrantQueryResponse>(
      `/collections/${this.collection}/points/query`,
      {
        method: 'POST',
        body: {
          query: sparseVector,
          using: SPARSE_VECTOR_NAME,
          limit: k,
          with_payload: true,
        },
      },
    );

    const results = this.getQdrantPoints(response)
      .map((point) => ({
        docId: point.payload?.doc_id,
        text: point.payload?.text ?? '',
        source: point.payload?.source ?? 'unknown',
        date: point.payload?.date ?? '',
        chunkId: point.payload?.chunk_id ?? 0,
        score: point.score,
        sparseScore: point.score,
        retrieval: ['sparse'],
      }))
      .filter((chunk) => chunk.text.length > 0);

    this.addTrace(trace, {
      title: 'Qdrant sparse search',
      description: 'Поиск по sparse vector внутри Qdrant: токены запроса превращаются в разреженный вектор.',
      query,
      output: this.tokenize(query),
      durationMs: this.elapsedMs(startedAt),
      chunks: results,
    });

    return results;
  }

  private async bm25Search(query: string, k: number, trace?: RagTraceStep[]): Promise<RagChunk[]> {
    const startedAt = performance.now();
    const chunks = await this.getIndexedChunks();
    const queryTokens = this.tokenize(query);

    if (queryTokens.length === 0 || chunks.length === 0) {
      this.addTrace(trace, {
        title: 'BM25 search',
        description: 'BM25 не запущен: нет токенов запроса или индексированных чанков.',
        query,
        output: queryTokens,
        durationMs: this.elapsedMs(startedAt),
      });
      return [];
    }

    const tokenizedCorpus = chunks.map((chunk) => this.tokenize(chunk.text));
    const documentFrequency = new Map<string, number>();

    for (const tokens of tokenizedCorpus) {
      for (const token of new Set(tokens)) {
        documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
      }
    }

    const averageLength =
      tokenizedCorpus.reduce((sum, tokens) => sum + tokens.length, 0) / Math.max(tokenizedCorpus.length, 1);
    const rawScores = tokenizedCorpus.map((tokens) =>
      this.scoreBm25Document(queryTokens, tokens, documentFrequency, tokenizedCorpus.length, averageLength),
    );
    const maxScore = Math.max(...rawScores, 0);

    const results = rawScores
      .map((score, index) => ({
        chunk: chunks[index],
        score: maxScore > 0 ? score / maxScore : 0,
      }))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, k)
      .map(({ chunk, score }) => ({
        docId: chunk.docId,
        text: chunk.text,
        source: chunk.source,
        date: chunk.date,
        chunkId: chunk.chunkId,
        score,
        bm25Score: score,
        retrieval: ['bm25'],
      }));

    this.addTrace(trace, {
      title: 'BM25 search',
      description: 'Поиск по точным токенам с нормализацией частоты и длины документа.',
      query,
      output: queryTokens,
      durationMs: this.elapsedMs(startedAt),
      chunks: results,
    });

    return results;
  }

  private scoreBm25Document(
    queryTokens: string[],
    documentTokens: string[],
    documentFrequency: Map<string, number>,
    documentCount: number,
    averageLength: number,
  ) {
    const termFrequency = new Map<string, number>();

    for (const token of documentTokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    let score = 0;

    for (const token of queryTokens) {
      const frequency = termFrequency.get(token) ?? 0;

      if (frequency === 0) {
        continue;
      }

      const docsWithToken = documentFrequency.get(token) ?? 0;
      const idf = Math.log(1 + (documentCount - docsWithToken + 0.5) / (docsWithToken + 0.5));
      const denominator = frequency + BM25_K1 * (1 - BM25_B + BM25_B * (documentTokens.length / averageLength));
      score += idf * ((frequency * (BM25_K1 + 1)) / denominator);
    }

    return score;
  }

  private async hybridSearch(
    query: string,
    finalK: number,
    candidateLimit = HYBRID_CANDIDATE_LIMIT,
    trace?: RagTraceStep[],
  ): Promise<RagChunk[]> {
    const startedAt = performance.now();
    await this.ensureCollection();

    const [denseResults, sparseResults] = await Promise.all([
      this.denseSearch(query, candidateLimit, 0, trace),
      this.qdrantSparseSearch(query, candidateLimit, trace),
    ]);
    const candidates = new Map<string, RagChunk>();

    for (const chunk of [...denseResults, ...sparseResults]) {
      const key = this.getChunkKey(chunk.source, chunk.chunkId);
      const existing = candidates.get(key);
      candidates.set(key, {
        ...chunk,
        denseScore: existing?.denseScore ?? chunk.denseScore,
        sparseScore: existing?.sparseScore ?? chunk.sparseScore,
        retrieval: [...new Set([...(existing?.retrieval ?? []), ...(chunk.retrieval ?? [])])],
      });
    }

    const fused = this.reciprocalRankFusion([
      denseResults.map((chunk) => this.getChunkKey(chunk.source, chunk.chunkId)),
      sparseResults.map((chunk) => this.getChunkKey(chunk.source, chunk.chunkId)),
    ]);

    const fusedChunks: RagChunk[] = [];

    for (const [id, rrfScore] of fused.slice(0, finalK)) {
      const chunk = candidates.get(id);

      if (!chunk) {
        continue;
      }

      fusedChunks.push({
        ...chunk,
        score: rrfScore,
        rrfScore,
      });
    }

    this.addTrace(trace, {
      title: 'Hybrid search',
      description: `Dense и Qdrant sparse объединяются через Reciprocal Rank Fusion. Candidates per retriever: ${candidateLimit}.`,
      query,
      output: [
        `dense: ${denseResults.length}`,
        `sparse: ${sparseResults.length}`,
        `fused: ${fusedChunks.length}`,
      ],
      durationMs: this.elapsedMs(startedAt),
      chunks: fusedChunks,
    });

    return fusedChunks;
  }

  private reciprocalRankFusion(resultLists: string[][], k = RRF_K): Array<[string, number]> {
    const scores = new Map<string, number>();

    for (const results of resultLists) {
      results.forEach((docId, index) => {
        const rank = index + 1;
        scores.set(docId, (scores.get(docId) ?? 0) + 1 / (k + rank));
      });
    }

    return [...scores.entries()].sort((left, right) => right[1] - left[1]);
  }

  private async advancedSearch(query: string, k: number, trace?: RagTraceStep[]): Promise<RagChunk[]> {
    const startedAt = performance.now();
    const candidates = await this.hybridSearch(query, HYBRID_CANDIDATE_LIMIT, HYBRID_CANDIDATE_LIMIT, trace);
    this.addTrace(trace, {
      title: 'Advanced candidates',
      description: 'Сначала берётся расширенный top кандидатов из Hybrid, затем они передаются в rerank.',
      query,
      durationMs: this.elapsedMs(startedAt),
      chunks: candidates,
    });
    return this.rerank(query, candidates, k, trace);
  }

  private async hydeSearch(query: string, k: number, trace?: RagTraceStep[]): Promise<RagChunk[]> {
    const generationStartedAt = performance.now();
    const hypotheticalDocument = await this.generateHypotheticalDocument(query);
    this.addTrace(trace, {
      title: 'HyDE generation',
      description: 'LLM пишет гипотетический фрагмент документации, и поиск идёт уже по нему.',
      query,
      model: this.chatModel,
      output: hypotheticalDocument,
      durationMs: this.elapsedMs(generationStartedAt),
    });
    const searchStartedAt = performance.now();
    const results = await this.hybridSearch(hypotheticalDocument, k, HYBRID_CANDIDATE_LIMIT, trace);

    const finalResults = results.map((chunk) => ({
      ...chunk,
      retrieval: [...new Set([...(chunk.retrieval ?? []), 'hyde'])],
    }));

    this.addTrace(trace, {
      title: 'HyDE result',
      description: 'Итоговый top-k после поиска по гипотетическому документу.',
      durationMs: this.elapsedMs(searchStartedAt),
      chunks: finalResults,
    });

    return finalResults;
  }

  private async multiQuerySearch(query: string, k: number, trace?: RagTraceStep[]): Promise<RagChunk[]> {
    const generationStartedAt = performance.now();
    const reformulations = await this.generateQueryReformulations(query);
    const queries = [query, ...reformulations];
    this.addTrace(trace, {
      title: 'MultiQuery generation',
      description: 'LLM делает несколько формулировок одного запроса, чтобы повысить recall.',
      query,
      model: this.chatModel,
      output: reformulations,
      durationMs: this.elapsedMs(generationStartedAt),
    });
    const fusionStartedAt = performance.now();
    const resultLists = await Promise.all(queries.map((item) => this.hybridSearch(item, k * 2, HYBRID_CANDIDATE_LIMIT)));
    const candidates = new Map<string, RagChunk>();

    for (const list of resultLists) {
      for (const chunk of list) {
        const key = this.getChunkKey(chunk.source, chunk.chunkId);
        const existing = candidates.get(key);
        candidates.set(key, {
          ...chunk,
          denseScore: existing?.denseScore ?? chunk.denseScore,
          sparseScore: existing?.sparseScore ?? chunk.sparseScore,
          rrfScore: existing?.rrfScore ?? chunk.rrfScore,
          retrieval: [...new Set([...(existing?.retrieval ?? []), ...(chunk.retrieval ?? []), 'multiQuery'])],
        });
      }
    }

    const fused = this.reciprocalRankFusion(
      resultLists.map((list) => list.map((chunk) => this.getChunkKey(chunk.source, chunk.chunkId))),
    );

    const results: RagChunk[] = [];

    for (const [id, score] of fused.slice(0, k)) {
      const chunk = candidates.get(id);

      if (!chunk) {
        continue;
      }

      results.push({
        ...chunk,
        score,
        rrfScore: score,
      });
    }

    this.addTrace(trace, {
      title: 'MultiQuery fusion',
      description: `Результаты ${queries.length} запросов объединяются через RRF.`,
      output: queries,
      durationMs: this.elapsedMs(fusionStartedAt),
      chunks: results,
    });

    return results;
  }

  private async generateHypotheticalDocument(query: string) {
    const completion = await this.getClient().chat.completions.create({
      model: this.chatModel,
      max_completion_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Напиши короткий технический фрагмент документации (2-3 предложения), который напрямую отвечает на этот вопрос:\n${query}`,
        },
      ],
    });

    return completion.choices[0]?.message.content?.trim() || query;
  }

  private async generateQueryReformulations(query: string, count = 3) {
    const completion = await this.getClient().chat.completions.create({
      model: this.chatModel,
      max_completion_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Сгенерируй ${count} разных формулировок этого поискового запроса. По одной на строку, без нумерации:\n${query}`,
        },
      ],
    });
    const content = completion.choices[0]?.message.content ?? '';

    return content
      .split('\n')
      .map((line) => line.replace(/^\s*[-*\d.)]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, count);
  }

  private async rerank(query: string, candidates: RagChunk[], topK: number, trace?: RagTraceStep[]): Promise<RagChunk[]> {
    const startedAt = performance.now();

    if (candidates.length === 0) {
      return [];
    }

    if (process.env.RAG_RERANK_PROVIDER === 'heuristic') {
      const results = this.heuristicRerank(query, candidates, topK);
      this.addTrace(trace, {
        title: 'Heuristic rerank',
        description: 'Кандидаты переоценены локальной эвристикой по пересечению токенов.',
        query,
        durationMs: this.elapsedMs(startedAt),
        chunks: results,
      });
      return results;
    }

    try {
      const completion = await this.getClient().chat.completions.create({
        model: this.rerankModel,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a retrieval reranker. Score each candidate from 0 to 1 by direct usefulness for answering the query. Return only JSON: {"scores":[{"index":0,"score":0.0}]}',
          },
          {
            role: 'user',
            content: JSON.stringify({
              query,
              candidates: candidates.map((candidate, index) => ({
                index,
                source: candidate.source,
                text: candidate.text.slice(0, 1800),
              })),
            }),
          },
        ],
      });
      const content = completion.choices[0]?.message.content ?? '{}';
      const parsed = JSON.parse(content) as { scores?: Array<{ index?: number; score?: number }> };
      const scores = new Map<number, number>();

      for (const item of parsed.scores ?? []) {
        if (typeof item.index === 'number' && typeof item.score === 'number' && Number.isFinite(item.score)) {
          scores.set(item.index, Math.min(Math.max(item.score, 0), 1));
        }
      }

      if (scores.size === 0) {
        return this.heuristicRerank(query, candidates, topK);
      }

      const results = candidates
        .map((candidate, index) => ({
          ...candidate,
          score: scores.get(index) ?? 0,
          rerankScore: scores.get(index) ?? 0,
          retrieval: [...new Set([...(candidate.retrieval ?? []), 'rerank'])],
        }))
        .sort((left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0))
        .slice(0, topK);
      this.addTrace(trace, {
        title: 'LLM rerank',
        description: 'LLM переоценивает кандидатов по прямой полезности для ответа.',
        query,
        model: this.rerankModel,
        output: [...scores.entries()].map(([index, score]) => `#${index}: ${score.toFixed(3)}`),
        durationMs: this.elapsedMs(startedAt),
        chunks: results,
      });
      return results;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown rerank error';
      console.warn(`[rag] LLM rerank fallback: ${message}`);
      const results = this.heuristicRerank(query, candidates, topK);
      this.addTrace(trace, {
        title: 'Rerank fallback',
        description: `LLM rerank не сработал, использована локальная эвристика. Причина: ${message}`,
        query,
        durationMs: this.elapsedMs(startedAt),
        chunks: results,
      });
      return results;
    }
  }

  private heuristicRerank(query: string, candidates: RagChunk[], topK: number): RagChunk[] {
    const queryTokens = new Set(this.tokenize(query));

    return candidates
      .map((candidate) => {
        const candidateTokens = this.tokenize(candidate.text);
        const overlap = candidateTokens.filter((token) => queryTokens.has(token)).length;
        const coverage = queryTokens.size > 0 ? overlap / queryTokens.size : 0;
        const phraseBoost = candidate.text.toLowerCase().includes(query.toLowerCase()) ? 0.25 : 0;
        const rerankScore = Math.min(1, coverage + phraseBoost + (candidate.rrfScore ?? 0));

        return {
          ...candidate,
          score: rerankScore,
          rerankScore,
          retrieval: [...new Set([...(candidate.retrieval ?? []), 'rerank'])],
        };
      })
      .sort((left, right) => (right.rerankScore ?? 0) - (left.rerankScore ?? 0))
      .slice(0, topK);
  }

  private async retrieve(request: RagAskRequest) {
    const question = String(request.question ?? '').trim();
    const mode = this.normalizeMode(request.mode);
    const trace: RagTraceStep[] = [];

    if (!question) {
      throw new HttpException(
        {
          message: 'Question is required.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const limit = this.normalizeLimit(request.k);
    const threshold = this.normalizeThreshold(request.threshold);
    this.addTrace(trace, {
      title: 'Request',
      description: `Нормализован запрос. Mode: ${mode}, top-k: ${limit}, threshold: ${threshold}.`,
      query: question,
      durationMs: 0,
    });
    const retrievalStartedAt = performance.now();
    const chunks = await this.searchByMode(question, mode, limit, threshold, trace);
    const sources = [...new Set(chunks.map((chunk) => chunk.source))];
    this.addTrace(trace, {
      title: 'Final context',
      description: 'Эти чанки попадут в контекст ответа.',
      durationMs: this.elapsedMs(retrievalStartedAt),
      chunks,
    });

    return {
      question,
      mode,
      chunks,
      sources,
      trace,
    };
  }

  private async searchByMode(
    query: string,
    mode: RagSearchMode,
    k: number,
    threshold = DEFAULT_SCORE_THRESHOLD,
    trace?: RagTraceStep[],
  ) {
    if (mode === 'bm25') {
      return this.bm25Search(query, k, trace);
    }

    if (mode === 'sparse') {
      return this.qdrantSparseSearch(query, k, trace);
    }

    if (mode === 'hybrid') {
      return this.hybridSearch(query, k, HYBRID_CANDIDATE_LIMIT, trace);
    }

    if (mode === 'advanced') {
      return this.advancedSearch(query, k, trace);
    }

    if (mode === 'hyde') {
      return this.hydeSearch(query, k, trace);
    }

    if (mode === 'multiQuery') {
      return this.multiQuerySearch(query, k, trace);
    }

    await this.ensureCollection();
    return this.denseSearch(query, k, threshold, trace);
  }

  async evaluate(request: RagEvaluationRequest = {}): Promise<RagEvaluationResponse> {
    const k = this.normalizeLimit(request.k ?? 5);
    const dataset = this.normalizeEvaluationDataset(request.dataset);
    const cases = S21_DATASETS[dataset].cases;
    const rows: RagEvaluationRow[] = [];

    for (const testCase of cases) {
      const results: Record<string, string[]> = {};

      for (const method of EVALUATION_METHODS) {
        const chunks = await this.searchByMode(testCase.question, method.mode, k, 0);
        results[method.label] = chunks.map((chunk) => chunk.docId ?? chunk.source);
      }

      rows.push({
        question: testCase.question,
        relevantIds: [...testCase.relevantIds],
        note: testCase.note,
        results,
      });
    }

    const metrics = Object.fromEntries(
      EVALUATION_METHODS.map((method) => [method.label, this.calculateRetrievalMetrics(rows, method.label, k)]),
    ) as Record<string, RagEvaluationMetrics>;

    const markdown = this.buildEvaluationMarkdown(dataset, k, metrics, rows);
    await mkdir(dirname(this.resultsPath), { recursive: true });
    await writeFile(this.resultsPath, markdown, 'utf8');

    return {
      k,
      dataset,
      resultsPath: this.resultsPath,
      metrics,
      rows,
      markdown,
    };
  }

  private calculateRetrievalMetrics(rows: RagEvaluationRow[], method: string, k: number): RagEvaluationMetrics {
    if (rows.length === 0) {
      return {
        hitRate: 0,
        mrr: 0,
        precisionAtK: 0,
      };
    }

    let hitCount = 0;
    let reciprocalRankSum = 0;
    let precisionSum = 0;

    for (const row of rows) {
      const relevant = new Set(row.relevantIds);
      const retrieved = row.results[method] ?? [];
      const hits = retrieved.map((docId) => relevant.has(docId));
      const firstHit = hits.findIndex(Boolean);

      if (firstHit >= 0) {
        hitCount += 1;
        reciprocalRankSum += 1 / (firstHit + 1);
      }

      precisionSum += hits.filter(Boolean).length / k;
    }

    return {
      hitRate: this.roundMetric(hitCount / rows.length),
      mrr: this.roundMetric(reciprocalRankSum / rows.length),
      precisionAtK: this.roundMetric(precisionSum / rows.length),
    };
  }

  private roundMetric(value: number) {
    return Math.round(value * 1000) / 1000;
  }

  private elapsedMs(startedAt: number) {
    return Math.round((performance.now() - startedAt) * 10) / 10;
  }

  private buildEvaluationMarkdown(
    dataset: RagEvaluationDataset,
    k: number,
    metrics: Record<string, RagEvaluationMetrics>,
    rows: RagEvaluationRow[],
  ) {
    return [
      '# RAG evaluation',
      '',
      `Dataset: ${dataset}`,
      `k: ${k}`,
      '',
      '| Method | hit_rate | mrr | precision@k |',
      '|---|---:|---:|---:|',
      ...Object.entries(metrics).map(
        ([method, score]) =>
          `| ${method} | ${score.hitRate.toFixed(3)} | ${score.mrr.toFixed(3)} | ${score.precisionAtK.toFixed(3)} |`,
      ),
      '',
      `| Question | Relevant IDs | ${EVALUATION_METHODS.map((method) => method.label).join(' | ')} |`,
      `|---|---|${EVALUATION_METHODS.map(() => '---').join('|')}|`,
      ...rows.map((row) => {
        const relevant = new Set(row.relevantIds);
        const cells = EVALUATION_METHODS.map((method) => {
          const retrieved = row.results[method.label] ?? [];
          const hit = retrieved.some((docId) => relevant.has(docId));
          return hit ? 'hit' : 'miss';
        });

        return `| ${row.question} | ${row.relevantIds.join(', ')} | ${cells.join(' | ')} |`;
      }),
    ].join('\n');
  }

  private async generateAnswer(question: string, chunks: RagChunk[]) {
    const completion = await this.getClient().chat.completions.create({
      model: this.chatModel,
      messages: this.buildAnswerMessages(question, chunks),
    });

    return completion.choices[0]?.message.content?.trim() || FALLBACK_ANSWER;
  }

  private async *generateAnswerStream(question: string, chunks: RagChunk[]) {
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

  private buildAnswerMessages(question: string, chunks: RagChunk[]) {
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

  private addTrace(trace: RagTraceStep[] | undefined, step: Omit<RagTraceStep, 'chunks'> & { chunks?: RagChunk[] }) {
    if (!trace) {
      return;
    }

    trace.push({
      ...step,
      output: Array.isArray(step.output) ? step.output.slice(0, 8) : step.output,
      chunks: step.chunks?.slice(0, 5).map((chunk, index) => ({
        rank: index + 1,
        source: chunk.source,
        chunkId: chunk.chunkId,
        docId: chunk.docId,
        score: this.roundMetric(chunk.score),
        why: this.explainChunkSelection(chunk),
        text: chunk.text.slice(0, 320),
      })),
    });
  }

  private explainChunkSelection(chunk: RagChunk) {
    const retrieval = new Set(chunk.retrieval ?? []);
    const reasons: string[] = [];

    if (retrieval.has('dense') && retrieval.has('sparse')) {
      reasons.push('совпал по смыслу и по токенам');
    } else if (retrieval.has('dense')) {
      reasons.push('найден dense-поиском по смысловой близости');
    } else if (retrieval.has('sparse')) {
      reasons.push('найден Qdrant sparse по токенам запроса');
    } else if (retrieval.has('bm25')) {
      reasons.push('найден BM25 по точным токенам');
    }

    if (typeof chunk.rrfScore === 'number') {
      reasons.push('поднят RRF fusion после объединения выдач');
    }

    if (typeof chunk.rerankScore === 'number' || retrieval.has('rerank')) {
      reasons.push('переоценен reranker по полезности для вопроса');
    }

    if (retrieval.has('hyde')) {
      reasons.push('пришел из поиска по HyDE-документу');
    }

    if (retrieval.has('multiQuery')) {
      reasons.push('найден одной из MultiQuery-формулировок');
    }

    return reasons.length > 0 ? reasons : ['попал в top-k по итоговому score'];
  }

  private async loadDocuments(): Promise<SourceDocument[]> {
    const fileDocuments = await this.loadFileDocuments();
    const s21Documents = this.loadS21Documents();
    const documents = [...fileDocuments, ...s21Documents];

    if (documents.length === 0) {
      throw new HttpException(
        {
          message: `No documents found in ${this.docsDir}.`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return documents;
  }

  private async loadFileDocuments(): Promise<SourceDocument[]> {
    const entries = await readdir(this.docsDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();

    return Promise.all(
      files.map(async (file) => {
        const raw = await readFile(resolve(this.docsDir, file), 'utf8');
        const { text, date } = this.parseFrontMatter(raw);
        const source = `rag-docs/${basename(file)}`;

        return {
          docId: source,
          text,
          source,
          date,
        };
      }),
    );
  }

  private loadS21Documents(): SourceDocument[] {
    if (process.env.RAG_INCLUDE_S21_DATASETS === 'false') {
      return [];
    }

    return S21_DATASETS.full.documents.map((document) => ({
      docId: document.id,
      text: document.text,
      source: `s21/${document.id}`,
      date: '2026-06-08',
    }));
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

  private async getIndexedChunks(): Promise<IndexedChunk[]> {
    if (this.indexedChunks) {
      return this.indexedChunks;
    }

    const documents = await this.loadDocuments();
    const chunksByDocument = await Promise.all(
      documents.map(async (document) => ({
        document,
        chunks: await this.chunkText(document.text),
      })),
    );

    this.indexedChunks = chunksByDocument.flatMap(({ document, chunks }) =>
      chunks.map((text, chunkId) => ({
        id: this.getChunkKey(document.source, chunkId),
        docId: document.docId,
        text,
        source: document.source,
        date: document.date,
        chunkId,
      })),
    );

    return this.indexedChunks;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\s]+/gu, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  private getChunkKey(source: string, chunkId: number) {
    return `${source}::${chunkId}`;
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
          [DENSE_VECTOR_NAME]: {
            size: VECTOR_SIZE,
            distance: 'Cosine',
          },
        },
        sparse_vectors: {
          [SPARSE_VECTOR_NAME]: {
            index: {
              on_disk: false,
            },
          },
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

  private normalizeEvaluationDataset(value: unknown): RagEvaluationDataset {
    if (value === 'full') {
      return 'full';
    }

    return 'small';
  }

  private getQdrantPoints(response: QdrantQueryResponse): QdrantSearchPoint[] {
    return response.result?.points ?? [];
  }

  private createSparseVector(text: string): SparseVector {
    const frequencies = new Map<number, number>();

    for (const token of this.tokenize(text)) {
      const index = this.hashSparseToken(token);
      frequencies.set(index, (frequencies.get(index) ?? 0) + 1);
    }

    const entries = [...frequencies.entries()].sort((left, right) => left[0] - right[0]);
    const rawValues = entries.map(([, frequency]) => 1 + Math.log(frequency));
    const norm = Math.sqrt(rawValues.reduce((sum, value) => sum + value * value, 0)) || 1;

    return {
      indices: entries.map(([index]) => index),
      values: rawValues.map((value) => value / norm),
    };
  }

  private hashSparseToken(token: string) {
    let hash = 2166136261;

    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  private normalizeMode(value: unknown): RagSearchMode {
    if (
      value === 'bm25' ||
      value === 'sparse' ||
      value === 'hybrid' ||
      value === 'advanced' ||
      value === 'hyde' ||
      value === 'multiQuery' ||
      value === 'dense'
    ) {
      return value;
    }

    return 'dense';
  }
}
