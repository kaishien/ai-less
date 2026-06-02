import fs from 'node:fs';
import express from 'express';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { filesHydrateMiddleware } from '../middleware/filesHydrateMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..');

const uploadsDir = path.join(projectRoot, 'uploads');
const publicDir = path.join(projectRoot, 'src', 'public');

// Настройка хранилища Multer: сохраняем в папку uploads/ и добавляем уникальный суффикс
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            fs.mkdirSync(uploadsDir, { recursive: true });
        } catch { }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

export const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB лимит на размер файла
    }
});

export function serverConfig(app) {
    // Парсинг JSON и urlencoded-данных из запросов
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Поднимаем состояние (uploads + RAG-индекс) один раз лениво, затем только прокидываем ссылку.
    app.use(filesHydrateMiddleware);

    // Гарантируем наличие папки uploads/ (нужна для RAG)
    try {
        fs.mkdirSync(uploadsDir, { recursive: true });
    } catch { }

    // Раздача статических файлов (CSS/JS/изображения) из папки public
    app.use(express.static(publicDir));
}
