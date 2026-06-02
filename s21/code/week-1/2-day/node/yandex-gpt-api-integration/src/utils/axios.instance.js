import axios from "axios";
import { config } from '../config/server.config.js';

export const axiosInstance = axios.create({
    baseURL: config.yandexGpt.modelUrl,
    headers: {
        Authorization: `Api-Key ${config.yandexGpt.apiKey}`,
        "Content-Type": "application/json"
    },
});

// Перехватчик запросов для логирования
axiosInstance.interceptors.request.use(
    (request) => {
        if (config.server.env === 'development') {
            console.log('📤 API Запрос:', {
                method: request.method?.toUpperCase(),
                url: request.url,
                timestamp: new Date().toISOString()
            });
        }
        return request;
    },
    (error) => {
        console.error('❌ Ошибка запроса:', error);
        return Promise.reject(error);
    }
);

// Перехватчик ответов для логирования
axiosInstance.interceptors.response.use(
    (response) => {
        if (config.server.env === 'development') {
            console.log('📥 API Ответ:', {
                status: response.status,
                statusText: response.statusText,
                timestamp: new Date().toISOString()
            });
        }
        return response;
    },
    (error) => {
        console.error('❌ Ошибка ответа:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            timestamp: new Date().toISOString()
        });
        return Promise.reject(error);
    }
);
