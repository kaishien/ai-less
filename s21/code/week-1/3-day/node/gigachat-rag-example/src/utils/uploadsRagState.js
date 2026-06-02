import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import { rebuildVectorStoreFromTextFiles, resetVectorStore } from './vectorStore.js';

// Папка для загруженных файлов.
// В этой демке мы сохраняем исходные файлы на диск, чтобы переживать перезапуск сервера.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

export const uploadsDir = path.join(projectRoot, 'uploads');

export function isTextFileByName(name) {
    // Простая проверка по расширению файла.
    // Это намеренно грубо: для полноценного решения лучше использовать mime-type и/или парсеры форматов.
    return /\.(txt|md|markdown|csv|tsv|json|log)$/i.test(name || '');
}

function safeStat(p) {
    try {
        return fs.statSync(p);
    } catch {
        return null;
    }
}

export function loadUploadedFilesFromDisk(uploadedFiles) {
    // Синхронно читаем папку uploads/ и восстанавливаем список файлов в памяти процесса.
    // Это нужно UI (список файлов) и индексу (пересборка из текстов).
    uploadedFiles.clear();

    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
    } catch { }

    let entries = [];
    try {
        entries = fs.readdirSync(uploadsDir, { withFileTypes: true });
    } catch {
        entries = [];
    }

    for (const e of entries) {
        if (!e.isFile()) continue;
        const filename = e.name;
        const fullPath = path.join(uploadsDir, filename);
        const st = safeStat(fullPath);
        if (!st) continue;

        uploadedFiles.set(filename, {
            path: fullPath,
            originalName: filename,
            size: st.size,
            uploadedAt: st.mtime
        });
    }
}

export async function rebuildIndexFromUploadedFiles(uploadedFiles) {
    // Пересобираем RAG-индекс из текущего набора файлов.
    // Важно: мы читаем содержимое файлов в UTF-8 и индексируем только “текстовые” по расширению.
    const remaining = [];

    for (const [fid, info] of uploadedFiles.entries()) {
        if (!isTextFileByName(info.originalName)) continue;
        try {
            const content = fs.readFileSync(info.path, 'utf-8');
            remaining.push({ fileId: fid, originalName: info.originalName, content });
        } catch { }
    }

    if (remaining.length > 0) {
        await rebuildVectorStoreFromTextFiles(remaining);
    } else {
        resetVectorStore();
    }
}

export async function hydrateUploadedFilesAndIndex(uploadedFiles) {
    // Полная гидратация: сначала список файлов, затем RAG-индекс.
    loadUploadedFilesFromDisk(uploadedFiles);
    await rebuildIndexFromUploadedFiles(uploadedFiles);
}
