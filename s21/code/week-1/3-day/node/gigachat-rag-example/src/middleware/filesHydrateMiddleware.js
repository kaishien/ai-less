import { FileService } from '../services/index.js';

// Временное хранилище метаданных загруженных файлов в памяти процесса.
// ВАЖНО: в продакшен-проекте такие данные обычно хранятся в БД, но для демо это ок.
export const uploadedFiles = new Map();

// Гидратация (поднятие состояния из uploads/ + пересборка индекса) должна выполняться
// один раз при старте процесса, а не на каждый HTTP-запрос.
let hydratePromise = null;

async function ensureHydratedOnce() {
    if (!hydratePromise) {
        hydratePromise = FileService.hydrate(uploadedFiles);
    }
    return hydratePromise;
}

// Прокидываем uploadedFiles в res.locals для контроллеров.
export async function filesHydrateMiddleware(req, res, next) {
    res.locals.uploadedFiles = await ensureHydratedOnce();
    next();
}