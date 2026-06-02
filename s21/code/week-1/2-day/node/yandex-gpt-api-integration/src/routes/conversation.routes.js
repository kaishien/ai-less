import { Router } from 'express';
import MessageManager from '../services/MessageManager.js';
import { axiosInstance } from '../utils/axios.instance.js';
import { config } from '../config/server.config.js';

const router = Router();
const conversation = new MessageManager();

// GET / - Отображение истории диалога в виде HTML
router.get('/', (_, res) => {
    const htmlPage = `<!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>История диалога с YandexGPT</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            h1 {
                color: white;
                text-align: center;
                margin-bottom: 30px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .messages-container {
                background: white;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            }
            .message {
                padding: 15px;
                margin: 10px 0;
                border-radius: 8px;
                animation: fadeIn 0.5s ease-in;
            }
            .user-message {
                background: #e3f2fd;
                border-left: 4px solid #2196f3;
            }
            .assistant-message {
                background: #f3e5f5;
                border-left: 4px solid #9c27b0;
            }
            .role {
                font-weight: bold;
                text-transform: uppercase;
                font-size: 0.8em;
                margin-bottom: 5px;
            }
            .no-messages {
                text-align: center;
                color: #666;
                padding: 40px;
                font-style: italic;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>
    </head>
    <body>
        <h1>🤖 История диалога с YandexGPT</h1>
        <div class="messages-container">
            ${conversation.messages.length > 1 ?
            conversation.messages.map(message => {
                if (message.role === "system") {
                    return '';
                }
                const roleClass = message.role === "user" ? "user-message" : "assistant-message";
                const roleLabel = message.role === "user" ? "Вы" : "YandexGPT";
                return `
                        <div class="message ${roleClass}">
                            <div class="role">${roleLabel}:</div>
                            <div>${message.text}</div>
                        </div>
                    `;
            }).join("\n") :
            '<div class="no-messages">История диалога пуста. Отправьте POST запрос с сообщением по маршруту /conversation для начала работы.</div>'
        }
        </div>
    </body>
    </html>`;
    res.send(htmlPage);
});

// POST /conversation - Отправка сообщения и получение ответа от YandexGPT
router.post('/conversation', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({
            error: "Сообщение обязательно",
            code: "MISSING_MESSAGE"
        });
    }

    // Добавление сообщения пользователя в диалог
    conversation.addMessage({ role: "user", text: message });

    // Подготовка тела запроса для YandexGPT API
    const body = {
        modelUri: `gpt://${config.yandexGpt.catalogueId}/${config.yandexGpt.model}`,
        completionOptions: config.yandexGpt.completionOptions,
        messages: conversation.messages
    };

    try {
        // Вызов YandexGPT API
        const response = await axiosInstance.post("", body);
        const assistantResponse = response.data.result.alternatives[0].message;

        // Добавление ответа ассистента в диалог
        conversation.addMessage(assistantResponse);

        // Возврат ответа
        res.json({
            success: true,
            result: response.data.result,
            conversationLength: conversation.messages.length
        });
    } catch (err) {
        console.error("Ошибка от Yandex GPT:", err.response?.data || err.message);

        // Подробный ответ об ошибке
        res.status(500).json({
            error: "Не удалось получить ответ от Yandex GPT",
            code: "YANDEX_GPT_ERROR",
            details: err.response?.data || err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// POST /conversation/reset - Сброс истории диалога
router.post('/conversation/reset', (req, res) => {
    conversation.reset();
    res.json({
        success: true,
        message: "История диалога сброшена"
    });
});

// GET /conversation/history - Получение истории диалога в формате JSON
router.get('/conversation/history', (req, res) => {
    res.json({
        messages: conversation.messages.filter(m => m.role !== 'system'),
        totalMessages: conversation.messages.length - 1, // Исключая системное сообщение
        systemPrompt: conversation.messages[0]?.text || null
    });
});

export default router;
