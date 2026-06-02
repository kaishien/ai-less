import systemRoles from "../config/prompts.json" with { type: "json" }

/**
 * Класс для управления историей диалога с YandexGPT
 */
class MessageManager {
    #messages = [];

    constructor() {
        // Инициализация массива сообщений с системным промптом
        this.#messages = [
            {
                "role": "system",
                "text": systemRoles.mentor
            }
        ]
    }

    /**
     * Получить все сообщения диалога
     * @returns {Array} Массив сообщений
     */
    get messages() {
        return this.#messages
    }

    /**
     * Добавить новое сообщение в диалог
     * @param {Object} message - Объект сообщения с полями role и text
     */
    addMessage(message) {
        this.#messages.push(message)
    }

    /**
     * Сбросить историю диалога, оставив только системное сообщение
     */
    reset() {
        // Оставляем только первое (системное) сообщение
        this.#messages = this.#messages.slice(0, 1)
    }
}

export default MessageManager