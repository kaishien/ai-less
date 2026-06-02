import path from 'path';
import express from 'express';
import { upload } from '../config/serverConfig.js';
import { FileService } from '../services/index.js';
import { FileController, ChatController } from '../controllers/index.js';
import { fileURLToPath } from 'url';

// Маршруты для работы с файлами и чатом
export const router = express.Router();

// В ESM нет __dirname по умолчанию — вычисляем его вручную
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Маршрут для главной страницы
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});

// Чат: формируем RAG-контекст и отправляем запрос в GigaChat
router.post('/chat', ChatController.chat);

// Загрузка одного файла. Индексируем только текстовые форматы. Остальные просто храним.
router.post('/upload', upload.single('file'), FileController.upload);
// Маршрут для получения списка загруженных файлов
router.get('/files', FileController.list);
// Удаление файла: удаляем физически и пересобираем/сбрасываем индекс
router.delete('/files/:filename', FileController.delete);