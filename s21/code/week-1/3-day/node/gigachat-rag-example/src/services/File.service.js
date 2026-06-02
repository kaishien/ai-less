import fs from 'node:fs';
import { removeFileFromVectorStore, addFileToVectorStore } from '../utils/vectorStore.js';
import { hydrateUploadedFilesAndIndex, rebuildIndexFromUploadedFiles } from '../utils/uploadsRagState.js';

export class FileService {
    static async hydrate(uploadedFiles) {
        // Поднимаем состояние из папки uploads/:
        // - читаем список файлов на диске
        // - пересобираем RAG-индекс эмбеддингов из текстовых файлов
        await hydrateUploadedFilesAndIndex(uploadedFiles);
        return uploadedFiles;
    }

    static registerUploadedFile(uploadedFiles, file) {
        // Сохраняем метаданные в памяти процесса, чтобы UI мог показать список файлов.
        // Сами файлы уже сохранены на диск через Multer.
        uploadedFiles.set(file.filename, {
            path: file.path,
            originalName: file.originalname,
            size: file.size,
            uploadedAt: new Date()
        });
    }

    static isTextUpload(file) {
        // Индексируем только текстовые типы (иначе не сможем корректно прочитать файл в utf-8)
        return !!(
            (file.mimetype && file.mimetype.startsWith('text/')) ||
            /\.(txt|md|markdown|csv|tsv|json|log)$/i.test(file.originalname)
        );
    }

    static async indexUploadedTextFile(file) {
        // Читаем файл как UTF-8 и добавляем в векторный индекс
        const fileContent = fs.readFileSync(file.path, 'utf-8');
        await addFileToVectorStore({
            fileId: file.filename,
            originalName: file.originalname,
            content: fileContent
        });
    }

    static list(uploadedFiles) {
        return Array.from(uploadedFiles.entries()).map(([filename, fileInfo]) => ({
            filename,
            originalName: fileInfo.originalName,
            size: fileInfo.size,
            uploadedAt: fileInfo.uploadedAt
        }));
    }

    static async delete(uploadedFiles, filename) {
        if (!uploadedFiles.has(filename)) {
            return { error: 'not_found' };
        }

        const fileInfo = uploadedFiles.get(filename);

        try {
            // Сначала удаляем файл с диска
            fs.unlinkSync(fileInfo.path);
        } catch (error) {
            return { error: 'unlink_failed', details: error?.message };
        }

        // Затем удаляем из индекса и метаданных
        removeFileFromVectorStore(filename);
        uploadedFiles.delete(filename);

        // MemoryVectorStore не умеет “точечное” удаление — пересобираем индекс из оставшихся файлов
        await rebuildIndexFromUploadedFiles(uploadedFiles);

        return { deleted: true };
    }
}