import app from './app.js';
import { config } from './config/server.config.js';
import { validateConfig } from './validators/config.validator.js';

// Валидация конфигурации перед запуском
try {
    validateConfig();
} catch (error) {
    console.error('❌ Ошибка конфигурации:', error.message);
    console.error('Пожалуйста, проверьте ваш .env файл и убедитесь, что все необходимые переменные установлены.');
    process.exit(1);
}

// Запуск сервера
const PORT = config.server.port;

app.listen(PORT, (err) => {
    if (err) {
        console.error('❌ Не удалось запустить сервер:', err.message);
        process.exit(1);
    }

    console.log(`
    🚀 Информация о сервере:
    • Порт: ${PORT}
    • Окружение: ${config.server.env}
    • Модель: ${config.yandexGpt.model}
    • URL API: http://localhost:${PORT}

    📍 Доступные маршруты:
    • GET  / - Просмотр истории диалога
    • GET  /health - Проверка состояния
    • GET  /api/info - Информация об API
    • POST /conversation - Отправить сообщение YandexGPT
    • POST /conversation/reset - Сбросить диалог
    • GET  /conversation/history - Получить историю (JSON)
    
    📝 Документация: Смотрите README.md для подробного использования

    Нажмите Ctrl+C для остановки сервера...
    `);
});