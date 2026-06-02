import { retrieveRelevant } from '../utils/vectorStore.js';
import { gigaChatClient } from '../utils/gigachat.js';

export class ChatService {
    static async answer({ message }) {
        // 1) Retrieval: ищем наиболее релевантные фрагменты по эмбеддингу запроса
        const topDocs = await retrieveRelevant(message, 6);

        // 2) Формируем контекст, который “подкладываем” модели перед вопросом пользователя.
        // В демо мы просим отвечать строго по этому контексту и указывать источник.
        const context = topDocs.length
            ? `Ниже приведены выдержки из базы знаний (могут быть неполными). Отвечай строго на их основе, ссылаясь на файл и номер фрагмента.
${topDocs.map(d => `— [${d.metadata.originalName} #${d.metadata.chunkIndex + 1}] ${d.text}`).join('\n\n')}`
            : '';

        // 3) Если контекста нет — отправляем вопрос как есть.
        const userContent = context
            ? `${context}\n\nВопрос пользователя: ${message}\n\nЕсли ответа нет в контексте, скажи, что в контексте нет информации.`
            : message;

        // 4) Generation: просим модель сгенерировать ответ с учётом контекста.
        const response = await gigaChatClient.chat({
            messages: [{ role: 'user', content: userContent }],
        });

        const aiResponse = response.choices[0]?.message.content || 'Не удалось получить ответ';

        return {
            response: aiResponse,
            usedChunks: topDocs.length,
        };
    }
}