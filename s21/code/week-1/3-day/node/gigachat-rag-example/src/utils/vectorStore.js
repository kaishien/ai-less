import { gigaChatClient } from './gigachat.js';
import { Document } from '@langchain/core/documents';

class SimpleMemoryVectorStore {
    // Простое in-memory хранилище эмбеддингов:
    // - docs[] хранит исходные текстовые фрагменты (чанки)
    // - vectors[] хранит эмбеддинги этих фрагментов
    // Важно: это демо-реализация, при перезапуске процесса всё в памяти сбрасывается.
    constructor(embeddings) {
        this.embeddings = embeddings;
        this.docs = [];
        this.vectors = [];
    }

    static async fromDocuments(docs, embeddings) {
        const s = new SimpleMemoryVectorStore(embeddings);
        await s.addDocuments(docs);
        return s;
    }

    async addDocuments(docs) {
        if (!Array.isArray(docs) || docs.length === 0) return;
        const texts = docs.map(d => d.pageContent ?? '');
        // Получаем эмбеддинги пачкой — так быстрее и дешевле, чем по одному тексту.
        const vectors = await this.embeddings.embedDocuments(texts);
        for (let i = 0; i < docs.length; i++) {
            const v = vectors[i];
            if (!Array.isArray(v) || v.length === 0) continue;
            this.docs.push(docs[i]);
            this.vectors.push(v);
        }
    }

    asRetriever(k = 6) {
        return {
            getRelevantDocuments: async (query) => {
                if (!this.docs.length) return [];
                // Эмбеддинг запроса → косинусная близость к каждому вектору → сортировка → top-k
                const q = await this.embeddings.embedQuery(query);
                const scored = this.vectors.map((v, i) => ({
                    i,
                    score: cosineSimilarity(q, v)
                }));
                scored.sort((a, b) => b.score - a.score);
                const top = scored.slice(0, Math.max(1, k));
                return top.map(x => this.docs[x.i]);
            }
        };
    }
}

function cosineSimilarity(a, b) {
    // Косинусная близость: чем ближе к 1, тем более похожи вектора.
    const n = Math.min(a?.length ?? 0, b?.length ?? 0);
    if (n === 0) return -1;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < n; i++) {
        const av = a[i];
        const bv = b[i];
        dot += av * bv;
        na += av * av;
        nb += bv * bv;
    }
    if (na === 0 || nb === 0) return -1;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Адаптер эмбеддингов GigaChat под интерфейс LangChain
class GigaChatEmbeddingsAdapter {
    // embedDocuments - эмбеддинг документов
    async embedDocuments(texts) {
        // GigaChat embeddings ожидает массив строк
        const response = await gigaChatClient.embeddings(texts);
        return response.data.map(item => item.embedding);
    }
    // embedQuery - эмбеддинг запроса
    async embedQuery(text) {
        const response = await gigaChatClient.embeddings([text]);
        return response.data[0].embedding;
    }
}

const embeddings = new GigaChatEmbeddingsAdapter();

// Текущее векторное хранилище в памяти процесса
let store = null; // SimpleMemoryVectorStore в ОЗУ

// Соответствие fileId -> список сформированных docId (для служебных задач)
const fileIdToDocIds = new Map();

// Функция для сброса векторного хранилища
export function resetVectorStore() {
    store = null;
    fileIdToDocIds.clear();
}

// Функция для добавления файла в векторное хранилище
export async function addFileToVectorStore(params) {
    const { fileId, originalName, content } = params;
    if (!content || typeof content !== 'string') return [];

    // Нарезаем текст на фрагменты с overlap, добавляем метаданные
    const chunks = chunkText(content, 1200, 200);
    const docs = chunks.map((c, i) => new Document({
        pageContent: c,
        metadata: { fileId, originalName, chunkIndex: i }
    }));

    // Если векторное хранилище не инициализировано, инициализируем его
    if (!store) {
        store = await SimpleMemoryVectorStore.fromDocuments(docs, embeddings);
        const ids = docs.map((_, i) => `${fileId}:${i}`);
        fileIdToDocIds.set(fileId, ids);
        return ids;
    }

    // MemoryVectorStore не хранит ID — эмулируем индексацию дозаписью
    await store.addDocuments(docs);
    const startIndex = (fileIdToDocIds.get(fileId)?.length || 0);
    const ids = docs.map((_, i) => `${fileId}:${startIndex + i}`);
    fileIdToDocIds.set(fileId, ids);
    return ids;
}

// Функция для поиска релевантных фрагментов
export async function retrieveRelevant(query, k = 6) {
    if (!store) return [];
    // Создаем retriever для поиска релевантных фрагментов
    const retriever = store.asRetriever(k);
    // Получаем релевантные фрагменты
    const docs = await retriever.getRelevantDocuments(query);
    // Возвращаем унифицированный формат
    return docs.map(d => ({
        text: d.pageContent,
        metadata: d.metadata || {}
    }));
}

// Функция для удаления файла из векторного хранилища
export function removeFileFromVectorStore(fileId) {
    // MemoryVectorStore не поддерживает удаление по ID
    // Выполним полную пересборку/сброс, исключив документы файла
    if (!store) return;
    if (!fileIdToDocIds.has(fileId)) return;
    fileIdToDocIds.delete(fileId);
    // Перечитывать исходные тексты негде — выполняем сброс индекса.
    store = null;
}

// Функция для пересборки векторного хранилища из текстовых файлов
export async function rebuildVectorStoreFromTextFiles(files) {
    // files: Array<{ fileId: string, originalName: string, content: string }>
    const docs = [];
    for (const f of files) {
        const chunks = chunkText(f.content, 1200, 200);
        for (let i = 0; i < chunks.length; i++) {
            docs.push(new Document({
                pageContent: chunks[i],
                metadata: { fileId: f.fileId, originalName: f.originalName, chunkIndex: i }
            }));
        }
    }
    if (docs.length === 0) {
        resetVectorStore();
        return;
    }
    store = await SimpleMemoryVectorStore.fromDocuments(docs, embeddings);
}

// Функция для нарезания текста на фрагменты с overlap
function chunkText(text, maxLen, overlap) {
    // Нормализуем переносы строк и режем по абзацам, затем по длине с overlap
    const normalized = text.replace(/\r\n/g, '\n');
    const paragraphs = normalized.split(/\n\n+/);
    const chunks = [];
    let buffer = '';

    for (const p of paragraphs) {
        const piece = p.trim();
        if (!piece) continue;
        if ((buffer + '\n\n' + piece).length <= maxLen) {
            buffer = buffer ? buffer + '\n\n' + piece : piece;
            continue;
        }
        if (buffer) chunks.push(buffer);
        // Если абзац очень большой — нарезаем дополнительно
        if (piece.length > maxLen) {
            const parts = splitByLength(piece, maxLen, overlap);
            chunks.push(...parts);
            buffer = '';
        } else {
            buffer = piece;
        }
    }
    if (buffer) chunks.push(buffer);

    // Доводим чанки до нужной длины с overlap при необходимости
    const finalChunks = [];
    for (const c of chunks) {
        if (c.length <= maxLen) {
            finalChunks.push(c);
        } else {
            finalChunks.push(...splitByLength(c, maxLen, overlap));
        }
    }
    return finalChunks;
}

// Функция для нарезания текста на отрезки с заданным overlap
function splitByLength(text, maxLen, overlap) {
    // Последовательное нарезание строки на отрезки с заданным overlap
    const res = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(text.length, start + maxLen);
        res.push(text.slice(start, end));
        if (end === text.length) break;
        start = end - overlap;
        if (start < 0) start = 0;
    }
    return res;
}


