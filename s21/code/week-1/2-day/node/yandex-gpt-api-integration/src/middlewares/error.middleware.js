import { config } from '../config/server.config.js';

export const errorMiddleware = (err, req, res, next) => {
    console.error('Ошибка:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Внутренняя ошибка сервера',
        code: err.code || 'SERVER_ERROR',
        timestamp: new Date().toISOString(),
        ...(config.server.env === 'development' && { stack: err.stack })
    });
}