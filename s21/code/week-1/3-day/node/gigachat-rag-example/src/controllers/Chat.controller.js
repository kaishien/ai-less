import { ChatService } from '../services/index.js';
import { formatGigaChatError } from '../utils/gigachat.js';

export class ChatController {
    static async chat(req, res) {
        const { message } = req.body;
        const { uploadedFiles } = res.locals;

        if (!message) {
            return res.status(400).json({ error: 'Сообщение не может быть пустым' });
        }

        try {
            const data = await ChatService.answer({ message });
            return res.json({
                response: data.response,
                contextUsed: uploadedFiles.size > 0
            });
        } catch (error) {
            console.error('Ошибка при обращении к GigaChat:', error);
            return res.status(500).json({
                error: 'Ошибка при обработке запроса: ' + formatGigaChatError(error)
            });
        }
    }
}