// Сервер приложения (Express).
// Эта демка показывает базовую схему RAG:
// 1) загрузили текстовые файлы → 2) посчитали эмбеддинги и сохранили их в MemoryVectorStore →
// 3) на вопрос пользователя извлекаем релевантные фрагменты и добавляем их в промпт модели.
import express from 'express';
import path from 'path';
import { serverConfig } from './config/serverConfig.js';
import { router } from './routes/index.js';

// Загружаем переменные окружения из корня проекта
process.loadEnvFile(path.join(process.cwd(), '.env'));

// Инициализация Express и порта
const app = express();
const PORT = process.env.PORT ?? 4000;

// Подключаем middleware и статику (см. config/serverConfig.js)
serverConfig(app);

// Основной роутер приложения (страница, загрузка, чат, файлы)
app.use('/', router);

app.listen(PORT, () => {
    // Базовая диагностическая информация при старте
    console.log(`Сервер запущен на порту: ${PORT}`);
    console.log(`Откройте http://localhost:${PORT} в браузере`);
    console.log(`GigaChat API: ${process.env.GIGACHAT_API_KEY ? 'Настроен' : 'Не настроен'}`);
});
