import express from 'express';
import conversationRoutes from './routes/conversation.routes.js';
import { config, serverConfig } from './config/server.config.js';
import { errorMiddleware } from './middlewares/error.middleware.js';

// Создание Express приложения
const app = express();

// Настройка сервера
serverConfig(app);

// Эндпоинт проверки состояния
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: config.server.env,
        version: process.env.npm_package_version || '0.1.0'
    });
});

// Эндпоинт информации об API
app.get('/api/info', (req, res) => {
    res.json({
        name: 'YandexGPT Node.js Server',
        version: process.env.npm_package_version || '0.1.0',
        endpoints: [
            { method: 'GET', path: '/', description: 'Просмотр истории диалога (HTML)' },
            { method: 'GET', path: '/health', description: 'Проверка состояния' },
            { method: 'GET', path: '/api/info', description: 'Информация об API' },
            { method: 'POST', path: '/conversation', description: 'Отправить сообщение в YandexGPT' },
            { method: 'POST', path: '/conversation/reset', description: 'Сбросить историю диалога' },
            { method: 'GET', path: '/conversation/history', description: 'Получить историю диалога (JSON)' }
        ],
        model: config.yandexGpt.model,
        environment: config.server.env
    });
});

// Подключение маршрутов диалогов
app.use('/', conversationRoutes);

// Обработчик 404 ошибки
app.use((req, res) => {
    res.status(404).json({
        error: 'Не найдено',
        message: `Запрашиваемый ресурс ${req.path} не найден`,
        timestamp: new Date().toISOString()
    });
});

// Middleware для обработки ошибок
app.use(errorMiddleware);

export default app;
