import { config } from '../config/server.config.js';

// Валидация конфигурации
export const validateConfig = () => {
    const required = {
        'YANDEX_API_KEY': config.yandexGpt.apiKey,
        'YANDEX_CATALOGUE_ID': config.yandexGpt.catalogueId
    };

    const missing = Object.entries(required)
        .filter(([key, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        throw new Error(`Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`);
    }

    return true;
};