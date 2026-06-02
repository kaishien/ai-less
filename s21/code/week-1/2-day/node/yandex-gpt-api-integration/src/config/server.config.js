import dotenv from 'dotenv';
import express from 'express';
import { corsMiddleware } from '../middlewares/cors.middleware.js';
import { logMiddleware } from '../middlewares/log.middleware.js';

dotenv.config();

export const config = {
    // Конфигурация сервера
    server: {
        port: process.env.PORT || 3000,
        env: process.env.NODE_ENV || 'development'
    },

    // Конфигурация YandexGPT
    yandexGpt: {
        apiKey: process.env.YANDEX_API_KEY,
        catalogueId: process.env.YANDEX_CATALOGUE_ID,
        modelUrl: process.env.YANDEX_MODEL_URL || 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        model: process.env.YANDEX_MODEL || 'yandexgpt',

        // Параметры генерации
        completionOptions: {
            stream: false,
            temperature: parseFloat(process.env.TEMPERATURE) || 0.3, // Температура генерации (креативность)
            maxTokens: parseInt(process.env.MAX_TOKENS) || 1024 // Максимальное кол-во токенов в ответе
        }
    },

    // Настройки приложения
    app: {
        corsEnabled: process.env.CORS_ENABLED === 'true',
        logLevel: process.env.LOG_LEVEL || 'info'
    }
};

export const serverConfig = (app) => {
    if (config.app.corsEnabled) {
        app.use(corsMiddleware);
    }
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(logMiddleware);
}