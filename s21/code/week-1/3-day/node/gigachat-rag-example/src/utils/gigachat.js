import GigaChat from 'gigachat';
import { Agent } from 'node:https';
import path from 'node:path';

process.loadEnvFile(path.join(process.cwd(), '.env'));

// HTTPS agent для GigaChat
export const httpsAgent = new Agent({
    // В учебных/корпоративных окружениях у GigaChat может быть “своя” цепочка сертификатов,
    // поэтому часто отключают проверку TLS. В production так делать нельзя.
    rejectUnauthorized: false,
    keepAlive: true,
});

// GigaChat клиент
export const gigaChatClient = new GigaChat({
    timeout: 3000,
    model: 'GigaChat-Max',
    credentials: process.env.GIGACHAT_API_KEY,
    httpsAgent,
});

// Форматирование ошибки GigaChat
export function formatGigaChatError(err) {
    const code = err?.code || err?.cause?.code;
    const msg = err?.message || String(err);

    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
        return `${msg} (network timeout). Проверьте доступ к GigaChat из вашей сети или увеличьте GIGACHAT_TIMEOUT_MS.`;
    }
    if (code === 'ECONNRESET' || code === 'ECONNREFUSED') {
        return `${msg} (network error: ${code}). Проверьте сеть/прокси/VPN и доступ к GigaChat.`;
    }
    return msg;
}
